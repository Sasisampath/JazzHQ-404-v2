"use client";
import { useCallback, useEffect, useRef, useState } from "react";

export type AudioStatus = "loading" | "ready" | "unavailable";

export type AudioApi = {
  status: AudioStatus;
  playing: boolean;
  current: number;
  duration: number;
  muted: boolean;
  toggle: () => void;
  seek: (seconds: number) => void;
  toggleMute: () => void;
};

// Owns a single <audio> element for the local "Sorry" track. Never autoplays.
export function useAudio(src: string): AudioApi {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [status, setStatus] = useState<AudioStatus>("loading");
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    const a = new Audio();
    a.preload = "metadata";
    audio.current = a;
    let frame = 0;
    // timeupdate only fires ~4×/s; follow the playhead per frame while playing so the bar glides.
    const follow = () => { setCurrent(a.currentTime); frame = requestAnimationFrame(follow); };
    const onMeta = () => { setDuration(a.duration); setStatus("ready"); };
    const onPlay = () => { setPlaying(true); cancelAnimationFrame(frame); frame = requestAnimationFrame(follow); };
    const onPause = () => { setPlaying(false); cancelAnimationFrame(frame); setCurrent(a.currentTime); };
    const onEnded = () => { a.currentTime = 0; setCurrent(0); };
    const onError = () => { setStatus("unavailable"); setPlaying(false); };
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    a.addEventListener("ended", onEnded);
    a.addEventListener("error", onError);
    a.src = src;
    return () => {
      cancelAnimationFrame(frame);
      a.pause();
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("ended", onEnded);
      a.removeEventListener("error", onError);
      a.removeAttribute("src");
      a.load();
      audio.current = null;
    };
  }, [src]);

  const toggle = useCallback(() => {
    const a = audio.current;
    if (!a || status === "unavailable") return;
    if (a.paused) a.play().catch(() => setPlaying(false));
    else a.pause();
  }, [status]);

  const seek = useCallback((seconds: number) => {
    const a = audio.current;
    if (!a || !Number.isFinite(seconds)) return;
    a.currentTime = seconds;
    setCurrent(seconds);
  }, []);

  const toggleMute = useCallback(() => {
    const a = audio.current;
    if (!a) return;
    a.muted = !a.muted;
    setMuted(a.muted);
  }, []);

  return { status, playing, current, duration, muted, toggle, seek, toggleMute };
}
