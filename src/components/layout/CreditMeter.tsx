import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useCreditUsage, useCreditSettings } from "@/hooks/useCreditUsage";
// Custom credit meter icon with blue accent
import { toast } from "sonner";

interface CreditMeterProps {
  expanded: boolean;
}

const CreditMeter = ({ expanded }: CreditMeterProps) => {
  const navigate = useNavigate();
  const { projectId, versionId } = useParams();
  const { data: usage } = useCreditUsage("month");
  const { data: settings } = useCreditSettings();
  const [warningShown, setWarningShown] = useState(false);

  const total = usage?.total ?? 0;
  const warningThreshold = settings?.warning_threshold ? Number(settings.warning_threshold) : null;
  const cutoffThreshold = settings?.cutoff_threshold ? Number(settings.cutoff_threshold) : null;

  const getLevel = (): "green" | "yellow" | "red" => {
    if (cutoffThreshold && total >= cutoffThreshold) return "red";
    if (warningThreshold && total >= warningThreshold) return "yellow";
    if (cutoffThreshold && total >= cutoffThreshold * 0.8) return "yellow";
    return "green";
  };

  const level = getLevel();
  const maxRef = cutoffThreshold || warningThreshold || 100;
  const fillPct = Math.min((total / maxRef) * 100, 100);

  useEffect(() => {
    if (!warningShown && warningThreshold && total >= warningThreshold) {
      toast.warning(`Credit usage warning: You've used ${total.toFixed(0)} credits this month.`);
      setWarningShown(true);
    }
    if (!warningShown && cutoffThreshold && total >= cutoffThreshold) {
      toast.error(`Credit usage limit reached: ${cutoffThreshold} credits.`);
      setWarningShown(true);
    }
  }, [total, warningThreshold, cutoffThreshold, warningShown]);

  const meterColor = level === "red"
    ? "bg-destructive"
    : level === "yellow"
      ? "bg-amber-500"
      : "bg-emerald-500";

  const glowColor = level === "red"
    ? "shadow-destructive/30"
    : level === "yellow"
      ? "shadow-amber-500/30"
      : "shadow-emerald-500/30";

  const handleClick = () => {
    if (projectId && versionId) {
      navigate(`/projects/${projectId}/versions/${versionId}/settings?section=credit-usage`);
    }
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        "flex items-center rounded-lg transition-all duration-200 group",
        expanded ? "h-10 gap-3 px-3 w-full" : "h-10 w-10 justify-center",
        "text-muted-foreground hover:bg-accent hover:text-foreground"
      )}
      title="Credit Usage"
    >
      <div className="relative shrink-0">
        <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 shrink-0">
          <path d="M12 21a9 9 0 110-18 9 9 0 010 18z" stroke="currentColor" strokeWidth="1.3" opacity="0.4" />
          <path d="M6 17a8 8 0 0112 0" stroke="currentColor" strokeWidth="1" opacity="0.2" />
          <path d="M12 12l3-4" stroke="hsl(217 100% 59%)" strokeWidth="1.6" strokeLinecap="round" opacity="0.85" />
          <circle cx="12" cy="12" r="1.2" fill="currentColor" opacity="0.5" />
        </svg>
        <div
          className={cn(
            "absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full shadow-sm",
            meterColor, glowColor
          )}
        />
      </div>
      {expanded && (
        <div className="flex-1 flex flex-col items-start gap-0.5 min-w-0">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground leading-none">Credits</span>
          <div className="w-full h-1.5 rounded-full bg-secondary overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all duration-500", meterColor)}
              style={{ width: `${fillPct}%` }}
            />
          </div>
        </div>
      )}
    </button>
  );
};

export default CreditMeter;
