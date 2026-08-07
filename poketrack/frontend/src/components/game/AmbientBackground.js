import React from "react";
import { useReducedMotionMedia } from "@/lib/motion";

export function AmbientBackground({ className = "" }) {
  const reduce = useReducedMotionMedia();
  return (
    <div className={`pointer-events-none fixed inset-0 -z-10 overflow-hidden ${className}`} aria-hidden>
      {/* base radial + linear */}
      <div className="absolute inset-0"
        style={{ background: "radial-gradient(1200px 600px at 20% 10%, rgba(99,144,240,0.18), transparent 60%), radial-gradient(900px 500px at 80% 20%, rgba(249,85,135,0.12), transparent 55%), linear-gradient(180deg, #070A12, #0B1020)" }} />
      {/* aurora blur */}
      <div className={`absolute inset-0 blur-3xl opacity-60 ${reduce ? "" : "animate-aurora-drift"}`}
        style={{ background: "radial-gradient(600px 300px at 50% 20%, rgba(150,217,214,0.20), transparent 60%), radial-gradient(700px 400px at 30% 70%, rgba(122,199,76,0.16), transparent 60%)" }} />
      {/* hex-grid */}
      <div className="absolute inset-0 opacity-40"
        style={{ backgroundImage: "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.14) 1px, transparent 1.4px)", backgroundSize: "48px 48px" }} />
      {/* speed stripes accent */}
      <div className="absolute -top-10 left-0 h-40 w-[80vw] opacity-25 -rotate-6"
        style={{ background: "repeating-linear-gradient(135deg, rgba(255,255,255,0.10) 0 10px, rgba(255,255,255,0) 10px 22px)" }} />
    </div>
  );
}

export default AmbientBackground;
