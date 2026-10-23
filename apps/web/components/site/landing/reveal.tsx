'use client';

import { useEffect } from 'react';

/**
 * Entrances for the landing page: marks the page live (so hidden-until-seen styles apply only
 * when this script runs) and adds `is-in` to sections and [data-reveal] parts as they arrive.
 */
export function Reveal() {
  useEffect(() => {
    const root = document.querySelector('.ld');
    if (!root || !('IntersectionObserver' in window)) return;
    root.classList.add('is-live');
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.classList.add('is-in');
          io.unobserve(e.target);
        }
      },
      { rootMargin: '0px 0px -12% 0px' },
    );
    root.querySelectorAll('[data-reveal], .ld-chapter').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return null;
}
