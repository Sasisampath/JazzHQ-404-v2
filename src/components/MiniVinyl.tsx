"use client";
import { useEffect, useRef } from "react";
import styles from "@/styles/player.module.css";

const TAU = Math.PI * 2;
const IDLE = TAU / 40; // barely turning while paused
const PLAY = TAU * (33.333 / 60); // 33⅓ rpm, same as the large record
const SPIN_UP = 1.4; // same damping as the large record so both move as one system
const SPIN_DOWN = 0.9;
const MAX_TILT = 7; // degrees

type Props = { playing: boolean; disabled: boolean; onToggle: () => void };

// A small physical record that is itself the play/pause button. Grooves and
// label turn; the studio highlight and the centre icon stay put, like light on a real disc.
export function MiniVinyl({ playing, disabled, onToggle }: Props) {
  const button = useRef<HTMLButtonElement>(null);
  const record = useRef<HTMLSpanElement>(null);
  const playingRef = useRef(playing);

  useEffect(() => { playingRef.current = playing; }, [playing]);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let angle = 0;
    let speed = reduced.matches ? 0 : IDLE;
    let last = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      const target = reduced.matches ? 0 : playingRef.current ? PLAY : IDLE;
      speed += (target - speed) * (1 - Math.exp(-dt * (target > speed ? SPIN_UP : SPIN_DOWN)));
      angle = (angle + speed * dt) % TAU;
      if (record.current) record.current.style.transform = `rotate(${angle}rad)`;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  // Tiny pointer tilt; CSS transitions provide the damping.
  const onMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const el = button.current;
    if (!el || e.pointerType !== "mouse") return;
    const r = el.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 2 - 1;
    const y = ((e.clientY - r.top) / r.height) * 2 - 1;
    el.style.setProperty("--tilt-x", `${(-y * MAX_TILT).toFixed(2)}deg`);
    el.style.setProperty("--tilt-y", `${(x * MAX_TILT).toFixed(2)}deg`);
  };
  const onLeave = () => {
    button.current?.style.setProperty("--tilt-x", "0deg");
    button.current?.style.setProperty("--tilt-y", "0deg");
  };

  return (
    <button
      ref={button}
      type="button"
      className={styles.disc}
      onClick={onToggle}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      disabled={disabled}
      aria-label={disabled ? "Audio unavailable" : playing ? "Pause Sorry" : "Play Sorry"}
      data-playing={playing || undefined}
    >
      <span className={styles.discShadow} aria-hidden="true" />
      <span className={styles.discBody} aria-hidden="true">
        <span ref={record} className={styles.discSpin}>
          <svg viewBox="0 0 100 100" width="100%" height="100%">
            <circle cx="50" cy="50" r="49.5" fill="#111112" />
            {Array.from({ length: 15 }, (_, i) => 22 + i * 1.75).map((r, i) => (
              <circle key={r} cx="50" cy="50" r={r} fill="none" stroke="#fff" strokeOpacity={i % 4 === 3 ? 0.02 : 0.075} strokeWidth=".45" />
            ))}
            {Array.from({ length: 4 }, (_, i) => 40 + i * 2.2).map((r) => (
              <circle key={r} cx="50" cy="50" r={r} fill="none" stroke="#fff" strokeOpacity=".05" strokeWidth=".35" />
            ))}
            <circle cx="50" cy="50" r="49" fill="none" stroke="#fff" strokeOpacity=".08" strokeWidth=".8" />
            <circle cx="50" cy="50" r="17" fill="#564EF0" />
            <circle cx="50" cy="50" r="15.2" fill="none" stroke="#fff" strokeOpacity=".22" strokeWidth=".45" />
            {/* Printed mark on the label so the turn is visible. */}
            <rect x="44" y="37" width="12" height="1.8" rx=".9" fill="#fff" fillOpacity=".7" />
          </svg>
        </span>
        <span className={styles.discSheen} />
      </span>
      <span className={styles.discIcon} aria-hidden="true">
        {playing ? (
          <svg viewBox="0 0 10 10" width="10" height="10">
            <rect x="2" y="1.5" width="2" height="7" rx=".6" fill="currentColor" />
            <rect x="6" y="1.5" width="2" height="7" rx=".6" fill="currentColor" />
          </svg>
        ) : (
          <svg viewBox="0 0 10 10" width="10" height="10">
            <path d="M3 1.9v6.2a.5.5 0 0 0 .76.43l5-3.1a.5.5 0 0 0 0-.86l-5-3.1A.5.5 0 0 0 3 1.9Z" fill="currentColor" />
          </svg>
        )}
      </span>
      <span className={styles.arm} aria-hidden="true" />
    </button>
  );
}
