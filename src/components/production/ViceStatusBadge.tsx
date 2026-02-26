import { useViceStatus, useViceConflicts, useViceDirtyQueue } from "@/hooks/useVice";
import { cn } from "@/lib/utils";
import { Shield, ShieldAlert, ShieldCheck } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ViceStatusBadgeProps {
  onClick?: () => void;
}

const statusConfig = {
  active: {
    icon: ShieldCheck,
    label: "VICE Active",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/30",
    pulse: false,
  },
  updating: {
    icon: Shield,
    label: "VICE Updating",
    color: "text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/30",
    pulse: true,
  },
  conflict: {
    icon: ShieldAlert,
    label: "VICE Conflict",
    color: "text-red-400",
    bg: "bg-red-500/10 border-red-500/30",
    pulse: true,
  },
};

const ViceStatusBadge = ({ onClick }: ViceStatusBadgeProps) => {
  const status = useViceStatus();
  const { data: conflicts } = useViceConflicts();
  const { data: dirtyQueue } = useViceDirtyQueue();
  const config = statusConfig[status];
  const Icon = config.icon;

  const conflictCount = conflicts?.length ?? 0;
  const dirtyCount = dirtyQueue?.length ?? 0;
  const totalIssues = conflictCount + dirtyCount;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-mono font-bold uppercase tracking-wider transition-all hover:brightness-125 cursor-pointer",
            config.bg,
            config.color,
            config.pulse && "animate-pulse"
          )}
        >
          <Icon className="h-3 w-3" />
          <span>VICE</span>
          {totalIssues > 0 && (
            <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-current/20 px-1 text-[9px]">
              {totalIssues}
            </span>
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <p className="text-xs">{config.label}</p>
        {conflictCount > 0 && <p className="text-[10px] text-muted-foreground">{conflictCount} conflict(s)</p>}
        {dirtyCount > 0 && <p className="text-[10px] text-muted-foreground">{dirtyCount} shot(s) need regeneration</p>}
      </TooltipContent>
    </Tooltip>
  );
};

export default ViceStatusBadge;
