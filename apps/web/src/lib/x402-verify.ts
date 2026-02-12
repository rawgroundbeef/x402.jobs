/**
 * Shared x402 verification utility
 *
 * Uses x402check's check() API for unified extraction, validation, and registry lookups.
 * Bridges x402check's CAIP-2 network format to the app's v1 names via normalizeNetworkId().
 */

import { check } from "x402check";
import type { CheckResult } from "x402check";
import { normalizeNetworkId } from "@/lib/networks";

// ============================================================================
// Shared types (previously duplicated in both modals)
// ============================================================================

export interface AcceptOption {
  network: string;
  normalizedNetwork: string;
  payTo: string;
  amount: string;
  asset?: string;
  scheme?: string;
  extra?: Record<string, unknown>;
}

export interface VerifiedResource {
  description?: string;
  network?: string;
  payTo?: string;
  maxAmountRequired?: string;
  asset?: string;
  mimeType?: string;
  maxTimeoutSeconds?: number;
  outputSchema?: {
    input?: {
      type?: string;
      method?: string;
      bodyType?: string;
      bodyFields?: Record<
        string,
        { type: string; required?: boolean; description?: string }
      >;
      queryParams?: Record<
        string,
        { type: string; required?: boolean; description?: string }
      >;
    };
    output?: Record<string, unknown>;
  };
  extra?: {
    serviceName?: string;
    agentName?: string;
    avatarUrl?: string;
    [key: string]: unknown;
  };
  serviceName?: string;
  agentName?: string;
  avatarUrl?: string;
  isA2A?: boolean;
}

export interface VerifyResponse {
  valid: boolean;
  x402Version?: number;
  accepts?: AcceptOption[];
  service?: { name?: string; description?: string; website?: string };
  resource: VerifiedResource;
  server: ServerPreview;
  warnings?: string[];
  normalizedUrl?: string;
  detectedMethod?: string;
  /** Detailed check result from x402check — present for proxy-format responses */
  checkResult?: CheckResult;
}

export interface ServerPreview {
  exists: boolean;
  id: string | null;
  slug: string | null;
  name: string;
  originUrl: string;
  faviconUrl: string | null;
  resourceCount: number;
}

// ============================================================================
// Proxy response shape (new slim backend format)
// ============================================================================

export interface ProxyVerifyResponse {
  status: number;
  body: unknown;
  headers: Record<string, string>;
  detectedMethod: string;
  server: ServerPreview;
}

// ============================================================================
// A2A detection (moved from backend resources.ts)
// ============================================================================

export function detectA2A(
  outputSchema: VerifiedResource["outputSchema"],
): boolean {
  const bodyFields = outputSchema?.input?.bodyFields || {};

  // Check for jsonrpc field
  const hasJsonRpc = "jsonrpc" in bodyFields;
  if (!hasJsonRpc) return false;

  // Check for method field with A2A methods
  const methodField = bodyFields.method as
    | { type: string; enum?: string[] }
    | undefined;
  const hasA2AMethod =
    methodField?.enum?.some(
      (m: string) =>
        m === "message:send" ||
        m === "message:stream" ||
        m === "message/send" ||
        m === "message/stream",
    ) || false;
  if (!hasA2AMethod) return false;

  // Check for params with nested message structure
  const paramsField = bodyFields.params;
  const hasParamsMessage =
    paramsField && typeof paramsField === "object" && "message" in paramsField;

  return !!hasParamsMessage;
}

// ============================================================================
// Response processing pipeline
// ============================================================================

/**
 * Process a verify response from the backend.
 * Supports BOTH response formats:
 * - Legacy: backend does all extraction/validation, returns VerifyResponse directly
 * - Proxy: backend returns raw body/headers, we extract/validate here using x402check
 */
export function processVerifyResponse(
  data: unknown,
  inputUrl: string,
): VerifyResponse {
  const obj = data as Record<string, unknown>;

  // Detect proxy format: has `status` and `body` fields (no `valid` field)
  if ("status" in obj && "body" in obj && !("valid" in obj)) {
    return processProxyResponse(
      obj as unknown as ProxyVerifyResponse,
      inputUrl,
    );
  }

  // Legacy format: already a VerifyResponse, pass through
  return data as VerifyResponse;
}

/**
 * Process a proxy-format response using x402check's unified check() API.
 *
 * No longer throws on invalid configs — returns VerifyResponse with valid: false
 * and the full checkResult for the UI to display detailed errors/warnings.
 */
