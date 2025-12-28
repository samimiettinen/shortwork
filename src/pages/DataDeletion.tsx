import { Link } from "react-router-dom";
import { ArrowLeft, Trash2, Mail, Clock, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const DataDeletion = () => {
  const lastUpdated = "December 28, 2024";
  const appName = "ShortWork";
  const contactEmail = "privacy@shortwork.lovable.app";

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Link to="/">
          <Button variant="ghost" className="mb-6">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
        </Link>

        <div className="space-y-8">
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-destructive/10 mb-4">
              <Trash2 className="w-8 h-8 text-destructive" />
            </div>
            <h1 className="text-4xl font-display font-bold">Data Deletion Request</h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              You have the right to request deletion of your personal data from {appName}. 
              This page explains how to submit a deletion request.
            </p>
            <p className="text-sm text-muted-foreground">Last updated: {lastUpdated}</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="w-5 h-5" />
                How to Request Data Deletion
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p>To request deletion of your data, please send an email to:</p>
              <a 
                href={`mailto:${contactEmail}?subject=Data Deletion Request`}
                className="inline-block px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
              >
                {contactEmail}
              </a>
              <p className="text-muted-foreground">
                Please include the following information in your request:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>Your registered email address</li>
                <li>Your account username (if applicable)</li>
                <li>A clear statement that you wish to delete your data</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                What Data Will Be Deleted
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                Upon receiving your deletion request, we will remove the following data:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>Your account profile information</li>
                <li>Connected social media account tokens and credentials</li>
                <li>Scheduled and published posts created through {appName}</li>
                <li>Uploaded media and assets</li>
                <li>Analytics data associated with your account</li>
                <li>Workspace memberships and invitations</li>
              </ul>
              <p className="text-muted-foreground mt-4">
                <strong>Note:</strong> Content already published to third-party social media platforms 
                will remain on those platforms. You will need to delete that content directly through 
                the respective platform's settings.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Processing Time
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                We will process your deletion request within <strong>30 days</strong> of receiving it. 
                You will receive a confirmation email once your data has been deleted.
              </p>
              <p className="text-muted-foreground mt-4">
                Some data may be retained for legal or regulatory compliance purposes, such as:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground mt-2">
                <li>Transaction records for tax purposes</li>
                <li>Data required to comply with legal obligations</li>
                <li>Anonymized analytics data that cannot be linked back to you</li>
              </ul>
            </CardContent>
          </Card>

          <div className="text-center py-8 border-t border-border">
            <p className="text-muted-foreground mb-4">
              For any questions about data deletion, please contact us at:
            </p>
            <a 
              href={`mailto:${contactEmail}`}
              className="text-primary hover:underline font-medium"
            >
              {contactEmail}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DataDeletion;
