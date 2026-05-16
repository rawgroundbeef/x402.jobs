--
-- PostgreSQL database dump
--


-- Dumped from database version 17.4
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: api_keys; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.api_keys (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    key text NOT NULL,
    name text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    last_used_at timestamp with time zone,
    is_active boolean DEFAULT true NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb
);


--
-- Name: TABLE api_keys; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.api_keys IS 'API keys for authenticating public API requests';


--
-- Name: COLUMN api_keys.key; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.api_keys.key IS 'The actual API key string - should be securely generated';


--
-- Name: COLUMN api_keys.name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.api_keys.name IS 'Descriptive name for identifying the key (e.g. "Mobile App", "Partner X")';


--
-- Name: COLUMN api_keys.last_used_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.api_keys.last_used_at IS 'Timestamp of the last successful authentication with this key';


--
-- Name: COLUMN api_keys.is_active; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.api_keys.is_active IS 'Whether the key is currently valid - set to false to revoke';


--
-- Name: COLUMN api_keys.metadata; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.api_keys.metadata IS 'Additional data like rate limits, allowed endpoints, IP restrictions, etc.';


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    username text,
    display_name text,
    avatar_url text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    bio text
);


--
-- Name: TABLE profiles; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.profiles IS 'User profile data including username. Synced with auth.users on signup.';


--
-- Name: COLUMN profiles.bio; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.profiles.bio IS 'User bio/description, displayed on public profile page';


--
-- Name: x402_resources; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.x402_resources (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    resource_url text NOT NULL,
    network text NOT NULL,
    name text NOT NULL,
    description text,
    pay_to text NOT NULL,
    max_amount_required text,
    asset text,
    category text,
    favicon_url text,
    registered_by uuid,
    is_verified boolean DEFAULT false,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    server_id uuid,
    output_schema jsonb,
    extra jsonb,
    mime_type text,
    max_timeout_seconds integer,
    avatar_url text,
    call_count integer DEFAULT 0,
    total_earned_usdc numeric(20,6) DEFAULT 0,
    normalized_url text NOT NULL,
    tags text[] DEFAULT '{}'::text[],
    capabilities text[] DEFAULT '{}'::text[],
    input_types text[] DEFAULT '{}'::text[],
    output_types text[] DEFAULT '{}'::text[],
    source text DEFAULT 'manual'::text,
    last_verified_at timestamp with time zone,
    popularity_score integer DEFAULT 0,
    embedding public.vector(1536),
    search_vector tsvector,
    slug text,
    verified_owner_id uuid,
    verified_at timestamp with time zone,
    verification_code text,
    verification_expires_at timestamp with time zone,
    facilitator_id uuid,
    discovered_via text DEFAULT 'manual'::text,
    display_path text,
    success_count_30d integer DEFAULT 0,
    failure_count_30d integer DEFAULT 0,
    success_rate_updated_at timestamp with time zone,
    health_status public.resource_health_status DEFAULT 'healthy'::public.resource_health_status,
    last_health_check_at timestamp with time zone,
    health_failure_count integer DEFAULT 0,
    health_offline_at timestamp with time zone,
    last_called_at timestamp with time zone,
    is_a2a boolean DEFAULT false,
    resource_type text DEFAULT 'external'::text NOT NULL,
    proxy_origin_url text,
    proxy_method text,
    proxy_auth_header_encrypted text,
    proxy_timeout_ms integer DEFAULT 30000,
    proxy_rate_limit integer,
    proxy_rate_limit_window text,
    prompt_provider text,
    prompt_api_key_encrypted text,
    prompt_model text,
    prompt_system_prompt text,
    prompt_parameters jsonb,
    prompt_output_format text,
    prompt_output_transform text,
    prompt_retry_on_invalid boolean DEFAULT false,
    static_content text,
    static_content_type text DEFAULT 'application/json'::text,
    platform_fee_percent numeric(5,4) DEFAULT 0.10,
    price_usdc numeric(10,6) DEFAULT 0.01,
    pt_system_prompt text,
    pt_parameters jsonb DEFAULT '[]'::jsonb,
    pt_model character varying(100) DEFAULT 'claude-sonnet-4-20250514'::character varying,
    pt_max_tokens integer DEFAULT 4096,
    pt_allows_user_message boolean DEFAULT false,
    supports_refunds boolean DEFAULT false,
    CONSTRAINT pt_max_tokens_range CHECK (((pt_max_tokens IS NULL) OR ((pt_max_tokens >= 1) AND (pt_max_tokens <= 8192)))),
    CONSTRAINT x402_resources_discovered_via_check CHECK ((discovered_via = ANY (ARRAY['manual'::text, 'bazaar'::text, 'onchain'::text]))),
    CONSTRAINT x402_resources_network_check CHECK ((network = ANY (ARRAY['solana'::text, 'base'::text, 'ethereum'::text, 'polygon'::text, 'base-sepolia'::text, 'ethereum-sepolia'::text, 'solana-devnet'::text]))),
    CONSTRAINT x402_resources_prompt_output_format_check CHECK (((prompt_output_format IS NULL) OR (prompt_output_format = ANY (ARRAY['raw'::text, 'json'::text, 'transform'::text])))),
    CONSTRAINT x402_resources_prompt_provider_check CHECK (((prompt_provider IS NULL) OR (prompt_provider = ANY (ARRAY['anthropic'::text, 'openai'::text])))),
    CONSTRAINT x402_resources_proxy_method_check CHECK (((proxy_method IS NULL) OR (proxy_method = ANY (ARRAY['GET'::text, 'POST'::text, 'PASS'::text])))),
    CONSTRAINT x402_resources_proxy_rate_limit_window_check CHECK (((proxy_rate_limit_window IS NULL) OR (proxy_rate_limit_window = ANY (ARRAY['minute'::text, 'hour'::text, 'day'::text])))),
    CONSTRAINT x402_resources_resource_type_check CHECK ((resource_type = ANY (ARRAY['external'::text, 'proxy'::text, 'prompt'::text, 'static'::text, 'prompt_template'::text])))
);


--
-- Name: TABLE x402_resources; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.x402_resources IS 'Registered X402 resources that can be used in jobs. Anyone can register a resource.';


--
-- Name: COLUMN x402_resources.category; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_resources.category IS 'Primary category: "llm", "social", "trading", "media", "data"';


--
-- Name: COLUMN x402_resources.output_schema; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_resources.output_schema IS 'The outputSchema from X402 response - defines input/output structure';


--
-- Name: COLUMN x402_resources.extra; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_resources.extra IS 'Extra metadata from X402 response - service info, pricing, etc.';


--
-- Name: COLUMN x402_resources.avatar_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_resources.avatar_url IS 'Avatar URL from extra.avatarUrl for quick access';


--
-- Name: COLUMN x402_resources.tags; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_resources.tags IS 'User-facing tags like "social-media", "ai", "trading"';


--
-- Name: COLUMN x402_resources.capabilities; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_resources.capabilities IS 'What the resource can do: "generate-text", "fetch-tweets", "analyze-image"';


--
-- Name: COLUMN x402_resources.input_types; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_resources.input_types IS 'Input data types: "text", "image-url", "json", "wallet-address"';


--
-- Name: COLUMN x402_resources.output_types; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_resources.output_types IS 'Output data types: "text", "image-url", "json", "video-url"';


--
-- Name: COLUMN x402_resources.source; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_resources.source IS 'How the resource was added: "manual", "payai_discovery"';


--
-- Name: COLUMN x402_resources.embedding; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_resources.embedding IS 'OpenAI text-embedding-3-small vector for semantic similarity search';


--
-- Name: COLUMN x402_resources.search_vector; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_resources.search_vector IS 'Full-text search vector for keyword matching';


--
-- Name: COLUMN x402_resources.verified_owner_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_resources.verified_owner_id IS 'User who has verified ownership of this resource by proving endpoint control';


--
-- Name: COLUMN x402_resources.verified_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_resources.verified_at IS 'When ownership was verified';


--
-- Name: COLUMN x402_resources.verification_code; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_resources.verification_code IS 'Temporary code for ownership verification (cleared after verification)';


--
-- Name: COLUMN x402_resources.verification_expires_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_resources.verification_expires_at IS 'When the verification code expires';


--
-- Name: COLUMN x402_resources.success_count_30d; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_resources.success_count_30d IS 'Number of successful (completed) calls in the last 30 days. Updated hourly by cron.';


--
-- Name: COLUMN x402_resources.failure_count_30d; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_resources.failure_count_30d IS 'Number of failed calls in the last 30 days. Updated hourly by cron.';


--
-- Name: COLUMN x402_resources.success_rate_updated_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_resources.success_rate_updated_at IS 'Last time success rate stats were updated by cron.';


--
-- Name: COLUMN x402_resources.health_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_resources.health_status IS 'Current health status: healthy (responding), degraded (intermittent issues), offline (404/unreachable)';


--
-- Name: COLUMN x402_resources.last_health_check_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_resources.last_health_check_at IS 'When the resource was last checked (nightly cron or during job execution)';


--
-- Name: COLUMN x402_resources.health_failure_count; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_resources.health_failure_count IS 'Consecutive health check failures (reset to 0 on success)';


--
-- Name: COLUMN x402_resources.health_offline_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_resources.health_offline_at IS 'When the resource was first marked as offline (for notification purposes)';


--
-- Name: COLUMN x402_resources.last_called_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_resources.last_called_at IS 'Timestamp of the last time this resource was called in a workflow execution. Updated immediately on each call.';


--
-- Name: COLUMN x402_resources.is_a2a; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_resources.is_a2a IS 'Indicates if this resource supports the A2A (Agent-to-Agent) protocol';


--
-- Name: COLUMN x402_resources.resource_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_resources.resource_type IS 'Type of resource: external (traditional), proxy, prompt, or static';


--
-- Name: COLUMN x402_resources.proxy_origin_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_resources.proxy_origin_url IS 'For proxy type: the origin URL to forward requests to';


--
-- Name: COLUMN x402_resources.proxy_auth_header_encrypted; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_resources.proxy_auth_header_encrypted IS 'For proxy type: encrypted auth header to forward to origin';


--
-- Name: COLUMN x402_resources.prompt_api_key_encrypted; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_resources.prompt_api_key_encrypted IS 'For prompt type: encrypted LLM API key';


--
-- Name: COLUMN x402_resources.prompt_parameters; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_resources.prompt_parameters IS 'For prompt type: array of {name, type, required, default, description}';


--
-- Name: COLUMN x402_resources.static_content; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_resources.static_content IS 'For static type: the content to return';


--
-- Name: COLUMN x402_resources.platform_fee_percent; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_resources.platform_fee_percent IS 'Platform fee percentage (0.10 = 10%)';


--
-- Name: COLUMN x402_resources.price_usdc; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_resources.price_usdc IS 'Price in USDC (human-readable, e.g., 0.01 = 1 cent)';


--
-- Name: COLUMN x402_resources.pt_system_prompt; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_resources.pt_system_prompt IS 'System prompt for prompt_template x402_resources. Protected content - only visible to owner.';


--
-- Name: COLUMN x402_resources.pt_parameters; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_resources.pt_parameters IS 'JSON array of parameters: [{name, description, required, default}]';


--
-- Name: COLUMN x402_resources.pt_model; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_resources.pt_model IS 'Claude model ID (default: claude-sonnet-4-20250514)';


--
-- Name: COLUMN x402_resources.pt_max_tokens; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_resources.pt_max_tokens IS 'Max tokens for Claude response (1-8192, default: 4096)';


--
-- Name: COLUMN x402_resources.pt_allows_user_message; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_resources.pt_allows_user_message IS 'Whether caller can provide user message (system+user mode)';


--
-- Name: COLUMN x402_resources.supports_refunds; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_resources.supports_refunds IS 'Whether this resource supports x402 refunds. Extracted from extra.supportsRefunds during registration.';


--
-- Name: x402_cached_images; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.x402_cached_images (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    original_url text NOT NULL,
    cached_url text NOT NULL,
    type text DEFAULT 'avatar'::text NOT NULL,
    filename text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE x402_cached_images; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.x402_cached_images IS 'Cache for external avatar and favicon images';


--
-- Name: COLUMN x402_cached_images.original_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_cached_images.original_url IS 'The original external URL that was cached';


--
-- Name: COLUMN x402_cached_images.cached_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_cached_images.cached_url IS 'The Supabase storage public URL';


--
-- Name: x402_external_wallet_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.x402_external_wallet_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    external_wallet_address text NOT NULL,
    verified_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE x402_external_wallet_links; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.x402_external_wallet_links IS 'Links external wallets to platform accounts for $JOBS reward crediting';


--
-- Name: x402_facilitator_addresses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.x402_facilitator_addresses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    facilitator_id uuid NOT NULL,
    address text NOT NULL,
    network text NOT NULL,
    label text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT x402_facilitator_addresses_network_check CHECK ((network = ANY (ARRAY['solana'::text, 'base'::text, 'base-sepolia'::text, 'ethereum'::text, 'ethereum-sepolia'::text])))
);


