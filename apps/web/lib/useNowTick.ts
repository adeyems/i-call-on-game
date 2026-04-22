"use client";

import { useEffect, useState } from "react";

/**
 * Returns a reactive `nowEpoch` value that only re-renders when the wall-clock
 * second changes — not on every animation frame or setInterval tick. Consumers
 * that format seconds-precision timers see one update per second at most.
 */
export function useNowTick(active: boolean): number {
  const [nowEpoch, setNowEpoch] = useState(() => Date.now());

  useEffect(() => {
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
