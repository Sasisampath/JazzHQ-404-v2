"use client";
import { useAudio } from "@/hooks/useAudio";
import { AudioPlayer } from "./AudioPlayer";
import { ErrorContent } from "./ErrorContent";
import { VinylScene } from "./VinylScene";
import styles from "@/styles/experience.module.css";

export const SORRY_AUDIO_SRC = "/audio/sorry-v2.mp3";

export function NotFoundExperience() {
  const audio = useAudio(SORRY_AUDIO_SRC);
  return (
    <main className={styles.page}>
      <VinylScene playing={audio.playing} onToggle={audio.toggle} canToggle={audio.status === "ready"} />
      <ErrorContent player={<AudioPlayer audio={audio} />} />
    </main>
  );
}
