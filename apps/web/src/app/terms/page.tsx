"use client";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-3xl mx-auto prose prose-invert">
        <h1>Terms of Service</h1>
        <p className="text-muted-foreground">Last updated: January 2025</p>

        <h2>1. Acceptance of Terms</h2>
        <p>
          By accessing or using x402.jobs (&quot;the Service&quot;), you agree to be bound by these
          Terms of Service. If you do not agree to these terms, please do not use
          the Service.
        </p>

        <h2>2. Description of Service</h2>
        <p>
          x402.jobs is a platform that enables users to create, discover, and
          execute AI-powered jobs and resources using the x402 payment protocol.
          The Service facilitates micropayments for API access and AI services.
        </p>

        <h2>3. User Accounts</h2>
        <p>
          To use certain features of the Service, you may need to create an
          account using third-party authentication providers (such as Google or
          X/Twitter). You are responsible for maintaining the confidentiality of
          your account and for all activities that occur under your account.
        </p>

        <h2>4. Payments and Fees</h2>
        <p>
          The Service uses cryptocurrency payments (including but not limited to
          USDC on Base and Solana networks). All payments are final and
          non-refundable unless otherwise specified. Platform fees may apply to
          transactions.
        </p>

        <h2>5. User Content</h2>
        <p>
          You retain ownership of any content you create or upload to the
          Service. By posting content, you grant x402.jobs a non-exclusive,
          worldwide license to use, display, and distribute your content in
          connection with the Service.
        </p>

        <h2>6. Prohibited Uses</h2>
        <p>You agree not to:</p>
        <ul>
          <li>Use the Service for any illegal purpose</li>
          <li>Violate any applicable laws or regulations</li>
          <li>Infringe on the rights of others</li>
          <li>Attempt to gain unauthorized access to the Service</li>
          <li>Interfere with or disrupt the Service</li>
          <li>Create jobs or resources that generate harmful or illegal content</li>
        </ul>

        <h2>7. Disclaimer of Warranties</h2>
        <p>
          THE SERVICE IS PROVIDED &quot;AS IS&quot; WITHOUT WARRANTIES OF ANY KIND, EITHER
          EXPRESS OR IMPLIED. WE DO NOT GUARANTEE THAT THE SERVICE WILL BE
          UNINTERRUPTED, SECURE, OR ERROR-FREE.
        </p>

        <h2>8. Limitation of Liability</h2>
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, x402.jobs SHALL NOT BE LIABLE
          FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE
          DAMAGES ARISING FROM YOUR USE OF THE SERVICE.
        </p>

        <h2>9. Changes to Terms</h2>
        <p>
          We reserve the right to modify these terms at any time. Continued use
          of the Service after changes constitutes acceptance of the new terms.
        </p>

        <h2>10. Contact</h2>
        <p>
          For questions about these Terms, please contact us at{" "}
          <a href="mailto:support@x402.jobs">support@x402.jobs</a>.
        </p>
      </div>
    </div>
  );
}
