'use client';

import { Play } from 'lucide-react';
import { useRef, useState } from 'react';
import { cn } from '@/lib/utils';

/** The video tour with its chapters: a chapter jumps there and plays; the current one is marked. */
export function VideoPlayer({
  src,
  poster,
  start,
  track,
  chapters,
  chaptersLabel,
}: {
  src: string;
  poster: string;
  /** seconds to start at (?t= on the page) */
  start?: number;
  track?: { src: string; lang: string; label: string };
  chapters: { start: number; title: string; clock: string }[];
  chaptersLabel: string;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [now, setNow] = useState(start ?? 0);
  const current = chapters.findLastIndex((c) => c.start <= now + 0.5);
  const jump = (seconds: number) => {
    const v = video.current;
    if (!v) return;
    v.currentTime = seconds;
    setNow(seconds);
    void v.play().catch(() => {});
    v.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  };
  return (
    <div className="grid gap-6">
      <video
        ref={video}
        controls
        playsInline
        preload="none"
        poster={poster}
        width={1920}
        height={1080}
        onTimeUpdate={(e) => setNow(e.currentTarget.currentTime)}
        className="aspect-video h-auto w-full rounded-2xl border bg-card shadow-xl shadow-black/5"
        data-testid="video-tour"
      >
        {/* a media fragment starts at a chapter even before anything has loaded */}
        <source src={start ? `${src}#t=${start}` : src} type="video/mp4" />
        {track && (
          <track
            kind="subtitles"
            default
            srcLang={track.lang}
            label={track.label}
            src={track.src}
          />
        )}
      </video>
      <section aria-labelledby="chapters" className="grid gap-3">
        <h2 id="chapters" className="text-xl font-semibold">
          {chaptersLabel}
        </h2>
        <ol className="grid gap-1 sm:grid-cols-2" data-testid="video-chapters">
          {chapters.map((c, i) => (
            <li key={c.start}>
              <button
                type="button"
                onClick={() => jump(c.start)}
                aria-current={i === current ? 'true' : undefined}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted',
                  i === current && 'bg-primary/10 font-medium text-foreground',
                )}
              >
                <Play className="size-3.5 shrink-0 text-primary" aria-hidden />
                <span className="w-10 shrink-0 text-muted-foreground tabular-nums">{c.clock}</span>
                <span>{c.title}</span>
              </button>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
