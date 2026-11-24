import React, { useId } from "react";

type DeliveryBikeIconProps = {
  className?: string;
};

/** Side-view delivery bicycle with rear courier box */
export function DeliveryBikeIcon({ className = "" }: DeliveryBikeIconProps) {
  const uid = useId().replace(/:/g, "");
  const frame = `frame-${uid}`;
  const box = `box-${uid}`;
  const wheel = `wheel-${uid}`;

  return (
    <svg
      viewBox="0 0 160 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Delivery bike"
    >
      <defs>
        <linearGradient id={frame} x1="20" y1="20" x2="140" y2="90" gradientUnits="userSpaceOnUse">
          <stop stopColor="#f59e0b" />
          <stop offset="1" stopColor="#ea580c" />
        </linearGradient>
        <linearGradient id={box} x1="18" y1="14" x2="62" y2="52" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fbbf24" />
          <stop offset="1" stopColor="#d97706" />
        </linearGradient>
        <linearGradient id={wheel} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#334155" />
          <stop offset="1" stopColor="#0f172a" />
        </linearGradient>
      </defs>

      <ellipse cx="80" cy="91" rx="60" ry="5" fill="#0f172a" opacity="0.12" />

      {/* Delivery box — rear rack */}
      <rect
        x="18"
        y="16"
        width="40"
        height="32"
        rx="5"
        fill={`url(#${box})`}
        stroke="#b45309"
        strokeWidth="1.6"
      />
      <path d="M18 28 H58" stroke="#92400e" strokeWidth="1.2" opacity="0.5" />
      <path d="M31 16 V48 M45 16 V48" stroke="#fde68a" strokeWidth="1.2" opacity="0.4" />
      <circle cx="38" cy="32" r="6.5" fill="#fff7ed" opacity="0.95" />
      <path d="M34.8 34.8 L38 27.8 L41.2 34.8 Z" fill="#ea580c" />

      {/* Wheels */}
      <circle cx="46" cy="74" r="17" stroke={`url(#${wheel})`} strokeWidth="4.2" fill="#fff" fillOpacity="0.55" />
      <circle cx="46" cy="74" r="3" fill={`url(#${wheel})`} />
      <path
        d="M46 57.5 V90.5 M29.5 74 H62.5 M34 62 L58 86 M34 86 L58 62"
        stroke={`url(#${wheel})`}
        strokeWidth="1.3"
        opacity="0.65"
      />

      <circle cx="122" cy="74" r="17" stroke={`url(#${wheel})`} strokeWidth="4.2" fill="#fff" fillOpacity="0.55" />
      <circle cx="122" cy="74" r="3" fill={`url(#${wheel})`} />
      <path
        d="M122 57.5 V90.5 M105.5 74 H138.5 M110 62 L134 86 M110 86 L134 62"
        stroke={`url(#${wheel})`}
        strokeWidth="1.3"
        opacity="0.65"
      />

      {/* Frame */}
      <path
        d="M46 74 L74 44 H104 L122 74 M74 44 L62 74 M104 44 L92 74 M74 44 V34"
        stroke={`url(#${frame})`}
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Rack strut to box */}
      <path d="M46 58 V48 M38 48 H54" stroke={`url(#${frame})`} strokeWidth="3.2" strokeLinecap="round" />

      {/* Seat */}
      <path
        d="M62 31.5 h24c2.4 0 3.8 1.5 3.8 3.1s-1.5 3.2-3.8 3.2H64c-2 0-3.2-1.4-3.2-3S62 31.5 62 31.5Z"
        fill={`url(#${frame})`}
      />

      {/* Handlebar */}
      <path d="M104 33 h20 M124 28 v12" stroke={`url(#${frame})`} strokeWidth="4" strokeLinecap="round" />

      {/* Pedals */}
      <circle cx="82" cy="74" r="5" fill={`url(#${frame})`} />
      <path d="M82 74 L93 84" stroke={`url(#${frame})`} strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
