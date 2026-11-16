import React, { useId } from "react";

type RoomIconProps = {
  className?: string;
  /** Optional room label/number shown on a badge */
  number?: string | number;
};

/** Cozy private room — teal sofa + clear flat TV on the right */
export function RoomIcon({ className = "", number }: RoomIconProps) {
  const uid = useId().replace(/:/g, "");
  const wall = `wall-${uid}`;
  const sky = `sky-${uid}`;
  const wood = `wood-${uid}`;
  const woodDark = `woodDark-${uid}`;
  const sofaBack = `sofaBack-${uid}`;
  const sofaSeat = `sofaSeat-${uid}`;
  const rug = `rug-${uid}`;
  const cushionA = `cushionA-${uid}`;
  const cushionB = `cushionB-${uid}`;
  const tvGlow = `tvGlow-${uid}`;
  const screen = `screen-${uid}`;

  return (
    <svg
      viewBox="0 0 160 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden={!number}
      role={number ? "img" : "presentation"}
    >
      {number != null && <title>{`غرفة ${number}`}</title>}

      {/* Wall */}
      <rect x="6" y="8" width="148" height="72" rx="8" fill={`url(#${wall})`} />
      <path d="M6 8h148c4.4 0 8 3.6 8 8v6H-2v-6c0-4.4 3.6-8 8-8Z" fill="#FFF8EC" opacity="0.28" />

      {/* Floor */}
      <path d="M6 70h148v18c0 3.3-2.7 6-6 6H12c-3.3 0-6-2.7-6-6V70Z" fill="#C9A878" />
      <path d="M6 70h148" stroke="#A88860" strokeWidth="1.2" opacity="0.5" />

      {/* Window (left-center) */}
      <rect x="36" y="14" width="48" height="30" rx="2.8" fill="#4A3828" />
      <rect x="38.5" y="16.5" width="43" height="25" rx="1.5" fill={`url(#${sky})`} />
      <circle cx="66" cy="23" r="3.8" fill="#FFE2A8" opacity="0.9" />
      <path d="M38.5 32c6-4 12-5 18-2.5 5 2 10 1 15-1.5v13.5h-33V32Z" fill="#5A6F88" opacity="0.5" />
      <path d="M42 35h2.5v5H42Zm4-1.5h3v6.5h-3Zm5 0.5h2.5v6H51Zm4.5-2h4v8h-4Zm6 1h3v7h-3Zm5-0.5h4v7.5h-4Z" fill="#2C3A4A" opacity="0.7" />
      <path d="M60 16.5v25M38.5 29h43" stroke="#6B5340" strokeWidth="1.2" opacity="0.7" />
      <rect x="36" y="14" width="48" height="30" rx="2.8" stroke="#7A5E45" strokeWidth="1.8" />

      {/* Small art left */}
      <rect x="12" y="16" width="18" height="22" rx="1.5" fill={`url(#${woodDark})`} />
      <rect x="13.5" y="17.5" width="15" height="19" rx="0.8" fill="#6FA3C9" />
      <ellipse cx="21" cy="24" rx="3.2" ry="3.6" fill="#F2E2C4" />
      <path d="M15.5 32c1-4 3-5.5 8-5.5 2.5 0 4 .6 5.5 2.2v5H15.5v-1.7Z" fill="#A50044" opacity="0.8" />

      {/* ========== تلفاز واضح على اليمين ========== */}
      {/* Soft screen bloom */}
      <ellipse cx="128" cy="32" rx="26" ry="20" fill={`url(#${tvGlow})`} />

      {/* Mini frames above TV */}
      <rect x="108" y="12" width="8" height="6" rx="0.7" fill="#5C4636" />
      <rect x="118" y="11" width="8" height="6" rx="0.7" fill="#5C4636" />
      <rect x="128" y="12" width="8" height="6" rx="0.7" fill="#5C4636" />
      <rect x="109" y="13" width="6" height="4" fill="#7EB6D9" />
      <rect x="119" y="12" width="6" height="4" fill="#8FBF88" />
      <rect x="129" y="13" width="6" height="4" fill="#E0A86A" />

      {/* TV bezel */}
      <rect x="104" y="20" width="48" height="30" rx="2.8" fill="#0E1014" />
      <rect x="104" y="20" width="48" height="30" rx="2.8" stroke="#2A2E38" strokeWidth="1.2" />
      {/* Screen */}
      <rect x="107" y="22.5" width="42" height="23" rx="1.4" fill={`url(#${screen})`} />
      {/* Football pitch graphic */}
      <ellipse cx="128" cy="34" rx="12" ry="7" stroke="#E8F8EA" strokeWidth="0.9" opacity="0.8" />
      <path d="M128 27v14M116 34h24" stroke="#E8F8EA" strokeWidth="0.75" opacity="0.6" />
      <circle cx="128" cy="34" r="1.5" fill="#E8F8EA" opacity="0.85" />
      <path d="M116 29.5v9M140 29.5v9" stroke="#E8F8EA" strokeWidth="0.55" opacity="0.4" />
      {/* Score bar */}
      <rect x="114" y="41" width="28" height="3.2" rx="0.7" fill="#050608" opacity="0.75" />
      <rect x="116" y="41.6" width="7" height="2" rx="0.4" fill="#A50044" />
      <rect x="133" y="41.6" width="7" height="2" rx="0.4" fill="#F5F5F5" opacity="0.9" />
      {/* Power LED */}
      <circle cx="148" cy="47" r="1" fill="#4ADE80" />

      {/* Media console under TV */}
      <rect x="108" y="51" width="40" height="8" rx="1.8" fill={`url(#${wood})`} />
      <rect x="109.5" y="52.2" width="14" height="5.5" rx="1" fill="#1A1A1E" opacity="0.88" />
      <rect x="126" y="52.5" width="8" height="5" rx="0.8" fill="#2A2A30" opacity="0.75" />
      <circle cx="141" cy="55" r="1.7" fill="#F5F0E6" />

      {/* Room number — large, under TV */}
      {number != null && (
        <>
          <rect x="108" y="61" width="40" height="20" rx="4" fill="#F7D65C" />
          <rect x="109" y="62" width="38" height="3.5" rx="1.4" fill="#FFE98A" opacity="0.55" />
          <text
            x="128"
            y="73.5"
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#5C3A10"
            fontSize="18"
            fontWeight="800"
            fontFamily="Vazirmatn, 'Noto Sans Arabic', sans-serif"
          >
            {number}
          </text>
        </>
      )}

      {/* Rug */}
      <ellipse cx="58" cy="88" rx="40" ry="7.5" fill={`url(#${rug})`} />
      <ellipse cx="58" cy="88" rx="32" ry="5" fill="none" stroke="#F0D4A8" strokeWidth="0.85" opacity="0.4" />

      {/* ========== قنف على اليسار ========== */}
      <path
        d="M14 50c0-5.5 4-9 9.5-9h70c5.5 0 9.5 3.5 9.5 9v12H14V50Z"
        fill={`url(#${sofaBack})`}
      />
      <path
        d="M18 40c2-1.2 7-2 16-2h48c9 0 14 0.8 16 2"
        stroke="#A8D4E0"
        strokeWidth="1.3"
        strokeLinecap="round"
        opacity="0.45"
      />
      <path
        d="M16 60c0-2.8 2-4.5 5-4.5h72c3 0 5 1.7 5 4.5v13c0 2-1.5 3.5-3.5 3.5H19.5c-2 0-3.5-1.5-3.5-3.5V60Z"
        fill={`url(#${sofaSeat})`}
      />
      <path d="M40 57v16M58 57v16M76 57v16" stroke="#2A5564" strokeWidth="0.85" opacity="0.35" />
      <path d="M22 58h66c1.2 0 2 0.9 2 2v2H20v-2c0-1.1 0.8-2 2-2Z" fill="#B8DCE6" opacity="0.2" />

      {/* Armrests */}
      <path d="M10 52c0-3.5 2.4-6 5.5-6h7v28h-8c-2.5 0-4.5-2-4.5-4.5V52Z" fill="#3D6B7A" />
      <path d="M12 54h8v3.5h-8Z" fill="#5A8A9A" opacity="0.4" />
      <path d="M93 46h7c3.1 0 5.5 2.5 5.5 5.5v18c0 2.5-2 4.5-4.5 4.5h-8V46Z" fill="#3D6B7A" />
      <path d="M95 54h8v3.5h-8Z" fill="#5A8A9A" opacity="0.4" />

      {/* Pillows */}
      <rect x="26" y="48" width="14" height="16" rx="3" fill={`url(#${cushionA})`} transform="rotate(-7 33 56)" />
      <rect x="42" y="46" width="15" height="17" rx="3" fill={`url(#${cushionB})`} transform="rotate(4 49 54)" />
      <path d="M44 50h11M44 54.5h11M44 59h11" stroke="#A50044" strokeWidth="0.9" opacity="0.4" transform="rotate(4 49 54)" />
      <rect x="60" y="47" width="14" height="16" rx="3" fill="#E8C99A" transform="rotate(-3 67 55)" />
      <rect x="76" y="46" width="14" height="17" rx="3" fill="#2E5A9C" transform="rotate(5 83 54)" />

      <ellipse cx="58" cy="78" rx="42" ry="2.8" fill="#8B6914" opacity="0.25" />
      <rect x="24" y="75" width="5" height="2.5" rx="0.8" fill="#6B4E32" />
      <rect x="88" y="75" width="5" height="2.5" rx="0.8" fill="#6B4E32" />

      {/* Lamp */}
      <circle cx="18" cy="44" r="6" fill="#FFE08A" opacity="0.18" />
      <path d="M18 34v12" stroke="#C9A05A" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M13.5 34h9l-1.5 3H15L13.5 34Z" fill="#F5D76E" />

      <defs>
        <linearGradient id={wall} x1="6" y1="8" x2="154" y2="80" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F3E4C8" />
          <stop offset="0.55" stopColor="#E6D0A8" />
          <stop offset="1" stopColor="#D4B48A" />
        </linearGradient>
        <linearGradient id={sky} x1="38" y1="16" x2="82" y2="42" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFB07A" />
          <stop offset="0.4" stopColor="#F0A070" />
          <stop offset="0.7" stopColor="#7FA8C9" />
          <stop offset="1" stopColor="#3F5F8A" />
        </linearGradient>
        <linearGradient id={wood} x1="108" y1="51" x2="148" y2="61" gradientUnits="userSpaceOnUse">
          <stop stopColor="#D4A574" />
          <stop offset="1" stopColor="#8B5424" />
        </linearGradient>
        <linearGradient id={woodDark} x1="12" y1="16" x2="30" y2="38" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6B3E1F" />
          <stop offset="1" stopColor="#3F2412" />
        </linearGradient>
        <linearGradient id={sofaBack} x1="14" y1="41" x2="103" y2="62" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6FA8B8" />
          <stop offset="0.5" stopColor="#4A8496" />
          <stop offset="1" stopColor="#356A7A" />
        </linearGradient>
        <linearGradient id={sofaSeat} x1="16" y1="55" x2="98" y2="76" gradientUnits="userSpaceOnUse">
          <stop stopColor="#5B92A4" />
          <stop offset="0.45" stopColor="#3F7386" />
          <stop offset="1" stopColor="#2E5C6C" />
        </linearGradient>
        <linearGradient id={rug} x1="18" y1="82" x2="98" y2="96" gradientUnits="userSpaceOnUse">
          <stop stopColor="#C44536" />
          <stop offset="0.5" stopColor="#A12E2E" />
          <stop offset="1" stopColor="#6E1C1C" />
        </linearGradient>
        <linearGradient id={cushionA} x1="26" y1="48" x2="40" y2="64" gradientUnits="userSpaceOnUse">
          <stop stopColor="#E07A6A" />
          <stop offset="1" stopColor="#B84A3A" />
        </linearGradient>
        <linearGradient id={cushionB} x1="42" y1="46" x2="57" y2="63" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3A6AB0" />
          <stop offset="1" stopColor="#1E3F78" />
        </linearGradient>
        <radialGradient id={tvGlow} cx="128" cy="32" r="26" gradientUnits="userSpaceOnUse">
          <stop stopColor="#4ADE80" stopOpacity="0.45" />
          <stop offset="1" stopColor="#4ADE80" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={screen} x1="107" y1="22" x2="149" y2="46" gradientUnits="userSpaceOnUse">
          <stop stopColor="#166534" />
          <stop offset="0.5" stopColor="#15803D" />
          <stop offset="1" stopColor="#14532D" />
        </linearGradient>
      </defs>
    </svg>
  );
}
