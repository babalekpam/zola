// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy · Loop by Argilette Lab",
};

export default function PrivacyPage() {
  return (
    <>
      <h1>Privacy Policy</h1>
      <p>
        <em>Last updated: 30 June 2026</em>
      </p>

      <p>
        This Privacy Policy explains how Argilette Lab (&quot;we&quot;) collects,
        uses, and protects personal information when you use Loop (the
        &quot;Service&quot;).
      </p>

      <h2>1. Information We Collect</h2>
      <ul>
        <li>
          <strong>Account data:</strong> your email address and a hashed
          password (or OAuth identifier).
        </li>
        <li>
          <strong>Project content:</strong> file contents, project metadata,
          and chat messages you send to AI providers through the Service.
        </li>
        <li>
          <strong>Usage data:</strong> request timestamps, IP address, browser
          type, and rate-limit counters used to operate and secure the Service.
        </li>
        <li>
          <strong>Error data:</strong> stack traces and diagnostic context sent
          to our error-monitoring provider (Sentry).
        </li>
      </ul>

      <h2>2. How We Use It</h2>
      <ul>
        <li>Provide, maintain, and secure the Service;</li>
        <li>
          Forward your prompts and project context to the AI provider you
          select, in order to generate responses;
        </li>
        <li>
          Enforce rate limits, prevent abuse, and respond to security incidents;
        </li>
        <li>Send you transactional emails (password resets, security alerts);</li>
        <li>Comply with legal obligations.</li>
      </ul>
      <p>
        We do <strong>not</strong> sell your personal information, and we do
        not use your project content to train AI models.
      </p>

      <h2>3. Third-Party Processors</h2>
      <p>The Service relies on the following sub-processors:</p>
      <ul>
        <li>
          <strong>Supabase</strong> — authentication and database hosting (EU /
          US).
        </li>
        <li>
          <strong>Vercel</strong> / <strong>Replit</strong> — application
          hosting.
        </li>
        <li>
          <strong>Anthropic, OpenAI, Google, NVIDIA, OpenRouter</strong> — large
          language model inference. Your selected model receives your prompts
          and current project files.
        </li>
        <li>
          <strong>Cloudflare</strong> — bot/CAPTCHA protection on auth forms.
        </li>
        <li>
          <strong>Sentry</strong> — error monitoring.
        </li>
      </ul>

      <h2>4. Data Retention</h2>
      <p>
        Account, project, and message data is kept until you delete your
        project or account. Rate-limit logs are purged after 24 hours.
        Error-monitoring data is retained for 30 days.
      </p>

      <h2>5. Your Rights</h2>
      <p>
        If you are in the EU/EEA, UK, California, or other jurisdictions with
        data-protection laws, you have the right to access, correct, export, or
        delete your personal information, and to object to certain processing.
        To exercise these rights, email{" "}
        <a href="mailto:privacy@loopafrica.org">privacy@loopafrica.org</a>.
      </p>

      <h2>6. Cookies</h2>
      <p>
        We use a small number of strictly-necessary cookies to keep you signed
        in (Supabase Auth) and to protect auth forms from bots (Cloudflare
        Turnstile). We do not use advertising or tracking cookies.
      </p>

      <h2>7. Children</h2>
      <p>
        The Service is not directed to children under 13. If you believe a
        child has provided us personal information, contact us and we will
        delete it.
      </p>

      <h2>8. Changes</h2>
      <p>
        Material changes to this Policy will be announced by email or in-app
        notice at least 14 days before they take effect.
      </p>

      <h2>9. Contact</h2>
      <p>
        Email{" "}
        <a href="mailto:privacy@loopafrica.org">privacy@loopafrica.org</a> with
        any questions or requests.
      </p>
    </>
  );
}
