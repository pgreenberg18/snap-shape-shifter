import { useMemo, useState, useCallback } from "react";
import { useViceDependencies, type ViceDependency } from "@/hooks/useVice";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  User,
  MapPin,
  Package,
  Clapperboard,
  GitBranch,
} from "lucide-react";

const sourceTypeIcons: Record<string, typeof User> = {
  character: User,
  location: MapPin,
  prop: Package,
};

const sourceTypeLabels: Record<string, string> = {
  character: "Character",
  location: "Location",
  prop: "Prop",
};

interface GraphNode {
  id: string;
  label: string;
  type: "token" | "shot";
  sourceType?: string;
}

interface GraphEdge {
  from: string;
  to: string;
  depType: string;
}

interface TooltipInfo {
  x: number;
  y: number;
  content: React.ReactNode;
}

/* ── Layout constants ── */
const TOKEN_COL_X = 30;
const SHOT_COL_X = 340;
const NODE_H = 28;
const NODE_GAP = 6;
const START_Y = 20;
const TOKEN_W = 140;
const SHOT_W = 70;

/* ── Token Node ── */
const TokenNode = ({
  token,
  y,
  edges,
  highlighted,
  dimmed,
  onEnter,
  onLeave,
}: {
  token: GraphNode;
  y: number;
  edges: GraphEdge[];
  highlighted: boolean;
  dimmed: boolean;
  onEnter: (nodeId: string, tooltip: TooltipInfo) => void;
  onLeave: () => void;
}) => {
  const Icon = sourceTypeIcons[token.sourceType ?? ""] ?? Package;
  const connCount = edges.filter((e) => e.from === token.id).length;
  const depTypes = [...new Set(edges.filter((e) => e.from === token.id).map((e) => e.depType))];

  const handleEnter = useCallback(() => {
    onEnter(token.id, {
      x: TOKEN_COL_X + TOKEN_W + 8,
      y: y + NODE_H / 2,
      content: (
        <div className="flex flex-col gap-0.5">
          <span className="font-bold text-foreground">{token.id}</span>
          <span className="text-muted-foreground">
            Type: {sourceTypeLabels[token.sourceType ?? ""] ?? token.sourceType ?? "unknown"}
          </span>
          <span className="text-muted-foreground">Connections: {connCount} shot(s)</span>
          {depTypes.length > 0 && (
            <span className="text-muted-foreground">
              Dep types: {depTypes.join(", ")}
            </span>
          )}
        </div>
      ),
    });
  }, [token, y, connCount, depTypes, onEnter]);

  return (
    <g
      onMouseEnter={handleEnter}
      onMouseLeave={onLeave}
      className="cursor-pointer"
      style={{
        opacity: dimmed ? 0.2 : 1,
        transition: "opacity 0.2s ease",
      }}
    >
      <rect
        x={TOKEN_COL_X}
        y={y}
        width={TOKEN_W}
        height={NODE_H}
        rx={6}
        fill={highlighted ? "hsl(var(--primary) / 0.2)" : "hsl(var(--primary) / 0.08)"}
        stroke={highlighted ? "hsl(var(--primary) / 0.7)" : "hsl(var(--primary) / 0.3)"}
        strokeWidth={highlighted ? 1.5 : 1}
        style={{ transition: "all 0.2s ease" }}
      />
      <foreignObject x={TOKEN_COL_X + 6} y={y + 4} width={18} height={18}>
        <Icon className="h-3.5 w-3.5 text-primary" />
      </foreignObject>
      <text
        x={TOKEN_COL_X + 28}
        y={y + NODE_H / 2 + 1}
        dominantBaseline="middle"
        className="fill-foreground text-[9px] font-mono pointer-events-none"
      >
        {token.label.length > 14 ? token.label.slice(0, 14) + "…" : token.label}
      </text>
      <circle
        cx={TOKEN_COL_X + 134}
        cy={y + NODE_H / 2}
        r={7}
        fill="hsl(var(--primary) / 0.15)"
      />
      <text
        x={TOKEN_COL_X + 134}
        y={y + NODE_H / 2 + 1}
        textAnchor="middle"
        dominantBaseline="middle"
        className="fill-primary text-[7px] font-mono font-bold pointer-events-none"
      >
        {connCount}
      </text>
    </g>
  );
};

