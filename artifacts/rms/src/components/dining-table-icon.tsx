import React, { useId } from "react";
import { useI18n } from "@/i18n";

type DiningTableIconProps = {
  className?: string;
  /** Table number shown on the cloth */
  number?: string | number;
};

/** Side-view dining set: wood table, gold runner, mid-century chairs */
export function DiningTableIcon({ className = "", number }: DiningTableIconProps) {
  const { t } = useI18n();
  const uid = useId().replace(/:/g, "");
  const cloth = `cloth-${uid}`;
  const chair = `chair-${uid}`;
  const woodTop = `woodTop-${uid}`;
  const woodDark = `woodDark-${uid}`;
  const woodMid = `woodMid-${uid}`;

  return (
    <svg
      viewBox="0 0 160 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden={!number}
      role={number ? "img" : "presentation"}
    >
      {number != null && <title>{t("tables.tableN", { n: number })}</title>}

      {/* Left chair — molded gold seat + angled wood legs */}
      <path
        d="M8 38c0-3.2 2.4-5.8 5.5-5.8h14c3.1 0 5.5 2.6 5.5 5.8v20.5H8V38Z"
        fill={`url(#${chair})`}
      />
      <ellipse cx="20.5" cy="58.5" rx="12" ry="3.2" fill={`url(#${woodDark})`} />
      <path d="M12 58.5 L7 86 h3.4 L15.2 58.5Z" fill={`url(#${woodDark})`} />
      <path d="M16.5 58.5 L14.8 86 h3.2 L19.5 58.5Z" fill={`url(#${woodMid})`} />
      <path d="M24.5 58.5 L26.2 86 h3.2 L27.5 58.5Z" fill={`url(#${woodMid})`} />
      <path d="M29 58.5 L34 86 h3.4 L32.2 58.5Z" fill={`url(#${woodDark})`} />

      {/* Right chair */}
      <path
        d="M127 38c0-3.2 2.4-5.8 5.5-5.8h14c3.1 0 5.5 2.6 5.5 5.8v20.5H127V38Z"
        fill={`url(#${chair})`}
      />
      <ellipse cx="139.5" cy="58.5" rx="12" ry="3.2" fill={`url(#${woodDark})`} />
      <path d="M131 58.5 L126 86 h3.4 L134.2 58.5Z" fill={`url(#${woodDark})`} />
      <path d="M135.5 58.5 L133.8 86 h3.2 L138.5 58.5Z" fill={`url(#${woodMid})`} />
      <path d="M143.5 58.5 L145.2 86 h3.2 L146.5 58.5Z" fill={`url(#${woodMid})`} />
      <path d="M148 58.5 L153 86 h3.4 L151.2 58.5Z" fill={`url(#${woodDark})`} />

      {/* Table top */}
      <rect x="36" y="42" width="88" height="10" rx="1.8" fill={`url(#${woodTop})`} />
      <rect x="37.5" y="43.8" width="85" height="2" rx="1" fill="#D4A574" opacity="0.5" />

      {/* Table legs (4 tapered) */}
      <path d="M42 52 L39.5 88 h4.2 L48 52Z" fill={`url(#${woodDark})`} />
      <path d="M52 52 L53.5 88 h4 L54.5 52Z" fill={`url(#${woodMid})`} />
      <path d="M106 52 L104.5 88 h4 L108.5 52Z" fill={`url(#${woodDark})`} />
      <path d="M112 52 L114.5 88 h4.2 L116 52Z" fill={`url(#${woodMid})`} />

      {/* Gold cloth / runner draping down front */}
      <path
        d="M62 40h36c1.6 0 2.8 1.1 2.8 2.5v28.5c0 2.2-1.2 3.4-3.4 4.2l-2 .7c-1.1.3-1.8-.3-1.8-1.4V62H66.4v12.5c0 1.1-.7 1.7-1.8 1.4l-2-.7c-2.2-.8-3.4-2-3.4-4.2V42.5c0-1.4 1.2-2.5 2.8-2.5Z"
        fill={`url(#${cloth})`}
      />
      {/* Soft fold highlight */}
      <path
        d="M65 41.5h30c.6 0 1 .4 1 1v4.5H64v-4.5c0-.6.4-1 1-1Z"
        fill="#FFE98A"
        opacity="0.45"
      />
      {/* White trim line near bottom of cloth */}
      <path
        d="M68 68.5h24"
        stroke="#FFF8E0"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.85"
      />
      {/* Wavy cloth hem */}
      <path
        d="M66 72.5c2.5.9 5.5 1.4 8 1.4s5.5-.5 8-1.4 5.5-1.4 8-1.4"
        stroke="#C98900"
        strokeWidth="1.3"
        strokeLinecap="round"
        opacity="0.7"
      />

      {/* Number on cloth */}
      {number != null && (
        <text
          x="80"
          y="57"
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#5C3A10"
          fontSize={String(number).length > 2 ? "22" : "28"}
          fontWeight="900"
          fontFamily="Vazirmatn, 'Noto Sans Arabic', sans-serif"
        >
          {number}
        </text>
      )}

      <defs>
        <linearGradient id={cloth} x1="62" y1="40" x2="98" y2="76" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F7D65C" />
          <stop offset="0.4" stopColor="#E8B008" />
          <stop offset="1" stopColor="#C98900" />
        </linearGradient>
        <linearGradient id={chair} x1="8" y1="32" x2="33" y2="58" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F3CF4A" />
          <stop offset="1" stopColor="#D4A017" />
        </linearGradient>
        <linearGradient id={woodTop} x1="36" y1="42" x2="124" y2="52" gradientUnits="userSpaceOnUse">
          <stop stopColor="#C48A4A" />
          <stop offset="0.5" stopColor="#A86B32" />
          <stop offset="1" stopColor="#8B5424" />
        </linearGradient>
        <linearGradient id={woodDark} x1="0" y1="52" x2="0" y2="88" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6B3E1F" />
          <stop offset="1" stopColor="#3F2412" />
        </linearGradient>
        <linearGradient id={woodMid} x1="0" y1="52" x2="0" y2="88" gradientUnits="userSpaceOnUse">
          <stop stopColor="#8A5530" />
          <stop offset="1" stopColor="#5A3518" />
        </linearGradient>
      </defs>
    </svg>
  );
}
