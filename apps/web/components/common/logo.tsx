/** Seatline's mark: three desks, one free (the same drawing as app/icon.svg, the tab icon). */
export function Logo({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={className}>
      <rect x="2" y="2" width="20" height="20" rx="6" fill="var(--primary)" />
      <rect x="6" y="6.5" width="5" height="4.5" rx="1.2" fill="white" />
      <rect x="13" y="6.5" width="5" height="4.5" rx="1.2" fill="white" opacity="0.55" />
      <rect x="6" y="13" width="5" height="4.5" rx="1.2" fill="white" opacity="0.55" />
      <rect x="13" y="13" width="5" height="4.5" rx="1.2" fill="#4ade80" />
    </svg>
  );
}
