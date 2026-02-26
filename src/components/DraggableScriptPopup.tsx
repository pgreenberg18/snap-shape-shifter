import { useCallback, useRef, useState, useEffect, type ReactNode } from "react";
import { X, Minimize2, Maximize2, GripHorizontal } from "lucide-react";

interface DraggableScriptPopupProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
}

const INITIAL_WIDTH = 640;
const INITIAL_HEIGHT = 520;
const MIN_WIDTH = 360;
const MIN_HEIGHT = 280;

const DraggableScriptPopup = ({ open, onClose, title, subtitle, children }: DraggableScriptPopupProps) => {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState({ w: INITIAL_WIDTH, h: INITIAL_HEIGHT });
  const [maximized, setMaximized] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const dragging = useRef(false);
  const resizing = useRef(false);
  const offset = useRef({ x: 0, y: 0 });
  const preMaxState = useRef({ x: 0, y: 0, w: INITIAL_WIDTH, h: INITIAL_HEIGHT });

  // Center on first open
  useEffect(() => {
    if (open && !initialized) {
      const x = Math.max(0, (window.innerWidth - INITIAL_WIDTH) / 2);
      const y = Math.max(0, (window.innerHeight - INITIAL_HEIGHT) / 2);
      setPos({ x, y });
      setSize({ w: INITIAL_WIDTH, h: INITIAL_HEIGHT });
      setMaximized(false);
      setInitialized(true);
    }
    if (!open) setInitialized(false);
  }, [open, initialized]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (maximized) return;
    dragging.current = true;
    offset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [pos, maximized]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (dragging.current) {
      setPos({ x: e.clientX - offset.current.x, y: e.clientY - offset.current.y });
    }
  }, []);

  const handlePointerUp = useCallback(() => { dragging.current = false; }, []);

  // Resize from bottom-right corner
  const handleResizeDown = useCallback((e: React.PointerEvent) => {
    if (maximized) return;
    e.stopPropagation();
    resizing.current = true;
    offset.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [maximized]);

  const handleResizeMove = useCallback((e: React.PointerEvent) => {
    if (!resizing.current) return;
    const dx = e.clientX - offset.current.x;
    const dy = e.clientY - offset.current.y;
    offset.current = { x: e.clientX, y: e.clientY };
    setSize((s) => ({ w: Math.max(MIN_WIDTH, s.w + dx), h: Math.max(MIN_HEIGHT, s.h + dy) }));
  }, []);

  const handleResizeUp = useCallback(() => { resizing.current = false; }, []);

  const toggleMaximize = () => {
    if (maximized) {
      setPos({ x: preMaxState.current.x, y: preMaxState.current.y });
      setSize({ w: preMaxState.current.w, h: preMaxState.current.h });
    } else {
      preMaxState.current = { ...pos, ...size };
      setPos({ x: 0, y: 0 });
      setSize({ w: window.innerWidth, h: window.innerHeight });
    }
    setMaximized(!maximized);
  };

  if (!open) return null;

  return (
    <div
      className="fixed z-50 flex flex-col rounded-lg border border-border bg-background shadow-2xl overflow-hidden"
      style={{
        left: pos.x,
        top: pos.y,
        width: size.w,
        height: size.h,
        ...(maximized ? { left: 0, top: 0, width: "100vw", height: "100vh", borderRadius: 0 } : {}),
      }}
    >
      {/* Title bar — draggable */}
      <div
        className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-muted/50 select-none shrink-0"
        style={{ cursor: maximized ? "default" : "grab" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <div className="flex items-center gap-2 min-w-0">
          <GripHorizontal className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-mono font-bold text-foreground truncate">{title}</p>
            {subtitle && <p className="text-[11px] text-muted-foreground truncate">{subtitle}</p>}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={toggleMaximize} className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
            {maximized ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>
          <button onClick={onClose} className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>

      {/* Resize handle */}
      {!maximized && (
        <div
          className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize"
          onPointerDown={handleResizeDown}
          onPointerMove={handleResizeMove}
          onPointerUp={handleResizeUp}
        >
          <svg viewBox="0 0 16 16" className="w-full h-full text-muted-foreground/40">
            <path d="M14 14L8 14L14 8Z" fill="currentColor" />
            <path d="M14 14L11 14L14 11Z" fill="currentColor" opacity="0.6" />
          </svg>
        </div>
      )}
    </div>
  );
};

export default DraggableScriptPopup;
