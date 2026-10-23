'use client';

import { useEffect, useState } from 'react';

/** The time in Zürich right now (Europe/Zurich), ticking each minute. Empty until mounted. */
export function ZurichTime() {
  const [now, setNow] = useState<string | null>(null);
  useEffect(() => {
    const tick = () =>
      setNow(
        new Date().toLocaleTimeString('de-CH', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'Europe/Zurich',
        }),
      );
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);
  return <time>{now ?? '––:––'}</time>;
}
