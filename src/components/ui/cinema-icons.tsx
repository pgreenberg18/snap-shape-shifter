import { cn } from "@/lib/utils";

interface IconProps {
  className?: string;
  strokeWidth?: number;
}

const base = "shrink-0";

/* ── Development: Screenplay scroll ── */
export const ScreenplayIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" className={cn(base, className)}>
    <defs>
      <linearGradient id="g-screenplay" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="currentColor" stopOpacity="0.9" />
        <stop offset="100%" stopColor="currentColor" stopOpacity="0.4" />
      </linearGradient>
    </defs>
    <rect x="5" y="3" width="14" height="18" rx="2" fill="url(#g-screenplay)" opacity="0.15" stroke="currentColor" strokeWidth="1.5" />
    <path d="M5 7h14" stroke="currentColor" strokeWidth="1" opacity="0.3" />
    <line x1="8" y1="10" x2="16" y2="10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.7" />
    <line x1="8" y1="13" x2="14" y2="13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.5" />
    <line x1="8" y1="16" x2="12" y2="16" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.35" />
    <circle cx="17" cy="5" r="1.5" fill="currentColor" opacity="0.5" />
  </svg>
);

/* ── Pre-Production: Clapperboard (detailed) ── */
export const ClapperboardIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" className={cn(base, className)}>
    <defs>
      <linearGradient id="g-clapper" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="currentColor" stopOpacity="0.85" />
        <stop offset="100%" stopColor="currentColor" stopOpacity="0.35" />
      </linearGradient>
    </defs>
    {/* Board body */}
    <rect x="3" y="8" width="18" height="13" rx="1.5" fill="url(#g-clapper)" opacity="0.15" stroke="currentColor" strokeWidth="1.5" />
    {/* Clapper arm */}
    <path d="M3 8L6 3h12l3 5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M3 8L6 3h12l3 5" fill="currentColor" opacity="0.1" />
    {/* Stripes on clapper */}
    <line x1="7.5" y1="3.5" x2="5.5" y2="7.5" stroke="currentColor" strokeWidth="1.2" opacity="0.5" />
    <line x1="11" y1="3.2" x2="9" y2="7.5" stroke="currentColor" strokeWidth="1.2" opacity="0.5" />
    <line x1="14.5" y1="3.2" x2="12.5" y2="7.5" stroke="currentColor" strokeWidth="1.2" opacity="0.5" />
    <line x1="18" y1="3.5" x2="16" y2="7.5" stroke="currentColor" strokeWidth="1.2" opacity="0.5" />
    {/* Info lines */}
    <line x1="6" y1="12" x2="12" y2="12" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.4" />
    <line x1="6" y1="15" x2="10" y2="15" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.3" />
    {/* Circle marker */}
    <circle cx="16" cy="14" r="2" stroke="currentColor" strokeWidth="1" opacity="0.4" />
  </svg>
);

/* ── Production: Cinema Camera ── */
export const CineCameraIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" className={cn(base, className)}>
    <defs>
      <linearGradient id="g-cam" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="currentColor" stopOpacity="0.9" />
        <stop offset="100%" stopColor="currentColor" stopOpacity="0.3" />
      </linearGradient>
      <radialGradient id="g-lens" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0%" stopColor="currentColor" stopOpacity="0.6" />
        <stop offset="60%" stopColor="currentColor" stopOpacity="0.15" />
        <stop offset="100%" stopColor="currentColor" stopOpacity="0.05" />
      </radialGradient>
    </defs>
    {/* Camera body */}
    <rect x="2" y="7" width="15" height="11" rx="2" fill="url(#g-cam)" opacity="0.15" stroke="currentColor" strokeWidth="1.5" />
    {/* Viewfinder triangle */}
    <path d="M17 10l5-2v8l-5-2z" fill="currentColor" opacity="0.2" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    {/* Lens circle */}
    <circle cx="9.5" cy="12.5" r="3.5" fill="url(#g-lens)" stroke="currentColor" strokeWidth="1.2" />
    <circle cx="9.5" cy="12.5" r="1.5" stroke="currentColor" strokeWidth="0.8" opacity="0.5" />
    {/* Top handle */}
    <rect x="5" y="4.5" width="7" height="2.5" rx="1" fill="currentColor" opacity="0.15" stroke="currentColor" strokeWidth="1" />
    {/* REC dot */}
    <circle cx="15" cy="9" r="1" fill="currentColor" opacity="0.6" />
  </svg>
);

