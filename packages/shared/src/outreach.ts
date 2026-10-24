import { z } from 'zod';
import { OPERATOR } from './legal';

/**
 * Personal outreach to possible customers (the operator's Leads page under /owner). One person,
 * one personal e-mail: no bulk sending, at most MAX_WORDS words, sent at a good time
 * (Tuesday to Thursday, 8 am Zurich), one follow-up after FOLLOW_UP_DAYS days.
 */
export const LEAD_STATUSES = [
  'research',
  'ready',
  'sent',
  'followed_up',
  'replied',
  'meeting',
  'customer',
  'no',
  'no_answer',
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];
export const LEAD_CHANNELS = ['email', 'form', 'linkedin'] as const;
export type LeadChannel = (typeof LEAD_CHANNELS)[number];
export const LEAD_LANGUAGES = ['de', 'fr', 'en'] as const;
export type LeadLanguage = (typeof LEAD_LANGUAGES)[number];
export const LEAD_MESSAGE_KINDS = ['first', 'follow_up'] as const;
export type LeadMessageKind = (typeof LEAD_MESSAGE_KINDS)[number];

export const MAX_WORDS = 100;
export const FOLLOW_UP_DAYS = 7;
/** no reply this many days after the follow-up: the lead is "no answer" */
export const NO_ANSWER_DAYS = 14;
/** "no" and "no answer" leads are deleted after this many months (privacy) */
export const LEAD_RETENTION_MONTHS = 12;

const text = (max: number) => z.string().trim().max(max);
// '' = clear the field (cleanLead turns it into null)
const optional = (max: number) => text(max).nullable();

/** A lead's fields; every one optional except the company (see leadCreateSchema). */
const leadFields = {
  company: text(200).min(1),
  website: optional(500),
  address: optional(300),
  /** the first sentence: why write now ("Ich habe gesehen, dass … umgezogen ist.") */
  whyNow: optional(500),
  sourceUrl: optional(1000),
  contactName: optional(200),
  /** how the e-mail greets them: "Herr van der Ploeg", "Madame Dubois", "Anna" */
  greeting: optional(200),
  contactRole: optional(200),
  channel: z.enum(LEAD_CHANNELS),
  /** only a published address (info@, contact@ …), never a guessed one */
  contactEmail: z.union([z.email().max(320), z.literal('')]).nullable(),
  linkedinUrl: optional(500),
  language: z.enum(LEAD_LANGUAGES),
  notes: optional(4000),
  status: z.enum(LEAD_STATUSES),
};
export const leadUpdateSchema = z.strictObject(leadFields).partial();
export const leadCreateSchema = leadUpdateSchema.required({ company: true });
export type LeadInput = z.infer<typeof leadUpdateSchema>;

/** Empty texts become null, e-mail addresses lower case. */
export function cleanLead<T extends LeadInput>(input: T): T {
  const out: Record<string, unknown> = { ...input };
  for (const [k, v] of Object.entries(out)) if (v === '') out[k] = null;
  if (typeof out.contactEmail === 'string') out.contactEmail = out.contactEmail.toLowerCase();
  return out as T;
}

export const leadMessageSchema = z.strictObject({
  kind: z.enum(LEAD_MESSAGE_KINDS),
  subject: text(200).min(1),
  body: text(5000).min(1),
  /** send right away instead of at the next send slot */
  sendNow: z.boolean().optional(),
});

/** Words a reader sees (a link counts as one). */
export const wordCount = (body: string) =>
  body.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;

/** Why a message can't be scheduled yet, or null when it can. */
export function messageProblem(
  lead: { whyNow: string | null; contactEmail: string | null; channel: LeadChannel },
  body: string,
): 'no_email' | 'no_reason' | 'too_long' | 'placeholder' | null {
  if (lead.channel !== 'email' || !lead.contactEmail) return 'no_email';
  if (!lead.whyNow) return 'no_reason';
  if (/\[[^\]]*\]/.test(body)) return 'placeholder';
  if (wordCount(body) > MAX_WORDS) return 'too_long';
  return null;
}

// --- time (Zurich) ---

/** "YYYY-MM-DD" and the hour in Zurich at `date`. */
export function zurichClock(date: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Zurich',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  return { day: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) };
}

