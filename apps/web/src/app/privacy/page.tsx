"use client";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-3xl mx-auto prose prose-invert">
        <h1>Privacy Policy</h1>
        <p className="text-muted-foreground">Last updated: January 2025</p>

        <h2>1. Information We Collect</h2>
        <p>We collect the following types of information:</p>
        <ul>
          <li>
            <strong>Account Information:</strong> When you sign in with Google or
            X/Twitter, we receive your name, email address, profile picture, and
            username from those services.
          </li>
          <li>
            <strong>Wallet Information:</strong> If you connect a cryptocurrency
            wallet, we store your public wallet address.
          </li>
          <li>
            <strong>Usage Data:</strong> We collect information about how you use
            the Service, including jobs created, resources accessed, and
            transactions made.
          </li>
          <li>
            <strong>Transaction Data:</strong> We record payment transactions
            including amounts, timestamps, and wallet addresses involved.
          </li>
        </ul>

        <h2>2. How We Use Your Information</h2>
        <p>We use collected information to:</p>
        <ul>
          <li>Provide and maintain the Service</li>
          <li>Process transactions and payments</li>
          <li>Send notifications about your account and transactions</li>
          <li>Improve and optimize the Service</li>
          <li>Detect and prevent fraud or abuse</li>
          <li>Comply with legal obligations</li>
        </ul>

        <h2>3. Information Sharing</h2>
        <p>We may share your information with:</p>
        <ul>
          <li>
            <strong>Other Users:</strong> Your public profile information and
            created jobs/resources are visible to other users.
          </li>
          <li>
            <strong>Service Providers:</strong> We use third-party services for
            hosting, analytics, and payment processing.
          </li>
          <li>
            <strong>Legal Requirements:</strong> We may disclose information when
            required by law or to protect our rights.
          </li>
        </ul>

        <h2>4. Blockchain Data</h2>
        <p>
          Transactions on blockchain networks (Base, Solana) are public and
          permanent. Transaction data including wallet addresses and amounts
          cannot be deleted or modified once recorded on the blockchain.
        </p>

        <h2>5. Data Security</h2>
        <p>
          We implement reasonable security measures to protect your information.
          However, no method of transmission over the Internet is 100% secure, and
          we cannot guarantee absolute security.
        </p>

        <h2>6. Your Rights</h2>
        <p>You have the right to:</p>
        <ul>
          <li>Access your personal information</li>
          <li>Correct inaccurate information</li>
          <li>Request deletion of your account</li>
          <li>Export your data</li>
          <li>Opt out of marketing communications</li>
        </ul>

        <h2>7. Cookies</h2>
        <p>
          We use cookies and similar technologies to maintain your session and
          preferences. You can control cookie settings through your browser.
        </p>

        <h2>8. Third-Party Services</h2>
        <p>
          The Service integrates with third-party services including Google,
          X/Twitter, and various AI providers. Your use of these services is
          governed by their respective privacy policies.
        </p>

        <h2>9. Children&apos;s Privacy</h2>
        <p>
          The Service is not intended for children under 13. We do not knowingly
          collect information from children under 13.
        </p>

        <h2>10. Changes to This Policy</h2>
        <p>
          We may update this Privacy Policy from time to time. We will notify you
          of significant changes by posting a notice on the Service.
        </p>

        <h2>11. Contact Us</h2>
        <p>
          For questions about this Privacy Policy, please contact us at{" "}
          <a href="mailto:privacy@x402.jobs">privacy@x402.jobs</a>.
        </p>
      </div>
    </div>
  );
}
