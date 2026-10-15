import type { ReactNode } from "react";
import styles from "@/styles/experience.module.css";

const HOME_URL = "https://jazzhq.com";

export function ErrorContent({ player }: { player: ReactNode }) {
  return (
    <div className={styles.content}>
      <a href={HOME_URL} className={styles.logo} aria-label="JazzHQ home">
        {/* Approved JazzHQ wordmark, unchanged. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/branding/jazzhq-logo.svg" alt="" width={120} height={19} />
      </a>

      <div className={styles.message}>
        <h1 className={styles.heading}>
          <span className={styles.code}>404</span>
          <span className={styles.title}>This page couldn’t find the right channel.</span>
        </h1>
        <p className={styles.support}>
          JazzHQ helps AI companies grow through buyers, vendors and channel partners. The page you’re looking for isn’t available.
        </p>
        {player}
        <a href={HOME_URL} className={styles.cta}>
          Back to JazzHQ <span aria-hidden="true">→</span>
        </a>
      </div>
    </div>
  );
}
