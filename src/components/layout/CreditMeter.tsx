import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useCreditUsage, useCreditSettings } from "@/hooks/useCreditUsage";
import { Gauge, TrendingUp, Zap, ChevronDown } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const PERIOD_LABELS = {
  week: "Last Week",
  month: "This Month",
  year: "This Year",
} as const;

type Period = "week" | "month" | "year";

const CATEGORY_LABELS: Record<string, string> = {
  "script-analysis": "Script Analysis",
  "image-generation": "Image Generation",
  "sound-stage": "Voice & Audio",
  "camera-cart": "Video Generation",
  "post-house": "Post-Production",
};

const CATEGORY_COLORS: Record<string, string> = {
  "script-analysis": "bg-blue-500",
  "image-generation": "bg-emerald-500",
  "sound-stage": "bg-amber-500",
  "camera-cart": "bg-violet-500",
  "post-house": "bg-rose-500",
};

interface CreditMeterProps {
  expanded: boolean;
}

const CreditMeter = ({ expanded }: CreditMeterProps) => {
  const [period, setPeriod] = useState<Period>("month");
  const { data: usage } = useCreditUsage(period);
  const { data: settings } = useCreditSettings();
  const [warningShown, setWarningShown] = useState(false);

  const total = usage?.total ?? 0;
  const warningThreshold = settings?.warning_threshold ? Number(settings.warning_threshold) : null;
  const cutoffThreshold = settings?.cutoff_threshold ? Number(settings.cutoff_threshold) : null;

  // Determine meter level
  const getLevel = (): "green" | "yellow" | "red" => {
    if (cutoffThreshold && total >= cutoffThreshold) return "red";
    if (warningThreshold && total >= warningThreshold) return "yellow";
    if (cutoffThreshold && total >= cutoffThreshold * 0.8) return "yellow";
    return "green";
  };

  const level = getLevel();

  // Calculate fill percentage (against cutoff or warning, whichever is set)
  const maxRef = cutoffThreshold || warningThreshold || 100;
  const fillPct = Math.min((total / maxRef) * 100, 100);

  // Show warning toast when threshold exceeded
  useEffect(() => {
    if (!warningShown && warningThreshold && total >= warningThreshold) {
      toast.warning(`Credit usage warning: You've used ${total.toFixed(0)} credits this ${period}, exceeding your ${warningThreshold} credit guideline.`);
      setWarningShown(true);
    }
    if (!warningShown && cutoffThreshold && total >= cutoffThreshold) {
      toast.error(`Credit usage limit: You've reached your ${cutoffThreshold} credit cutoff limit for this ${period}.`);
      setWarningShown(true);
    }
  }, [total, warningThreshold, cutoffThreshold, period, warningShown]);

  // Reset warning flag when period changes
  useEffect(() => {
    setWarningShown(false);
  }, [period]);

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

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "flex items-center rounded-lg transition-all duration-200 group",
            expanded ? "h-10 gap-3 px-3 w-full" : "h-10 w-10 justify-center",
            "text-muted-foreground hover:bg-accent hover:text-foreground"
          )}
          title="Credit Usage"
        >
          {/* Mini meter */}
          <div className="relative shrink-0">
            <Gauge className="h-5 w-5 shrink-0" />
            {/* Tiny indicator dot */}
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
      </PopoverTrigger>

      <PopoverContent side="right" align="end" className="w-80 p-0">
        <div className="p-4 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              <h3 className="font-display text-sm font-bold">Credit Usage</h3>
            </div>
            {/* Period selector */}
            <div className="flex items-center gap-1">
              {(["week", "month", "year"] as Period[]).map((p) => (
                <Button
                  key={p}
                  variant={period === p ? "default" : "ghost"}
                  size="sm"
                  className="h-6 px-2 text-[10px] font-bold uppercase tracking-wider"
                  onClick={() => setPeriod(p)}
                >
                  {p === "week" ? "Wk" : p === "month" ? "Mo" : "Yr"}
                </Button>
              ))}
            </div>
          </div>

          {/* Main meter */}
          <div className="space-y-2">
            <div className="flex items-end justify-between">
              <span className={cn(
                "font-display text-3xl font-bold tabular-nums",
                level === "red" ? "text-destructive" : level === "yellow" ? "text-amber-500" : "text-foreground"
              )}>
                {total.toFixed(0)}
              </span>
              <span className="text-xs text-muted-foreground">
                {PERIOD_LABELS[period]}
              </span>
            </div>
            {/* Full meter bar */}
            <div className="relative h-3 rounded-full bg-secondary overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all duration-700 ease-out", meterColor)}
                style={{ width: `${fillPct}%` }}
              />
              {/* Warning marker */}
              {warningThreshold && cutoffThreshold && (
                <div
                  className="absolute top-0 h-full w-0.5 bg-amber-500"
                  style={{ left: `${Math.min((warningThreshold / cutoffThreshold) * 100, 100)}%` }}
                />
              )}
            </div>
            {/* Threshold labels */}
            {(warningThreshold || cutoffThreshold) && (
              <div className="flex justify-between text-[9px] text-muted-foreground">
                <span>0</span>
                {warningThreshold && <span className="text-amber-500">⚠ {warningThreshold}</span>}
                {cutoffThreshold && <span className="text-destructive">⛔ {cutoffThreshold}</span>}
              </div>
            )}
          </div>

          {/* Per-service breakdown */}
          {usage && Object.keys(usage.byService).length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                By Service
              </p>
              <div className="space-y-1">
                {Object.entries(usage.byService)
                  .sort(([, a], [, b]) => b - a)
                  .map(([service, credits]) => (
                    <div key={service} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground truncate">{service}</span>
                      <span className="font-mono font-medium tabular-nums">{credits.toFixed(0)}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Per-category breakdown */}
          {usage && Object.keys(usage.byCategory).length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                By Category
              </p>
              <div className="space-y-1">
                {Object.entries(usage.byCategory)
                  .sort(([, a], [, b]) => b - a)
                  .map(([cat, credits]) => (
                    <div key={cat} className="flex items-center gap-2 text-xs">
                      <div className={cn("h-2 w-2 rounded-full shrink-0", CATEGORY_COLORS[cat] || "bg-muted-foreground")} />
                      <span className="text-muted-foreground truncate flex-1">
                        {CATEGORY_LABELS[cat] || cat}
                      </span>
                      <span className="font-mono font-medium tabular-nums">{credits.toFixed(0)}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* No data state */}
          {(!usage || total === 0) && (
            <div className="text-center py-3">
              <TrendingUp className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">No credit usage recorded yet</p>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default CreditMeter;
