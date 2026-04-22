"use client";

import { useEffect, useState } from "react";

/**
 * Returns a reactive `nowEpoch` value that only re-renders when the wall-clock
 * second changes. Returns 0 until mounted on the client — consumers should
 * treat 0 as "not yet known" (display "--:--") to avoid SSG/hydration drift.
 */
export function useNowTick(active: boolean): number {
  const [nowEpoch, setNowEpoch] = useState(0);

  useEffect(() => {
    // Always prime nowEpoch on mount so first-render is accurate.
    setNowEpoch(Date.now());
    if (!active) return;

    let lastSecond = Math.floor(Date.now() / 1000);
    const timer = window.setInterval(() => {
      const now = Date.now();
      const currentSecond = Math.floor(now / 1000);
      if (currentSecond !== lastSecond) {
        lastSecond = currentSecond;
        setNowEpoch(now);
      }
    }, 250);

    return () => window.clearInterval(timer);
  }, [active]);

  return nowEpoch;
}
