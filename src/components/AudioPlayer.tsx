"use client";
import type { CSSProperties } from "react";
import type { AudioApi } from "@/hooks/useAudio";
import { MiniVinyl } from "./MiniVinyl";
import styles from "@/styles/player.module.css";

const fmt = (s: number, round = Math.floor) => {
  if (!Number.isFinite(s) || s < 0) return "0:00";
  const t = round(s);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
};

// Vinyl-native control: the mini record is the play/pause button, the groove
// line underneath is a quiet seek, and mute stays small in the corner.
export function AudioPlayer({ audio }: { audio: AudioApi }) {
  const { status, playing, current, duration, muted, toggle, seek, toggleMute } = audio;
  const off = status === "unavailable";
  const pct = duration > 0 ? Math.min(100, (current / duration) * 100) : 0;

  return (
    <div className={styles.card} data-playing={playing || undefined} data-off={off || undefined}>
      <MiniVinyl playing={playing} disabled={off} onToggle={toggle} />

      <div className={styles.info}>
        <p className={styles.track}>Sorry</p>
        {off && <p className={styles.artist}>Audio unavailable</p>}

        <div className={styles.groove}>
          <span className={styles.time} aria-hidden="true">{fmt(current)}</span>
          <input
            type="range"
            className={styles.seek}
            min={0}
            max={duration || 0}
            step={0.1}
            value={current}
            disabled={off || !duration}
            onChange={(e) => seek(Number(e.target.value))}
            aria-label="Seek"
            aria-valuetext={`${fmt(current)} of ${fmt(duration, Math.round)}`}
            style={{ "--pct": `${pct}%` } as CSSProperties}
          />
          <span className={styles.time} aria-hidden="true">{fmt(duration, Math.round)}</span>
          <button
            type="button"
            className={styles.mute}
            onClick={toggleMute}
            disabled={off}
            aria-pressed={muted}
            aria-label={muted ? "Unmute" : "Mute"}
            data-tip={muted ? "Unmute" : "Mute"}
          >
            <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3.5 7.5h2.8L10 4.5v11l-3.7-3H3.5z" fill="currentColor" stroke="none" />
              {muted ? <path d="m13.2 7.6 4.8 4.8m0-4.8-4.8 4.8" /> : <><path d="M13 7.2a4 4 0 0 1 0 5.6" /><path d="M15.4 5a7 7 0 0 1 0 10" /></>}
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
