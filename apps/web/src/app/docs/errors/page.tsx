import Link from "next/link";

export default function ErrorsPage() {
  return (
    <div className="space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Link
          href="/docs"
          className="text-primary hover:text-primary/80 transition-colors"
        >
          Documentation
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="text-muted-foreground">Error Handling</span>
      </div>

      <h1 className="text-3xl md:text-4xl font-bold text-foreground">
        Error Handling
      </h1>

      <p className="text-xl text-muted-foreground">
        Understanding and handling errors when working with the x402.jobs API.
      </p>

      {/* Error Response Format */}
      <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-foreground mb-2">
          Error Response Format
        </h2>
        <p className="text-muted-foreground mb-4">
          All API errors follow a consistent format to help you handle them
          programmatically.
        </p>
        <pre className="bg-muted rounded-lg p-4">
          <code className="text-sm font-mono text-foreground">
            {`{
  "error": "Error category or type",
  "message": "Human-readable error description"
}`}
          </code>
        </pre>
      </div>

      <h2 className="text-2xl font-semibold text-foreground">
        HTTP Status Codes
      </h2>

      <div className="space-y-4">
        {/* 2XX Success */}
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center gap-3 mb-3">
            <span className="bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full text-sm font-semibold">
              2XX
            </span>
            <h3 className="text-lg font-semibold text-foreground">Success</h3>
          </div>
          <ul className="space-y-1 text-sm text-muted-foreground">
            <li>
              <strong className="text-foreground">200 OK</strong> - Request
              successful
            </li>
            <li>
              <strong className="text-foreground">201 Created</strong> -
              Resource created successfully
            </li>
          </ul>
        </div>

        {/* 4XX Client Errors */}
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center gap-3 mb-3">
            <span className="bg-amber-500/20 text-amber-400 px-3 py-1 rounded-full text-sm font-semibold">
              4XX
            </span>
            <h3 className="text-lg font-semibold text-foreground">
              Client Errors
            </h3>
          </div>
          <ul className="space-y-1 text-sm text-muted-foreground">
            <li>
              <strong className="text-foreground">400 Bad Request</strong> -
              Invalid request data
            </li>
            <li>
              <strong className="text-foreground">401 Unauthorized</strong> -
              Missing or invalid API key
            </li>
            <li>
              <strong className="text-foreground">404 Not Found</strong> -
              Resource doesn't exist
            </li>
            <li>
              <strong className="text-foreground">429 Too Many Requests</strong>{" "}
              - Rate limit exceeded
            </li>
          </ul>
        </div>

        {/* 5XX Server Errors */}
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center gap-3 mb-3">
            <span className="bg-red-500/20 text-red-400 px-3 py-1 rounded-full text-sm font-semibold">
              5XX
            </span>
            <h3 className="text-lg font-semibold text-foreground">
              Server Errors
            </h3>
          </div>
          <ul className="space-y-1 text-sm text-muted-foreground">
            <li>
              <strong className="text-foreground">
                500 Internal Server Error
              </strong>{" "}
              - Unexpected server error
            </li>
            <li>
              <strong className="text-foreground">
                503 Service Unavailable
              </strong>{" "}
              - Service temporarily unavailable
            </li>
          </ul>
        </div>
      </div>

      <h2 className="text-2xl font-semibold text-foreground">
        Common Error Examples
      </h2>

      {/* Missing API Key */}
      <div className="bg-card border border-border rounded-lg p-6 space-y-4">
        <h3 className="text-lg font-semibold text-foreground">
          401 - Missing API Key
        </h3>
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4">
          <strong className="text-foreground">Problem:</strong>
          <span className="text-muted-foreground ml-1">
            API key not provided in request headers.
          </span>
        </div>
        <pre className="bg-muted rounded-lg p-4">
          <code className="text-sm font-mono text-foreground">
            {`{
  "error": "Unauthorized",
  "message": "API key required. Provide via x-api-key header or Authorization: Bearer header"
}`}
          </code>
        </pre>
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
          <strong className="text-foreground">Solution:</strong>
          <span className="text-muted-foreground ml-1">
            Include your API key in the request headers:
          </span>
          <code className="block mt-2 text-sm bg-muted p-2 rounded font-mono text-primary">
            x-api-key: YOUR_API_KEY
          </code>
        </div>
      </div>

      {/* Invalid API Key */}
      <div className="bg-card border border-border rounded-lg p-6 space-y-4">
        <h3 className="text-lg font-semibold text-foreground">
          401 - Invalid API Key
        </h3>
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4">
          <strong className="text-foreground">Problem:</strong>
          <span className="text-muted-foreground ml-1">
            API key is incorrect, expired, or has been revoked.
          </span>
        </div>
        <pre className="bg-muted rounded-lg p-4">
          <code className="text-sm font-mono text-foreground">
            {`{
  "error": "Unauthorized",
  "message": "Invalid or inactive API key"
}`}
          </code>
        </pre>
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
          <strong className="text-foreground">Solutions:</strong>
          <ul className="mt-2 text-sm text-muted-foreground">
            <li>• Verify your API key is correct</li>
            <li>• Check if the key has been revoked in your dashboard</li>
            <li>• Generate a new API key if needed</li>
          </ul>
        </div>
      </div>

      {/* Bad Request */}
      <div className="bg-card border border-border rounded-lg p-6 space-y-4">
        <h3 className="text-lg font-semibold text-foreground">
          400 - Bad Request
        </h3>
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4">
          <strong className="text-foreground">Problem:</strong>
          <span className="text-muted-foreground ml-1">
            Request data is invalid or missing required fields.
          </span>
        </div>
        <pre className="bg-muted rounded-lg p-4">
          <code className="text-sm font-mono text-foreground">
            {`{
  "error": "Missing required fields",
  "message": "name and resource_url are required"
}`}
          </code>
        </pre>
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
          <strong className="text-foreground">Solution:</strong>
          <span className="text-muted-foreground ml-1">
            Ensure all required fields are included and properly formatted in
            your request body.
          </span>
        </div>
      </div>

      {/* Rate Limit */}
      <div className="bg-card border border-border rounded-lg p-6 space-y-4">
        <h3 className="text-lg font-semibold text-foreground">
          429 - Rate Limit Exceeded
        </h3>
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4">
          <strong className="text-foreground">Problem:</strong>
          <span className="text-muted-foreground ml-1">
            You've exceeded the API rate limits.
          </span>
        </div>
        <pre className="bg-muted rounded-lg p-4">
          <code className="text-sm font-mono text-foreground">
            {`{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded. Try again in 60 seconds."
}`}
          </code>
        </pre>
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
          <strong className="text-foreground">Solution:</strong>
          <span className="text-muted-foreground ml-1">
            Wait before making additional requests. Consider implementing
            exponential backoff in your application.
          </span>
        </div>
      </div>

      {/* Not Found */}
      <div className="bg-card border border-border rounded-lg p-6 space-y-4">
        <h3 className="text-lg font-semibold text-foreground">
          404 - Resource Not Found
        </h3>
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4">
          <strong className="text-foreground">Problem:</strong>
          <span className="text-muted-foreground ml-1">
            The requested resource doesn't exist or you don't have access to it.
          </span>
        </div>
        <pre className="bg-muted rounded-lg p-4">
          <code className="text-sm font-mono text-foreground">
            {`{
  "error": "Resource not found",
  "message": "Resource does not exist or you don't have access to it"
}`}
          </code>
        </pre>
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
          <strong className="text-foreground">Solutions:</strong>
          <ul className="mt-2 text-sm text-muted-foreground">
            <li>• Verify the resource ID is correct</li>
            <li>• Ensure the resource exists and belongs to your account</li>
            <li>• Check if the resource has been deleted</li>
          </ul>
        </div>
      </div>

      <h2 className="text-2xl font-semibold text-foreground">
        Best Practices for Error Handling
      </h2>

      <div className="bg-card border border-border rounded-lg p-6 space-y-4">
        <h3 className="text-lg font-semibold text-foreground">
          JavaScript Example
        </h3>
        <pre className="bg-muted rounded-lg p-4 overflow-x-auto">
          <code className="text-sm font-mono text-foreground">
            {`async function createResource(resourceData) {
  try {
    const response = await fetch('https://api.x402.jobs/api/v1/resources', {
      method: 'POST',
      headers: {
        'x-api-key': 'YOUR_API_KEY',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(resourceData)
    });

    // Always check response status
    if (!response.ok) {
      const errorData = await response.json();
      
      // Handle specific error cases
      switch (response.status) {
        case 401:
          throw new Error('Invalid API key. Please check your credentials.');
        case 400:
          throw new Error(\`Invalid request: \${errorData.message}\`);
        case 429:
          throw new Error('Rate limit exceeded. Please wait before retrying.');
        case 404:
          throw new Error('Resource not found.');
        case 500:
          throw new Error('Server error. Please try again later.');
        default:
          throw new Error(\`API Error (\${response.status}): \${errorData.message}\`);
      }
    }

    const result = await response.json();
    return result.data;
    
  } catch (error) {
    console.error('Failed to create resource:', error);
    
    // Log for debugging but don't expose internal errors to users
    if (error.message.includes('fetch')) {
      throw new Error('Network error. Please check your internet connection.');
    }
    
    throw error; // Re-throw API errors
  }
}`}
          </code>
        </pre>
      </div>

      <div className="bg-card border border-border rounded-lg p-6 space-y-4">
        <h3 className="text-lg font-semibold text-foreground">
          Python Example
        </h3>
        <pre className="bg-muted rounded-lg p-4 overflow-x-auto">
          <code className="text-sm font-mono text-foreground">
            {`import requests
import time
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

class X402JobsAPIError(Exception):
    def __init__(self, message, status_code=None):
        self.message = message
        self.status_code = status_code
        super().__init__(message)

class X402JobsAPI:
    def __init__(self, api_key):
        self.api_key = api_key
        self.base_url = 'https://api.x402.jobs/api/v1'
        
        # Set up session with retry strategy
        self.session = requests.Session()
        retry_strategy = Retry(
            total=3,
            status_forcelist=[429, 500, 502, 503, 504],
            method_whitelist=["HEAD", "GET", "OPTIONS"],
            backoff_factor=1
        )
        adapter = HTTPAdapter(max_retries=retry_strategy)
        self.session.mount("http://", adapter)
        self.session.mount("https://", adapter)
    
    def _make_request(self, method, endpoint, **kwargs):
        url = f"{self.base_url}{endpoint}"
        headers = {
            'x-api-key': self.api_key,
            'Content-Type': 'application/json'
        }
        
        try:
            response = self.session.request(
                method, url, headers=headers, timeout=30, **kwargs
            )
            
            # Handle rate limiting with exponential backoff
            if response.status_code == 429:
                retry_after = int(response.headers.get('retry-after', 60))
                print(f"Rate limited. Waiting {retry_after} seconds...")
                time.sleep(retry_after)
                # Retry once after rate limit
                response = self.session.request(
                    method, url, headers=headers, timeout=30, **kwargs
                )
            
            # Parse error response
            if not response.ok:
                try:
                    error_data = response.json()
                    error_message = error_data.get('message', 'Unknown error')
                except:
                    error_message = f"HTTP {response.status_code} error"
                
                raise X402JobsAPIError(error_message, response.status_code)
            
            return response.json()
            
        except requests.exceptions.RequestException as e:
            raise X402JobsAPIError(f"Network error: {str(e)}")
    
    def create_resource(self, resource_data):
        try:
            return self._make_request('POST', '/resources', json=resource_data)
        except X402JobsAPIError as e:
            if e.status_code == 400:
                print(f"Validation error: {e.message}")
            elif e.status_code == 401:
                print("Authentication failed. Check your API key.")
            else:
                print(f"API error: {e.message}")
            raise`}
          </code>
        </pre>
      </div>

      {/* Tips Section */}
      <div className="bg-card border border-border rounded-lg p-6">
        <h2 className="text-xl font-semibold text-foreground mb-4">
          Error Handling Tips
        </h2>
        <ul className="text-muted-foreground space-y-2">
          <li>• Always check HTTP status codes before parsing response JSON</li>
          <li>• Implement retry logic for 5XX errors and 429 rate limits</li>
          <li>• Use exponential backoff when retrying requests</li>
          <li>
            • Log errors for debugging but don't expose sensitive info to users
          </li>
          <li>
            • Validate your request data before sending to reduce 400 errors
          </li>
          <li>• Monitor your API key usage to avoid hitting rate limits</li>
        </ul>
      </div>
    </div>
  );
}
