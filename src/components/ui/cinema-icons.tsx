import { cn } from "@/lib/utils";
import { useId } from "react";

interface IconProps {
  className?: string;
  strokeWidth?: number;
}

const base = "shrink-0";

/* ── Development: Screenplay scroll ── */
export const ScreenplayIcon = ({ className }: IconProps) => {
  const uid = useId();
  const gid = `g-screenplay-${uid}`;
  return (
    <svg viewBox="0 0 24 24" fill="none" className={cn(base, className)}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.9" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.4" />
        </linearGradient>
      </defs>
      <rect x="5" y="3" width="14" height="18" rx="2" fill={`url(#${gid})`} opacity="0.15" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5 7h14" stroke="currentColor" strokeWidth="1" opacity="0.3" />
      <line x1="8" y1="10" x2="16" y2="10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.7" />
      <line x1="8" y1="13" x2="14" y2="13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.5" />
      <line x1="8" y1="16" x2="12" y2="16" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.35" />
      <circle cx="17" cy="5" r="1.5" fill="currentColor" opacity="0.5" />
    </svg>
  );
};

/* ── Pre-Production: Clapperboard (detailed) ── */
export const ClapperboardIcon = ({ className }: IconProps) => {
  const uid = useId();
  const gid = `g-clapper-${uid}`;
  return (
    <svg viewBox="0 0 24 24" fill="none" className={cn(base, className)}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.85" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.35" />
        </linearGradient>
      </defs>
      <rect x="3" y="8" width="18" height="13" rx="1.5" fill={`url(#${gid})`} opacity="0.15" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3 8L6 3h12l3 5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M3 8L6 3h12l3 5" fill="currentColor" opacity="0.1" />
      <line x1="7.5" y1="3.5" x2="5.5" y2="7.5" stroke="currentColor" strokeWidth="1.2" opacity="0.5" />
      <line x1="11" y1="3.2" x2="9" y2="7.5" stroke="currentColor" strokeWidth="1.2" opacity="0.5" />
      <line x1="14.5" y1="3.2" x2="12.5" y2="7.5" stroke="currentColor" strokeWidth="1.2" opacity="0.5" />
      <line x1="18" y1="3.5" x2="16" y2="7.5" stroke="currentColor" strokeWidth="1.2" opacity="0.5" />
      <line x1="6" y1="12" x2="12" y2="12" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.4" />
      <line x1="6" y1="15" x2="10" y2="15" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.3" />
      <circle cx="16" cy="14" r="2" stroke="currentColor" strokeWidth="1" opacity="0.4" />
    </svg>
  );
};

/* ── Production: Cinema Camera ── */
export const CineCameraIcon = ({ className }: IconProps) => {
  const uid = useId();
  const gCam = `g-cam-${uid}`;
  const gLens = `g-lens-${uid}`;
  return (
    <svg viewBox="0 0 24 24" fill="none" className={cn(base, className)}>
      <defs>
        <linearGradient id={gCam} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.9" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.3" />
        </linearGradient>
        <radialGradient id={gLens} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.6" />
          <stop offset="60%" stopColor="currentColor" stopOpacity="0.15" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.05" />
        </radialGradient>
      </defs>
      <rect x="2" y="7" width="15" height="11" rx="2" fill={`url(#${gCam})`} opacity="0.15" stroke="currentColor" strokeWidth="1.5" />
      <path d="M17 10l5-2v8l-5-2z" fill="currentColor" opacity="0.2" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <circle cx="9.5" cy="12.5" r="3.5" fill={`url(#${gLens})`} stroke="currentColor" strokeWidth="1.2" />
      <circle cx="9.5" cy="12.5" r="1.5" stroke="currentColor" strokeWidth="0.8" opacity="0.5" />
      <rect x="5" y="4.5" width="7" height="2.5" rx="1" fill="currentColor" opacity="0.15" stroke="currentColor" strokeWidth="1" />
      <circle cx="15" cy="9" r="1" fill="currentColor" opacity="0.6" />
    </svg>
  );
};

/* ── Post-Production: Editing Timeline ── */
export const TimelineIcon = ({ className }: IconProps) => {
  const uid = useId();
  const gid = `g-tl-${uid}`;
  return (
    <svg viewBox="0 0 24 24" fill="none" className={cn(base, className)}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.8" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.3" />
        </linearGradient>
      </defs>
      <rect x="2" y="4" width="8" height="3.5" rx="1" fill={`url(#${gid})`} opacity="0.4" stroke="currentColor" strokeWidth="1" />
      <rect x="6" y="9" width="12" height="3.5" rx="1" fill={`url(#${gid})`} opacity="0.55" stroke="currentColor" strokeWidth="1" />
      <rect x="3" y="14" width="10" height="3.5" rx="1" fill={`url(#${gid})`} opacity="0.35" stroke="currentColor" strokeWidth="1" />
      <rect x="8" y="19" width="6" height="2" rx="0.5" fill="currentColor" opacity="0.15" stroke="currentColor" strokeWidth="0.8" />
      <line x1="14" y1="2" x2="14" y2="22" stroke="currentColor" strokeWidth="1.5" opacity="0.7" />
      <polygon points="12,2 16,2 14,4.5" fill="currentColor" opacity="0.7" />
      <g opacity="0.3">
        <line x1="16" y1="15" x2="16" y2="17" stroke="currentColor" strokeWidth="0.8" />
        <line x1="18" y1="14.5" x2="18" y2="17.5" stroke="currentColor" strokeWidth="0.8" />
        <line x1="20" y1="15.2" x2="20" y2="16.8" stroke="currentColor" strokeWidth="0.8" />
      </g>
    </svg>
  );
};

