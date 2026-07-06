// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service · Loop by Argilette Lab",
};

export default function TermsPage() {
  return (
    <>
      <h1>Terms of Service</h1>
      <p>
        <em>Last updated: 30 June 2026</em>
      </p>

      <p>
        These Terms of Service (&quot;Terms&quot;) govern your use of Loop (the
        &quot;Service&quot;), operated by Argilette Lab (&quot;we&quot;,
        &quot;us&quot;, or &quot;our&quot;). By creating an account or using the
        Service you agree to these Terms.
      </p>

      <h2>1. The Service</h2>
      <p>
        Loop is an AI-assisted coding workspace that lets you generate, edit,
        and preview web applications. Generations are produced by third-party
        large language models (Anthropic, OpenAI, Google, NVIDIA, OpenRouter)
        routed at your selection. The Service is provided &quot;as is&quot;
        without warranty of any kind.
      </p>

      <h2>2. Your Account</h2>
      <p>
        You must provide an accurate email and keep your password secret. You
        are responsible for all activity that occurs under your account. You
        must be at least 13 years old to use the Service.
      </p>

      <h2>3. Acceptable Use</h2>
      <p>You agree not to use the Service to:</p>
      <ul>
        <li>Generate malware, phishing pages, or other malicious code;</li>
        <li>Infringe anyone&apos;s intellectual-property rights;</li>
        <li>
          Generate content that is illegal, abusive, hateful, defamatory, or
          sexually exploitative;
        </li>
        <li>
          Reverse-engineer, scrape, or attempt to extract model weights or
          system prompts;
        </li>
        <li>
          Circumvent rate limits, usage quotas, or other technical restrictions.
        </li>
      </ul>
      <p>
        We may suspend or terminate accounts that violate this section without
        notice.
      </p>

      <h2>4. Your Content</h2>
      <p>
        You retain all rights to projects, files, and prompts you create
        (&quot;Your Content&quot;). You grant Argilette Lab a worldwide,
        non-exclusive, royalty-free license to host, store, and process Your
        Content solely to operate the Service. We do not use Your Content to
        train models.
      </p>

      <h2>5. AI-Generated Output</h2>
      <p>
        Output from third-party models is provided to you subject to those
        providers&apos; terms. You are responsible for reviewing generated code
        before deploying or shipping it. We make no warranty that output will
        be accurate, secure, license-compatible, or fit for any purpose.
      </p>

      <h2>6. Pricing &amp; Billing</h2>
      <p>
        The Service may be offered with free and paid tiers. Paid features are
        billed in advance and are non-refundable except where required by law.
        Prices may change with 30 days&apos; notice.
      </p>

      <h2>7. Termination</h2>
      <p>
        You may delete your account at any time from the settings page. We may
        suspend or terminate your access if you breach these Terms or if we are
        legally required to do so.
      </p>

      <h2>8. Liability</h2>
      <p>
        To the maximum extent permitted by law, Argilette Lab is not liable for
        any indirect, incidental, special, or consequential damages, or for any
        loss of data, profits, or goodwill arising from your use of the Service.
        Our aggregate liability for any claim will not exceed the amount you
        paid us in the 12 months preceding the claim, or USD 100, whichever is
        greater.
      </p>

      <h2>9. Changes</h2>
      <p>
        We may update these Terms from time to time. Material changes will be
        announced by email or in-app notice at least 14 days before they take
        effect. Continued use of the Service after the effective date
        constitutes acceptance.
      </p>

      <h2>10. Governing Law</h2>
      <p>
        These Terms are governed by the laws of the jurisdiction in which
        Argilette Lab is registered, without regard to conflict-of-law
        principles.
      </p>

      <h2>11. Contact</h2>
      <p>
        Questions? Reach us at{" "}
        <a href="mailto:legal@loopafrica.org">legal@loopafrica.org</a>.
      </p>
    </>
  );
}