/* ── Post-Production: Editing Timeline ── */
export const TimelineIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" className={cn(base, className)}>
    <defs>
      <linearGradient id="g-tl" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="currentColor" stopOpacity="0.8" />
        <stop offset="100%" stopColor="currentColor" stopOpacity="0.3" />
      </linearGradient>
    </defs>
    {/* Timeline tracks */}
    <rect x="2" y="4" width="8" height="3.5" rx="1" fill="url(#g-tl)" opacity="0.4" stroke="currentColor" strokeWidth="1" />
    <rect x="6" y="9" width="12" height="3.5" rx="1" fill="url(#g-tl)" opacity="0.55" stroke="currentColor" strokeWidth="1" />
    <rect x="3" y="14" width="10" height="3.5" rx="1" fill="url(#g-tl)" opacity="0.35" stroke="currentColor" strokeWidth="1" />
    <rect x="8" y="19" width="6" height="2" rx="0.5" fill="currentColor" opacity="0.15" stroke="currentColor" strokeWidth="0.8" />
    {/* Playhead */}
    <line x1="14" y1="2" x2="14" y2="22" stroke="currentColor" strokeWidth="1.5" opacity="0.7" />
    <polygon points="12,2 16,2 14,4.5" fill="currentColor" opacity="0.7" />
    {/* Audio waveform hint */}
    <g opacity="0.3">
      <line x1="16" y1="15" x2="16" y2="17" stroke="currentColor" strokeWidth="0.8" />
      <line x1="18" y1="14.5" x2="18" y2="17.5" stroke="currentColor" strokeWidth="0.8" />
      <line x1="20" y1="15.2" x2="20" y2="16.8" stroke="currentColor" strokeWidth="0.8" />
    </g>
  </svg>
);

/* ── Release: Export/Delivery ── */
export const DeliveryIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" className={cn(base, className)}>
    <defs>
      <linearGradient id="g-del" x1="0.5" y1="0" x2="0.5" y2="1">
        <stop offset="0%" stopColor="currentColor" stopOpacity="0.8" />
        <stop offset="100%" stopColor="currentColor" stopOpacity="0.3" />
      </linearGradient>
    </defs>
    {/* Film reel */}
    <circle cx="12" cy="11" r="8" fill="url(#g-del)" opacity="0.1" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="12" cy="11" r="3" stroke="currentColor" strokeWidth="1" opacity="0.4" />
    <circle cx="12" cy="11" r="1" fill="currentColor" opacity="0.5" />
    {/* Spokes */}
    <line x1="12" y1="3" x2="12" y2="5.5" stroke="currentColor" strokeWidth="0.8" opacity="0.35" />
    <line x1="12" y1="16.5" x2="12" y2="19" stroke="currentColor" strokeWidth="0.8" opacity="0.35" />
    <line x1="4" y1="11" x2="6.5" y2="11" stroke="currentColor" strokeWidth="0.8" opacity="0.35" />
    <line x1="17.5" y1="11" x2="20" y2="11" stroke="currentColor" strokeWidth="0.8" opacity="0.35" />
    {/* Export arrow */}
    <path d="M17 17l3 3m0 0l-3 3m3-3H14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />
  </svg>
);

/* ── Settings: Gear with precision teeth ── */
export const PrecisionGearIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" className={cn(base, className)}>
    <path d="M12 2l1.4 2.5a1 1 0 00.9.5h2.8l.7 2.7-2.3 1.3a1 1 0 00-.5.9l.3 2.8-2.7.7-1.3-2.3a1 1 0 00-.9 0L9.1 12.4l-.7-2.7 2.3-1.3a1 1 0 00.5-.9L10.9 4.7l2.7-.7z" stroke="currentColor" strokeWidth="1.3" opacity="0.5" />
    <circle cx="12" cy="12" r="6" stroke="currentColor" strokeWidth="1" opacity="0.25" strokeDasharray="2 2.5" />
    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.3" opacity="0.6" />
    <circle cx="12" cy="12" r="1.2" fill="hsl(38 92% 55%)" opacity="0.9" />
    <line x1="12" y1="2.5" x2="12" y2="4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.5" />
    <line x1="12" y1="19.5" x2="12" y2="21.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.5" />
    <line x1="2.5" y1="12" x2="4.5" y2="12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.5" />
    <line x1="19.5" y1="12" x2="21.5" y2="12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.5" />
  </svg>
);

/* ── Help: Info beacon ── */
export const InfoBeaconIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" className={cn(base, className)}>
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.3" opacity="0.4" />
    <circle cx="12" cy="8.5" r="1.1" fill="hsl(190 95% 55%)" opacity="0.9" />
    <rect x="11" y="11" width="2" height="5.5" rx="1" fill="currentColor" opacity="0.6" />
  </svg>
);

/* ── Back Arrow: Cinematic return ── */
export const CineBackIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" className={cn(base, className)}>
    <path d="M10 6L4 12l6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M4 12h12a4 4 0 010 8h-2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity="0.5" />
    <circle cx="4" cy="12" r="1.2" fill="hsl(12 90% 62%)" opacity="0.7" />
  </svg>
);