/* ── Shot Node ── */
const ShotNode = ({
  shot,
  y,
  edges,
  highlighted,
  dimmed,
  onEnter,
  onLeave,
}: {
  shot: GraphNode;
  y: number;
  edges: GraphEdge[];
  highlighted: boolean;
  dimmed: boolean;
  onEnter: (nodeId: string, tooltip: TooltipInfo) => void;
  onLeave: () => void;
}) => {
  const connCount = edges.filter((e) => e.to === shot.id).length;
  const sourceTokens = edges.filter((e) => e.to === shot.id).map((e) => e.from);

  const handleEnter = useCallback(() => {
    onEnter(shot.id, {
      x: SHOT_COL_X - 8,
      y: y + NODE_H / 2,
      content: (
        <div className="flex flex-col gap-0.5">
          <span className="font-bold text-foreground">Shot {shot.label}</span>
          <span className="text-muted-foreground text-[8px] break-all">ID: {shot.id}</span>
          <span className="text-muted-foreground">Dependencies: {connCount} token(s)</span>
          {sourceTokens.length > 0 && (
            <span className="text-muted-foreground">
              Tokens: {sourceTokens.join(", ")}
            </span>
          )}
        </div>
      ),
    });
  }, [shot, y, connCount, sourceTokens, onEnter]);

  return (
    <g
      onMouseEnter={handleEnter}
      onMouseLeave={onLeave}
      className="cursor-pointer"
      style={{
        opacity: dimmed ? 0.2 : 1,
        transition: "opacity 0.2s ease",
      }}
    >
      <rect
        x={SHOT_COL_X}
        y={y}
        width={SHOT_W}
        height={NODE_H}
        rx={6}
        fill={highlighted ? "hsl(var(--accent))" : "hsl(var(--secondary))"}
        stroke={highlighted ? "hsl(var(--primary) / 0.5)" : "hsl(var(--border))"}
        strokeWidth={highlighted ? 1.5 : 1}
        style={{ transition: "all 0.2s ease" }}
      />
      <foreignObject x={SHOT_COL_X + 5} y={y + 4} width={18} height={18}>
        <Clapperboard className="h-3.5 w-3.5 text-muted-foreground" />
      </foreignObject>
      <text
        x={SHOT_COL_X + 24}
        y={y + NODE_H / 2 + 1}
        dominantBaseline="middle"
        className="fill-muted-foreground text-[8px] font-mono pointer-events-none"
      >
        {shot.label}
      </text>
      <circle
        cx={SHOT_COL_X - 6}
        cy={y + NODE_H / 2}
        r={7}
        fill="hsl(var(--muted))"
      />
      <text
        x={SHOT_COL_X - 6}
        y={y + NODE_H / 2 + 1}
        textAnchor="middle"
        dominantBaseline="middle"
        className="fill-muted-foreground text-[7px] font-mono font-bold pointer-events-none"
      >
        {connCount}
      </text>
    </g>
  );
};

/* ── Tooltip Overlay ── */
const GraphTooltip = ({ tooltip }: { tooltip: TooltipInfo | null }) => {
  if (!tooltip) return null;
  const isLeftSide = tooltip.x < 200;
  const tx = isLeftSide ? tooltip.x : tooltip.x - 160;

  return (
    <foreignObject x={tx} y={tooltip.y - 36} width={155} height={80}>
      <div className="bg-popover border border-border rounded-md px-2 py-1.5 shadow-lg text-[8px] font-mono leading-relaxed pointer-events-none">
        {tooltip.content}
      </div>
    </foreignObject>
  );
};