function processProxyResponse(
  proxy: ProxyVerifyResponse,
  inputUrl: string,
): VerifyResponse {
  // Unified check: extract + validate + registry lookups in one call
  const result = check({
    body: proxy.body,
    headers: proxy.headers,
  });

  // Extraction failure — no config found at all
  if (!result.extracted) {
    return {
      valid: false,
      resource: {},
      server: proxy.server,
      checkResult: result,
      warnings: [
        result.extractionError || "No x402 config found in 402 response",
      ],
    };
  }

  const rawConfig = result.raw as Record<string, unknown>;
  const warnings: string[] = [];

  // Surface x402check warnings (advisory, non-blocking)
  for (const w of result.warnings) {
    if (!warnings.includes(w.message)) {
      warnings.push(w.message);
    }
  }

  // If invalid, return early with checkResult for detailed UI display
  if (!result.valid) {
    return {
      valid: false,
      x402Version: (rawConfig.x402Version as number) || 1,
      resource: {},
      server: proxy.server,
      checkResult: result,
      detectedMethod: proxy.detectedMethod,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  // Build accepts from normalized config or raw data
  const accepts = result.normalized?.accepts || (rawConfig.accepts as any[]) || [];
  const rawAccepts = (rawConfig.accepts as any[]) || [rawConfig];

  // URL normalization
  const firstAccept = rawAccepts[0] || {};
  const canonicalUrl =
    firstAccept.resource?.url || (rawConfig.resource as any)?.url;
  let normalizedUrl: string | undefined;
  if (canonicalUrl && canonicalUrl !== inputUrl) {
    const urlWithoutProtocol = inputUrl
      .replace(/^https?:\/\//, "")
      .toLowerCase();
    const canonicalWithoutProtocol = canonicalUrl
      .replace(/^https?:\/\//, "")
      .toLowerCase();
    if (urlWithoutProtocol === canonicalWithoutProtocol) {
      normalizedUrl = canonicalUrl;
    } else {
      warnings.push(
        `URL mismatch: you provided "${inputUrl}" but 402 response declares "${canonicalUrl}". Using your URL.`,
      );
    }
  }

  // Map accepts to AcceptOption format with network normalization
  const acceptsFormatted: AcceptOption[] = accepts.map((a: any) => ({
    network: a.network,
    normalizedNetwork: normalizeNetworkId(a.network || "solana") || "solana",
    payTo: a.payTo || a.pay_to,
    amount: a.amount,
    asset: a.asset,
    scheme: a.scheme,
    extra: a.extra,
  }));

  // Filter to supported networks
  const supportedAccepts = acceptsFormatted.filter(
    (a) => a.normalizedNetwork === "solana" || a.normalizedNetwork === "base",
  );

  if (supportedAccepts.length === 0 && acceptsFormatted.length > 0) {
    const networks = acceptsFormatted.map((a) => a.network).join(", ");
    return {
      valid: false,
      x402Version: (rawConfig.x402Version as number) || 1,
      resource: {},
      server: proxy.server,
      checkResult: result,
      detectedMethod: proxy.detectedMethod,
      warnings: [
        `Unsupported network(s): ${networks}. We currently only support Solana and Base networks.`,
        ...warnings,
      ],
    };
  }

  // Build outputSchema - check both accepts-level and extensions.bazaar
  // Per the bazaar spec: info contains example values, schema contains field definitions
  const bazaarExt = (rawConfig.extensions as any)?.bazaar;
  const bazaarInfo = bazaarExt?.info;
  const rawOutputSchema = firstAccept.outputSchema || bazaarInfo;
  const finalOutputSchema = rawOutputSchema ? { ...rawOutputSchema } : {};
  if (!finalOutputSchema.input) {
    finalOutputSchema.input = {};
  }
  if (!finalOutputSchema.input.method) {
    finalOutputSchema.input.method = proxy.detectedMethod;
  }

  // Extract field definitions from bazaar.schema (the source of truth for types/descriptions)
  const bazaarSchemaInput = bazaarExt?.schema?.properties?.input?.properties;
  if (bazaarSchemaInput) {
    const extractFields = (schemaDef: any): Record<string, any> | null => {
      if (!schemaDef?.properties || Object.keys(schemaDef.properties).length === 0) return null;
      const required = new Set<string>(schemaDef.required || []);
      const fields: Record<string, any> = {};
      for (const [k, v] of Object.entries(schemaDef.properties)) {
        fields[k] = { ...(v as object), required: required.has(k) };
      }
      return fields;
    };

    if (!finalOutputSchema.input.queryParams || Object.keys(finalOutputSchema.input.queryParams).length === 0) {
      const qp = extractFields(bazaarSchemaInput.queryParams);
      if (qp) finalOutputSchema.input.queryParams = qp;
    }

    if (!finalOutputSchema.input.bodyFields || Object.keys(finalOutputSchema.input.bodyFields).length === 0) {
      const body = extractFields(bazaarSchemaInput.body || bazaarSchemaInput.bodyFields);
      if (body) finalOutputSchema.input.bodyFields = body;
    }
  }

  // First accept for primary resource data
  const primaryAccept =
    supportedAccepts[0] || acceptsFormatted[0] || {};

  // Build resource
  const isA2A = detectA2A(finalOutputSchema);
  const resource: VerifiedResource = {
    description:
      (rawConfig.resource as any)?.description ||
      (rawConfig as any).description ||
      firstAccept.description,
    network: primaryAccept.normalizedNetwork,
    payTo: primaryAccept.payTo,
    maxAmountRequired: primaryAccept.amount,
    asset: primaryAccept.asset,
    mimeType: (rawConfig.resource as any)?.mimeType || firstAccept.mimeType,
    maxTimeoutSeconds: firstAccept.maxTimeoutSeconds,
    outputSchema:
      Object.keys(finalOutputSchema.input || {}).length > 0 ||
      Object.keys(finalOutputSchema.output || {}).length > 0
        ? finalOutputSchema
        : undefined,
    extra: firstAccept.extra,
    isA2A: isA2A || undefined,
    serviceName:
      (rawConfig.service as any)?.name ||
      firstAccept.extra?.serviceName ||
      firstAccept.description,
    agentName: firstAccept.extra?.agentName,
    avatarUrl: firstAccept.extra?.avatarUrl,
  };

  return {
    valid: true,
    detectedMethod: proxy.detectedMethod,
    normalizedUrl,
    warnings: warnings.length > 0 ? warnings : undefined,
    x402Version: (rawConfig.x402Version as number) || 1,
    accepts: supportedAccepts.length > 0 ? supportedAccepts : acceptsFormatted,
    service: rawConfig.service as VerifyResponse["service"],
    resource,
    server: proxy.server,
    checkResult: result,
  };
}