--
-- Name: x402_facilitators; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.x402_facilitators (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    name text NOT NULL,
    url text NOT NULL,
    discovery_url text,
    supported_networks text[] DEFAULT '{}'::text[],
    supported_assets text[] DEFAULT '{}'::text[],
    supported_schemes text[] DEFAULT '{}'::text[],
    is_active boolean DEFAULT true,
    last_seen_at timestamp with time zone,
    last_polled_at timestamp with time zone,
    total_transactions integer DEFAULT 0,
    total_volume_usdc numeric(18,6) DEFAULT 0,
    unique_servers integer DEFAULT 0,
    unique_buyers integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE x402_facilitators; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.x402_facilitators IS 'Payment facilitators in the x402 ecosystem (CDP, Dexter, PayAI, etc.)';


--
-- Name: x402_hackathon_sponsors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.x402_hackathon_sponsors (
    hackathon_id uuid NOT NULL,
    sponsor_id uuid NOT NULL,
    contribution_amount numeric(10,2) DEFAULT 0,
    display_order integer DEFAULT 0
);


--
-- Name: x402_hackathon_submissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.x402_hackathon_submissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    hackathon_id uuid NOT NULL,
    user_id uuid NOT NULL,
    job_id uuid NOT NULL,
    submitted_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    x_post_url text
);


--
-- Name: x402_hackathon_winners; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.x402_hackathon_winners (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    hackathon_id uuid NOT NULL,
    submission_id uuid NOT NULL,
    place integer DEFAULT 1 NOT NULL,
    prize_amount numeric(10,2) DEFAULT 0 NOT NULL,
    awarded_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: x402_hackathons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.x402_hackathons (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    name text NOT NULL,
    description text,
    rules text,
    prizes jsonb DEFAULT '{"first": 0, "third": 0, "second": 0}'::jsonb NOT NULL,
    starts_at timestamp with time zone NOT NULL,
    ends_at timestamp with time zone,
    status text DEFAULT 'upcoming'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    prize numeric(10,2) DEFAULT 0,
    judging_criteria text,
    number integer,
    resolved_at timestamp with time zone,
    CONSTRAINT x402_hackathons_status_check CHECK ((status = ANY (ARRAY['upcoming'::text, 'active'::text, 'judging'::text, 'complete'::text])))
);


--
-- Name: x402_hiring_escrow_ledger; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.x402_hiring_escrow_ledger (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    request_id uuid NOT NULL,
    transaction_type text NOT NULL,
    amount numeric(12,6) NOT NULL,
    submission_id uuid,
    payout_id uuid,
    description text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT x402_hiring_escrow_ledger_transaction_type_check CHECK ((transaction_type = ANY (ARRAY['deposit'::text, 'release'::text, 'refund'::text, 'fee'::text])))
);


--
-- Name: TABLE x402_hiring_escrow_ledger; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.x402_hiring_escrow_ledger IS 'Audit trail for all escrow fund movements';


--
-- Name: COLUMN x402_hiring_escrow_ledger.metadata; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_hiring_escrow_ledger.metadata IS 'Reserved for x402 payment integration details';


--
-- Name: x402_hiring_payouts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.x402_hiring_payouts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    request_id uuid NOT NULL,
    submission_id uuid NOT NULL,
    amount numeric(12,6) NOT NULL,
    platform_fee numeric(12,6) DEFAULT 0,
    reviewer_pool_fee numeric(12,6) DEFAULT 0,
    payout_address text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    tx_hash text,
    paid_at timestamp with time zone,
    error_message text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT x402_hiring_payouts_amount_check CHECK ((amount >= (0)::numeric)),
    CONSTRAINT x402_hiring_payouts_platform_fee_check CHECK ((platform_fee >= (0)::numeric)),
    CONSTRAINT x402_hiring_payouts_reviewer_pool_fee_check CHECK ((reviewer_pool_fee >= (0)::numeric)),
    CONSTRAINT x402_hiring_payouts_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'paid'::text, 'failed'::text])))
);


--
-- Name: TABLE x402_hiring_payouts; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.x402_hiring_payouts IS 'Payout records when bounties are released';


--
-- Name: x402_hiring_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.x402_hiring_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    creator_user_id uuid NOT NULL,
    title text NOT NULL,
    description text NOT NULL,
    requirements jsonb DEFAULT '[]'::jsonb,
    tags jsonb DEFAULT '[]'::jsonb,
    bounty_amount numeric(12,6) NOT NULL,
    posting_fee_amount numeric(12,6) DEFAULT 0,
    escrow_status text DEFAULT 'none'::text NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    desired_deliverable text DEFAULT 'job_json'::text NOT NULL,
    approval_quorum integer DEFAULT 2 NOT NULL,
    approval_pool_size integer DEFAULT 3 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone,
    inputs jsonb DEFAULT '[]'::jsonb,
    escrow_tx_hash text,
    payout_tx_hash text,
    CONSTRAINT x402_hiring_requests_bounty_amount_check CHECK ((bounty_amount >= (0)::numeric)),
    CONSTRAINT x402_hiring_requests_desired_deliverable_check CHECK ((desired_deliverable = 'job_json'::text)),
    CONSTRAINT x402_hiring_requests_escrow_status_check CHECK ((escrow_status = ANY (ARRAY['none'::text, 'funded'::text, 'released'::text, 'refunded'::text]))),
    CONSTRAINT x402_hiring_requests_posting_fee_amount_check CHECK ((posting_fee_amount >= (0)::numeric)),
    CONSTRAINT x402_hiring_requests_status_check CHECK ((status = ANY (ARRAY['open'::text, 'under_review'::text, 'fulfilled'::text, 'canceled'::text, 'expired'::text])))
);


--
-- Name: TABLE x402_hiring_requests; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.x402_hiring_requests IS 'Hiring requests where users post bounties for workflow jobs to be built';


--
-- Name: COLUMN x402_hiring_requests.escrow_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_hiring_requests.escrow_status IS 'Tracks the state of bounty funds: none (not deposited), funded (in escrow), released (paid to winner), refunded (returned to creator)';


--
-- Name: COLUMN x402_hiring_requests.approval_quorum; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_hiring_requests.approval_quorum IS 'Number of approvals required to accept a submission';


--
-- Name: COLUMN x402_hiring_requests.inputs; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_hiring_requests.inputs IS 'Array of input parameter definitions: [{ name, type, required, description, default? }]';


--
-- Name: COLUMN x402_hiring_requests.escrow_tx_hash; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_hiring_requests.escrow_tx_hash IS 'Transaction hash for the escrow deposit (when funded)';


--
-- Name: COLUMN x402_hiring_requests.payout_tx_hash; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_hiring_requests.payout_tx_hash IS 'Transaction hash for the payout to builder (when released)';


--
-- Name: x402_hiring_reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.x402_hiring_reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    submission_id uuid NOT NULL,
    reviewer_user_id uuid NOT NULL,
    decision text NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT x402_hiring_reviews_decision_check CHECK ((decision = ANY (ARRAY['approve'::text, 'reject'::text])))
);


--
-- Name: TABLE x402_hiring_reviews; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.x402_hiring_reviews IS 'Reviews/approvals from reviewers on submissions';


--
-- Name: x402_hiring_submissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.x402_hiring_submissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    request_id uuid NOT NULL,
    submitter_type text DEFAULT 'human'::text NOT NULL,
    submitter_user_id uuid,
    submitter_wallet_address text,
    job_id uuid,
    job_json jsonb,
    proof_run jsonb DEFAULT '{}'::jsonb,
    status text DEFAULT 'submitted'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    creator_feedback text,
    reviewed_at timestamp with time zone,
    reviewed_by uuid,
    CONSTRAINT x402_hiring_submissions_status_check CHECK ((status = ANY (ARRAY['submitted'::text, 'needs_changes'::text, 'accepted'::text, 'rejected'::text, 'withdrawn'::text]))),
    CONSTRAINT x402_hiring_submissions_submitter_check CHECK (((submitter_user_id IS NOT NULL) OR (submitter_wallet_address IS NOT NULL))),
    CONSTRAINT x402_hiring_submissions_submitter_type_check CHECK ((submitter_type = ANY (ARRAY['human'::text, 'agent'::text])))
);


--
-- Name: TABLE x402_hiring_submissions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.x402_hiring_submissions IS 'Submissions from builders (human or agent) for hiring requests';


--
-- Name: COLUMN x402_hiring_submissions.submitter_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_hiring_submissions.submitter_type IS 'human for user submissions, agent for automated submissions';


--
-- Name: COLUMN x402_hiring_submissions.proof_run; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_hiring_submissions.proof_run IS 'Flexible JSON blob for proof of work: { run_logs_url, run_output, notes }';


--
-- Name: COLUMN x402_hiring_submissions.creator_feedback; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_hiring_submissions.creator_feedback IS 'Feedback from the request creator when reviewing';


--
-- Name: COLUMN x402_hiring_submissions.reviewed_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_hiring_submissions.reviewed_at IS 'Timestamp when the creator reviewed the submission';


--
-- Name: COLUMN x402_hiring_submissions.reviewed_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_hiring_submissions.reviewed_by IS 'User ID of the creator who reviewed';


--
-- Name: x402_job_run_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.x402_job_run_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    run_id uuid NOT NULL,
    resource_id uuid,
    resource_url text NOT NULL,
    resource_name text NOT NULL,
    resource_price numeric(20,6) DEFAULT 0,
    sequence integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    inputs jsonb DEFAULT '{}'::jsonb,
    output jsonb,
    output_text text,
    payment_signature text,
    amount_paid numeric(20,6) DEFAULT 0,
    error text,
    attempt integer DEFAULT 1,
    max_attempts integer DEFAULT 3,
    created_at timestamp with time zone DEFAULT now(),
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    node_id text,
    resolved_inputs jsonb,
    network text DEFAULT 'solana'::text,
    bridge_tx text,
    bridge_from_chain text,
    bridge_to_chain text,
    CONSTRAINT x402_job_run_events_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'running'::text, 'completed'::text, 'failed'::text, 'skipped'::text])))
);


--
-- Name: COLUMN x402_job_run_events.payment_signature; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_job_run_events.payment_signature IS 'Transaction signature for the payment (for block explorer links)';


--
-- Name: COLUMN x402_job_run_events.network; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_job_run_events.network IS 'Network used for this resource payment (solana, base)';


--
-- Name: COLUMN x402_job_run_events.bridge_tx; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_job_run_events.bridge_tx IS 'Transaction hash of the bridge operation (if cross-chain)';


--
-- Name: COLUMN x402_job_run_events.bridge_from_chain; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_job_run_events.bridge_from_chain IS 'Source chain of the bridge';


--
-- Name: COLUMN x402_job_run_events.bridge_to_chain; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_job_run_events.bridge_to_chain IS 'Destination chain of the bridge';


--
-- Name: x402_job_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.x402_job_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    job_id uuid NOT NULL,
    status text NOT NULL,
    input jsonb DEFAULT '{}'::jsonb,
    output jsonb,
    error text,
    total_cost_usdc numeric(10,6) DEFAULT 0,
    payments jsonb DEFAULT '[]'::jsonb,
    execution_trace jsonb DEFAULT '[]'::jsonb,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    duration_ms integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    user_id uuid NOT NULL,
    inputs jsonb DEFAULT '{}'::jsonb,
    total_cost numeric(20,6) DEFAULT 0,
    resources_total integer DEFAULT 0,
    resources_completed integer DEFAULT 0,
    resources_failed integer DEFAULT 0,
    payment_source_chain text,
    payment_source_address text,
    escrow_deposit_tx text,
    escrow_deposit_chain text,
    refund_tx text,
    refund_status text,
    refund_amount numeric(10,6),
    triggered_by text DEFAULT 'manual'::text,
    total_payment numeric(20,6) DEFAULT 0,
    payment_signature text,
    creator_markup_earned numeric(20,6) DEFAULT 0,
    payer_address text,
    payment_network text,
    creator_wallet_address text,
    creator_base_wallet_address text,
    CONSTRAINT x402_job_runs_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'running'::text, 'success'::text, 'failed'::text, 'cancelled'::text])))
);


--
-- Name: TABLE x402_job_runs; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.x402_job_runs IS 'Execution history for jobs, including payments and outputs.';


--
-- Name: COLUMN x402_job_runs.payments; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_job_runs.payments IS 'Array of payment records: [{ resourceId, amount, txId, timestamp }]';


--
-- Name: COLUMN x402_job_runs.execution_trace; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_job_runs.execution_trace IS 'Array of node execution traces for debugging.';


--
-- Name: COLUMN x402_job_runs.payment_source_chain; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_job_runs.payment_source_chain IS 'Chain the user paid from (e.g., solana, base, arbitrum)';


--
-- Name: COLUMN x402_job_runs.payment_source_address; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_job_runs.payment_source_address IS 'User wallet address on the source chain';


--
-- Name: COLUMN x402_job_runs.escrow_deposit_tx; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_job_runs.escrow_deposit_tx IS 'Transaction hash of the escrow deposit (or bridge tx for cross-chain)';


--
-- Name: COLUMN x402_job_runs.escrow_deposit_chain; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_job_runs.escrow_deposit_chain IS 'Chain where escrow deposit arrived (usually solana or base)';


--
-- Name: COLUMN x402_job_runs.refund_tx; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_job_runs.refund_tx IS 'Transaction hash of the platform fee refund (if job failed)';


--
-- Name: COLUMN x402_job_runs.refund_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_job_runs.refund_status IS 'Refund status: pending, processing, completed, failed';


--
-- Name: COLUMN x402_job_runs.refund_amount; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_job_runs.refund_amount IS 'Amount refunded in USDC (usually just the platform fee)';


--
-- Name: COLUMN x402_job_runs.total_payment; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_job_runs.total_payment IS 'Total payment received including creator markup (for webhook runs)';


--
-- Name: COLUMN x402_job_runs.payment_signature; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_job_runs.payment_signature IS 'Transaction signature for the payment (for block explorer links)';


--
-- Name: COLUMN x402_job_runs.creator_markup_earned; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_job_runs.creator_markup_earned IS 'Amount of creator markup earned on this run';