/* ── Film/Studio: Film strip ── */
export const FilmStripIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" className={cn(base, className)}>
    <rect x="4" y="2" width="16" height="20" rx="2" stroke="currentColor" strokeWidth="1.3" opacity="0.4" />
    <rect x="5.5" y="4" width="2" height="1.5" rx="0.5" fill="currentColor" opacity="0.25" />
    <rect x="5.5" y="8" width="2" height="1.5" rx="0.5" fill="currentColor" opacity="0.25" />
    <rect x="5.5" y="12" width="2" height="1.5" rx="0.5" fill="currentColor" opacity="0.25" />
    <rect x="5.5" y="16" width="2" height="1.5" rx="0.5" fill="currentColor" opacity="0.25" />
    <rect x="16.5" y="4" width="2" height="1.5" rx="0.5" fill="currentColor" opacity="0.25" />
    <rect x="16.5" y="8" width="2" height="1.5" rx="0.5" fill="currentColor" opacity="0.25" />
    <rect x="16.5" y="12" width="2" height="1.5" rx="0.5" fill="currentColor" opacity="0.25" />
    <rect x="16.5" y="16" width="2" height="1.5" rx="0.5" fill="currentColor" opacity="0.25" />
    <rect x="9" y="4" width="6" height="4" rx="0.5" stroke="currentColor" strokeWidth="0.8" opacity="0.35" />
    <rect x="9" y="10" width="6" height="4" rx="0.5" stroke="hsl(270 80% 65%)" strokeWidth="0.8" opacity="0.7" fill="hsl(270 80% 65%)" fillOpacity="0.1" />
    <rect x="9" y="16" width="6" height="4" rx="0.5" stroke="currentColor" strokeWidth="0.8" opacity="0.3" />
  </svg>
);

/* ── Global Sliders: Mixing console ── */
export const MixingConsoleIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" className={cn(base, className)}>
    <line x1="6" y1="4" x2="6" y2="20" stroke="currentColor" strokeWidth="1.2" opacity="0.25" />
    <line x1="12" y1="4" x2="12" y2="20" stroke="currentColor" strokeWidth="1.2" opacity="0.25" />
    <line x1="18" y1="4" x2="18" y2="20" stroke="currentColor" strokeWidth="1.2" opacity="0.25" />
    <rect x="4.2" y="7" width="3.6" height="2.8" rx="0.8" fill="currentColor" opacity="0.4" stroke="currentColor" strokeWidth="0.7" />
    <rect x="10.2" y="13" width="3.6" height="2.8" rx="0.8" fill="hsl(330 85% 60%)" opacity="0.5" stroke="hsl(330 85% 60%)" strokeWidth="0.7" />
    <rect x="16.2" y="9" width="3.6" height="2.8" rx="0.8" fill="currentColor" opacity="0.35" stroke="currentColor" strokeWidth="0.7" />
  </svg>
);

/* ── Sign Out: Power button ── */
export const PowerIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" className={cn(base, className)}>
    <path d="M12 3v7" stroke="hsl(350 90% 60%)" strokeWidth="1.8" strokeLinecap="round" opacity="0.85" />
    <path d="M17.5 6.5a8 8 0 11-11 0" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity="0.5" />
  </svg>
);

/* ── Collapse / Expand: Panel toggle ── */
export const PanelCollapseIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" className={cn(base, className)}>
    <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.3" opacity="0.35" />
    <line x1="9" y1="3" x2="9" y2="21" stroke="currentColor" strokeWidth="0.8" opacity="0.2" />
    <path d="M15 9l-3 3 3 3" stroke="hsl(175 70% 48%)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />
  </svg>
);

export const PanelExpandIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" className={cn(base, className)}>
    <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.3" opacity="0.35" />
    <line x1="9" y1="3" x2="9" y2="21" stroke="currentColor" strokeWidth="0.8" opacity="0.2" />
    <path d="M13 9l3 3-3 3" stroke="hsl(175 70% 48%)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />
  </svg>
);

/* ── User: Profile silhouette ── */
export const ProfileIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" className={cn(base, className)}>
    <defs>
      <radialGradient id="g-profile" cx="0.5" cy="0.35" r="0.5">
        <stop offset="0%" stopColor="currentColor" stopOpacity="0.4" />
        <stop offset="100%" stopColor="currentColor" stopOpacity="0.1" />
      </radialGradient>
    </defs>
    <circle cx="12" cy="8" r="4" fill="url(#g-profile)" stroke="currentColor" strokeWidth="1.3" />
    <path d="M4 20c0-4 3.5-7 8-7s8 3 8 7" fill="url(#g-profile)" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
  </svg>
);

/* ── Plus: Add project ── */
export const AddProjectIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" className={cn(base, className)}>
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.3" opacity="0.4" />
    <line x1="12" y1="7" x2="12" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
    <line x1="7" y1="12" x2="17" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
  </svg>
);

/* ── Versions: Stacked layers ── */
export const VersionsIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" className={cn(base, className)}>
    <rect x="5" y="3" width="14" height="4" rx="1" stroke="currentColor" strokeWidth="1.2" opacity="0.35" fill="currentColor" fillOpacity="0.05" />
    <rect x="4" y="9" width="16" height="4" rx="1" stroke="currentColor" strokeWidth="1.3" opacity="0.5" fill="currentColor" fillOpacity="0.08" />
    <rect x="3" y="15" width="18" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.5" opacity="0.7" fill="currentColor" fillOpacity="0.12" />
    <circle cx="17" cy="17.5" r="1" fill="currentColor" opacity="0.5" />
  </svg>
);