/** `hour`:00 in Zurich on `day` (YYYY-MM-DD), summer or winter time. */
export function zurichTime(day: string, hour: number): Date {
  const guess = Date.parse(`${day}T${String(hour).padStart(2, '0')}:00:00Z`);
  const shown = zurichClock(new Date(guess));
  const shownMs = Date.parse(`${shown.day}T${String(shown.hour).padStart(2, '0')}:00:00Z`);
  return new Date(guess - (shownMs - guess)); // Zurich is 1 or 2 hours ahead of UTC
}

/** Messages go out with the morning job (07:00 UTC: 8 am Zurich in winter, 9 am in summer). */
export const SEND_HOUR = 8;
const SEND_DAYS = [2, 3, 4]; // Tuesday to Thursday

/** When a message scheduled now goes out: the next Tuesday–Thursday at 8 am in Zurich. */
export function nextSendSlot(now: Date): Date {
  for (let i = 0; i < 14; i++) {
    const day = zurichClock(new Date(now.getTime() + i * 864e5)).day;
    const slot = zurichTime(day, SEND_HOUR);
    const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
    if (SEND_DAYS.includes(weekday) && slot.getTime() > now.getTime()) return slot;
  }
  throw new Error('no send slot');
}

/** The morning run may send what's due between 7 and 11 am Zurich (never at night). */
export const isSendingHour = (now: Date) => {
  const { hour } = zurichClock(now);
  return hour >= 7 && hour < 11;
};

const DAY_MS = 864e5;
export const followUpDue = (firstSentAt: Date) =>
  new Date(firstSentAt.getTime() + FOLLOW_UP_DAYS * DAY_MS);

/** A lead whose follow-up got no answer for NO_ANSWER_DAYS days. */
export const isNoAnswer = (lead: { status: LeadStatus; followUpSentAt: Date | null }, now: Date) =>
  lead.status === 'followed_up' &&
  !!lead.followUpSentAt &&
  now.getTime() - lead.followUpSentAt.getTime() >= NO_ANSWER_DAYS * DAY_MS;

/** What to do next with a lead (the list's "next step" and "to do today"). */
export type NextStep =
  'research' | 'write_first' | 'scheduled' | 'waiting' | 'follow_up_due' | 'talk' | 'done';
export function nextStep(
  lead: {
    status: LeadStatus;
    firstSentAt: Date | null;
    followUpSentAt: Date | null;
    scheduled: boolean;
    /** the reason and a way to reach them are known */
    researched: boolean;
  },
  now: Date,
): NextStep {
  if (lead.scheduled) return 'scheduled';
  switch (lead.status) {
    case 'research':
      return lead.researched ? 'write_first' : 'research';
    case 'ready':
      return 'write_first';
    case 'sent':
      return lead.firstSentAt && followUpDue(lead.firstSentAt) <= now ? 'follow_up_due' : 'waiting';
    case 'followed_up':
      return 'waiting';
    case 'replied':
    case 'meeting':
      return 'talk';
    default:
      return 'done';
  }
}

// --- the e-mails ---

/** The promo video's short link (opens the landing page at the video, counted as "email"). */
export const videoLink = (language: LeadLanguage) =>
  `https://seatline.ch/${language === 'en' ? '' : `${language}/`}video?utm_source=email`;

const SIGNATURE: Record<LeadLanguage, string> = {
  de: `Freundliche Grüsse\n${OPERATOR.name}\nGründer, Seatline · seatline.ch`,
  fr: `Meilleures salutations\n${OPERATOR.name}\nFondateur, Seatline · seatline.ch`,
  en: `Kind regards\n${OPERATOR.name}\nFounder, Seatline · seatline.ch`,
};