--
-- Name: COLUMN x402_job_runs.payer_address; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_job_runs.payer_address IS 'Wallet address of the payer (for x402 webhook runs)';


--
-- Name: COLUMN x402_job_runs.payment_network; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_job_runs.payment_network IS 'Network the payment was made on (solana/base)';


--
-- Name: COLUMN x402_job_runs.creator_wallet_address; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_job_runs.creator_wallet_address IS 'Solana wallet address of the job creator (for escrow payouts)';


--
-- Name: COLUMN x402_job_runs.creator_base_wallet_address; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_job_runs.creator_base_wallet_address IS 'Base wallet address of the job creator (for escrow payouts)';


--
-- Name: x402_jobs_display_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.x402_jobs_display_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: x402_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.x402_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    workflow_definition jsonb NOT NULL,
    trigger_type text NOT NULL,
    trigger_config jsonb DEFAULT '{}'::jsonb,
    output_type text DEFAULT 'ui'::text NOT NULL,
    output_config jsonb DEFAULT '{}'::jsonb,
    is_active boolean DEFAULT true,
    last_run_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    display_id integer DEFAULT nextval('public.x402_jobs_display_id_seq'::regclass) NOT NULL,
    trigger_methods jsonb DEFAULT '{"manual": true, "webhook": false}'::jsonb,
    creator_markup numeric(10,6) DEFAULT 0 NOT NULL,
    total_earnings_usdc numeric(20,6) DEFAULT 0,
    run_count integer DEFAULT 0,
    is_public boolean DEFAULT false,
    network text DEFAULT 'solana'::text NOT NULL,
    embedding public.vector(1536),
    slug text,
    avatar_url text,
    schedule_cron text,
    schedule_timezone text DEFAULT 'UTC'::text,
    schedule_next_run_at timestamp with time zone,
    schedule_last_run_at timestamp with time zone,
    schedule_enabled boolean DEFAULT false,
    published boolean DEFAULT false,
    on_success_job_id uuid,
    show_workflow boolean DEFAULT false,
    webhook_response jsonb DEFAULT '{"mode": "confirmation"}'::jsonb,
    success_count_30d integer DEFAULT 0,
    failure_count_30d integer DEFAULT 0,
    success_rate_updated_at timestamp with time zone,
    full_revenue_tracking boolean DEFAULT false,
    CONSTRAINT x402_jobs_output_type_check CHECK ((output_type = ANY (ARRAY['ui'::text, 'telegram'::text, 'email'::text, 'bucket'::text]))),
    CONSTRAINT x402_jobs_trigger_type_check CHECK ((trigger_type = ANY (ARRAY['manual'::text, 'schedule'::text, 'webhook'::text])))
);


--
-- Name: TABLE x402_jobs; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.x402_jobs IS 'User-created jobs (workflows) that chain X402 resources together.';


--
-- Name: COLUMN x402_jobs.name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_jobs.name IS 'Job name - can be duplicated across users';


--
-- Name: COLUMN x402_jobs.workflow_definition; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_jobs.workflow_definition IS 'JSON workflow definition with nodes and edges. See XYFlow format.';


--
-- Name: COLUMN x402_jobs.display_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_jobs.display_id IS 'Sequential human-readable ID for job names (e.g., x402job 1042)';


--
-- Name: COLUMN x402_jobs.trigger_methods; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_jobs.trigger_methods IS 'JSON object with boolean flags for activation methods: { manual: boolean, webhook: boolean }';


--
-- Name: COLUMN x402_jobs.creator_markup; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_jobs.creator_markup IS 'Creator markup in USDC that is added on top of the base job cost when called via webhook';


--
-- Name: COLUMN x402_jobs.total_earnings_usdc; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_jobs.total_earnings_usdc IS 'Total creator earnings in USDC (sum of creator_markup_earned from webhook runs)';


--
-- Name: COLUMN x402_jobs.network; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_jobs.network IS 'Blockchain network for this job (solana, base). Resources in the job must match this network.';


--
-- Name: COLUMN x402_jobs.embedding; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_jobs.embedding IS 'OpenAI text-embedding-3-small vector for semantic similarity search of webhook jobs';


--
-- Name: COLUMN x402_jobs.slug; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_jobs.slug IS 'URL-friendly identifier - unique per user';


--
-- Name: COLUMN x402_jobs.schedule_cron; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_jobs.schedule_cron IS 'Cron expression for scheduled runs (e.g., "0 9 * * *" for daily at 9 AM)';


--
-- Name: COLUMN x402_jobs.schedule_timezone; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_jobs.schedule_timezone IS 'Timezone for interpreting the cron expression (e.g., "America/New_York")';


--
-- Name: COLUMN x402_jobs.schedule_next_run_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_jobs.schedule_next_run_at IS 'Next scheduled execution time (calculated from cron + timezone)';


--
-- Name: COLUMN x402_jobs.schedule_last_run_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_jobs.schedule_last_run_at IS 'Last scheduled execution time';


--
-- Name: COLUMN x402_jobs.schedule_enabled; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_jobs.schedule_enabled IS 'Whether scheduled execution is enabled for this job';


--
-- Name: COLUMN x402_jobs.published; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_jobs.published IS 'When true, job appears in public marketplace. When false, webhook still works but job is hidden from listing.';


--
-- Name: COLUMN x402_jobs.on_success_job_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_jobs.on_success_job_id IS 'Optional: ID of another job to trigger when this job completes successfully. Can reference own jobs or public jobs.';


--
-- Name: COLUMN x402_jobs.show_workflow; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_jobs.show_workflow IS 'Whether to show the workflow visualization to non-owners. Default false to protect proprietary resource combinations.';


--
-- Name: COLUMN x402_jobs.webhook_response; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_jobs.webhook_response IS 'Configuration for webhook response: mode (confirmation/custom_template), template (custom JSON), success_message';


--
-- Name: COLUMN x402_jobs.success_count_30d; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_jobs.success_count_30d IS 'Number of successful job runs in the last 30 days. Updated hourly by cron.';


--
-- Name: COLUMN x402_jobs.failure_count_30d; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_jobs.failure_count_30d IS 'Number of failed job runs in the last 30 days. Updated hourly by cron.';


--
-- Name: COLUMN x402_jobs.success_rate_updated_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_jobs.success_rate_updated_at IS 'Last time success rate stats were updated by cron.';


--
-- Name: COLUMN x402_jobs.full_revenue_tracking; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_jobs.full_revenue_tracking IS 'When true, the full payment amount counts as revenue instead of just creator markup. Used for partner integrations like Open Facilitator subscriptions.';


--
-- Name: x402_jobs_rewards_claims; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.x402_jobs_rewards_claims (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ledger_ids uuid[] NOT NULL,
    wallet_address text NOT NULL,
    user_id uuid,
    platform_wallet_address text NOT NULL,
    total_claimed_usdc numeric(18,6) NOT NULL,
    periods_claimed text[] NOT NULL,
    signature text,
    message text,
    tx_hash text,
    claimed_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE x402_jobs_rewards_claims; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.x402_jobs_rewards_claims IS 'Audit log of all reward claims';


--
-- Name: x402_jobs_rewards_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.x402_jobs_rewards_config (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    key text NOT NULL,
    value jsonb NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: x402_jobs_rewards_excluded_wallets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.x402_jobs_rewards_excluded_wallets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    wallet_address text NOT NULL,
    reason text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE x402_jobs_rewards_excluded_wallets; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.x402_jobs_rewards_excluded_wallets IS 'Wallets excluded from rewards (LP pools, team wallets)';


--
-- Name: x402_jobs_rewards_ledger; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.x402_jobs_rewards_ledger (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    wallet_address text NOT NULL,
    period text NOT NULL,
    amount_usdc numeric(18,6) NOT NULL,
    jobs_balance numeric(18,6) DEFAULT 0 NOT NULL,
    jobs_percentage numeric(10,8) DEFAULT 0 NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    claimed_at timestamp with time zone,
    claimed_to_user_id uuid,
    claimed_to_platform_wallet text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT x402_jobs_rewards_ledger_amount_usdc_check CHECK ((amount_usdc >= (0)::numeric)),
    CONSTRAINT x402_jobs_rewards_ledger_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'claimed'::text, 'expired'::text])))
);


--
-- Name: TABLE x402_jobs_rewards_ledger; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.x402_jobs_rewards_ledger IS 'Individual reward entries for $JOBS holders to claim';


--
-- Name: COLUMN x402_jobs_rewards_ledger.wallet_address; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_jobs_rewards_ledger.wallet_address IS 'External Solana wallet address holding $JOBS';


--
-- Name: COLUMN x402_jobs_rewards_ledger.period; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_jobs_rewards_ledger.period IS 'Period identifier in YYYY-MM format';


--
-- Name: COLUMN x402_jobs_rewards_ledger.amount_usdc; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_jobs_rewards_ledger.amount_usdc IS 'Amount of USDC rewards earned for this period';


--
-- Name: COLUMN x402_jobs_rewards_ledger.jobs_balance; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_jobs_rewards_ledger.jobs_balance IS '$JOBS token balance at time of snapshot';


--
-- Name: COLUMN x402_jobs_rewards_ledger.jobs_percentage; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_jobs_rewards_ledger.jobs_percentage IS 'Percentage of total $JOBS supply held';


--
-- Name: COLUMN x402_jobs_rewards_ledger.claimed_to_platform_wallet; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_jobs_rewards_ledger.claimed_to_platform_wallet IS 'Platform wallet address where USDC was credited';


--
-- Name: x402_jobs_rewards_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.x402_jobs_rewards_snapshots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    period text NOT NULL,
    snapshot_at timestamp with time zone NOT NULL,
    total_jobs_supply numeric(18,6) DEFAULT 0 NOT NULL,
    total_holders integer DEFAULT 0 NOT NULL,
    platform_fees_total numeric(18,6) DEFAULT 0 NOT NULL,
    reward_pool numeric(18,6) DEFAULT 0 NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT x402_jobs_rewards_snapshots_status_check CHECK ((status = ANY (ARRAY['active'::text, 'distributed'::text, 'closed'::text])))
);


--
-- Name: TABLE x402_jobs_rewards_snapshots; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.x402_jobs_rewards_snapshots IS 'Monthly snapshots of $JOBS token distribution for revenue sharing';


--
-- Name: x402_jobs_rewards_treasury_transfers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.x402_jobs_rewards_treasury_transfers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    period text NOT NULL,
    amount_usdc numeric(18,6) NOT NULL,
    signature text NOT NULL,
    from_address text NOT NULL,
    to_address text NOT NULL,
    transferred_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: x402_notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.x402_notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    type text NOT NULL,
    title text NOT NULL,
    message text,
    link text,
    read boolean DEFAULT false NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT x402_notifications_type_check CHECK ((type = ANY (ARRAY['submission_received'::text, 'submission_approved'::text, 'submission_rejected'::text, 'changes_requested'::text, 'job_transferred'::text, 'schedule_paused_low_balance'::text, 'loop_stopped_job_failed'::text, 'hackathon_winner'::text, 'resource_offline'::text, 'resource_low_success_rate'::text, 'refund_requested'::text])))
);


--
-- Name: TABLE x402_notifications; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.x402_notifications IS 'User notifications for hiring board events';


--
-- Name: COLUMN x402_notifications.type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_notifications.type IS 'Type of notification event';


--
-- Name: COLUMN x402_notifications.link; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_notifications.link IS 'URL to navigate to when clicking the notification';


--
-- Name: COLUMN x402_notifications.metadata; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_notifications.metadata IS 'Additional context: { request_id?, submission_id?, job_id? }';


--
-- Name: x402_openrouter_models; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.x402_openrouter_models (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    openrouter_id text NOT NULL,
    memeputer_name text,
    display_name text NOT NULL,
    description text,
    provider text NOT NULL,
    modality text DEFAULT 'text'::text NOT NULL,
    context_length integer,
    max_tokens integer,
    pricing_prompt text,
    pricing_completion text,
    pricing_image text,
    pricing_web_search text,
    input_cost_per_million numeric,
    output_cost_per_million numeric,
    capabilities jsonb,
    vision_supported boolean DEFAULT false,
    web_search_supported boolean DEFAULT false,
    tool_calling_supported boolean DEFAULT false,
    is_active boolean DEFAULT true,
    is_curated boolean DEFAULT false,
    last_synced_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: x402_pending_payouts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.x402_pending_payouts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    run_id uuid,
    job_id uuid,
    type text NOT NULL,
    recipient_address text NOT NULL,
    creator_id uuid,
    amount numeric(20,6) NOT NULL,
    network text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    transaction_signature text,
    error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    processed_at timestamp with time zone,
    attempts integer DEFAULT 0 NOT NULL,
    last_attempt_at timestamp with time zone,
    refund_breakdown jsonb,
    CONSTRAINT x402_pending_payouts_network_check CHECK ((network = ANY (ARRAY['solana'::text, 'base'::text]))),
    CONSTRAINT x402_pending_payouts_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text]))),
    CONSTRAINT x402_pending_payouts_type_check CHECK ((type = ANY (ARRAY['creator_payout'::text, 'payer_refund'::text])))
);


--
-- Name: TABLE x402_pending_payouts; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.x402_pending_payouts IS 'Tracks pending escrow payouts (creator markup on success) and refunds (markup refund on failure)';


--
-- Name: COLUMN x402_pending_payouts.type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_pending_payouts.type IS 'creator_payout = pay creator markup on job success; payer_refund = refund markup to payer on job failure';


--
-- Name: COLUMN x402_pending_payouts.recipient_address; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_pending_payouts.recipient_address IS 'Wallet address to send funds to';


