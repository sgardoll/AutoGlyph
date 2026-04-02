export function AutoGlyphIcon({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Bounding box — slightly rounded, muted stroke */}
      <rect
        x="6"
        y="14"
        width="36"
        height="30"
        rx="4"
        stroke="currentColor"
        strokeWidth="2.5"
        opacity="0.35"
      />

      {/* Letter A — bold, breaking out of the top of the box */}
      {/* Left stem */}
      <line
        x1="24"
        y1="4"
        x2="10"
        y2="38"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
      {/* Right stem */}
      <line
        x1="24"
        y1="4"
        x2="38"
        y2="38"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
      {/* Crossbar */}
      <line
        x1="16"
        y1="26"
        x2="32"
        y2="26"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
