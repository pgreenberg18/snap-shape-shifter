import { useRef, useCallback } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

interface NDADocumentProps {
  fullName: string;
  email: string;
  phone?: string | null;
  address?: string | null;
  signatureData?: string | null;
  ndaSignedAt?: string | null;
}

const NDADocument = ({ fullName, email, phone, address, signatureData, ndaSignedAt }: NDADocumentProps) => {
  const contentRef = useRef<HTMLDivElement>(null);

  const handleDownloadPdf = useCallback(async () => {
    if (!contentRef.current) return;
    const canvas = await html2canvas(contentRef.current, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
    });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    let heightLeft = pdfHeight;
    let position = 0;
    const pageHeight = pdf.internal.pageSize.getHeight();

    pdf.addImage(imgData, "PNG", 0, position, pdfWidth, pdfHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position -= pageHeight;
      pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, position, pdfWidth, pdfHeight);
      heightLeft -= pageHeight;
    }

    pdf.save(`NDA_${fullName.replace(/\s+/g, "_")}.pdf`);
  }, [fullName]);

  return (
    <div className="rounded-lg border border-border shadow-sm overflow-hidden">
      <div className="flex items-center justify-end px-4 py-2 border-b border-border bg-secondary/30">
        <Button variant="outline" size="sm" className="gap-2" onClick={handleDownloadPdf}>
          <Download className="h-3.5 w-3.5" /> Download PDF
        </Button>
      </div>
      <ScrollArea className="h-[65vh]">
        <div ref={contentRef} className="bg-white text-gray-900 p-8 md:p-12 space-y-8 font-serif text-sm leading-relaxed">
          {/* Header */}
          <div className="text-center space-y-2 border-b border-gray-200 pb-6">
            <h1 className="text-xl font-bold tracking-tight text-gray-900 font-sans">
              TERMS &amp; CONDITIONS / NON-DISCLOSURE AGREEMENT
            </h1>
            <p className="text-xs text-gray-500 font-sans">Virtual Film Studio — Confidential</p>
          </div>

          {/* NDA Sections */}
          <div className="space-y-5">
            <section>
              <h2 className="text-sm font-bold text-gray-900 font-sans mb-1">1. Confidentiality &amp; Non-Disclosure</h2>
              <p>By using Virtual Film Studio ("the Platform"), you agree to maintain strict confidentiality regarding all proprietary content, methodologies, workflows, algorithms, and creative assets made available through the Platform.</p>
            </section>

            <section>
              <h2 className="text-sm font-bold text-gray-900 font-sans mb-1">2. Prohibited Uses</h2>
              <p className="mb-2">You agree that you will NOT:</p>
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
              <h2 className="text-sm font-bold text-gray-900 font-sans mb-1">3. Intellectual Property</h2>
              <p>All intellectual property rights in the Platform are owned exclusively by Virtual Film Studio and its licensors.</p>
            </section>

            <section>
              <h2 className="text-sm font-bold text-gray-900 font-sans mb-1">4. User-Generated Content</h2>
              <p>You retain ownership of original scripts and source materials you upload. The methods and AI-assisted processes used remain proprietary to the Platform.</p>
            </section>

            <section>
              <h2 className="text-sm font-bold text-gray-900 font-sans mb-1">5. Duration</h2>
              <p>This non-disclosure obligation survives termination and remains in effect indefinitely.</p>
            </section>

            <section>
              <h2 className="text-sm font-bold text-gray-900 font-sans mb-1">6. Remedies</h2>
              <p>Any breach may cause irreparable harm. Virtual Film Studio shall be entitled to seek injunctive relief.</p>
            </section>

            <section>
              <h2 className="text-sm font-bold text-gray-900 font-sans mb-1">7. Acceptable Use</h2>
              <p>Use the Platform solely for its intended purpose. Misuse may result in immediate account termination.</p>
            </section>

            <section>
              <h2 className="text-sm font-bold text-gray-900 font-sans mb-1">8. Modifications</h2>
              <p>Virtual Film Studio reserves the right to modify these terms at any time.</p>
            </section>

            <section>
              <h2 className="text-sm font-bold text-gray-900 font-sans mb-1">9. Governing Law</h2>
              <p>This agreement shall be governed by applicable laws, without regard to conflict of law principles.</p>
            </section>
          </div>

          {/* Signatory Info */}
          <div className="border-t border-gray-300 pt-6 space-y-4">
            <h2 className="text-sm font-bold text-gray-900 font-sans">Signatory Information</h2>
            <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
              <div>
                <span className="text-gray-500 text-xs font-sans block">Full Name</span>
                <span className="text-gray-900 font-medium">{fullName}</span>
              </div>
              <div>
                <span className="text-gray-500 text-xs font-sans block">Email</span>
                <span className="text-gray-900">{email}</span>
              </div>
              <div>
                <span className="text-gray-500 text-xs font-sans block">Phone</span>
                <span className="text-gray-900">{phone || "—"}</span>
              </div>
              <div>
                <span className="text-gray-500 text-xs font-sans block">Address</span>
                <span className="text-gray-900">{address || "—"}</span>
              </div>
            </div>
          </div>

          {/* Signature */}
          <div className="border-t border-gray-300 pt-6">
            <div className="space-y-3">
              <span className="text-gray-500 text-xs font-sans block">Digital Signature</span>
              {signatureData ? (
                <div className="border border-gray-200 rounded bg-gray-50 p-3 inline-block">
                  <img
                    src={signatureData}
                    alt={`Signature of ${fullName}`}
                    className="h-20 w-auto object-contain"
                    style={{ filter: "invert(0)" }}
                  />
                </div>
              ) : (
                <p className="text-gray-400 italic text-xs">No signature on file</p>
              )}
              <div className="pt-2">
                <span className="text-gray-500 text-xs font-sans block">Date &amp; Time Signed</span>
                <span className="text-gray-900 text-sm font-medium">
                  {ndaSignedAt
                    ? new Date(ndaSignedAt).toLocaleString("en-US", {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                        timeZoneName: "short",
                      })
                    : "—"}
                </span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 pt-4 text-center">
            <p className="text-[10px] text-gray-400 font-sans">
              Last updated: February 2026 · Virtual Film Studio · All rights reserved
            </p>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};

export default NDADocument;
