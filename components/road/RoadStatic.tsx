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
        aria-label="Campus road with 8 department buildings"
      >
        <path d={d} fill="none" stroke="#0c1e3a" strokeWidth={18} strokeLinecap="round" strokeLinejoin="round" />
        <path d={d} fill="none" stroke="#ffffff" strokeWidth={21} strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
        <path d={d} fill="none" stroke="#0369a1" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
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
