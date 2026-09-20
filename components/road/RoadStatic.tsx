import { roadPath } from "@/lib/campus";

/**
 * RoadStatic — Server Component. Sky, road SVG and clock tower render
 * into the initial HTML (view-source shows the <path> with no JS).
 * All interactivity lives in RoadClient.tsx.
 */
export default function RoadStatic() {
  const d = roadPath();
  return (
    <>
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
        <div className="absolute inset-0 bg-gradient-to-b from-sky via-sky-2 to-green-50" />
      </div>
      <svg
        className="road-svg"
        viewBox="0 0 100 1000"
        preserveAspectRatio="xMidYMid slice"
        style={{ minHeight: "100vh" }}
        role="img"
        aria-label="Campus road with 8 department buildings — Elvener glowing city"
      >
        <defs>
          <radialGradient id="city-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#a8f5ce" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#0369a1" stopOpacity="0" />
          </radialGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {/* Elvener city glow behind road */}
        <circle cx="50" cy="200" r="18" fill="url(#city-glow)" opacity="0.4" />
        <circle cx="14" cy="120" r="14" fill="url(#city-glow)" opacity="0.3" />
        <circle cx="86" cy="320" r="16" fill="url(#city-glow)" opacity="0.35" />
        <circle cx="50" cy="440" r="20" fill="url(#city-glow)" opacity="0.5" />
        <path d={d} fill="none" stroke="#0c1e3a" strokeWidth={18} strokeLinecap="round" strokeLinejoin="round" />
        <path d={d} fill="none" stroke="#ffffff" strokeWidth={21} strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
        <path d={d} className="road-draw" fill="none" stroke="#0369a1" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" opacity="0.7" filter="url(#glow)" />
        {/* Particle shimmer along road */}
        <circle cx="50" cy="200" r="2" fill="#a8f5ce" opacity="0.9">
          <animate attributeName="opacity" values="0.9;0.3;0.9" dur="2s" repeatCount="indefinite" />
        </circle>
        <circle cx="86" cy="320" r="1.5" fill="#80e8dc" opacity="0.8">
          <animate attributeName="opacity" values="0.8;0.2;0.8" dur="2.5s" repeatCount="indefinite" />
        </circle>
      </svg>
      <div className="clock-tower" style={{ left: "50%", top: "44%", position: "absolute", zIndex: 5 }}>
        <div className="tower-icon" role="img" aria-label="MBBS clock tower">
          🕛
        </div>
        <span className="tower-label">MBBS · clock tower</span>
      </div>
    </>
  );
}
