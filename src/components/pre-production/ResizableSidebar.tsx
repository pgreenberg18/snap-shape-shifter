import { useState, useCallback, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ResizableSidebarProps {
  children: ReactNode;
  defaultWidth?: number;
  minWidth?: number;
  maxWidthPercent?: number;
  className?: string;
}

const ResizableSidebar = ({
  children,
  defaultWidth = 340,
  minWidth = 220,
  maxWidthPercent = 30,
  className,
}: ResizableSidebarProps) => {
  const [width, setWidth] = useState(defaultWidth);
  const dragging = useRef(false);
  const startX = useRef(0);
  const startW = useRef(0);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    startX.current = e.clientX;
    startW.current = width;

    const onMouseMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      const maxPx = window.innerWidth * (maxWidthPercent / 100);
      const delta = ev.clientX - startX.current;
      const next = Math.max(minWidth, Math.min(maxPx, startW.current + delta));
      setWidth(next);
    };

    const onMouseUp = () => {
      dragging.current = false;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, [width, minWidth, maxWidthPercent]);

  return (
    <aside
      className={cn("relative border-r border-border bg-card flex flex-col shrink-0", className)}
      style={{ width }}
    >
      {children}
      {/* Resize handle */}
      <div
        onMouseDown={onMouseDown}
        className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize z-10 group hover:bg-primary/20 transition-colors"
      >
        <div className="absolute top-1/2 -translate-y-1/2 right-0 w-1 h-8 rounded-full bg-muted-foreground/20 group-hover:bg-primary/50 transition-colors" />
      </div>
    </aside>
  );
};

export default ResizableSidebar;
