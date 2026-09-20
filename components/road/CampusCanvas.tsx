"use client";
import { useEffect, useRef } from "react";
import { BUILDINGS, NODE_POSITIONS } from "@/lib/campus";

// Elvenar reference: HTML5 Canvas + Y-sorted sprites, one engine for web+iOS+Android
// Pre-rendered 2D from Blender/Maya, layered grid with Y-sorting
export default function CampusCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Y-sort buildings by y-coordinate — tall tree hides walker behind
    const sorted = [...BUILDINGS].sort((a, b) => (NODE_POSITIONS[a.id]?.y ?? 0) - (NODE_POSITIONS[b.id]?.y ?? 0));

    // Clear and draw gradient sky
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, "#7dd3fc");
    grad.addColorStop(1, "#f0fdfa");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw city glows with Y-sorting — pre-rendered sprite concept
    sorted.forEach((b, i) => {
      const pos = NODE_POSITIONS[b.id];
      if (!pos) return;
      const x = (pos.x / 100) * canvas.width;
      const y = (pos.y / 1000) * canvas.height;
      // Glow
      ctx.beginPath();
      ctx.arc(x, y, 18, 0, Math.PI * 2);
      ctx.fillStyle = b.color + "40";
      ctx.fill();
      // Building sprite (pre-rendered 2D)
      ctx.fillStyle = b.color;
      ctx.fillRect(x - 12, y - 12, 24, 24);
      ctx.fillStyle = "#fff";
      ctx.font = "12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(b.icon, x, y + 4);
    });
  }, []);

  return <canvas ref={canvasRef} width={800} height={600} className="w-full rounded-3xl shadow-lg" style={{ minHeight: "60vh" }} aria-label="Campus city — HTML5 Canvas, Y-sorted sprites" />;
}
