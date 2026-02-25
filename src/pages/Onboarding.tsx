import { useState } from "react";
import paulSignature from "@/assets/paul-signature.png";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Film, User, Phone, MapPin, Mail } from "lucide-react";
import SignaturePad from "@/components/SignaturePad";

const Onboarding = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState(user?.user_metadata?.full_name || "");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState(user?.email || "");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [signatureData, setSignatureData] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreedToTerms) {
      toast.error("You must agree to the Terms & NDA to continue.");
      return;
    }
    if (!user) return;

    setLoading(true);
    const { error } = await supabase.from("user_profiles").insert({
      user_id: user.id,
      full_name: fullName.trim(),
      phone: phone.trim() || null,
      address: address.trim() || null,
      email: email.trim(),
      nda_signed: true,
      nda_signed_at: new Date().toISOString(),
      signature_data: signatureData,
      onboarding_complete: true,
    });
    setLoading(false);

    if (error) {
      if (error.code === "23505") {
        // Profile already exists, update it
        const { error: updateErr } = await supabase
          .from("user_profiles")
          .update({
            full_name: fullName.trim(),
            phone: phone.trim() || null,
            address: address.trim() || null,
            email: email.trim(),
            nda_signed: true,
            nda_signed_at: new Date().toISOString(),
            signature_data: signatureData,
            onboarding_complete: true,
          })
          .eq("user_id", user.id);
        if (updateErr) {
          toast.error(updateErr.message);
          return;
        }
      } else {
        toast.error(error.message);
        return;
      }
    }

    // Also create default access controls (all off by default)
    await supabase.from("user_access_controls").upsert({
      user_id: user.id,
    }, { onConflict: "user_id" });

    toast.success("Welcome to Virtual Film Studio!");
    navigate("/projects");
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden items-center justify-center">
        <div className="absolute inset-0 bg-gradient-to-br from-background via-card to-background" />
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: "radial-gradient(circle at 30% 40%, hsl(51 100% 50% / 0.15), transparent 60%), radial-gradient(circle at 70% 70%, hsl(345 100% 50% / 0.1), transparent 50%)",
          }}
        />
        <div className="relative z-10 text-center space-y-6 px-12">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20">
            <Film className="h-10 w-10 text-primary" />
          </div>
          <h1 className="font-display text-4xl font-bold tracking-tight">Almost There</h1>
          <p className="text-muted-foreground text-lg max-w-sm mx-auto leading-relaxed">
            This is a highly confidential beta version of our revolutionary software. Please complete your profile and sign the NDA to access the studio. We appreciate your interest in our app. Thank you for your cooperation.
          </p>
          <div className="mx-auto h-24 w-48 relative" style={{ maskImage: "radial-gradient(ellipse 70% 60% at center, black 20%, transparent 70%)", WebkitMaskImage: "radial-gradient(ellipse 70% 60% at center, black 20%, transparent 70%)" }}>
            <img src={paulSignature} alt="Paul" className="h-full w-full object-contain opacity-60 mix-blend-screen" />
          </div>
        </div>
      </div>

      {/* Right — Form */}
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-md space-y-8">
          <div className="lg:hidden flex flex-col items-center gap-3 mb-4">
            <Film className="h-10 w-10 text-primary" />
            <h1 className="font-display text-2xl font-bold">Virtual Film Studio</h1>
          </div>

          <div>
            <h2 className="font-display text-2xl font-bold">Complete Your Profile</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Please fill in your details and agree to our terms before continuing.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="fullName" className="text-sm">Full Name *</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your full name"
                  className="pl-10 bg-secondary border-border"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm">Email *</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="pl-10 bg-secondary border-border"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone" className="text-sm">Phone Number</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(555) 123-4567"
                  className="pl-10 bg-secondary border-border"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address" className="text-sm">Address</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="123 Main St, City, State"
                  className="pl-10 bg-secondary border-border"
                />
              </div>
            </div>

            {/* NDA Agreement */}
            <div className="rounded-lg border border-border bg-secondary/50 p-4 space-y-3">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="agreeNda"
                  checked={agreedToTerms}
                  onCheckedChange={(checked) => setAgreedToTerms(checked === true)}
                  className="mt-0.5"
                />
                <label htmlFor="agreeNda" className="text-sm text-foreground leading-snug cursor-pointer">
                  I have read and agree to the{" "}
                  <Dialog>
                    <DialogTrigger asChild>
                      <button type="button" className="text-primary hover:underline font-medium">
                        Terms &amp; Conditions / Non-Disclosure Agreement
                      </button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[80vh] p-0">
                      <DialogHeader className="px-6 pt-6 pb-0">
                        <DialogTitle className="font-display text-xl font-bold">Terms &amp; Conditions / Non-Disclosure Agreement</DialogTitle>
                      </DialogHeader>
                      <ScrollArea className="px-6 pb-6 max-h-[65vh]">
                        <div className="prose prose-invert max-w-none space-y-6 text-sm text-muted-foreground leading-relaxed pr-4">
                          <section>
                            <h2 className="text-lg font-semibold text-foreground">1. Confidentiality &amp; Non-Disclosure</h2>
                            <p>By using Virtual Film Studio ("the Platform"), you agree to maintain strict confidentiality regarding all proprietary content, methodologies, workflows, algorithms, and creative assets made available through the Platform.</p>
                          </section>
                          <section>
                            <h2 className="text-lg font-semibold text-foreground">2. Prohibited Uses</h2>
                            <p>You agree that you will NOT:</p>
                            <ul className="list-disc pl-6 space-y-1">
                              <li>Copy, reproduce, or duplicate any content, workflows, or proprietary processes</li>
                              <li>Reverse-engineer, decompile, or attempt to derive underlying algorithms</li>
                              <li>Share, distribute, or disclose confidential information to third parties</li>
                              <li>Use ideas or processes to create competing products or services</li>
                              <li>Screenshot, record, or capture Platform content for redistribution</li>
                              <li>Share login credentials or allow unauthorized access</li>
                            </ul>
                          </section>
                          <section>
                            <h2 className="text-lg font-semibold text-foreground">3. Intellectual Property</h2>
                            <p>All intellectual property rights in the Platform are owned exclusively by Virtual Film Studio and its licensors.</p>
                          </section>
                          <section>
                            <h2 className="text-lg font-semibold text-foreground">4. User-Generated Content</h2>
                            <p>You retain ownership of original scripts and source materials you upload. The methods and AI-assisted processes used remain proprietary to the Platform.</p>
                          </section>
                          <section>
                            <h2 className="text-lg font-semibold text-foreground">5. Duration</h2>
                            <p>This non-disclosure obligation survives termination and remains in effect indefinitely.</p>
                          </section>
                          <section>
                            <h2 className="text-lg font-semibold text-foreground">6. Remedies</h2>
                            <p>Any breach may cause irreparable harm. Virtual Film Studio shall be entitled to seek injunctive relief.</p>
                          </section>
                          <section>
                            <h2 className="text-lg font-semibold text-foreground">7. Acceptable Use</h2>
                            <p>Use the Platform solely for its intended purpose. Misuse may result in immediate account termination.</p>
                          </section>
                          <section>
                            <h2 className="text-lg font-semibold text-foreground">8. Modifications</h2>
                            <p>Virtual Film Studio reserves the right to modify these terms at any time.</p>
                          </section>
                          <section>
                            <h2 className="text-lg font-semibold text-foreground">9. Governing Law</h2>
                            <p>This agreement shall be governed by applicable laws, without regard to conflict of law principles.</p>
                          </section>
                          <p className="text-xs text-muted-foreground/60 pt-4 border-t border-border">Last updated: February 2026</p>
                        </div>
                      </ScrollArea>
                    </DialogContent>
                  </Dialog>
                  . I understand that I am bound by these terms and will not copy, share, or misuse any proprietary content or ideas.
                </label>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  Digital Signature
                </Label>
                <SignaturePad onSignatureChange={setSignatureData} />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full gap-2"
              disabled={loading || !agreedToTerms || !fullName.trim() || !email.trim() || !signatureData}
            >
              {loading ? "Saving…" : "Sign & Continue"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
