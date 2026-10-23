'use client';

import { useState } from 'react';

export interface IndexRow {
  href: string;
  name: string;
  summary: string;
  image?: string;
}

/**
 * Everything Seatline does, as the help center's topics. On mouse devices one framed picture
 * follows the row under the pointer; on touch each row shows its own picture.
 */
export function FeatureIndex({ rows }: { rows: IndexRow[] }) {
  const [on, setOn] = useState(0);
  return (
    <>
      <ul className="ld-index__list">
        {rows.map((r, i) => (
          <li key={r.href} data-reveal style={{ '--i': i % 4 } as React.CSSProperties}>
            <a
              className="ld-index__row"
              href={r.href}
              onPointerEnter={() => setOn(i)}
              onFocus={() => setOn(i)}
            >
              <span className="ld-index__name">{r.name}</span>
              <span className="ld-index__sum">{r.summary}</span>
              {r.image && (
                <img
                  className="ld-index__thumb"
                  src={r.image}
                  alt=""
                  loading="lazy"
                  width={1280}
                  height={800}
                />
              )}
            </a>
          </li>
        ))}
      </ul>
      <figure className="ld-index__frame" aria-hidden>
        {rows.map(
          (r, i) =>
            r.image && (
              <img
                key={r.href}
                src={r.image}
                alt=""
                loading="lazy"
                className={i === on ? 'is-on' : undefined}
              />
            ),
        )}
      </figure>
    </>
  );
}
