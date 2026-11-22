"use client";

import { useEffect, useState } from "react";

export default function Countdown({ seconds, className = "" }: { seconds: number; className?: string }) {
  const [left, setLeft] = useState(Math.max(0, seconds));

  useEffect(() => {
    setLeft(Math.max(0, seconds));
    const id = setInterval(() => setLeft((v) => (v <= 1 ? 0 : v - 1)), 1000);
    return () => clearInterval(id);
  }, [seconds]);

  const m = Math.floor(left / 60);
  const s = String(left % 60).padStart(2, "0");
  return (
    <span className={`tnum ${className}`} suppressHydrationWarning>
      {m}:{s}
    </span>
  );
}
