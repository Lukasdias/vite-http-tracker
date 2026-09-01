export interface LogoProps {
  className?: string;
}

export const LOGO_ACCENT = "#54a7ff";

export function Logo({ className }: LogoProps) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" className={className}>
      <circle cx="7" cy="23" r="2.8" stroke="currentColor" strokeWidth="2.2" />
      <circle cx="16" cy="17.5" r="2.8" stroke="currentColor" strokeWidth="2.2" />
      <g stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
        <line x1="9.4" y1="21.5" x2="13.6" y2="19" />
        <line x1="18.2" y1="15.9" x2="23.1" y2="12.3" />
      </g>
      <circle cx="25.5" cy="10.5" r="3.1" fill={LOGO_ACCENT} />
      <path
        d="M 30.62 9.6 A 5.2 5.2 0 0 0 25.05 5.32"
        stroke={LOGO_ACCENT}
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.85"
        fill="none"
      />
    </svg>
  );
}
