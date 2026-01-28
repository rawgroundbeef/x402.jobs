import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

interface TestEndpointRequest {
  url: string;
  method: "GET" | "POST";
  headers?: Record<string, string>;
  body?: string;
}

export async function POST(request: NextRequest) {
  try {
    const { url, method, headers, body }: TestEndpointRequest =
      await request.json();

    // Validate URL
    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // Validate it's a valid URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return NextResponse.json(
        { error: "Invalid URL format" },
        { status: 400 },
      );
    }

    // Only allow HTTPS URLs for security
    if (parsedUrl.protocol !== "https:") {
      return NextResponse.json(
        { error: "Only HTTPS URLs are supported" },
        { status: 400 },
      );
    }

    // Prepare request options
    const fetchOptions: RequestInit = {
      method: method || "GET",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...headers,
      },
    };

    // Add body for POST requests
    if (method === "POST" && body) {
      fetchOptions.body = body;
    }

    // Make the request with a timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    const startTime = Date.now();
    let response: Response;

    try {
      response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
      });
    } catch (fetchError: unknown) {
      clearTimeout(timeoutId);

      const error = fetchError as Error;
      if (error.name === "AbortError") {
        return NextResponse.json(
          {
            success: false,
            error: "Request timed out after 30 seconds",
            statusCode: 0,
            responseTime: Date.now() - startTime,
          },
          { status: 200 },
        );
      }

      return NextResponse.json(
        {
          success: false,
          error: `Failed to connect: ${error.message}`,
          statusCode: 0,
          responseTime: Date.now() - startTime,
        },
        { status: 200 },
      );
    }

    clearTimeout(timeoutId);
    const responseTime = Date.now() - startTime;

    // Get response body
    let responseBody: unknown;
    const contentType = response.headers.get("content-type") || "";

    try {
      if (contentType.includes("application/json")) {
        responseBody = await response.json();
      } else {
        responseBody = await response.text();
      }
    } catch {
      responseBody = null;
    }

    // Extract relevant headers
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    return NextResponse.json({
      success: true,
      statusCode: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      body: responseBody,
      responseTime,
      isJson: contentType.includes("application/json"),
    });
  } catch (error: unknown) {
    console.error("Test endpoint error:", error);
    const err = error as Error;
    return NextResponse.json(
      {
        success: false,
        error: err.message || "Internal server error",
        statusCode: 0,
        responseTime: 0,
      },
      { status: 200 },
    );
  }
}
