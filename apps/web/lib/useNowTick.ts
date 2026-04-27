"use client";

import { useEffect, useState } from "react";

/**
 * Returns a reactive "synced now" epoch (Date.now() + clockOffset) that only
 * re-renders when the wall-clock second changes. Returns 0 until the client
 * is mounted to avoid SSG/hydration drift.
 *
 * `clockOffset` should be `serverEpoch - Date.now()` captured at WebSocket
 * connect time. It corrects for clock skew between devices so all clients
 * agree on the same "now" relative to server-published deadlines.
 */
export function useNowTick(active: boolean, clockOffset = 0): number {
  const [nowEpoch, setNowEpoch] = useState(0);

  useEffect(() => {
    setNowEpoch(Date.now() + clockOffset);
    if (!active) return;

    let lastSecond = Math.floor((Date.now() + clockOffset) / 1000);
    const timer = window.setInterval(() => {
      const now = Date.now() + clockOffset;
      const currentSecond = Math.floor(now / 1000);
      if (currentSecond !== lastSecond) {
        lastSecond = currentSecond;
        setNowEpoch(now);
      }
    }, 250);

    return () => window.clearInterval(timer);
  }, [active, clockOffset]);

  return nowEpoch;
}