--
-- Name: COLUMN x402_pending_payouts.creator_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_pending_payouts.creator_id IS 'User ID of the job creator (for creator_payout type)';


--
-- Name: COLUMN x402_pending_payouts.network; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_pending_payouts.network IS 'Blockchain network for the payout (solana or base)';


--
-- Name: COLUMN x402_pending_payouts.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_pending_payouts.status IS 'pending = awaiting processing; processing = currently being sent; completed = successfully sent; failed = send failed';


--
-- Name: COLUMN x402_pending_payouts.refund_breakdown; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_pending_payouts.refund_breakdown IS 'Breakdown of refund calculation: { creator_markup: number, unused_resources: number }';


--
-- Name: x402_platform_stats; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.x402_platform_stats (
    id text NOT NULL,
    value numeric(20,6) DEFAULT 0,
    count integer DEFAULT 0,
    updated_at timestamp with time zone DEFAULT now(),
    text_value text
);


--
-- Name: COLUMN x402_platform_stats.text_value; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_platform_stats.text_value IS 'Text value storage for string data like webhook IDs';


--
-- Name: x402_refunds; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.x402_refunds (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    refund_number integer NOT NULL,
    run_id uuid NOT NULL,
    job_id uuid NOT NULL,
    user_id uuid NOT NULL,
    amount numeric(10,6) NOT NULL,
    reason text,
    status text DEFAULT 'pending'::text NOT NULL,
    admin_notes text,
    resolved_at timestamp with time zone,
    resolved_by uuid,
    payout_signature text,
    payout_network text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    failed_event_id uuid
);


--
-- Name: x402_refunds_refund_number_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.x402_refunds_refund_number_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: x402_refunds_refund_number_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.x402_refunds_refund_number_seq OWNED BY public.x402_refunds.refund_number;


--
-- Name: x402_resource_executions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.x402_resource_executions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    resource_id uuid NOT NULL,
    user_id uuid,
    success boolean NOT NULL,
    status_code integer,
    amount_usdc numeric(20,6) DEFAULT 0,
    error_message text,
    executed_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE x402_resource_executions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.x402_resource_executions IS 'Tracks individual resource executions from the resource detail page for success/failure rate calculation';


--
-- Name: x402_scheduled_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.x402_scheduled_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    job_id uuid NOT NULL,
    job_run_id uuid,
    scheduled_for timestamp with time zone NOT NULL,
    cron_expression text NOT NULL,
    timezone text DEFAULT 'UTC'::text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    triggered_at timestamp with time zone,
    error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT x402_scheduled_runs_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'triggered'::text, 'skipped'::text, 'failed'::text])))
);


--
-- Name: TABLE x402_scheduled_runs; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.x402_scheduled_runs IS 'Tracks scheduled job executions for auditing and debugging';


--
-- Name: x402_servers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.x402_servers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    origin_url text NOT NULL,
    name text NOT NULL,
    favicon_url text,
    description text,
    registered_by uuid,
    resource_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    slug text,
    total_earned_usdc numeric(20,6) DEFAULT 0,
    total_calls integer DEFAULT 0,
    stats_updated_at timestamp with time zone,
    verified_owner_id uuid,
    verified_at timestamp with time zone,
    verification_code text,
    verification_expires_at timestamp with time zone,
    discovered_via text DEFAULT 'manual'::text,
    is_verified_onchain boolean DEFAULT false,
    last_transaction_at timestamp with time zone,
    transaction_count integer DEFAULT 0,
    flags text[] DEFAULT '{}'::text[],
    facilitator_ids uuid[] DEFAULT '{}'::uuid[],
    last_health_check_at timestamp with time zone,
    is_responsive boolean DEFAULT true,
    is_hosted boolean DEFAULT false,
    CONSTRAINT x402_servers_discovered_via_check CHECK ((discovered_via = ANY (ARRAY['manual'::text, 'bazaar'::text, 'onchain'::text])))
);


--
-- Name: TABLE x402_servers; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.x402_servers IS 'Servers/providers that host X402 resources. Each unique domain gets one server entry.';


--
-- Name: COLUMN x402_servers.origin_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_servers.origin_url IS 'The root URL (protocol + host) e.g., https://api.memeputer.com';


--
-- Name: COLUMN x402_servers.resource_count; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_servers.resource_count IS 'Number of resources registered under this server (auto-updated)';


--
-- Name: COLUMN x402_servers.total_earned_usdc; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_servers.total_earned_usdc IS 'Sum of total_earned_usdc from all active resources. Updated by cron job.';


--
-- Name: COLUMN x402_servers.total_calls; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_servers.total_calls IS 'Sum of call_count from all active resources. Updated by cron job.';


--
-- Name: COLUMN x402_servers.stats_updated_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_servers.stats_updated_at IS 'Last time the stats were aggregated.';


--
-- Name: COLUMN x402_servers.verified_owner_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_servers.verified_owner_id IS 'User who has verified ownership of this server via /.well-known/x402-verification.json';


--
-- Name: COLUMN x402_servers.verified_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_servers.verified_at IS 'When server ownership was verified';


--
-- Name: COLUMN x402_servers.verification_code; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_servers.verification_code IS 'Temporary code for ownership verification (cleared after verification)';


--
-- Name: COLUMN x402_servers.verification_expires_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_servers.verification_expires_at IS 'When the verification code expires';


--
-- Name: COLUMN x402_servers.discovered_via; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_servers.discovered_via IS 'How the server was discovered: manual registration, bazaar API, or on-chain activity';


--
-- Name: COLUMN x402_servers.flags; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_servers.flags IS 'Discrepancy flags: NO_ONCHAIN_ACTIVITY, NOT_IN_BAZAAR, UNRESPONSIVE, etc.';


--
-- Name: COLUMN x402_servers.is_hosted; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_servers.is_hosted IS 'Whether this is a user personal hosted server for instant resources';


--
-- Name: x402_sponsors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.x402_sponsors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    description text,
    image_url text,
    website text,
    x_url text,
    telegram_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    display_name text,
    representative_x_url text
);


--
-- Name: x402_stats_hourly; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.x402_stats_hourly (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bucket timestamp with time zone NOT NULL,
    server_id uuid,
    facilitator_id uuid,
    network text DEFAULT 'all'::text NOT NULL,
    transaction_count integer DEFAULT 0,
    volume_usdc numeric(18,6) DEFAULT 0,
    unique_buyers integer DEFAULT 0,
    unique_sellers integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE x402_stats_hourly; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.x402_stats_hourly IS 'Hourly aggregated stats for time-series visualization';


--
-- Name: x402_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.x402_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    signature text NOT NULL,
    server_id uuid,
    resource_id uuid,
    facilitator_id uuid,
    sender_address text NOT NULL,
    receiver_address text NOT NULL,
    amount_raw text NOT NULL,
    amount_usdc numeric(18,6),
    asset text NOT NULL,
    network text NOT NULL,
    block_time timestamp with time zone NOT NULL,
    slot bigint,
    status text DEFAULT 'confirmed'::text,
    raw_data jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT x402_transactions_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'failed'::text])))
);


--
-- Name: TABLE x402_transactions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.x402_transactions IS 'On-chain x402 payment transactions indexed from Solana/Base';


