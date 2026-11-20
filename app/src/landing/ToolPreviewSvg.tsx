/** Schematic preview — no ranking numbers (landing grep acceptance). */
export function ToolPreviewSvg() {
  return (
    <svg
      viewBox="0 0 960 420"
      role="img"
      aria-label="Vista esquemática del ranking y la matriz estratégica"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="960" height="420" fill="#0f172a" />
      <text
        x="28"
        y="36"
        fill="#99f6e4"
        fontFamily="Inter,sans-serif"
        fontSize="16"
        fontWeight="700"
      >
        IMS Atlas
      </text>
      <text x="28" y="58" fill="#94a3b8" fontFamily="Inter,sans-serif" fontSize="12">
        Acceso equipo · marca de agua del proyecto
      </text>
      <rect
        x="28"
        y="80"
        width="420"
        height="300"
        rx="12"
        fill="#111827"
        stroke="#334155"
      />
      <text
        x="48"
        y="112"
        fill="#e2e8f0"
        fontFamily="Inter,sans-serif"
        fontSize="14"
        fontWeight="600"
      >
        Ranking de mercados
      </text>
      {[0, 1, 2, 3, 4].map((i) => (
        <g key={i}>
          <rect x="48" y={130 + i * 42} width="380" height="32" rx="8" fill="#1e293b" />
          <rect
            x="48"
            y={130 + i * 42}
            width={300 - i * 36}
            height="32"
            rx="8"
            fill="#0f766e"
            opacity={0.85 - i * 0.1}
          />
        </g>
      ))}
      <rect
        x="480"
        y="80"
        width="452"
        height="300"
        rx="12"
        fill="#111827"
        stroke="#334155"
      />
      <text
        x="500"
        y="112"
        fill="#e2e8f0"
        fontFamily="Inter,sans-serif"
        fontSize="14"
        fontWeight="600"
      >
        Matriz estratégica
      </text>
      <line x1="540" y1="340" x2="880" y2="340" stroke="#475569" />
      <line x1="540" y1="340" x2="540" y2="140" stroke="#475569" />
      <circle cx="620" cy="220" r="10" fill="#2dd4bf" />
      <circle cx="710" cy="180" r="10" fill="#2dd4bf" />
      <circle cx="780" cy="250" r="10" fill="#94a3b8" />
      <circle cx="660" cy="290" r="10" fill="#94a3b8" />
      <circle cx="820" cy="200" r="10" fill="#2dd4bf" />
      <text
        x="480"
        y="400"
        fill="rgba(148,163,184,0.35)"
        fontFamily="Inter,sans-serif"
        fontSize="28"
        fontWeight="700"
      >
        IMS Atlas · equipo
      </text>
    </svg>
  );
}
