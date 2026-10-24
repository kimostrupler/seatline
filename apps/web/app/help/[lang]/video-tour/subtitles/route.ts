import { isHelpLanguage } from '@/lib/help';
import { subtitlesVtt } from '@/lib/help/video';

/** The video tour's subtitles in this language (WebVTT, for the page's <track>). */
export async function GET(_req: Request, { params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isHelpLanguage(lang)) return new Response('Not found', { status: 404 });
  return new Response(subtitlesVtt(lang), {
    headers: {
      'Content-Type': 'text/vtt; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