--
-- Name: x402_user_claude_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.x402_user_claude_configs (
    user_id uuid NOT NULL,
    api_key_encrypted text NOT NULL,
    is_enabled boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: x402_user_telegram_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.x402_user_telegram_configs (
    user_id uuid NOT NULL,
    bot_token text NOT NULL,
    default_chat_id text,
    is_enabled boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE x402_user_telegram_configs; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.x402_user_telegram_configs IS 'User Telegram bot configuration for x402.jobs (bot token + optional default chat).';


--
-- Name: COLUMN x402_user_telegram_configs.bot_token; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_user_telegram_configs.bot_token IS 'Telegram bot token (sensitive).';


--
-- Name: COLUMN x402_user_telegram_configs.default_chat_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_user_telegram_configs.default_chat_id IS 'Default chat id/channel to post to.';


--
-- Name: x402_user_wallets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.x402_user_wallets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    address text NOT NULL,
    encrypted_private_key text NOT NULL,
    balance_usdc numeric(10,6) DEFAULT 0,
    total_spent_usdc numeric(10,6) DEFAULT 0,
    total_jobs_run integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    base_address text,
    base_encrypted_private_key text
);


--
-- Name: TABLE x402_user_wallets; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.x402_user_wallets IS 'User wallets for funding X402 job executions. Each user gets one wallet on signup.';


--
-- Name: COLUMN x402_user_wallets.encrypted_private_key; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_user_wallets.encrypted_private_key IS 'Base64 encoded private key for signing X402 payments.';


--
-- Name: x402_user_x_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.x402_user_x_tokens (
    user_id uuid NOT NULL,
    access_token text NOT NULL,
    access_secret text NOT NULL,
    username text,
    display_name text,
    profile_image_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE x402_user_x_tokens; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.x402_user_x_tokens IS 'User OAuth tokens for posting to X (Twitter) from x402.jobs.';


--
-- Name: COLUMN x402_user_x_tokens.access_token; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_user_x_tokens.access_token IS 'OAuth access token (sensitive).';


--
-- Name: COLUMN x402_user_x_tokens.access_secret; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.x402_user_x_tokens.access_secret IS 'OAuth access secret (sensitive).';


--
-- Name: x402_refunds refund_number; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_refunds ALTER COLUMN refund_number SET DEFAULT nextval('public.x402_refunds_refund_number_seq'::regclass);


--
-- Name: api_keys api_keys_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_key_key UNIQUE (key);


--
-- Name: api_keys api_keys_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_username_key UNIQUE (username);


--
-- Name: x402_refunds unique_refund_per_run; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_refunds
    ADD CONSTRAINT unique_refund_per_run UNIQUE (run_id);


--
-- Name: x402_cached_images x402_cached_images_original_url_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_cached_images
    ADD CONSTRAINT x402_cached_images_original_url_key UNIQUE (original_url);


--
-- Name: x402_cached_images x402_cached_images_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_cached_images
    ADD CONSTRAINT x402_cached_images_pkey PRIMARY KEY (id);


--
-- Name: x402_external_wallet_links x402_external_wallet_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_external_wallet_links
    ADD CONSTRAINT x402_external_wallet_links_pkey PRIMARY KEY (id);


--
-- Name: x402_external_wallet_links x402_external_wallet_links_unique_pair; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_external_wallet_links
    ADD CONSTRAINT x402_external_wallet_links_unique_pair UNIQUE (user_id, external_wallet_address);


--
-- Name: x402_external_wallet_links x402_external_wallet_links_unique_wallet; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_external_wallet_links
    ADD CONSTRAINT x402_external_wallet_links_unique_wallet UNIQUE (external_wallet_address);


--
-- Name: x402_facilitator_addresses x402_facilitator_addresses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_facilitator_addresses
    ADD CONSTRAINT x402_facilitator_addresses_pkey PRIMARY KEY (id);


--
-- Name: x402_facilitator_addresses x402_facilitator_addresses_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_facilitator_addresses
    ADD CONSTRAINT x402_facilitator_addresses_unique UNIQUE (address, network);


--
-- Name: x402_facilitators x402_facilitators_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_facilitators
    ADD CONSTRAINT x402_facilitators_pkey PRIMARY KEY (id);


--
-- Name: x402_facilitators x402_facilitators_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_facilitators
    ADD CONSTRAINT x402_facilitators_slug_key UNIQUE (slug);


--
-- Name: x402_hackathon_sponsors x402_hackathon_sponsors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_hackathon_sponsors
    ADD CONSTRAINT x402_hackathon_sponsors_pkey PRIMARY KEY (hackathon_id, sponsor_id);


--
-- Name: x402_hackathon_submissions x402_hackathon_submissions_hackathon_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_hackathon_submissions
    ADD CONSTRAINT x402_hackathon_submissions_hackathon_id_user_id_key UNIQUE (hackathon_id, user_id);


--
-- Name: x402_hackathon_submissions x402_hackathon_submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_hackathon_submissions
    ADD CONSTRAINT x402_hackathon_submissions_pkey PRIMARY KEY (id);


--
-- Name: x402_hackathon_winners x402_hackathon_winners_hackathon_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_hackathon_winners
    ADD CONSTRAINT x402_hackathon_winners_hackathon_id_key UNIQUE (hackathon_id);


--
-- Name: x402_hackathon_winners x402_hackathon_winners_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_hackathon_winners
    ADD CONSTRAINT x402_hackathon_winners_pkey PRIMARY KEY (id);


--
-- Name: x402_hackathons x402_hackathons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_hackathons
    ADD CONSTRAINT x402_hackathons_pkey PRIMARY KEY (id);


--
-- Name: x402_hackathons x402_hackathons_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_hackathons
    ADD CONSTRAINT x402_hackathons_slug_key UNIQUE (slug);


--
-- Name: x402_hiring_escrow_ledger x402_hiring_escrow_ledger_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_hiring_escrow_ledger
    ADD CONSTRAINT x402_hiring_escrow_ledger_pkey PRIMARY KEY (id);


--
-- Name: x402_hiring_payouts x402_hiring_payouts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_hiring_payouts
    ADD CONSTRAINT x402_hiring_payouts_pkey PRIMARY KEY (id);


--
-- Name: x402_hiring_requests x402_hiring_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_hiring_requests
    ADD CONSTRAINT x402_hiring_requests_pkey PRIMARY KEY (id);


--
-- Name: x402_hiring_reviews x402_hiring_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_hiring_reviews
    ADD CONSTRAINT x402_hiring_reviews_pkey PRIMARY KEY (id);


--
-- Name: x402_hiring_reviews x402_hiring_reviews_unique_review; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_hiring_reviews
    ADD CONSTRAINT x402_hiring_reviews_unique_review UNIQUE (submission_id, reviewer_user_id);


--
-- Name: x402_hiring_submissions x402_hiring_submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_hiring_submissions
    ADD CONSTRAINT x402_hiring_submissions_pkey PRIMARY KEY (id);


--
-- Name: x402_job_run_events x402_job_run_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_job_run_events
    ADD CONSTRAINT x402_job_run_events_pkey PRIMARY KEY (id);


--
-- Name: x402_job_runs x402_job_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_job_runs
    ADD CONSTRAINT x402_job_runs_pkey PRIMARY KEY (id);


--
-- Name: x402_jobs x402_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_jobs
    ADD CONSTRAINT x402_jobs_pkey PRIMARY KEY (id);


--
-- Name: x402_jobs_rewards_claims x402_jobs_rewards_claims_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_jobs_rewards_claims
    ADD CONSTRAINT x402_jobs_rewards_claims_pkey PRIMARY KEY (id);


--
-- Name: x402_jobs_rewards_config x402_jobs_rewards_config_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_jobs_rewards_config
    ADD CONSTRAINT x402_jobs_rewards_config_key_key UNIQUE (key);


--
-- Name: x402_jobs_rewards_config x402_jobs_rewards_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_jobs_rewards_config
    ADD CONSTRAINT x402_jobs_rewards_config_pkey PRIMARY KEY (id);


--
-- Name: x402_jobs_rewards_excluded_wallets x402_jobs_rewards_excluded_wallets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_jobs_rewards_excluded_wallets
    ADD CONSTRAINT x402_jobs_rewards_excluded_wallets_pkey PRIMARY KEY (id);


--
-- Name: x402_jobs_rewards_excluded_wallets x402_jobs_rewards_excluded_wallets_wallet_address_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_jobs_rewards_excluded_wallets
    ADD CONSTRAINT x402_jobs_rewards_excluded_wallets_wallet_address_key UNIQUE (wallet_address);


--
-- Name: x402_jobs_rewards_ledger x402_jobs_rewards_ledger_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_jobs_rewards_ledger
    ADD CONSTRAINT x402_jobs_rewards_ledger_pkey PRIMARY KEY (id);


--
-- Name: x402_jobs_rewards_ledger x402_jobs_rewards_ledger_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_jobs_rewards_ledger
    ADD CONSTRAINT x402_jobs_rewards_ledger_unique UNIQUE (wallet_address, period);


--
-- Name: x402_jobs_rewards_snapshots x402_jobs_rewards_snapshots_period_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_jobs_rewards_snapshots
    ADD CONSTRAINT x402_jobs_rewards_snapshots_period_key UNIQUE (period);


--
-- Name: x402_jobs_rewards_snapshots x402_jobs_rewards_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_jobs_rewards_snapshots
    ADD CONSTRAINT x402_jobs_rewards_snapshots_pkey PRIMARY KEY (id);


--
-- Name: x402_jobs_rewards_treasury_transfers x402_jobs_rewards_treasury_transfers_period_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_jobs_rewards_treasury_transfers
    ADD CONSTRAINT x402_jobs_rewards_treasury_transfers_period_key UNIQUE (period);


--
-- Name: x402_jobs_rewards_treasury_transfers x402_jobs_rewards_treasury_transfers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_jobs_rewards_treasury_transfers
    ADD CONSTRAINT x402_jobs_rewards_treasury_transfers_pkey PRIMARY KEY (id);


--
-- Name: x402_notifications x402_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_notifications
    ADD CONSTRAINT x402_notifications_pkey PRIMARY KEY (id);


--
-- Name: x402_openrouter_models x402_openrouter_models_openrouter_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_openrouter_models
    ADD CONSTRAINT x402_openrouter_models_openrouter_id_key UNIQUE (openrouter_id);


--
-- Name: x402_openrouter_models x402_openrouter_models_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_openrouter_models
    ADD CONSTRAINT x402_openrouter_models_pkey PRIMARY KEY (id);


--
-- Name: x402_pending_payouts x402_pending_payouts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_pending_payouts
    ADD CONSTRAINT x402_pending_payouts_pkey PRIMARY KEY (id);


--
-- Name: x402_platform_stats x402_platform_stats_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_platform_stats
    ADD CONSTRAINT x402_platform_stats_pkey PRIMARY KEY (id);


--
-- Name: x402_refunds x402_refunds_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_refunds
    ADD CONSTRAINT x402_refunds_pkey PRIMARY KEY (id);


--
-- Name: x402_resource_executions x402_resource_executions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_resource_executions
    ADD CONSTRAINT x402_resource_executions_pkey PRIMARY KEY (id);


--
-- Name: x402_resources x402_resources_normalized_url_network_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_resources
    ADD CONSTRAINT x402_resources_normalized_url_network_unique UNIQUE (normalized_url, network);


--
-- Name: x402_resources x402_resources_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_resources
    ADD CONSTRAINT x402_resources_pkey PRIMARY KEY (id);


--
-- Name: x402_scheduled_runs x402_scheduled_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_scheduled_runs
    ADD CONSTRAINT x402_scheduled_runs_pkey PRIMARY KEY (id);


--
-- Name: x402_servers x402_servers_origin_url_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_servers
    ADD CONSTRAINT x402_servers_origin_url_key UNIQUE (origin_url);


--
-- Name: x402_servers x402_servers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_servers
    ADD CONSTRAINT x402_servers_pkey PRIMARY KEY (id);


--
-- Name: x402_sponsors x402_sponsors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_sponsors
    ADD CONSTRAINT x402_sponsors_pkey PRIMARY KEY (id);


--
-- Name: x402_sponsors x402_sponsors_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_sponsors
    ADD CONSTRAINT x402_sponsors_slug_key UNIQUE (slug);


--
-- Name: x402_stats_hourly x402_stats_hourly_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_stats_hourly
    ADD CONSTRAINT x402_stats_hourly_pkey PRIMARY KEY (id);


--
-- Name: x402_transactions x402_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_transactions
    ADD CONSTRAINT x402_transactions_pkey PRIMARY KEY (id);


--
-- Name: x402_transactions x402_transactions_signature_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_transactions
    ADD CONSTRAINT x402_transactions_signature_key UNIQUE (signature);


--
-- Name: x402_user_claude_configs x402_user_claude_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_user_claude_configs
    ADD CONSTRAINT x402_user_claude_configs_pkey PRIMARY KEY (user_id);


--
-- Name: x402_user_telegram_configs x402_user_telegram_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_user_telegram_configs
    ADD CONSTRAINT x402_user_telegram_configs_pkey PRIMARY KEY (user_id);


--
-- Name: x402_user_wallets x402_user_wallets_address_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_user_wallets
    ADD CONSTRAINT x402_user_wallets_address_key UNIQUE (address);


--
-- Name: x402_user_wallets x402_user_wallets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_user_wallets
    ADD CONSTRAINT x402_user_wallets_pkey PRIMARY KEY (id);


--
-- Name: x402_user_wallets x402_user_wallets_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_user_wallets
    ADD CONSTRAINT x402_user_wallets_user_id_key UNIQUE (user_id);


--
-- Name: x402_user_x_tokens x402_user_x_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_user_x_tokens
    ADD CONSTRAINT x402_user_x_tokens_pkey PRIMARY KEY (user_id);


--
-- Name: idx_api_keys_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_api_keys_active ON public.api_keys USING btree (is_active, created_at DESC);


--
-- Name: idx_api_keys_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_api_keys_created_by ON public.api_keys USING btree (created_by);


--
-- Name: idx_api_keys_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_api_keys_key ON public.api_keys USING btree (key) WHERE (is_active = true);


--
-- Name: idx_claude_configs_user_enabled; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_claude_configs_user_enabled ON public.x402_user_claude_configs USING btree (user_id, is_enabled);


--
-- Name: idx_facilitator_addresses_address; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_facilitator_addresses_address ON public.x402_facilitator_addresses USING btree (address);


--
-- Name: idx_facilitator_addresses_facilitator; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_facilitator_addresses_facilitator ON public.x402_facilitator_addresses USING btree (facilitator_id);


--
-- Name: idx_facilitator_addresses_network; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_facilitator_addresses_network ON public.x402_facilitator_addresses USING btree (network);


--
-- Name: idx_hackathon_sponsors_hackathon; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hackathon_sponsors_hackathon ON public.x402_hackathon_sponsors USING btree (hackathon_id);


--
-- Name: idx_hackathon_sponsors_sponsor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hackathon_sponsors_sponsor ON public.x402_hackathon_sponsors USING btree (sponsor_id);


--
-- Name: idx_hackathon_submissions_hackathon; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hackathon_submissions_hackathon ON public.x402_hackathon_submissions USING btree (hackathon_id);


--
-- Name: idx_hackathon_submissions_job; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hackathon_submissions_job ON public.x402_hackathon_submissions USING btree (job_id);


--
-- Name: idx_hackathon_submissions_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hackathon_submissions_user ON public.x402_hackathon_submissions USING btree (user_id);


--
-- Name: idx_hackathon_winners_hackathon; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hackathon_winners_hackathon ON public.x402_hackathon_winners USING btree (hackathon_id);


--
-- Name: idx_hackathons_ends_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hackathons_ends_at ON public.x402_hackathons USING btree (ends_at);


--
-- Name: idx_hackathons_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hackathons_number ON public.x402_hackathons USING btree (number);


--
-- Name: idx_hackathons_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hackathons_status ON public.x402_hackathons USING btree (status);


--
-- Name: idx_pending_payouts_creator_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pending_payouts_creator_id ON public.x402_pending_payouts USING btree (creator_id);


--
-- Name: idx_pending_payouts_job_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pending_payouts_job_id ON public.x402_pending_payouts USING btree (job_id);


--
-- Name: idx_pending_payouts_run_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pending_payouts_run_id ON public.x402_pending_payouts USING btree (run_id);


--
-- Name: idx_pending_payouts_run_type_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_pending_payouts_run_type_unique ON public.x402_pending_payouts USING btree (run_id, type) WHERE (run_id IS NOT NULL);


--
-- Name: INDEX idx_pending_payouts_run_type_unique; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_pending_payouts_run_type_unique IS 'Ensures each run has at most one payout and one refund record';


--
-- Name: idx_pending_payouts_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pending_payouts_status ON public.x402_pending_payouts USING btree (status) WHERE (status = 'pending'::text);


--
-- Name: idx_refunds_status_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_refunds_status_created ON public.x402_refunds USING btree (status, created_at DESC);


--
-- Name: idx_refunds_user_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_refunds_user_created ON public.x402_refunds USING btree (user_id, created_at DESC);


--
-- Name: idx_resource_executions_executed_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_resource_executions_executed_at ON public.x402_resource_executions USING btree (executed_at);


--
-- Name: idx_resource_executions_resource_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_resource_executions_resource_id ON public.x402_resource_executions USING btree (resource_id);


--
-- Name: idx_resource_executions_resource_success; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_resource_executions_resource_success ON public.x402_resource_executions USING btree (resource_id, success, executed_at DESC);


--
-- Name: idx_resource_executions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_resource_executions_user_id ON public.x402_resource_executions USING btree (user_id);


--
-- Name: idx_resources_capabilities; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_resources_capabilities ON public.x402_resources USING gin (capabilities);


--
-- Name: idx_resources_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_resources_category ON public.x402_resources USING btree (category);


--
-- Name: idx_resources_last_called_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_resources_last_called_at ON public.x402_resources USING btree (last_called_at DESC NULLS LAST) WHERE (is_active = true);


--
-- Name: idx_resources_network_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_resources_network_category ON public.x402_resources USING btree (network, category);


--
-- Name: idx_resources_search_vector; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_resources_search_vector ON public.x402_resources USING gin (search_vector);


--
-- Name: idx_resources_success_rate; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_resources_success_rate ON public.x402_resources USING btree ((
CASE
    WHEN ((success_count_30d + failure_count_30d) >= 10) THEN ((success_count_30d)::double precision / ((success_count_30d + failure_count_30d))::double precision)
    ELSE NULL::double precision
END) DESC NULLS LAST) WHERE (is_active = true);


--
-- Name: idx_resources_tags; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_resources_tags ON public.x402_resources USING gin (tags);


--
-- Name: idx_servers_total_earned; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_servers_total_earned ON public.x402_servers USING btree (total_earned_usdc DESC);


--
-- Name: idx_sponsors_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sponsors_slug ON public.x402_sponsors USING btree (slug);


--
-- Name: idx_x402_cached_images_original_url; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_x402_cached_images_original_url ON public.x402_cached_images USING btree (original_url);


--
-- Name: idx_x402_cached_images_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_x402_cached_images_type ON public.x402_cached_images USING btree (type);


--
-- Name: idx_x402_external_wallet_links_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_x402_external_wallet_links_user ON public.x402_external_wallet_links USING btree (user_id);


--
-- Name: idx_x402_external_wallet_links_wallet; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_x402_external_wallet_links_wallet ON public.x402_external_wallet_links USING btree (external_wallet_address);


--
-- Name: idx_x402_facilitators_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_x402_facilitators_active ON public.x402_facilitators USING btree (is_active) WHERE (is_active = true);


--
-- Name: idx_x402_facilitators_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_x402_facilitators_slug ON public.x402_facilitators USING btree (slug);


--
-- Name: idx_x402_hiring_escrow_ledger_request; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_x402_hiring_escrow_ledger_request ON public.x402_hiring_escrow_ledger USING btree (request_id);


--
-- Name: idx_x402_hiring_escrow_ledger_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_x402_hiring_escrow_ledger_type ON public.x402_hiring_escrow_ledger USING btree (transaction_type);


--
-- Name: idx_x402_hiring_payouts_request; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_x402_hiring_payouts_request ON public.x402_hiring_payouts USING btree (request_id);


--
-- Name: idx_x402_hiring_payouts_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_x402_hiring_payouts_status ON public.x402_hiring_payouts USING btree (status) WHERE (status = 'pending'::text);


--
-- Name: idx_x402_hiring_requests_bounty; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_x402_hiring_requests_bounty ON public.x402_hiring_requests USING btree (bounty_amount DESC) WHERE (status = 'open'::text);


--
-- Name: idx_x402_hiring_requests_creator; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_x402_hiring_requests_creator ON public.x402_hiring_requests USING btree (creator_user_id);


--
-- Name: idx_x402_hiring_requests_search; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_x402_hiring_requests_search ON public.x402_hiring_requests USING gin (to_tsvector('english'::regconfig, ((title || ' '::text) || description)));


--
-- Name: idx_x402_hiring_requests_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_x402_hiring_requests_status ON public.x402_hiring_requests USING btree (status) WHERE (status = 'open'::text);


--
-- Name: idx_x402_hiring_requests_tags; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_x402_hiring_requests_tags ON public.x402_hiring_requests USING gin (tags);


--
-- Name: idx_x402_hiring_reviews_reviewer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_x402_hiring_reviews_reviewer ON public.x402_hiring_reviews USING btree (reviewer_user_id);


--
-- Name: idx_x402_hiring_reviews_submission; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_x402_hiring_reviews_submission ON public.x402_hiring_reviews USING btree (submission_id);


--
-- Name: idx_x402_hiring_submissions_request; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_x402_hiring_submissions_request ON public.x402_hiring_submissions USING btree (request_id);


--
-- Name: idx_x402_hiring_submissions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_x402_hiring_submissions_status ON public.x402_hiring_submissions USING btree (status);


--
-- Name: idx_x402_hiring_submissions_submitter; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_x402_hiring_submissions_submitter ON public.x402_hiring_submissions USING btree (submitter_user_id) WHERE (submitter_user_id IS NOT NULL);


--
-- Name: idx_x402_job_run_events_node_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_x402_job_run_events_node_id ON public.x402_job_run_events USING btree (node_id);


--
-- Name: idx_x402_job_run_events_run_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_x402_job_run_events_run_id ON public.x402_job_run_events USING btree (run_id);


--
-- Name: idx_x402_job_run_events_sequence; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_x402_job_run_events_sequence ON public.x402_job_run_events USING btree (run_id, sequence);


--
-- Name: idx_x402_job_run_events_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_x402_job_run_events_status ON public.x402_job_run_events USING btree (status);


--
-- Name: idx_x402_job_runs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_x402_job_runs_created_at ON public.x402_job_runs USING btree (created_at DESC);


--
-- Name: idx_x402_job_runs_job; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_x402_job_runs_job ON public.x402_job_runs USING btree (job_id, created_at DESC);


--
-- Name: idx_x402_job_runs_payment_source_chain; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_x402_job_runs_payment_source_chain ON public.x402_job_runs USING btree (payment_source_chain) WHERE (payment_source_chain IS NOT NULL);


--
-- Name: idx_x402_job_runs_refund_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_x402_job_runs_refund_status ON public.x402_job_runs USING btree (refund_status) WHERE (refund_status IS NOT NULL);


--
-- Name: idx_x402_job_runs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_x402_job_runs_status ON public.x402_job_runs USING btree (status) WHERE (status = ANY (ARRAY['pending'::text, 'running'::text]));


--
-- Name: idx_x402_job_runs_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_x402_job_runs_user_id ON public.x402_job_runs USING btree (user_id);


--
-- Name: idx_x402_jobs_display_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_x402_jobs_display_id ON public.x402_jobs USING btree (display_id);


--
-- Name: idx_x402_jobs_earnings; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_x402_jobs_earnings ON public.x402_jobs USING btree (total_earnings_usdc DESC) WHERE (is_public = true);


--
-- Name: idx_x402_jobs_network; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_x402_jobs_network ON public.x402_jobs USING btree (network);


--
-- Name: idx_x402_jobs_on_success; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_x402_jobs_on_success ON public.x402_jobs USING btree (on_success_job_id) WHERE (on_success_job_id IS NOT NULL);


--
-- Name: idx_x402_jobs_published; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_x402_jobs_published ON public.x402_jobs USING btree (published) WHERE (published = true);


--
-- Name: idx_x402_jobs_rewards_claims_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_x402_jobs_rewards_claims_user ON public.x402_jobs_rewards_claims USING btree (user_id);


--
-- Name: idx_x402_jobs_rewards_claims_wallet; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_x402_jobs_rewards_claims_wallet ON public.x402_jobs_rewards_claims USING btree (wallet_address);


--
-- Name: idx_x402_jobs_rewards_ledger_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_x402_jobs_rewards_ledger_pending ON public.x402_jobs_rewards_ledger USING btree (wallet_address) WHERE (status = 'pending'::text);


--
-- Name: idx_x402_jobs_rewards_ledger_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_x402_jobs_rewards_ledger_period ON public.x402_jobs_rewards_ledger USING btree (period);


--
-- Name: idx_x402_jobs_rewards_ledger_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_x402_jobs_rewards_ledger_status ON public.x402_jobs_rewards_ledger USING btree (status);


--
-- Name: idx_x402_jobs_rewards_ledger_wallet; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_x402_jobs_rewards_ledger_wallet ON public.x402_jobs_rewards_ledger USING btree (wallet_address);


--
-- Name: idx_x402_jobs_rewards_snapshots_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_x402_jobs_rewards_snapshots_period ON public.x402_jobs_rewards_snapshots USING btree (period);


--
-- Name: idx_x402_jobs_rewards_snapshots_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_x402_jobs_rewards_snapshots_status ON public.x402_jobs_rewards_snapshots USING btree (status);


--
-- Name: idx_x402_jobs_schedule_enabled; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_x402_jobs_schedule_enabled ON public.x402_jobs USING btree (schedule_enabled, user_id) WHERE (schedule_enabled = true);


--
-- Name: idx_x402_jobs_schedule_next_run; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_x402_jobs_schedule_next_run ON public.x402_jobs USING btree (schedule_next_run_at) WHERE ((schedule_enabled = true) AND (schedule_next_run_at IS NOT NULL));


--
-- Name: idx_x402_jobs_trigger; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_x402_jobs_trigger ON public.x402_jobs USING btree (trigger_type, is_active) WHERE (trigger_type <> 'manual'::text);


--
-- Name: idx_x402_jobs_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_x402_jobs_user ON public.x402_jobs USING btree (user_id, is_active);


--
-- Name: idx_x402_notifications_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_x402_notifications_created ON public.x402_notifications USING btree (created_at DESC);


--
-- Name: idx_x402_notifications_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_x402_notifications_user ON public.x402_notifications USING btree (user_id);


--
-- Name: idx_x402_notifications_user_unread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_x402_notifications_user_unread ON public.x402_notifications USING btree (user_id, read) WHERE (read = false);


--
-- Name: idx_x402_openrouter_models_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_x402_openrouter_models_is_active ON public.x402_openrouter_models USING btree (is_active);


--
-- Name: idx_x402_openrouter_models_openrouter_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_x402_openrouter_models_openrouter_id ON public.x402_openrouter_models USING btree (openrouter_id);


--
-- Name: idx_x402_openrouter_models_provider; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_x402_openrouter_models_provider ON public.x402_openrouter_models USING btree (provider);


--
-- Name: idx_x402_resources_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_x402_resources_category ON public.x402_resources USING btree (category) WHERE (category IS NOT NULL);


--
-- Name: idx_x402_resources_display_path; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_x402_resources_display_path ON public.x402_resources USING btree (display_path);


--
-- Name: idx_x402_resources_earnings; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_x402_resources_earnings ON public.x402_resources USING btree (total_earned_usdc DESC) WHERE (is_active = true);


--
-- Name: idx_x402_resources_health_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_x402_resources_health_status ON public.x402_resources USING btree (health_status) WHERE (is_active = true);


--
-- Name: idx_x402_resources_network; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_x402_resources_network ON public.x402_resources USING btree (network, is_active);


--
-- Name: idx_x402_resources_normalized_url_network; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_x402_resources_normalized_url_network ON public.x402_resources USING btree (normalized_url, network);


--
-- Name: idx_x402_resources_registered_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_x402_resources_registered_by ON public.x402_resources USING btree (registered_by);


--
-- Name: idx_x402_resources_resource_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_x402_resources_resource_type ON public.x402_resources USING btree (resource_type);


--
-- Name: idx_x402_resources_resource_url; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_x402_resources_resource_url ON public.x402_resources USING btree (resource_url);


--
-- Name: idx_x402_resources_search; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_x402_resources_search ON public.x402_resources USING gin (to_tsvector('english'::regconfig, ((name || ' '::text) || COALESCE(description, ''::text))));


--
-- Name: idx_x402_resources_server; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_x402_resources_server ON public.x402_resources USING btree (server_id);


--
-- Name: idx_x402_resources_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_x402_resources_type ON public.x402_resources USING btree (resource_type);


--
-- Name: idx_x402_resources_verified_owner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_x402_resources_verified_owner ON public.x402_resources USING btree (verified_owner_id) WHERE (verified_owner_id IS NOT NULL);


--
-- Name: idx_x402_scheduled_runs_job; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_x402_scheduled_runs_job ON public.x402_scheduled_runs USING btree (job_id, created_at DESC);


--
-- Name: idx_x402_scheduled_runs_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_x402_scheduled_runs_pending ON public.x402_scheduled_runs USING btree (scheduled_for) WHERE (status = 'pending'::text);


--
-- Name: idx_x402_servers_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_x402_servers_created_at ON public.x402_servers USING btree (created_at DESC);


--
-- Name: idx_x402_servers_is_hosted; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_x402_servers_is_hosted ON public.x402_servers USING btree (is_hosted) WHERE (is_hosted = true);


--
-- Name: idx_x402_servers_registered_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_x402_servers_registered_by ON public.x402_servers USING btree (registered_by);


--
-- Name: idx_x402_servers_verified_owner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_x402_servers_verified_owner ON public.x402_servers USING btree (verified_owner_id) WHERE (verified_owner_id IS NOT NULL);


--
-- Name: idx_x402_stats_hourly_bucket; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_x402_stats_hourly_bucket ON public.x402_stats_hourly USING btree (bucket DESC);


--
-- Name: idx_x402_stats_hourly_facilitator; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_x402_stats_hourly_facilitator ON public.x402_stats_hourly USING btree (facilitator_id, bucket DESC) WHERE (facilitator_id IS NOT NULL);


--
-- Name: idx_x402_stats_hourly_network; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_x402_stats_hourly_network ON public.x402_stats_hourly USING btree (network, bucket DESC);


--
-- Name: idx_x402_stats_hourly_server; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_x402_stats_hourly_server ON public.x402_stats_hourly USING btree (server_id, bucket DESC) WHERE (server_id IS NOT NULL);


--
-- Name: idx_x402_stats_hourly_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_x402_stats_hourly_unique ON public.x402_stats_hourly USING btree (bucket, COALESCE(server_id, '00000000-0000-0000-0000-000000000000'::uuid), network);


--
-- Name: idx_x402_transactions_block_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_x402_transactions_block_time ON public.x402_transactions USING btree (block_time DESC);


--
-- Name: idx_x402_transactions_facilitator; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_x402_transactions_facilitator ON public.x402_transactions USING btree (facilitator_id);


--
-- Name: idx_x402_transactions_network; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_x402_transactions_network ON public.x402_transactions USING btree (network);


--
-- Name: idx_x402_transactions_network_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_x402_transactions_network_time ON public.x402_transactions USING btree (network, block_time DESC);


--
-- Name: idx_x402_transactions_receiver; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_x402_transactions_receiver ON public.x402_transactions USING btree (receiver_address);


--
-- Name: idx_x402_transactions_sender; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_x402_transactions_sender ON public.x402_transactions USING btree (sender_address);


--
-- Name: idx_x402_transactions_server; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_x402_transactions_server ON public.x402_transactions USING btree (server_id);


--
-- Name: idx_x402_user_wallets_address; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_x402_user_wallets_address ON public.x402_user_wallets USING btree (address);


--
-- Name: idx_x402_user_wallets_base; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_x402_user_wallets_base ON public.x402_user_wallets USING btree (base_address);


--
-- Name: profiles_username_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX profiles_username_idx ON public.profiles USING btree (username);


--
-- Name: x402_jobs_embedding_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX x402_jobs_embedding_idx ON public.x402_jobs USING ivfflat (embedding public.vector_cosine_ops) WITH (lists='100');


--
-- Name: x402_jobs_user_slug_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX x402_jobs_user_slug_unique ON public.x402_jobs USING btree (user_id, slug) WHERE (slug IS NOT NULL);


--
-- Name: x402_resources_server_slug_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX x402_resources_server_slug_unique ON public.x402_resources USING btree (server_id, slug) WHERE ((slug IS NOT NULL) AND (is_active = true));


--
-- Name: x402_servers_slug_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX x402_servers_slug_unique ON public.x402_servers USING btree (slug) WHERE (slug IS NOT NULL);


--
-- Name: x402_user_claude_configs claude_config_updated_at; Type: TRIGGER; Schema: public; Owner: -
--


-- Required trigger functions

CREATE OR REPLACE FUNCTION public.compute_resource_display_path()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  server_slug text;
BEGIN
  -- Get the server slug
  SELECT slug INTO server_slug 
  FROM public.x402_servers 
  WHERE id = NEW.server_id;
  
  -- Compute display_path as serverSlug/resourceSlug
  IF server_slug IS NOT NULL AND NEW.slug IS NOT NULL THEN
    NEW.display_path := server_slug || '/' || NEW.slug;
  ELSIF NEW.slug IS NOT NULL THEN
    NEW.display_path := NEW.slug;
  ELSE
    NEW.display_path := NULL;
  END IF;
  
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.set_current_timestamp_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.update_claude_config_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.update_hackathon_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.update_job_last_run()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  UPDATE x402_jobs 
  SET last_run_at = NEW.created_at
  WHERE id = NEW.job_id;
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.update_profiles_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.update_resource_search_vector()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.search_vector := 
    setweight(to_tsvector('english', COALESCE(NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(array_to_string(NEW.tags, ' '), '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(array_to_string(NEW.capabilities, ' '), '')), 'C');
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.update_resources_display_path_on_server_change()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- Update all resources belonging to this server
  UPDATE public.x402_resources
  SET display_path = NEW.slug || '/' || slug
  WHERE server_id = NEW.id AND slug IS NOT NULL;
  
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.update_server_resource_count()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.server_id IS NOT NULL THEN
    UPDATE public.x402_servers 
    SET resource_count = resource_count + 1, updated_at = NOW()
    WHERE id = NEW.server_id;
  ELSIF TG_OP = 'DELETE' AND OLD.server_id IS NOT NULL THEN
    UPDATE public.x402_servers 
    SET resource_count = resource_count - 1, updated_at = NOW()
    WHERE id = OLD.server_id;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.server_id IS DISTINCT FROM NEW.server_id THEN
      IF OLD.server_id IS NOT NULL THEN
        UPDATE public.x402_servers 
        SET resource_count = resource_count - 1, updated_at = NOW()
        WHERE id = OLD.server_id;
      END IF;
      IF NEW.server_id IS NOT NULL THEN
        UPDATE public.x402_servers 
        SET resource_count = resource_count + 1, updated_at = NOW()
        WHERE id = NEW.server_id;
      END IF;
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$function$
;
CREATE OR REPLACE FUNCTION public.update_x402_resource_stats_on_event_complete()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- Only update when event completes successfully
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    UPDATE x402_resources
    SET 
      call_count = call_count + 1,
      total_earned_usdc = total_earned_usdc + COALESCE(NEW.amount_paid, 0)
    WHERE id = NEW.resource_id;
  END IF;
  
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.update_x402_stats_on_run_complete()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  job_full_revenue BOOLEAN;
  revenue_amount DECIMAL(20, 6);
BEGIN
  -- Handle INSERT (for payment collector jobs that insert with completed status)
  IF TG_OP = 'INSERT' THEN
    IF NEW.status IN ('success', 'failed', 'completed') THEN
      -- Check if job has full_revenue_tracking enabled
      SELECT full_revenue_tracking INTO job_full_revenue
      FROM x402_jobs
      WHERE id = NEW.job_id;
      
      -- Calculate revenue based on flag
      IF job_full_revenue = true THEN
        revenue_amount := COALESCE(NEW.total_payment, 0);
      ELSE
        revenue_amount := COALESCE(NEW.creator_markup_earned, 0);
      END IF;
      
      UPDATE x402_jobs
      SET 
        run_count = COALESCE(run_count, 0) + 1,
        total_earnings_usdc = COALESCE(total_earnings_usdc, 0) + revenue_amount
      WHERE id = NEW.job_id;
    END IF;
    RETURN NEW;
  END IF;

  -- Handle UPDATE (existing logic for runs that transition to completed)
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status != NEW.status AND NEW.status IN ('success', 'failed', 'completed') THEN
      -- Check if job has full_revenue_tracking enabled
      SELECT full_revenue_tracking INTO job_full_revenue
      FROM x402_jobs
      WHERE id = NEW.job_id;
      
      -- Calculate revenue based on flag
      IF job_full_revenue = true THEN
        revenue_amount := COALESCE(NEW.total_payment, 0);
      ELSE
        revenue_amount := COALESCE(NEW.creator_markup_earned, 0);
      END IF;
      
      UPDATE x402_jobs
      SET 
        run_count = COALESCE(run_count, 0) + 1,
        total_earnings_usdc = COALESCE(total_earnings_usdc, 0) + revenue_amount
      WHERE id = NEW.job_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$
;

CREATE TRIGGER claude_config_updated_at BEFORE UPDATE ON public.x402_user_claude_configs FOR EACH ROW EXECUTE FUNCTION public.update_claude_config_updated_at();


--
-- Name: x402_hackathon_submissions hackathon_submissions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER hackathon_submissions_updated_at BEFORE UPDATE ON public.x402_hackathon_submissions FOR EACH ROW EXECUTE FUNCTION public.update_hackathon_updated_at();


--
-- Name: x402_hackathons hackathons_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER hackathons_updated_at BEFORE UPDATE ON public.x402_hackathons FOR EACH ROW EXECUTE FUNCTION public.update_hackathon_updated_at();


--
-- Name: profiles profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_profiles_updated_at();


--
-- Name: x402_user_telegram_configs set_timestamp_x402_user_telegram_configs; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_timestamp_x402_user_telegram_configs BEFORE UPDATE ON public.x402_user_telegram_configs FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();


--
-- Name: x402_user_x_tokens set_timestamp_x402_user_x_tokens; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_timestamp_x402_user_x_tokens BEFORE UPDATE ON public.x402_user_x_tokens FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();


--
-- Name: x402_sponsors sponsors_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER sponsors_updated_at BEFORE UPDATE ON public.x402_sponsors FOR EACH ROW EXECUTE FUNCTION public.update_hackathon_updated_at();


--
-- Name: x402_resources trg_compute_resource_display_path; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_compute_resource_display_path BEFORE INSERT OR UPDATE OF slug, server_id ON public.x402_resources FOR EACH ROW EXECUTE FUNCTION public.compute_resource_display_path();


--
-- Name: x402_resources trg_resource_search_vector; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_resource_search_vector BEFORE INSERT OR UPDATE OF name, description, tags, capabilities ON public.x402_resources FOR EACH ROW EXECUTE FUNCTION public.update_resource_search_vector();


--
-- Name: x402_servers trg_update_resources_on_server_slug_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_update_resources_on_server_slug_change AFTER UPDATE OF slug ON public.x402_servers FOR EACH ROW WHEN ((old.slug IS DISTINCT FROM new.slug)) EXECUTE FUNCTION public.update_resources_display_path_on_server_change();


--
-- Name: x402_job_runs trigger_update_job_last_run; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_job_last_run AFTER INSERT ON public.x402_job_runs FOR EACH ROW EXECUTE FUNCTION public.update_job_last_run();


--
-- Name: x402_resources trigger_update_server_resource_count; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_server_resource_count AFTER INSERT OR DELETE OR UPDATE ON public.x402_resources FOR EACH ROW EXECUTE FUNCTION public.update_server_resource_count();


--
-- Name: x402_job_run_events trigger_update_x402_resource_stats; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_x402_resource_stats AFTER UPDATE ON public.x402_job_run_events FOR EACH ROW EXECUTE FUNCTION public.update_x402_resource_stats_on_event_complete();


--
-- Name: x402_job_runs trigger_update_x402_stats; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_x402_stats AFTER INSERT OR UPDATE ON public.x402_job_runs FOR EACH ROW EXECUTE FUNCTION public.update_x402_stats_on_run_complete();


--
-- Name: x402_job_runs trigger_update_x402_stats_on_run_complete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_x402_stats_on_run_complete AFTER INSERT OR UPDATE ON public.x402_job_runs FOR EACH ROW EXECUTE FUNCTION public.update_x402_stats_on_run_complete();


--
-- Name: api_keys api_keys_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: x402_external_wallet_links x402_external_wallet_links_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_external_wallet_links
    ADD CONSTRAINT x402_external_wallet_links_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: x402_facilitator_addresses x402_facilitator_addresses_facilitator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_facilitator_addresses
    ADD CONSTRAINT x402_facilitator_addresses_facilitator_id_fkey FOREIGN KEY (facilitator_id) REFERENCES public.x402_facilitators(id) ON DELETE CASCADE;


--
-- Name: x402_hackathon_sponsors x402_hackathon_sponsors_hackathon_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_hackathon_sponsors
    ADD CONSTRAINT x402_hackathon_sponsors_hackathon_id_fkey FOREIGN KEY (hackathon_id) REFERENCES public.x402_hackathons(id) ON DELETE CASCADE;


--
-- Name: x402_hackathon_sponsors x402_hackathon_sponsors_sponsor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_hackathon_sponsors
    ADD CONSTRAINT x402_hackathon_sponsors_sponsor_id_fkey FOREIGN KEY (sponsor_id) REFERENCES public.x402_sponsors(id) ON DELETE CASCADE;


--
-- Name: x402_hackathon_submissions x402_hackathon_submissions_hackathon_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_hackathon_submissions
    ADD CONSTRAINT x402_hackathon_submissions_hackathon_id_fkey FOREIGN KEY (hackathon_id) REFERENCES public.x402_hackathons(id) ON DELETE CASCADE;


--
-- Name: x402_hackathon_submissions x402_hackathon_submissions_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_hackathon_submissions
    ADD CONSTRAINT x402_hackathon_submissions_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.x402_jobs(id) ON DELETE CASCADE;


--
-- Name: x402_hackathon_submissions x402_hackathon_submissions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_hackathon_submissions
    ADD CONSTRAINT x402_hackathon_submissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: x402_hackathon_winners x402_hackathon_winners_hackathon_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_hackathon_winners
    ADD CONSTRAINT x402_hackathon_winners_hackathon_id_fkey FOREIGN KEY (hackathon_id) REFERENCES public.x402_hackathons(id) ON DELETE CASCADE;


--
-- Name: x402_hackathon_winners x402_hackathon_winners_submission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_hackathon_winners
    ADD CONSTRAINT x402_hackathon_winners_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES public.x402_hackathon_submissions(id) ON DELETE CASCADE;


--
-- Name: x402_hiring_escrow_ledger x402_hiring_escrow_ledger_payout_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_hiring_escrow_ledger
    ADD CONSTRAINT x402_hiring_escrow_ledger_payout_id_fkey FOREIGN KEY (payout_id) REFERENCES public.x402_hiring_payouts(id) ON DELETE SET NULL;


--
-- Name: x402_hiring_escrow_ledger x402_hiring_escrow_ledger_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_hiring_escrow_ledger
    ADD CONSTRAINT x402_hiring_escrow_ledger_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.x402_hiring_requests(id) ON DELETE CASCADE;


--
-- Name: x402_hiring_escrow_ledger x402_hiring_escrow_ledger_submission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_hiring_escrow_ledger
    ADD CONSTRAINT x402_hiring_escrow_ledger_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES public.x402_hiring_submissions(id) ON DELETE SET NULL;


--
-- Name: x402_hiring_payouts x402_hiring_payouts_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_hiring_payouts
    ADD CONSTRAINT x402_hiring_payouts_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.x402_hiring_requests(id) ON DELETE CASCADE;


--
-- Name: x402_hiring_payouts x402_hiring_payouts_submission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_hiring_payouts
    ADD CONSTRAINT x402_hiring_payouts_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES public.x402_hiring_submissions(id) ON DELETE CASCADE;


--
-- Name: x402_hiring_requests x402_hiring_requests_creator_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_hiring_requests
    ADD CONSTRAINT x402_hiring_requests_creator_user_id_fkey FOREIGN KEY (creator_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: x402_hiring_reviews x402_hiring_reviews_reviewer_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_hiring_reviews
    ADD CONSTRAINT x402_hiring_reviews_reviewer_user_id_fkey FOREIGN KEY (reviewer_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: x402_hiring_reviews x402_hiring_reviews_submission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_hiring_reviews
    ADD CONSTRAINT x402_hiring_reviews_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES public.x402_hiring_submissions(id) ON DELETE CASCADE;


--
-- Name: x402_hiring_submissions x402_hiring_submissions_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_hiring_submissions
    ADD CONSTRAINT x402_hiring_submissions_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.x402_jobs(id) ON DELETE SET NULL;


--
-- Name: x402_hiring_submissions x402_hiring_submissions_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_hiring_submissions
    ADD CONSTRAINT x402_hiring_submissions_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.x402_hiring_requests(id) ON DELETE CASCADE;


--
-- Name: x402_hiring_submissions x402_hiring_submissions_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_hiring_submissions
    ADD CONSTRAINT x402_hiring_submissions_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: x402_hiring_submissions x402_hiring_submissions_submitter_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_hiring_submissions
    ADD CONSTRAINT x402_hiring_submissions_submitter_user_id_fkey FOREIGN KEY (submitter_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: x402_job_run_events x402_job_run_events_resource_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_job_run_events
    ADD CONSTRAINT x402_job_run_events_resource_id_fkey FOREIGN KEY (resource_id) REFERENCES public.x402_resources(id) ON DELETE SET NULL;


--
-- Name: x402_job_run_events x402_job_run_events_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_job_run_events
    ADD CONSTRAINT x402_job_run_events_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.x402_job_runs(id) ON DELETE CASCADE;


--
-- Name: x402_job_runs x402_job_runs_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_job_runs
    ADD CONSTRAINT x402_job_runs_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.x402_jobs(id) ON DELETE CASCADE;


--
-- Name: x402_job_runs x402_job_runs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_job_runs
    ADD CONSTRAINT x402_job_runs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: x402_jobs x402_jobs_on_success_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_jobs
    ADD CONSTRAINT x402_jobs_on_success_job_id_fkey FOREIGN KEY (on_success_job_id) REFERENCES public.x402_jobs(id) ON DELETE SET NULL;


--
-- Name: x402_jobs_rewards_claims x402_jobs_rewards_claims_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_jobs_rewards_claims
    ADD CONSTRAINT x402_jobs_rewards_claims_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: x402_jobs_rewards_ledger x402_jobs_rewards_ledger_claimed_to_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_jobs_rewards_ledger
    ADD CONSTRAINT x402_jobs_rewards_ledger_claimed_to_user_id_fkey FOREIGN KEY (claimed_to_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: x402_jobs x402_jobs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_jobs
    ADD CONSTRAINT x402_jobs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: x402_notifications x402_notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_notifications
    ADD CONSTRAINT x402_notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: x402_pending_payouts x402_pending_payouts_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_pending_payouts
    ADD CONSTRAINT x402_pending_payouts_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.x402_jobs(id) ON DELETE SET NULL;


--
-- Name: x402_pending_payouts x402_pending_payouts_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_pending_payouts
    ADD CONSTRAINT x402_pending_payouts_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.x402_job_runs(id) ON DELETE SET NULL;


--
-- Name: x402_refunds x402_refunds_failed_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_refunds
    ADD CONSTRAINT x402_refunds_failed_event_id_fkey FOREIGN KEY (failed_event_id) REFERENCES public.x402_job_run_events(id) ON DELETE SET NULL;


--
-- Name: x402_refunds x402_refunds_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_refunds
    ADD CONSTRAINT x402_refunds_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.x402_jobs(id) ON DELETE CASCADE;


--
-- Name: x402_refunds x402_refunds_resolved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_refunds
    ADD CONSTRAINT x402_refunds_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES auth.users(id);


--
-- Name: x402_refunds x402_refunds_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_refunds
    ADD CONSTRAINT x402_refunds_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.x402_job_runs(id) ON DELETE CASCADE;


--
-- Name: x402_refunds x402_refunds_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_refunds
    ADD CONSTRAINT x402_refunds_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: x402_resource_executions x402_resource_executions_resource_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_resource_executions
    ADD CONSTRAINT x402_resource_executions_resource_id_fkey FOREIGN KEY (resource_id) REFERENCES public.x402_resources(id) ON DELETE CASCADE;


--
-- Name: x402_resource_executions x402_resource_executions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_resource_executions
    ADD CONSTRAINT x402_resource_executions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: x402_resources x402_resources_facilitator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_resources
    ADD CONSTRAINT x402_resources_facilitator_id_fkey FOREIGN KEY (facilitator_id) REFERENCES public.x402_facilitators(id) ON DELETE SET NULL;


--
-- Name: x402_resources x402_resources_registered_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_resources
    ADD CONSTRAINT x402_resources_registered_by_fkey FOREIGN KEY (registered_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: x402_resources x402_resources_server_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_resources
    ADD CONSTRAINT x402_resources_server_id_fkey FOREIGN KEY (server_id) REFERENCES public.x402_servers(id) ON DELETE SET NULL;


--
-- Name: x402_resources x402_resources_verified_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_resources
    ADD CONSTRAINT x402_resources_verified_owner_id_fkey FOREIGN KEY (verified_owner_id) REFERENCES auth.users(id);


--
-- Name: x402_scheduled_runs x402_scheduled_runs_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_scheduled_runs
    ADD CONSTRAINT x402_scheduled_runs_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.x402_jobs(id) ON DELETE CASCADE;


--
-- Name: x402_scheduled_runs x402_scheduled_runs_job_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_scheduled_runs
    ADD CONSTRAINT x402_scheduled_runs_job_run_id_fkey FOREIGN KEY (job_run_id) REFERENCES public.x402_job_runs(id) ON DELETE SET NULL;


--
-- Name: x402_servers x402_servers_registered_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_servers
    ADD CONSTRAINT x402_servers_registered_by_fkey FOREIGN KEY (registered_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: x402_servers x402_servers_verified_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_servers
    ADD CONSTRAINT x402_servers_verified_owner_id_fkey FOREIGN KEY (verified_owner_id) REFERENCES auth.users(id);


--
-- Name: x402_stats_hourly x402_stats_hourly_facilitator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_stats_hourly
    ADD CONSTRAINT x402_stats_hourly_facilitator_id_fkey FOREIGN KEY (facilitator_id) REFERENCES public.x402_facilitators(id) ON DELETE CASCADE;


--
-- Name: x402_stats_hourly x402_stats_hourly_server_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_stats_hourly
    ADD CONSTRAINT x402_stats_hourly_server_id_fkey FOREIGN KEY (server_id) REFERENCES public.x402_servers(id) ON DELETE CASCADE;


--
-- Name: x402_transactions x402_transactions_facilitator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_transactions
    ADD CONSTRAINT x402_transactions_facilitator_id_fkey FOREIGN KEY (facilitator_id) REFERENCES public.x402_facilitators(id) ON DELETE SET NULL;


--
-- Name: x402_transactions x402_transactions_resource_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_transactions
    ADD CONSTRAINT x402_transactions_resource_id_fkey FOREIGN KEY (resource_id) REFERENCES public.x402_resources(id) ON DELETE SET NULL;


--
-- Name: x402_transactions x402_transactions_server_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_transactions
    ADD CONSTRAINT x402_transactions_server_id_fkey FOREIGN KEY (server_id) REFERENCES public.x402_servers(id) ON DELETE SET NULL;


--
-- Name: x402_user_claude_configs x402_user_claude_configs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_user_claude_configs
    ADD CONSTRAINT x402_user_claude_configs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: x402_user_telegram_configs x402_user_telegram_configs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_user_telegram_configs
    ADD CONSTRAINT x402_user_telegram_configs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: x402_user_wallets x402_user_wallets_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_user_wallets
    ADD CONSTRAINT x402_user_wallets_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: x402_user_x_tokens x402_user_x_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x402_user_x_tokens
    ADD CONSTRAINT x402_user_x_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: x402_platform_stats Anyone can read platform stats; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read platform stats" ON public.x402_platform_stats FOR SELECT USING (true);


--
-- Name: profiles Profiles are viewable by everyone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);


--
-- Name: x402_pending_payouts Service role full access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role full access" ON public.x402_pending_payouts USING (true) WITH CHECK (true);


--
-- Name: x402_resource_executions Service role full access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role full access" ON public.x402_resource_executions USING ((auth.role() = 'service_role'::text));


--
-- Name: x402_user_claude_configs Service role full access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role full access" ON public.x402_user_claude_configs TO service_role USING (true);


--
-- Name: x402_job_runs Service role full access to job runs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role full access to job runs" ON public.x402_job_runs USING (((auth.jwt() ->> 'role'::text) = 'service_role'::text));


--
-- Name: x402_job_run_events Service role full access to run events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role full access to run events" ON public.x402_job_run_events USING (((auth.jwt() ->> 'role'::text) = 'service_role'::text));


--
-- Name: x402_refunds Service role has full access to refunds; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role has full access to refunds" ON public.x402_refunds USING ((auth.role() = 'service_role'::text));


--
-- Name: api_keys Users can create their own API keys; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create their own API keys" ON public.api_keys FOR INSERT WITH CHECK ((auth.uid() = created_by));


--
-- Name: api_keys Users can delete their own API keys; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own API keys" ON public.api_keys FOR DELETE USING ((auth.uid() = created_by));


--
-- Name: x402_job_runs Users can insert own job runs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own job runs" ON public.x402_job_runs FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: profiles Users can insert own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK ((auth.uid() = id));


--
-- Name: x402_user_claude_configs Users can manage their own Claude config; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage their own Claude config" ON public.x402_user_claude_configs USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: x402_job_runs Users can update own job runs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own job runs" ON public.x402_job_runs FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: profiles Users can update own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING ((auth.uid() = id));


--
-- Name: api_keys Users can update their own API keys; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own API keys" ON public.api_keys FOR UPDATE USING ((auth.uid() = created_by));


--
-- Name: x402_resource_executions Users can view own executions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own executions" ON public.x402_resource_executions FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: x402_job_runs Users can view own job runs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own job runs" ON public.x402_job_runs FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: x402_pending_payouts Users can view own payouts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own payouts" ON public.x402_pending_payouts FOR SELECT USING ((creator_id = auth.uid()));


--
-- Name: x402_refunds Users can view own refunds; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own refunds" ON public.x402_refunds FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: x402_job_run_events Users can view own run events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own run events" ON public.x402_job_run_events FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.x402_job_runs
  WHERE ((x402_job_runs.id = x402_job_run_events.run_id) AND (x402_job_runs.user_id = auth.uid())))));


--
-- Name: api_keys Users can view their own API keys; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own API keys" ON public.api_keys FOR SELECT USING ((auth.uid() = created_by));


--
-- Name: api_keys; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: x402_cached_images; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.x402_cached_images ENABLE ROW LEVEL SECURITY;

--
-- Name: x402_external_wallet_links; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.x402_external_wallet_links ENABLE ROW LEVEL SECURITY;

--
-- Name: x402_facilitator_addresses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.x402_facilitator_addresses ENABLE ROW LEVEL SECURITY;

--
-- Name: x402_facilitators; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.x402_facilitators ENABLE ROW LEVEL SECURITY;

--
-- Name: x402_hackathon_sponsors; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.x402_hackathon_sponsors ENABLE ROW LEVEL SECURITY;

--
-- Name: x402_hackathon_submissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.x402_hackathon_submissions ENABLE ROW LEVEL SECURITY;

--
-- Name: x402_hackathon_winners; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.x402_hackathon_winners ENABLE ROW LEVEL SECURITY;

--
-- Name: x402_hackathons; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.x402_hackathons ENABLE ROW LEVEL SECURITY;

--
-- Name: x402_hiring_escrow_ledger; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.x402_hiring_escrow_ledger ENABLE ROW LEVEL SECURITY;

--
-- Name: x402_hiring_payouts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.x402_hiring_payouts ENABLE ROW LEVEL SECURITY;

--
-- Name: x402_hiring_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.x402_hiring_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: x402_hiring_reviews; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.x402_hiring_reviews ENABLE ROW LEVEL SECURITY;

--
-- Name: x402_hiring_submissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.x402_hiring_submissions ENABLE ROW LEVEL SECURITY;

--
-- Name: x402_job_run_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.x402_job_run_events ENABLE ROW LEVEL SECURITY;

--
-- Name: x402_job_runs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.x402_job_runs ENABLE ROW LEVEL SECURITY;

--
-- Name: x402_jobs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.x402_jobs ENABLE ROW LEVEL SECURITY;

--
-- Name: x402_jobs_rewards_claims; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.x402_jobs_rewards_claims ENABLE ROW LEVEL SECURITY;

--
-- Name: x402_jobs_rewards_config; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.x402_jobs_rewards_config ENABLE ROW LEVEL SECURITY;

--
-- Name: x402_jobs_rewards_excluded_wallets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.x402_jobs_rewards_excluded_wallets ENABLE ROW LEVEL SECURITY;

--
-- Name: x402_jobs_rewards_ledger; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.x402_jobs_rewards_ledger ENABLE ROW LEVEL SECURITY;

--
-- Name: x402_jobs_rewards_snapshots; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.x402_jobs_rewards_snapshots ENABLE ROW LEVEL SECURITY;

--
-- Name: x402_jobs_rewards_treasury_transfers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.x402_jobs_rewards_treasury_transfers ENABLE ROW LEVEL SECURITY;

--
-- Name: x402_notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.x402_notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: x402_pending_payouts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.x402_pending_payouts ENABLE ROW LEVEL SECURITY;

--
-- Name: x402_platform_stats; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.x402_platform_stats ENABLE ROW LEVEL SECURITY;

--
-- Name: x402_refunds; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.x402_refunds ENABLE ROW LEVEL SECURITY;

--
-- Name: x402_resource_executions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.x402_resource_executions ENABLE ROW LEVEL SECURITY;

--
-- Name: x402_resources; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.x402_resources ENABLE ROW LEVEL SECURITY;

--
-- Name: x402_scheduled_runs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.x402_scheduled_runs ENABLE ROW LEVEL SECURITY;

--
-- Name: x402_servers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.x402_servers ENABLE ROW LEVEL SECURITY;

--
-- Name: x402_sponsors; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.x402_sponsors ENABLE ROW LEVEL SECURITY;

--
-- Name: x402_stats_hourly; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.x402_stats_hourly ENABLE ROW LEVEL SECURITY;

--
-- Name: x402_transactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.x402_transactions ENABLE ROW LEVEL SECURITY;

--
-- Name: x402_user_claude_configs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.x402_user_claude_configs ENABLE ROW LEVEL SECURITY;

--
-- Name: x402_user_telegram_configs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.x402_user_telegram_configs ENABLE ROW LEVEL SECURITY;

--
-- Name: x402_user_wallets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.x402_user_wallets ENABLE ROW LEVEL SECURITY;

--
-- Name: x402_user_x_tokens; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.x402_user_x_tokens ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--


--
-- Name: public_x402_resources; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.public_x402_resources WITH (security_invoker='on') AS
 SELECT id,
    slug,
    name,
    description,
    resource_url,
    network,
    price_usdc,
    resource_type,
    avatar_url,
    category,
    created_at,
    is_active,
    call_count,
    total_earned_usdc,
    pt_parameters,
    pt_model,
    pt_max_tokens,
    pt_allows_user_message,
    is_a2a,
    supports_refunds
   FROM public.x402_resources
  WHERE (is_active = true);
