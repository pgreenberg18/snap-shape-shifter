import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

const TermsNDA = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <Button variant="ghost" className="mb-6 gap-2" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>

        <h1 className="font-display text-3xl font-bold text-foreground mb-8">
          Terms &amp; Conditions / Non-Disclosure Agreement
        </h1>

        <div className="prose prose-invert max-w-none space-y-6 text-sm text-muted-foreground leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-foreground">1. Confidentiality &amp; Non-Disclosure</h2>
            <p>
              By using Virtual Film Studio ("the Platform"), you agree to maintain strict confidentiality regarding all proprietary content, methodologies, workflows, algorithms, and creative assets made available through the Platform. This includes, but is not limited to, AI-generated content, script breakdowns, visual style contracts, shot compositions, and any related production materials.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">2. Prohibited Uses</h2>
            <p>You agree that you will NOT:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Copy, reproduce, or duplicate any content, workflows, or proprietary processes from the Platform</li>
              <li>Reverse-engineer, decompile, or attempt to derive the underlying algorithms or methodologies</li>
              <li>Share, distribute, or disclose any confidential information to third parties without prior written consent</li>
              <li>Use any ideas, concepts, or creative processes observed on the Platform to create competing products or services</li>
              <li>Screenshot, record, or capture Platform content for redistribution purposes</li>
              <li>Share login credentials or allow unauthorized access to your account</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">3. Intellectual Property</h2>
            <p>
              All intellectual property rights in the Platform, including its design, features, AI models, and proprietary workflows, are owned exclusively by Virtual Film Studio and its licensors. Your use of the Platform does not grant you any ownership rights in the Platform's technology or processes.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">4. User-Generated Content</h2>
            <p>
              You retain ownership of original scripts and source materials you upload. However, the methods, techniques, and AI-assisted processes used to transform your content remain proprietary to the Platform.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">5. Duration</h2>
            <p>
              This non-disclosure obligation survives the termination of your account and remains in effect indefinitely. Your confidentiality obligations continue even after you stop using the Platform.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">6. Remedies</h2>
            <p>
              You acknowledge that any breach of this agreement may cause irreparable harm. In addition to any other remedies available at law or in equity, Virtual Film Studio shall be entitled to seek injunctive relief to prevent any actual or threatened breach of this agreement.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">7. Acceptable Use</h2>
            <p>
              You agree to use the Platform solely for its intended purpose of virtual film production. Any misuse, abuse, or unauthorized access attempts may result in immediate account termination without notice.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">8. Modifications</h2>
            <p>
              Virtual Film Studio reserves the right to modify these terms at any time. Continued use of the Platform after changes constitutes acceptance of the revised terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">9. Governing Law</h2>
            <p>
              This agreement shall be governed by and construed in accordance with applicable laws, without regard to conflict of law principles.
            </p>
          </section>

          <p className="text-xs text-muted-foreground/60 pt-4 border-t border-border">
            Last updated: February 2026
          </p>
        </div>
      </div>
    </div>
  );
};

export default TermsNDA;