const FIRST: Record<LeadLanguage, { subject: string; body: string }> = {
  de: {
    subject: 'Wer sitzt wo bei {company}?',
    body: `Guten Tag {greeting}

{whyNow} Genau dann wird «Wer sitzt wo?» schnell mühsam.

Dafür habe ich Seatline gebaut: Sitzplan in einem Nachmittag, Personen per Drag & Drop platzieren, Team-Umzüge über Nacht. Daten in Zürich, CHF 2 pro Arbeitsplatz, 30 Tage gratis.

90-Sekunden-Video:
{video}

Schicken Sie mir Ihren Grundriss, und ich richte Ihr Büro{place} kostenlos ein. Hätten Sie nächste Woche 15 Minuten?

{signature}

PS: Kein Thema? Ein kurzes «Nein danke» genügt.`,
  },
  fr: {
    subject: 'Qui est assis où chez {company} ?',
    body: `Bonjour {greeting}

{whyNow} C’est souvent là que « qui est assis où ? » devient pénible.

C’est pour cela que j’ai créé Seatline : un plan de bureau en un après-midi, les personnes placées par glisser-déposer, les déménagements d’équipe pendant la nuit. Données à Zurich, CHF 2 par poste, 30 jours gratuits.

Vidéo de 90 secondes :
{video}

Envoyez-moi votre plan d’étage, et je configure votre bureau{place} gratuitement. Auriez-vous 15 minutes la semaine prochaine ?

{signature}

PS : Pas pour vous ? Un simple « non merci » suffit.`,
  },
  en: {
    subject: 'Who sits where at {company}?',
    body: `Hello {greeting}

{whyNow} That’s exactly when “who sits where?” gets painful.

So I built Seatline: a seating plan in an afternoon, people placed by drag and drop, team moves overnight. Data in Zurich, CHF 2 per desk, 30 days free.

90-second video:
{video}

Send me your floor plan and I’ll set up your office{place} for free. Would you have 15 minutes next week?

{signature}

PS: Not for you? A short “no thanks” is enough.`,
  },
};

const FOLLOW_UP: Record<LeadLanguage, string> = {
  de: `Guten Tag {greeting}

Nur ein kurzes Nachfassen zu meiner Nachricht von letzter Woche.

Mein Angebot gilt weiterhin: Sie schicken mir Ihren Grundriss (PDF oder Foto genügt), und ich richte Ihr Büro in Seatline kostenlos ein. Danach sehen Sie in 5 Minuten, ob es Ihnen hilft.

Oder schauen Sie selbst kurz rein, ohne Konto: seatline.ch → «Demo ausprobieren».

{signature}

PS: Falls jemand anderes bei Ihnen dafür zuständig ist, wäre ich für einen Hinweis dankbar.`,
  fr: `Bonjour {greeting}

Je me permets de revenir brièvement sur mon message de la semaine dernière.

Mon offre tient toujours : vous m’envoyez votre plan d’étage (un PDF ou une photo suffit), et je configure votre bureau dans Seatline gratuitement. Vous verrez en 5 minutes si cela vous aide.

Ou jetez un œil vous-même, sans compte : seatline.ch → « Essayer la démo ».

{signature}

PS : Si quelqu’un d’autre s’en occupe chez vous, je vous remercie de me l’indiquer.`,
  en: `Hello {greeting}

Just a short follow-up on my message from last week.

My offer still stands: send me your floor plan (a PDF or photo is enough) and I’ll set up your office in Seatline for free. You’ll see in 5 minutes whether it helps.

Or take a look yourself, no account needed: seatline.ch → “Try the demo”.

{signature}

PS: If someone else looks after this at your company, I’d be grateful for a pointer.`,
};

/**
 * A draft to start from. Anything the lead doesn't have yet stays as a [placeholder], and a
 * message with a placeholder can't be scheduled (messageProblem), so nothing generic goes out.
 */
export function draftMessage(
  kind: LeadMessageKind,
  lead: {
    company: string;
    greeting: string | null;
    whyNow: string | null;
    address: string | null;
    language: LeadLanguage;
  },
  firstSubject?: string,
): { subject: string; body: string } {
  const l = lead.language;
  // the street only ("Tellstrasse 31, 8004 Zürich" → "an der Tellstrasse 31")
  const street = lead.address?.split(',')[0]?.trim();
  const place = street
    ? { de: ` an der ${street}`, fr: ` à la ${street}`, en: ` at ${street}` }[l]
    : '';
  const fill = (s: string) =>
    s
      .replaceAll('{company}', lead.company)
      .replaceAll('{greeting}', lead.greeting ?? '[Name]')
      .replaceAll('{whyNow}', lead.whyNow ?? '[Why now]')
      .replaceAll('{place}', place)
      .replaceAll('{video}', videoLink(l))
      .replaceAll('{signature}', SIGNATURE[l]);
  if (kind === 'follow_up')
    return {
      subject: `Re: ${firstSubject ?? fill(FIRST[l].subject)}`,
      body: fill(FOLLOW_UP[l]),
    };
  return { subject: fill(FIRST[l].subject), body: fill(FIRST[l].body) };
}
