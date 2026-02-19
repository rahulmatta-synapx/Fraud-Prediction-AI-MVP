import { Shield } from "lucide-react";

export default function PrivacyPolicy() {
  return (
    <div className="h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 py-12 px-4 overflow-y-auto">
      <div className="max-w-4xl mx-auto bg-white dark:bg-slate-800 rounded-lg shadow-xl p-8 md:p-12 mb-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Shield className="h-10 w-10 text-emerald-600" />
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Fraud Prediction AI Privacy Policy</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Last updated: February 19, 2026
            </p>
          </div>
        </div>

        <div className="prose prose-slate dark:prose-invert max-w-none">
          {/* Introduction */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-white mb-4">
              1. Introduction
            </h2>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
              Fraud Prediction AI by Synapx is committed to protecting your privacy. This Privacy Policy
              explains how we collect, use, disclose, and safeguard your information when you use our Fraud
              Prediction AI platform (the "Service"). By accessing or using the Service, you agree to this
              Privacy Policy.
            </p>
          </section>

          {/* Information We Collect */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-white mb-4">
              2. Information We Collect
            </h2>
            
            <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-3 mt-6">
              2.1 Information You Provide
            </h3>
            <ul className="list-disc pl-6 space-y-2 text-slate-700 dark:text-slate-300">
              <li><strong>Account Information:</strong> When you sign in via Microsoft Azure Active Directory, we collect your name, email address, and organization details.</li>
              <li><strong>Claims Data:</strong> Insurance claim information, documents, and related data you submit for fraud analysis.</li>
              <li><strong>Communications:</strong> Information you provide when contacting our support team.</li>
            </ul>

            <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-3 mt-6">
              2.2 Automatically Collected Information
            </h3>
            <ul className="list-disc pl-6 space-y-2 text-slate-700 dark:text-slate-300">
              <li><strong>Usage Data:</strong> Log data, IP addresses, browser type, pages visited, and timestamps.</li>
              <li><strong>Device Information:</strong> Device type, operating system, and unique identifiers.</li>
              <li><strong>Analytics:</strong> Service performance metrics and error logs.</li>
            </ul>
          </section>

          {/* How We Use Your Information */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-white mb-4">
              3. How We Use Your Information
            </h2>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-4">
              We use the collected information for the following purposes:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-slate-700 dark:text-slate-300">
              <li>Providing and maintaining the Service, including fraud risk analysis</li>
              <li>Processing and analyzing insurance claims data using AI models</li>
              <li>Managing user accounts and subscriptions</li>
              <li>Sending service-related notifications and updates</li>
              <li>Improving our algorithms and service quality</li>
              <li>Ensuring security and preventing fraud</li>
              <li>Complying with legal obligations</li>
            </ul>
          </section>

          {/* Data Security */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-white mb-4">
              4. Data Security
            </h2>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
              We implement industry-standard security measures to protect your data:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-slate-700 dark:text-slate-300 mt-4">
              <li>Data encryption in transit (TLS/SSL) and at rest</li>
              <li>Microsoft Azure Active Directory authentication</li>
              <li>Secure Azure infrastructure with multi-tenant isolation</li>
              <li>Regular security audits and monitoring</li>
              <li>Role-based access controls</li>
            </ul>
          </section>

          {/* Data Retention */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-white mb-4">
              5. Data Retention
            </h2>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
              We retain your information for as long as necessary to provide the Service and comply with legal
              obligations. Claims data is retained according to insurance industry standards and regulatory
              requirements. You may request deletion of your data by contacting us at{" "}
              <a href="mailto:privacy@synapx.com" className="text-emerald-600 hover:text-emerald-700 underline">
                privacy@synapx.com
              </a>.
            </p>
          </section>

          {/* Data Sharing */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-white mb-4">
              6. Data Sharing and Disclosure
            </h2>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-4">
              We do not sell your personal information. We may share data only in the following circumstances:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-slate-700 dark:text-slate-300">
              <li><strong>Service Providers:</strong> Microsoft Azure for hosting, OpenAI for AI processing (with data privacy agreements)</li>
              <li><strong>Legal Requirements:</strong> When required by law, court order, or regulatory authority</li>
              <li><strong>Business Transfers:</strong> In case of merger, acquisition, or asset sale</li>
              <li><strong>With Your Consent:</strong> When you explicitly authorize sharing</li>
            </ul>
          </section>

          {/* Your Rights */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-white mb-4">
              7. Your Rights (GDPR & Data Protection)
            </h2>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-4">
              Under applicable data protection laws (GDPR, UK DPA), you have the right to:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-slate-700 dark:text-slate-300">
              <li><strong>Access:</strong> Request a copy of your personal data</li>
              <li><strong>Rectification:</strong> Correct inaccurate or incomplete data</li>
              <li><strong>Erasure:</strong> Request deletion of your data ("right to be forgotten")</li>
              <li><strong>Restriction:</strong> Limit processing of your data</li>
              <li><strong>Portability:</strong> Receive your data in a structured, machine-readable format</li>
              <li><strong>Object:</strong> Object to processing based on legitimate interests</li>
            </ul>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed mt-4">
              To exercise these rights, contact us at{" "}
              <a href="mailto:privacy@synapx.com" className="text-emerald-600 hover:text-emerald-700 underline">
                privacy@synapx.com
              </a>.
            </p>
          </section>

          {/* Cookies */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-white mb-4">
              8. Cookies and Tracking
            </h2>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
              We use essential cookies for authentication and session management. We do not use third-party
              tracking cookies. Your browser's local storage is used to cache authentication tokens for
              improved performance.
            </p>
          </section>

          {/* International Transfers */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-white mb-4">
              9. International Data Transfers
            </h2>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
              Your data is hosted on Microsoft Azure UK South region. If data is transferred internationally,
              we ensure appropriate safeguards are in place, including Standard Contractual Clauses (SCCs) and
              adequacy decisions.
            </p>
          </section>

          {/* Children's Privacy */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-white mb-4">
              10. Children's Privacy
            </h2>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
              Our Service is not intended for individuals under 18 years of age. We do not knowingly collect
              data from children.
            </p>
          </section>

          {/* Changes to Policy */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-white mb-4">
              11. Changes to This Policy
            </h2>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
              We may update this Privacy Policy from time to time. Changes will be posted on this page with an
              updated "Last updated" date. Continued use of the Service constitutes acceptance of changes.
            </p>
          </section>

          {/* Contact */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-white mb-4">
              12. Contact Us
            </h2>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
              If you have questions about this Privacy Policy or our data practices, contact us:
            </p>
            <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-700 rounded-lg">
              <p className="text-slate-700 dark:text-slate-300">
                <strong>Email:</strong>{" "}
                <a href="mailto:privacy@synapx.com" className="text-emerald-600 hover:text-emerald-700 underline">
                  privacy@synapx.com
                </a>
              </p>
              <p className="text-slate-700 dark:text-slate-300 mt-2">
                <strong>Support:</strong>{" "}
                <a href="mailto:support@synapx.com" className="text-emerald-600 hover:text-emerald-700 underline">
                  support@synapx.com
                </a>
              </p>
            </div>
          </section>

          {/* Supervisory Authority */}
          <section>
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-white mb-4">
              13. Supervisory Authority
            </h2>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
              If you are located in the EEA or UK, you have the right to lodge a complaint with your local
              data protection authority (e.g., ICO in the UK).
            </p>
          </section>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-slate-200 dark:border-slate-700 text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            © 2026 Synapx AI. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