/* ── Main Graph ── */
const ViceDependencyGraph = () => {
  const { data: deps = [], isLoading } = useViceDependencies();
  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const handleEnter = useCallback((nodeId: string, info: TooltipInfo) => {
    setHoveredId(nodeId);
    setTooltip(info);
  }, []);

  const handleLeave = useCallback(() => {
    setHoveredId(null);
    setTooltip(null);
  }, []);

  const { tokens, shots, edges } = useMemo(() => {
    const tokenMap = new Map<string, { sourceType: string }>();
    const shotSet = new Set<string>();
    const edgeList: GraphEdge[] = [];

    for (const dep of deps) {
      tokenMap.set(dep.source_token, { sourceType: dep.source_type });
      shotSet.add(dep.shot_id);
      edgeList.push({ from: dep.source_token, to: dep.shot_id, depType: dep.dependency_type });
    }

    return {
      tokens: Array.from(tokenMap.entries()).map(([id, meta]) => ({
        id, label: id, type: "token" as const, sourceType: meta.sourceType,
      })),
      shots: Array.from(shotSet).map((id) => ({
        id, label: id.slice(0, 8), type: "shot" as const,
      })),
      edges: edgeList,
    };
  }, [deps]);

  // Derive connected node IDs from hovered node
  const connectedIds = useMemo(() => {
    if (!hoveredId) return null;
    const ids = new Set<string>([hoveredId]);
    for (const e of edges) {
      if (e.from === hoveredId) ids.add(e.to);
      if (e.to === hoveredId) ids.add(e.from);
    }
    return ids;
  }, [hoveredId, edges]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <p className="text-[10px] text-muted-foreground/50 font-mono">Loading graph…</p>
      </div>
    );
  }

  if (tokens.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-40 gap-2">
        <GitBranch className="h-5 w-5 text-muted-foreground/30" />
        <p className="text-[10px] text-muted-foreground/50 font-mono text-center">
          No dependencies tracked yet.<br />
          Use {"{{REF_CODES}}"} in shot prompts to build the graph.
        </p>
      </div>
    );
  }

  const tokenPositions = new Map<string, number>();
  tokens.forEach((t, i) => tokenPositions.set(t.id, START_Y + i * (NODE_H + NODE_GAP)));

  const shotPositions = new Map<string, number>();
  shots.forEach((s, i) => shotPositions.set(s.id, START_Y + i * (NODE_H + NODE_GAP)));

  const svgHeight = Math.max(
    START_Y + tokens.length * (NODE_H + NODE_GAP),
    START_Y + shots.length * (NODE_H + NODE_GAP),
    120
  );

  return (
    <ScrollArea className="h-[calc(100vh-280px)]">
      <div className="px-3 py-2">
        {/* Legend */}
        <div className="flex items-center gap-3 mb-3">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-primary" />
            <span className="text-[9px] font-mono text-muted-foreground">Tokens</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-accent-foreground/40" />
            <span className="text-[9px] font-mono text-muted-foreground">Shots</span>
          </div>
          <Badge variant="outline" className="text-[8px] px-1 py-0 font-mono ml-auto">
            {edges.length} edge{edges.length !== 1 ? "s" : ""}
          </Badge>
        </div>

        <svg
          width="100%"
          viewBox={`0 0 420 ${svgHeight}`}
          className="overflow-visible"
        >
          {/* Edges */}
          {edges.map((edge, i) => {
            const fromY = (tokenPositions.get(edge.from) ?? 0) + NODE_H / 2;
            const toY = (shotPositions.get(edge.to) ?? 0) + NODE_H / 2;
            const fromX = TOKEN_COL_X + TOKEN_W;
            const toX = SHOT_COL_X;
            const cpOffset = 60;

            const isConnected = connectedIds
              ? connectedIds.has(edge.from) && connectedIds.has(edge.to)
              : false;
            const isDimmed = connectedIds !== null && !isConnected;

            return (
              <path
                key={`edge-${i}`}
                d={`M ${fromX} ${fromY} C ${fromX + cpOffset} ${fromY}, ${toX - cpOffset} ${toY}, ${toX} ${toY}`}
                fill="none"
                stroke={isConnected ? "hsl(var(--primary) / 0.7)" : "hsl(var(--primary) / 0.25)"}
                strokeWidth={isConnected ? 2.5 : 1.5}
                style={{
                  opacity: isDimmed ? 0.15 : 1,
                  transition: "all 0.2s ease",
                }}
              />
            );
          })}

          {/* Token nodes */}
          {tokens.map((token) => {
            const isHighlighted = connectedIds?.has(token.id) ?? false;
            const isDimmed = connectedIds !== null && !isHighlighted;
            return (
              <TokenNode
                key={`token-${token.id}`}
                token={token}
                y={tokenPositions.get(token.id) ?? 0}
                edges={edges}
                highlighted={isHighlighted}
                dimmed={isDimmed}
                onEnter={handleEnter}
                onLeave={handleLeave}
              />
            );
          })}

          {/* Shot nodes */}
          {shots.map((shot) => {
            const isHighlighted = connectedIds?.has(shot.id) ?? false;
            const isDimmed = connectedIds !== null && !isHighlighted;
            return (
              <ShotNode
                key={`shot-${shot.id}`}
                shot={shot}
                y={shotPositions.get(shot.id) ?? 0}
                edges={edges}
                highlighted={isHighlighted}
                dimmed={isDimmed}
                onEnter={handleEnter}
                onLeave={handleLeave}
              />
            );
          })}

          {/* Tooltip layer */}
          <GraphTooltip tooltip={tooltip} />
        </svg>
      </div>
    </ScrollArea>
  );
};

export default ViceDependencyGraph;
