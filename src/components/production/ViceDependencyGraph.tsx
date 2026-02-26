import { useMemo } from "react";
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
import { cn } from "@/lib/utils";

const sourceTypeIcons: Record<string, typeof User> = {
  character: User,
  location: MapPin,
  prop: Package,
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

const ViceDependencyGraph = () => {
  const { data: deps = [], isLoading } = useViceDependencies();

  const { tokens, shots, edges } = useMemo(() => {
    const tokenMap = new Map<string, { sourceType: string }>();
    const shotSet = new Set<string>();
    const edgeList: GraphEdge[] = [];

    for (const dep of deps) {
      tokenMap.set(dep.source_token, { sourceType: dep.source_type });
      shotSet.add(dep.shot_id);
      edgeList.push({
        from: dep.source_token,
        to: dep.shot_id,
        depType: dep.dependency_type,
      });
    }

    return {
      tokens: Array.from(tokenMap.entries()).map(([id, meta]) => ({
        id,
        label: id,
        type: "token" as const,
        sourceType: meta.sourceType,
      })),
      shots: Array.from(shotSet).map((id) => ({
        id,
        label: id.slice(0, 8),
        type: "shot" as const,
      })),
      edges: edgeList,
    };
  }, [deps]);

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

  // Layout constants
  const tokenColX = 30;
  const shotColX = 340;
  const nodeH = 28;
  const nodeGap = 6;
  const tokenStartY = 20;
  const shotStartY = 20;

  const tokenPositions = new Map<string, number>();
  tokens.forEach((t, i) => {
    tokenPositions.set(t.id, tokenStartY + i * (nodeH + nodeGap));
  });

  const shotPositions = new Map<string, number>();
  shots.forEach((s, i) => {
    shotPositions.set(s.id, shotStartY + i * (nodeH + nodeGap));
  });

  const svgHeight = Math.max(
    tokenStartY + tokens.length * (nodeH + nodeGap),
    shotStartY + shots.length * (nodeH + nodeGap),
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
            const fromY = (tokenPositions.get(edge.from) ?? 0) + nodeH / 2;
            const toY = (shotPositions.get(edge.to) ?? 0) + nodeH / 2;
            const fromX = tokenColX + 140;
            const toX = shotColX;
            const cpOffset = 60;

            return (
              <path
                key={`edge-${i}`}
                d={`M ${fromX} ${fromY} C ${fromX + cpOffset} ${fromY}, ${toX - cpOffset} ${toY}, ${toX} ${toY}`}
                fill="none"
                stroke="hsl(var(--primary) / 0.25)"
                strokeWidth={1.5}
                className="transition-all duration-300"
              />
            );
          })}

          {/* Token nodes */}
          {tokens.map((token) => {
            const y = tokenPositions.get(token.id) ?? 0;
            const Icon = sourceTypeIcons[token.sourceType ?? ""] ?? Package;
            const connCount = edges.filter((e) => e.from === token.id).length;

            return (
              <g key={`token-${token.id}`}>
                <rect
                  x={tokenColX}
                  y={y}
                  width={140}
                  height={nodeH}
                  rx={6}
                  fill="hsl(var(--primary) / 0.08)"
                  stroke="hsl(var(--primary) / 0.3)"
                  strokeWidth={1}
                />
                <foreignObject x={tokenColX + 6} y={y + 4} width={18} height={18}>
                  <Icon className="h-3.5 w-3.5 text-primary" />
                </foreignObject>
                <text
                  x={tokenColX + 28}
                  y={y + nodeH / 2 + 1}
                  dominantBaseline="middle"
                  className="fill-foreground text-[9px] font-mono"
                >
                  {token.label.length > 14 ? token.label.slice(0, 14) + "…" : token.label}
                </text>
                <circle
                  cx={tokenColX + 134}
                  cy={y + nodeH / 2}
                  r={7}
                  fill="hsl(var(--primary) / 0.15)"
                />
                <text
                  x={tokenColX + 134}
                  y={y + nodeH / 2 + 1}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-primary text-[7px] font-mono font-bold"
                >
                  {connCount}
                </text>
              </g>
            );
          })}

          {/* Shot nodes */}
          {shots.map((shot) => {
            const y = shotPositions.get(shot.id) ?? 0;
            const connCount = edges.filter((e) => e.to === shot.id).length;

            return (
              <g key={`shot-${shot.id}`}>
                <rect
                  x={shotColX}
                  y={y}
                  width={70}
                  height={nodeH}
                  rx={6}
                  fill="hsl(var(--secondary))"
                  stroke="hsl(var(--border))"
                  strokeWidth={1}
                />
                <foreignObject x={shotColX + 5} y={y + 4} width={18} height={18}>
                  <Clapperboard className="h-3.5 w-3.5 text-muted-foreground" />
                </foreignObject>
                <text
                  x={shotColX + 24}
                  y={y + nodeH / 2 + 1}
                  dominantBaseline="middle"
                  className="fill-muted-foreground text-[8px] font-mono"
                >
                  {shot.label}
                </text>
                <circle
                  cx={shotColX - 6}
                  cy={y + nodeH / 2}
                  r={7}
                  fill="hsl(var(--muted))"
                />
                <text
                  x={shotColX - 6}
                  y={y + nodeH / 2 + 1}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-muted-foreground text-[7px] font-mono font-bold"
                >
                  {connCount}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </ScrollArea>
  );
};

export default ViceDependencyGraph;
