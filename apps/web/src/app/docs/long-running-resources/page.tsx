import Link from "next/link";

export const metadata = {
  title: "Long Running Resources | x402.jobs",
  description:
    "Learn how to implement the LRO pattern for resources that take time to complete, like AI image generation or video processing.",
};

export default function LongRunningResourcesPage() {
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
        <span className="text-muted-foreground">Long Running Resources</span>
      </div>

      <h1 className="text-3xl md:text-4xl font-bold text-foreground">
        Long Running Operations (LRO)
      </h1>

      <p className="text-xl text-muted-foreground">
        For operations that take more than a few seconds—like AI image
        generation, video processing, or complex computations—implement the Long
        Running Operations pattern.
      </p>

      {/* How It Works */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">How It Works</h2>
        <div className="bg-card border border-border rounded-lg p-6">
          <ol className="list-decimal list-inside text-muted-foreground space-y-2">
            <li>Client makes a request with payment</li>
            <li>
              Server returns{" "}
              <code className="text-primary bg-muted px-1.5 py-0.5 rounded text-sm font-mono">
                202 Accepted
              </code>{" "}
              with a status URL
            </li>
            <li>Client polls the status URL until completion</li>
            <li>Server returns the final result</li>
          </ol>
        </div>
      </section>

      {/* Initial Response */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">
          Initial Response (HTTP 202)
        </h2>
        <p className="text-muted-foreground">
          When your operation will take time, return{" "}
          <code className="text-primary bg-muted px-1.5 py-0.5 rounded text-sm font-mono">
            202 Accepted
          </code>
          :
        </p>
        <pre className="bg-muted rounded-lg p-4 overflow-x-auto">
          <code className="text-sm font-mono text-foreground">
            {`{
  "success": true,
  "jobId": "abc123",
  "statusUrl": "https://api.example.com/status/abc123",
  "retryAfterSeconds": 2,
  "message": "Your request is being processed..."
}`}
          </code>
        </pre>

        {/* Field Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 text-muted-foreground font-medium">
                  Field
                </th>
                <th className="text-left py-3 text-muted-foreground font-medium">
                  Type
                </th>
                <th className="text-left py-3 text-muted-foreground font-medium">
                  Description
                </th>
              </tr>
            </thead>
            <tbody className="text-muted-foreground">
              <tr className="border-b border-border">
                <td className="py-3">
                  <code className="text-primary bg-muted px-1.5 py-0.5 rounded font-mono">
                    jobId
                  </code>
                </td>
                <td className="py-3">string</td>
                <td className="py-3">Unique identifier for this job</td>
              </tr>
              <tr className="border-b border-border">
                <td className="py-3">
                  <code className="text-primary bg-muted px-1.5 py-0.5 rounded font-mono">
                    statusUrl
                  </code>
                </td>
                <td className="py-3">string</td>
                <td className="py-3">URL to poll for status updates</td>
              </tr>
              <tr className="border-b border-border">
                <td className="py-3">
                  <code className="text-primary bg-muted px-1.5 py-0.5 rounded font-mono">
                    retryAfterSeconds
                  </code>
                </td>
                <td className="py-3">number</td>
                <td className="py-3">Recommended polling interval</td>
              </tr>
              <tr className="border-b border-border">
                <td className="py-3">
                  <code className="text-primary bg-muted px-1.5 py-0.5 rounded font-mono">
                    message
                  </code>
                </td>
                <td className="py-3">string</td>
                <td className="py-3">Human-readable status message</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Status Endpoint */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">
          Status Endpoint
        </h2>
        <p className="text-muted-foreground">
          Your status endpoint should return one of three states:
        </p>

        {/* Processing */}
        <div className="bg-card border border-border rounded-lg p-6 space-y-3">
          <h3 className="text-lg font-semibold text-foreground">
            Processing (HTTP 200)
          </h3>
          <p className="text-muted-foreground text-sm">Job is still running:</p>
          <pre className="bg-muted rounded-lg p-4 overflow-x-auto">
            <code className="text-sm font-mono text-foreground">
              {`{
  "state": "processing",
  "progress": 50
}`}
            </code>
          </pre>
        </div>

        {/* Succeeded */}
        <div className="bg-card border border-border rounded-lg p-6 space-y-3">
          <h3 className="text-lg font-semibold text-foreground">
            Succeeded (HTTP 200)
          </h3>
          <p className="text-muted-foreground text-sm">
            Job completed successfully:
          </p>
          <pre className="bg-muted rounded-lg p-4 overflow-x-auto">
            <code className="text-sm font-mono text-foreground">
              {`{
  "state": "succeeded",
  "artifactUrl": "https://storage.example.com/result.png",
  "response": "Your image has been generated!"
}`}
            </code>
          </pre>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 text-muted-foreground font-medium">
                    Field
                  </th>
                  <th className="text-left py-2 text-muted-foreground font-medium">
                    Description
                  </th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                <tr className="border-b border-border">
                  <td className="py-2">
                    <code className="text-primary bg-muted px-1.5 py-0.5 rounded font-mono">
                      artifactUrl
                    </code>
                  </td>
                  <td className="py-2">
                    URL to generated file (images, media, etc.)
                  </td>
                </tr>
                <tr className="border-b border-border">
                  <td className="py-2">
                    <code className="text-primary bg-muted px-1.5 py-0.5 rounded font-mono">
                      response
                    </code>
                  </td>
                  <td className="py-2">Text response or description</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Failed */}
        <div className="bg-card border border-border rounded-lg p-6 space-y-3">
          <h3 className="text-lg font-semibold text-foreground">
            Failed (HTTP 200)
          </h3>
          <p className="text-muted-foreground text-sm">Job failed:</p>
          <pre className="bg-muted rounded-lg p-4 overflow-x-auto">
            <code className="text-sm font-mono text-foreground">
              {`{
  "state": "failed",
  "error": "Generation timed out",
  "code": "generation_timeout"
}`}
            </code>
          </pre>
        </div>
      </section>

      {/* Standard Error Codes */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">
          Standard Error Codes
        </h2>
        <p className="text-muted-foreground">
          Use these standard codes for consistency:
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 text-muted-foreground font-medium">
                  Code
                </th>
                <th className="text-left py-3 text-muted-foreground font-medium">
                  Description
                </th>
              </tr>
            </thead>
            <tbody className="text-muted-foreground">
              <tr className="border-b border-border">
                <td className="py-3">
                  <code className="text-primary bg-muted px-1.5 py-0.5 rounded font-mono">
                    generation_timeout
                  </code>
                </td>
                <td className="py-3">Operation took too long</td>
              </tr>
              <tr className="border-b border-border">
                <td className="py-3">
                  <code className="text-primary bg-muted px-1.5 py-0.5 rounded font-mono">
                    generation_failed
                  </code>
                </td>
                <td className="py-3">Processing failed</td>
              </tr>
              <tr className="border-b border-border">
                <td className="py-3">
                  <code className="text-primary bg-muted px-1.5 py-0.5 rounded font-mono">
                    model_unavailable
                  </code>
                </td>
                <td className="py-3">AI model is unavailable</td>
              </tr>
              <tr className="border-b border-border">
                <td className="py-3">
                  <code className="text-primary bg-muted px-1.5 py-0.5 rounded font-mono">
                    content_filtered
                  </code>
                </td>
                <td className="py-3">Content moderation triggered</td>
              </tr>
              <tr className="border-b border-border">
                <td className="py-3">
                  <code className="text-primary bg-muted px-1.5 py-0.5 rounded font-mono">
                    quota_exceeded
                  </code>
                </td>
                <td className="py-3">Rate/quota limit hit</td>
              </tr>
              <tr className="border-b border-border">
                <td className="py-3">
                  <code className="text-primary bg-muted px-1.5 py-0.5 rounded font-mono">
                    invalid_input
                  </code>
                </td>
                <td className="py-3">Bad input parameters</td>
              </tr>
              <tr className="border-b border-border">
                <td className="py-3">
                  <code className="text-primary bg-muted px-1.5 py-0.5 rounded font-mono">
                    internal_error
                  </code>
                </td>
                <td className="py-3">Server error</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Implementation Example */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">
          Implementation Example
        </h2>
        <div className="bg-card border border-border rounded-lg p-6 space-y-4">
          <h3 className="text-lg font-semibold text-foreground">Express.js</h3>
          <pre className="bg-muted rounded-lg p-4 overflow-x-auto">
            <code className="text-sm font-mono text-foreground">
              {`// POST /generate - Start the job
app.post('/generate', async (req, res) => {
  // Verify payment...
  
  // Create job record
  const jobId = crypto.randomUUID();
  await db.jobs.create({ id: jobId, status: 'pending' });
  
  // Start async processing
  processJob(jobId, req.body).catch(console.error);
  
  // Return 202 immediately
  res.status(202).json({
    success: true,
    jobId,
    statusUrl: \`https://api.example.com/status/\${jobId}\`,
    retryAfterSeconds: 2
  });
});

// GET /status/:jobId - Check status
app.get('/status/:jobId', async (req, res) => {
  const job = await db.jobs.findById(req.params.jobId);
  
  if (!job) {
    return res.json({
      state: 'failed',
      error: 'Job not found',
      code: 'not_found'
    });
  }
  
  if (job.status === 'completed') {
    return res.json({
      state: 'succeeded',
      artifactUrl: job.resultUrl,
      response: job.description
    });
  }
  
  if (job.status === 'failed') {
    return res.json({
      state: 'failed',
      error: job.errorMessage,
      code: job.errorCode
    });
  }
  
  // Still processing
  return res.json({
    state: 'processing',
    progress: job.progress || 0
  });
});`}
            </code>
          </pre>
        </div>
      </section>

      {/* x402.jobs Integration */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">
          x402.jobs Integration
        </h2>
        <div className="bg-card border border-border rounded-lg p-6 space-y-4">
          <p className="text-muted-foreground">
            When x402.jobs executes your resource:
          </p>
          <ol className="list-decimal list-inside text-muted-foreground space-y-2">
            <li>It makes the initial request with payment</li>
            <li>
              If it receives{" "}
              <code className="text-primary bg-muted px-1.5 py-0.5 rounded text-sm font-mono">
                202
              </code>
              , it automatically polls{" "}
              <code className="text-primary bg-muted px-1.5 py-0.5 rounded text-sm font-mono">
                statusUrl
              </code>
            </li>
            <li>
              It respects{" "}
              <code className="text-primary bg-muted px-1.5 py-0.5 rounded text-sm font-mono">
                retryAfterSeconds
              </code>{" "}
              between polls
            </li>
            <li>
              When{" "}
              <code className="text-primary bg-muted px-1.5 py-0.5 rounded text-sm font-mono">
                state
              </code>{" "}
              is{" "}
              <code className="text-primary bg-muted px-1.5 py-0.5 rounded text-sm font-mono">
                succeeded
              </code>
              , it extracts{" "}
              <code className="text-primary bg-muted px-1.5 py-0.5 rounded text-sm font-mono">
                artifactUrl
              </code>{" "}
              and{" "}
              <code className="text-primary bg-muted px-1.5 py-0.5 rounded text-sm font-mono">
                response
              </code>
            </li>
            <li>These values flow to downstream nodes in the workflow</li>
          </ol>

          <div className="bg-muted/50 rounded-lg p-4 mt-4">
            <h4 className="font-medium text-foreground mb-2">Output Mapping</h4>
            <p className="text-sm text-muted-foreground">
              In workflows, users can map your outputs:
            </p>
            <ul className="list-disc list-inside text-sm text-muted-foreground mt-2 space-y-1">
              <li>
                <code className="text-primary bg-muted px-1 py-0.5 rounded font-mono">
                  artifactUrl
                </code>{" "}
                → Image display, file downloads
              </li>
              <li>
                <code className="text-primary bg-muted px-1 py-0.5 rounded font-mono">
                  response
                </code>{" "}
                → Text processing, further AI calls
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Best Practices */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">
          Best Practices
        </h2>
        <div className="bg-card border border-border rounded-lg p-6">
          <ul className="space-y-3 text-muted-foreground">
            <li className="flex gap-2">
              <span className="text-primary font-bold">1.</span>
              <span>
                <strong className="text-foreground">
                  Use reasonable timeouts
                </strong>{" "}
                — Don't let jobs run forever
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-primary font-bold">2.</span>
              <span>
                <strong className="text-foreground">
                  Provide progress updates
                </strong>{" "}
                — Users appreciate knowing status
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-primary font-bold">3.</span>
              <span>
                <strong className="text-foreground">Clean up old jobs</strong> —
                Expire status after 24 hours
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-primary font-bold">4.</span>
              <span>
                <strong className="text-foreground">
                  Return consistent errors
                </strong>{" "}
                — Use standard error codes
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-primary font-bold">5.</span>
              <span>
                <strong className="text-foreground">
                  Set appropriate retry intervals
                </strong>{" "}
                — 2-5 seconds is typical
              </span>
            </li>
          </ul>
        </div>
      </section>

      {/* Related Links */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">Related</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <Link
            href="/docs/resources"
            className="block p-4 bg-card border border-border rounded-lg hover:border-primary/50 hover:bg-accent/50 transition-all"
          >
            <h3 className="font-semibold text-foreground">Resources API</h3>
            <p className="text-muted-foreground text-sm">
              Learn how to create and manage resources
            </p>
          </Link>
          <Link
            href="/developer"
            className="block p-4 bg-card border border-border rounded-lg hover:border-primary/50 hover:bg-accent/50 transition-all"
          >
            <h3 className="font-semibold text-foreground">x402 Validator</h3>
            <p className="text-muted-foreground text-sm">
              Test your x402 endpoint compliance
            </p>
          </Link>
        </div>
      </section>
    </div>
  );
}
