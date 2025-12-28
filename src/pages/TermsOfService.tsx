import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const TermsOfService = () => {
  const lastUpdated = "December 28, 2024";
  const appName = "Social Media Manager";
  const contactEmail = "support@yourdomain.com";

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <Link to="/">
          <Button variant="ghost" className="mb-8">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Button>
        </Link>

        <h1 className="text-4xl font-bold text-foreground mb-2">Terms of Service</h1>
        <p className="text-muted-foreground mb-8">Last updated: {lastUpdated}</p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8">
          {/* Introduction */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">1. Acceptance of Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              By accessing or using {appName} ("the Service"), you agree to be bound by these Terms of Service 
              ("Terms"). If you do not agree to these Terms, you may not access or use the Service. These Terms 
              apply to all users, including workspace owners, team members, and visitors.
            </p>
          </section>

          {/* Description of Service */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">2. Description of Service</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              {appName} is a social media management platform that allows you to:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>Connect and manage multiple social media accounts</li>
              <li>Create, schedule, and publish content to various platforms</li>
              <li>View analytics and performance metrics</li>
              <li>Collaborate with team members on social media content</li>
              <li>Manage approval workflows for content publishing</li>
            </ul>
          </section>

          {/* Account Registration */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">3. Account Registration</h2>
            
            <h3 className="text-xl font-medium text-foreground mt-6 mb-3">3.1 Account Creation</h3>
            <p className="text-muted-foreground leading-relaxed">
              To use certain features of the Service, you must create an account. You agree to provide 
              accurate, current, and complete information during registration and to update such information 
              to keep it accurate, current, and complete.
            </p>

            <h3 className="text-xl font-medium text-foreground mt-6 mb-3">3.2 Account Security</h3>
            <p className="text-muted-foreground leading-relaxed">
              You are responsible for safeguarding your account credentials and for all activities that occur 
              under your account. You must notify us immediately of any unauthorized use of your account.
            </p>

            <h3 className="text-xl font-medium text-foreground mt-6 mb-3">3.3 Age Requirement</h3>
            <p className="text-muted-foreground leading-relaxed">
              You must be at least 18 years old to use this Service. By using the Service, you represent 
              and warrant that you meet this age requirement.
            </p>
          </section>

          {/* Social Media Platform Integration */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">4. Social Media Platform Integration</h2>
            
            <h3 className="text-xl font-medium text-foreground mt-6 mb-3">4.1 Third-Party Platforms</h3>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Our Service integrates with third-party social media platforms including but not limited to:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>Meta Platforms (Facebook, Instagram, Threads)</li>
              <li>YouTube (Google)</li>
              <li>LinkedIn</li>
              <li>X (formerly Twitter)</li>
              <li>TikTok</li>
              <li>Bluesky</li>
            </ul>

            <h3 className="text-xl font-medium text-foreground mt-6 mb-3">4.2 Platform Terms Compliance</h3>
            <p className="text-muted-foreground leading-relaxed">
              By connecting your social media accounts to our Service, you agree to comply with each 
              platform's terms of service, community guidelines, and policies. We are not responsible for 
              any actions taken by these platforms regarding your accounts.
            </p>

            <h3 className="text-xl font-medium text-foreground mt-6 mb-3">4.3 Authorization</h3>
            <p className="text-muted-foreground leading-relaxed">
              When you connect a social media account, you authorize us to access and use your account 
              information as described in our Privacy Policy. You represent that you have the authority 
              to grant this access and that doing so does not violate any third-party rights.
            </p>
          </section>

          {/* User Content */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">5. User Content</h2>
            
            <h3 className="text-xl font-medium text-foreground mt-6 mb-3">5.1 Your Content</h3>
            <p className="text-muted-foreground leading-relaxed">
              You retain ownership of all content you create, upload, or publish through the Service 
              ("User Content"). By using the Service, you grant us a limited license to store, process, 
              and transmit your User Content solely for the purpose of providing the Service.
            </p>

            <h3 className="text-xl font-medium text-foreground mt-6 mb-3">5.2 Content Responsibility</h3>
            <p className="text-muted-foreground leading-relaxed mb-4">
              You are solely responsible for your User Content and the consequences of posting or 
              publishing it. You represent and warrant that:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>You own or have the necessary rights to use and authorize the use of your User Content</li>
              <li>Your User Content does not violate any applicable laws or regulations</li>
              <li>Your User Content does not infringe on any third-party intellectual property rights</li>
              <li>Your User Content is not defamatory, obscene, or otherwise objectionable</li>
            </ul>

            <h3 className="text-xl font-medium text-foreground mt-6 mb-3">5.3 Prohibited Content</h3>
            <p className="text-muted-foreground leading-relaxed mb-4">
              You may not use the Service to create, store, or publish content that:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>Is illegal, harmful, or promotes illegal activities</li>
              <li>Contains hate speech or promotes discrimination</li>
              <li>Infringes on intellectual property rights</li>
              <li>Contains malware or malicious code</li>
              <li>Is spam or misleading</li>
              <li>Violates the terms of connected social media platforms</li>
            </ul>
          </section>

          {/* Acceptable Use */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">6. Acceptable Use</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              You agree not to:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>Use the Service for any unlawful purpose</li>
              <li>Attempt to gain unauthorized access to any part of the Service</li>
              <li>Interfere with or disrupt the Service or servers</li>
              <li>Use automated systems to access the Service without permission</li>
              <li>Impersonate any person or entity</li>
              <li>Share your account credentials with others</li>
              <li>Use the Service to send spam or unsolicited messages</li>
              <li>Circumvent any rate limits or usage restrictions</li>
            </ul>
          </section>

          {/* Workspaces and Teams */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">7. Workspaces and Team Members</h2>
            
            <h3 className="text-xl font-medium text-foreground mt-6 mb-3">7.1 Workspace Ownership</h3>
            <p className="text-muted-foreground leading-relaxed">
              Workspace owners are responsible for managing their workspace, including inviting and 
              removing team members, setting permissions, and ensuring compliance with these Terms.
            </p>

            <h3 className="text-xl font-medium text-foreground mt-6 mb-3">7.2 Team Member Access</h3>
            <p className="text-muted-foreground leading-relaxed">
              Team members may have different permission levels as assigned by workspace owners. 
              All team members must comply with these Terms and any workspace-specific policies.
            </p>
          </section>

          {/* Intellectual Property */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">8. Intellectual Property</h2>
            <p className="text-muted-foreground leading-relaxed">
              The Service and its original content, features, and functionality are owned by us and are 
              protected by international copyright, trademark, and other intellectual property laws. 
              Our trademarks may not be used without our prior written consent.
            </p>
          </section>

          {/* Disclaimer of Warranties */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">9. Disclaimer of Warranties</h2>
            <p className="text-muted-foreground leading-relaxed">
              THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, 
              EITHER EXPRESS OR IMPLIED. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, 
              SECURE, OR ERROR-FREE. WE ARE NOT RESPONSIBLE FOR THE ACTIONS, CONTENT, OR POLICIES 
              OF THIRD-PARTY SOCIAL MEDIA PLATFORMS.
            </p>
          </section>

          {/* Limitation of Liability */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">10. Limitation of Liability</h2>
            <p className="text-muted-foreground leading-relaxed">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE SHALL NOT BE LIABLE FOR ANY INDIRECT, 
              INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF PROFITS, 
              DATA, OR GOODWILL, ARISING FROM YOUR USE OF THE SERVICE OR INABILITY TO USE THE SERVICE.
            </p>
          </section>

          {/* Indemnification */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">11. Indemnification</h2>
            <p className="text-muted-foreground leading-relaxed">
              You agree to indemnify and hold us harmless from any claims, damages, losses, or expenses 
              (including reasonable attorneys' fees) arising from your use of the Service, your User Content, 
              or your violation of these Terms.
            </p>
          </section>

          {/* Termination */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">12. Termination</h2>
            
            <h3 className="text-xl font-medium text-foreground mt-6 mb-3">12.1 Termination by You</h3>
            <p className="text-muted-foreground leading-relaxed">
              You may terminate your account at any time by contacting us. Upon termination, you will 
              lose access to the Service and your data may be deleted in accordance with our Privacy Policy.
            </p>

            <h3 className="text-xl font-medium text-foreground mt-6 mb-3">12.2 Termination by Us</h3>
            <p className="text-muted-foreground leading-relaxed">
              We may terminate or suspend your account immediately, without prior notice, if you breach 
              these Terms or engage in conduct that we determine is harmful to the Service or other users.
            </p>
          </section>

          {/* Changes to Terms */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">13. Changes to Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              We reserve the right to modify these Terms at any time. We will notify you of any material 
              changes by posting the new Terms on this page and updating the "Last updated" date. Your 
              continued use of the Service after such changes constitutes acceptance of the new Terms.
            </p>
          </section>

          {/* Governing Law */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">14. Governing Law</h2>
            <p className="text-muted-foreground leading-relaxed">
              These Terms shall be governed by and construed in accordance with the laws of the jurisdiction 
              in which we operate, without regard to its conflict of law provisions.
            </p>
          </section>

          {/* Contact */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">15. Contact Us</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              If you have any questions about these Terms, please contact us:
            </p>
            <p className="text-muted-foreground">
              <strong>Email:</strong> {contactEmail}
            </p>
          </section>

          {/* Related Policies */}
          <section className="border-t border-border pt-8 mt-8">
            <h2 className="text-2xl font-semibold text-foreground mb-4">Related Policies</h2>
            <p className="text-muted-foreground leading-relaxed">
              Please also review our{" "}
              <Link to="/privacy-policy" className="text-primary hover:underline">
                Privacy Policy
              </Link>
              , which describes how we collect, use, and protect your personal information.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default TermsOfService;