/* ── Release: Export/Delivery ── */
export const DeliveryIcon = ({ className }: IconProps) => {
  const uid = useId();
  const gid = `g-del-${uid}`;
  return (
    <svg viewBox="0 0 24 24" fill="none" className={cn(base, className)}>
      <defs>
        <linearGradient id={gid} x1="0.5" y1="0" x2="0.5" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.8" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.3" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="11" r="8" fill={`url(#${gid})`} opacity="0.1" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="11" r="3" stroke="currentColor" strokeWidth="1" opacity="0.4" />
      <circle cx="12" cy="11" r="1" fill="currentColor" opacity="0.5" />
      <line x1="12" y1="3" x2="12" y2="5.5" stroke="currentColor" strokeWidth="0.8" opacity="0.35" />
      <line x1="12" y1="16.5" x2="12" y2="19" stroke="currentColor" strokeWidth="0.8" opacity="0.35" />
      <line x1="4" y1="11" x2="6.5" y2="11" stroke="currentColor" strokeWidth="0.8" opacity="0.35" />
      <line x1="17.5" y1="11" x2="20" y2="11" stroke="currentColor" strokeWidth="0.8" opacity="0.35" />
      <path d="M17 17l3 3m0 0l-3 3m3-3H14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />
    </svg>
  );
};

/* ── Integrations: Plug / connector ── */
export const IntegrationsPlugIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" className={cn(base, className)}>
    <path d="M17 7l-1.4 1.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity="0.5" />
    <path d="M9 15l-1.4 1.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity="0.5" />
    <path d="M13 6l1.5-1.5a3.5 3.5 0 015 5L18 11l-5-5z" stroke="currentColor" strokeWidth="1.3" opacity="0.6" />
    <path d="M11 18l-1.5 1.5a3.5 3.5 0 01-5-5L6 13l5 5z" stroke="currentColor" strokeWidth="1.3" opacity="0.6" />
    <line x1="8" y1="16" x2="16" y2="8" stroke="hsl(38 92% 55%)" strokeWidth="1.6" strokeLinecap="round" opacity="0.85" />
    <circle cx="14.5" cy="9.5" r="1" fill="currentColor" opacity="0.3" />
    <circle cx="9.5" cy="14.5" r="1" fill="currentColor" opacity="0.3" />
  </svg>
);

/* ── Settings: Gear with precision teeth (legacy alias) ── */
export const PrecisionGearIcon = IntegrationsPlugIcon;

/* ── Help: Info beacon ── */
export const InfoBeaconIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" className={cn(base, className)}>
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.3" opacity="0.4" />
    <circle cx="12" cy="8.5" r="1.1" fill="hsl(190 95% 55%)" opacity="0.9" />
    <rect x="11" y="11" width="2" height="5.5" rx="1" fill="currentColor" opacity="0.6" />
  </svg>
);

/* ── Back Arrow: Cinematic return ── */
export const CineBackIcon = ({ className }: IconProps) => {
  const uid = useId();
  const gid = `g-back-${uid}`;
  return (
    <svg viewBox="0 0 24 24" fill="none" className={cn(base, className)}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.8" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.3" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="9" fill={`url(#${gid})`} opacity="0.1" stroke="currentColor" strokeWidth="1.3" />
      <path d="M14 8L9 12l5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.85" />
      <line x1="9.5" y1="12" x2="16" y2="12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity="0.5" />
      <circle cx="9" cy="12" r="1" fill="hsl(210 95% 60%)" opacity="0.8" />
    </svg>
  );
};

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
export const ProfileIcon = ({ className }: IconProps) => {
  const uid = useId();
  const gid = `g-profile-${uid}`;
  return (
    <svg viewBox="0 0 24 24" fill="none" className={cn(base, className)}>
      <defs>
        <radialGradient id={gid} cx="0.5" cy="0.35" r="0.5">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.4" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.1" />
        </radialGradient>
      </defs>
      <circle cx="12" cy="8" r="4" fill={`url(#${gid})`} stroke="currentColor" strokeWidth="1.3" />
      <path d="M4 20c0-4 3.5-7 8-7s8 3 8 7" fill={`url(#${gid})`} stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
};

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
