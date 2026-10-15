"use client";
import { useEffect, useRef, useState } from "react";
import type { VinylController } from "./vinyl/createVinyl";
import styles from "@/styles/vinyl.module.css";

type Props = { playing: boolean; canToggle: boolean; onToggle: () => void };

// Decorative record. The audio card holds the accessible controls; clicking the
// disc is a pointer shortcut for the same toggle.
export function VinylScene({ playing, canToggle, onToggle }: Props) {
  const stage = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const controller = useRef<VinylController | null>(null);
  const latest = useRef({ playing, canToggle, onToggle });
  const [status, setStatus] = useState<"loading" | "ready" | "fallback">("loading");
  const [hover, setHover] = useState(false);

  useEffect(() => {
    latest.current = { playing, canToggle, onToggle };
    controller.current?.setPlaying(playing);
  }, [playing, canToggle, onToggle]);

  useEffect(() => {
    let cancelled = false;
    const fail = () => {
      controller.current?.dispose();
      controller.current = null;
      if (!cancelled) setStatus("fallback");
    };
    // Lazy-load three.js so the copy and controls paint first.
    import("./vinyl/createVinyl")
      .then(({ createVinyl }) => {
        if (cancelled || !canvas.current || !stage.current) return;
        try {
          controller.current = createVinyl(canvas.current, stage.current, fail);
          controller.current.setPlaying(latest.current.playing);
          setStatus("ready");
        } catch {
          fail();
        }
      })
      .catch(fail);
    return () => {
      cancelled = true;
      controller.current?.dispose();
      controller.current = null;
    };
  }, []);

  // Only the disc itself is clickable, not the square canvas around it.
  const onDisc = (e: React.PointerEvent) => {
    const el = stage.current;
    if (!el) return false;
    const r = el.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    return Math.hypot(dx, dy) < r.width * 0.4;
  };

  return (
    <div
      ref={stage}
      className={styles.stage}
      data-status={status}
      data-playing={playing || undefined}
      data-hover={(hover && canToggle) || undefined}
      aria-hidden="true"
      onPointerMove={(e) => setHover(e.pointerType === "mouse" && onDisc(e))}
      onPointerLeave={() => setHover(false)}
      onClick={(e) => {
        if (latest.current.canToggle && onDisc(e as unknown as React.PointerEvent)) latest.current.onToggle();
      }}
    >
      <div className={styles.fallback}>
        <svg viewBox="0 0 250 250" className={styles.fallbackDisc}>
          <defs>
            <radialGradient id="vinyl-shadow" cx="50%" cy="50%" r="50%">
              <stop offset="70%" stopColor="#000" stopOpacity=".22" />
              <stop offset="100%" stopColor="#000" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="122" cy="131" r="110" fill="url(#vinyl-shadow)" />
          <g className={styles.fallbackSpin}>
            <circle cx="125" cy="125" r="100" fill="#121213" />
            {[96, 90, 84, 77, 70, 63, 56, 49, 44].map((r) => (
              <circle key={r} cx="125" cy="125" r={r} fill="none" stroke="#fff" strokeOpacity=".07" strokeWidth=".5" />
            ))}
            <path d="M125 125 L58 42 A100 100 0 0 1 96 29 Z" fill="#fff" fillOpacity=".07" />
            <path d="M125 125 L192 208 A100 100 0 0 1 154 221 Z" fill="#fff" fillOpacity=".05" />
            <circle cx="125" cy="125" r="34" fill="#564EF0" />
            <rect x="111" y="108" width="28" height="4" rx="2" fill="#fff" fillOpacity=".85" />
            <circle cx="125" cy="125" r="2.4" fill="#f7f6f2" />
          </g>
        </svg>
      </div>
      <canvas ref={canvas} className={styles.canvas} />
    </div>
  );
}
