import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const PrivacyPolicy = () => {
  const lastUpdated = "December 28, 2024";
  const appName = "Shortwork";
  const contactEmail = "privacy@shortwork.lovable.app";

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <Link to="/">
          <Button variant="ghost" className="mb-8">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Button>
        </Link>

        <h1 className="text-4xl font-bold text-foreground mb-2">Privacy Policy</h1>
        <p className="text-muted-foreground mb-8">Last updated: {lastUpdated}</p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8">
          {/* Introduction */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">1. Introduction</h2>
            <p className="text-muted-foreground leading-relaxed">
              Welcome to {appName}. We respect your privacy and are committed to protecting your personal data. 
              This privacy policy explains how we collect, use, store, and protect your information when you use 
              our social media management platform, including our integration with Meta platforms (Facebook, Instagram, and Threads).
            </p>
          </section>

          {/* Information We Collect */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">2. Information We Collect</h2>
            
            <h3 className="text-xl font-medium text-foreground mt-6 mb-3">2.1 Account Information</h3>
            <p className="text-muted-foreground leading-relaxed mb-4">
              When you create an account, we collect:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>Email address</li>
              <li>Name (if provided)</li>
              <li>Profile picture (if provided)</li>
              <li>Workspace and team information</li>
            </ul>

            <h3 className="text-xl font-medium text-foreground mt-6 mb-3">2.2 Social Media Platform Data</h3>
            <p className="text-muted-foreground leading-relaxed mb-4">
              When you connect your social media accounts, we collect and store:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>OAuth access tokens and refresh tokens (encrypted)</li>
              <li>Social media account identifiers (Page IDs, User IDs)</li>
              <li>Display names and profile pictures</li>
              <li>Account type information (Page, Profile, Business Account)</li>
            </ul>

            <h3 className="text-xl font-medium text-foreground mt-6 mb-3">2.3 Content You Create</h3>
            <p className="text-muted-foreground leading-relaxed mb-4">
              We store content you create within our platform:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>Posts and drafts</li>
              <li>Images and videos you upload</li>
              <li>Scheduling preferences</li>
              <li>Analytics data retrieved from connected platforms</li>
            </ul>
          </section>

          {/* Facebook and Instagram Data */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">3. Facebook and Instagram Data Usage</h2>
            
            <h3 className="text-xl font-medium text-foreground mt-6 mb-3">3.1 Data We Access from Meta Platforms</h3>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Through our integration with Facebook and Instagram, we access:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li><strong>Facebook Pages:</strong> Page information, posting capabilities, and page insights</li>
              <li><strong>Instagram Business/Creator Accounts:</strong> Account information, media publishing, and insights</li>
              <li><strong>Threads:</strong> Profile information and posting capabilities</li>
              <li><strong>Analytics:</strong> Engagement metrics, reach, impressions, and follower demographics</li>
            </ul>

            <h3 className="text-xl font-medium text-foreground mt-6 mb-3">3.2 How We Use Meta Platform Data</h3>
            <p className="text-muted-foreground leading-relaxed mb-4">
              We use data from Facebook and Instagram exclusively to:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>Publish content on your behalf to your connected Pages and accounts</li>
              <li>Display analytics and performance metrics within our dashboard</li>
              <li>Schedule and manage your social media posts</li>
              <li>Show you a preview of your connected accounts</li>
            </ul>

            <h3 className="text-xl font-medium text-foreground mt-6 mb-3">3.3 Data We Do NOT Collect or Use</h3>
            <p className="text-muted-foreground leading-relaxed mb-4">
              We do not:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>Access or store your personal Facebook profile content</li>
              <li>Access private messages or conversations</li>
              <li>Sell your data to third parties</li>
              <li>Use your data for advertising purposes</li>
              <li>Share your social media data with other users</li>
            </ul>
          </section>

          {/* Data Storage and Security */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">4. Data Storage and Security</h2>
            
            <h3 className="text-xl font-medium text-foreground mt-6 mb-3">4.1 Where We Store Your Data</h3>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Your data is stored securely using industry-standard cloud infrastructure. OAuth tokens and 
              sensitive credentials are encrypted at rest and in transit.
            </p>

            <h3 className="text-xl font-medium text-foreground mt-6 mb-3">4.2 Security Measures</h3>
            <p className="text-muted-foreground leading-relaxed mb-4">
              We implement robust security measures including:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>Encryption of data in transit (TLS/SSL)</li>
              <li>Encryption of sensitive data at rest</li>
              <li>Row-level security policies for data isolation</li>
              <li>Regular security audits and updates</li>
              <li>Secure OAuth 2.0 token management with automatic refresh</li>
            </ul>

            <h3 className="text-xl font-medium text-foreground mt-6 mb-3">4.3 Data Retention</h3>
            <p className="text-muted-foreground leading-relaxed">
              We retain your data for as long as your account is active. When you disconnect a social media 
              account or delete your account, we remove the associated tokens and data within 30 days.
            </p>
          </section>

          {/* User Rights */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">5. Your Rights</h2>
            
            <p className="text-muted-foreground leading-relaxed mb-4">
              You have the following rights regarding your data:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li><strong>Access:</strong> Request a copy of the data we hold about you</li>
              <li><strong>Correction:</strong> Request correction of inaccurate data</li>
              <li><strong>Deletion:</strong> Request deletion of your data and account</li>
              <li><strong>Disconnection:</strong> Disconnect social media accounts at any time through our Channels page</li>
              <li><strong>Export:</strong> Export your content and data</li>
              <li><strong>Revoke Access:</strong> Revoke our access to your social media accounts through the respective platform's settings</li>
            </ul>

            <h3 className="text-xl font-medium text-foreground mt-6 mb-3">5.1 How to Exercise Your Rights</h3>
            <p className="text-muted-foreground leading-relaxed">
              To disconnect a social media account, visit the Channels page in our app and click "Disconnect" 
              on the relevant account. To delete your entire account or request data export, please contact us 
              at the email address below.
            </p>
          </section>

          {/* Third-Party Services */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">6. Third-Party Services</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Our service integrates with the following third-party platforms:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li><strong>Meta Platforms (Facebook, Instagram, Threads):</strong> For social media publishing and analytics</li>
              <li><strong>YouTube (Google):</strong> For video publishing and analytics</li>
              <li><strong>LinkedIn:</strong> For professional content publishing</li>
              <li><strong>X (Twitter):</strong> For microblogging content</li>
              <li><strong>TikTok:</strong> For short-form video content</li>
              <li><strong>Bluesky:</strong> For decentralized social content</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-4">
              Each platform has its own privacy policy. We encourage you to review their policies for 
              information on how they handle your data.
            </p>
          </section>

          {/* Cookies */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">7. Cookies and Tracking</h2>
            <p className="text-muted-foreground leading-relaxed">
              We use essential cookies to maintain your login session and preferences. We do not use 
              third-party tracking cookies or sell data to advertisers.
            </p>
          </section>

          {/* Changes to Policy */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">8. Changes to This Policy</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may update this privacy policy from time to time. We will notify you of any significant 
              changes by posting the new policy on this page and updating the "Last updated" date.
            </p>
          </section>

          {/* Contact */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">9. Contact Us</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              If you have any questions about this privacy policy or our data practices, please contact us:
            </p>
            <p className="text-muted-foreground">
              <strong>Email:</strong> {contactEmail}
            </p>
          </section>

          {/* Meta-Specific Compliance */}
          <section className="border-t border-border pt-8 mt-8">
            <h2 className="text-2xl font-semibold text-foreground mb-4">Meta Platform Terms Compliance</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Our use of Facebook and Instagram data complies with:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>Meta Platform Terms of Service</li>
              <li>Meta Developer Policies</li>
              <li>Facebook and Instagram Terms of Use</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-4">
              Users can revoke our access to their Facebook or Instagram data at any time by visiting 
              their Facebook Settings → Apps and Websites, or by disconnecting the account within our application.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
