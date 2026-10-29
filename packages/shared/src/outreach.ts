import { z } from 'zod';
import { OPERATOR } from './legal';

/**
 * Personal outreach to possible customers (the operator's Leads page under /owner). One person,
 * one personal e-mail (never one mail to many; "send all" still sends one e-mail per lead), sent at a good time
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
/** ask_why = one short thank-you after a "no", asking what didn't fit (sent at most once) */
export const LEAD_MESSAGE_KINDS = ['first', 'follow_up', 'ask_why'] as const;
export type LeadMessageKind = (typeof LEAD_MESSAGE_KINDS)[number];
/** What makes a company a good lead, set by hand or in the import file. */
export const LEAD_TAGS = [
  'moving',
  'growing',
  'hybrid',
  'multiple_sites',
  'microsoft365',
  'warm',
] as const;
export type LeadTag = (typeof LEAD_TAGS)[number];

/** at most this many e-mails per "send all" click (keeps the request short; click again) */
export const SEND_ALL_MAX = 25;
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
  /** company size (people working there) */
  employees: z.number().int().min(1).max(1_000_000).nullable(),
  tags: z.array(z.enum(LEAD_TAGS)).max(LEAD_TAGS.length),
  status: z.enum(LEAD_STATUSES),
};
export const leadUpdateSchema = z.strictObject(leadFields).partial();
export const leadCreateSchema = leadUpdateSchema.required({ company: true });
export type LeadInput = z.infer<typeof leadUpdateSchema>;
/** Many researched leads at once (a JSON file on the Leads page); they start as "research". */
export const leadImportSchema = z.strictObject({
  leads: z
    .array(leadCreateSchema.omit({ status: true }))
    .min(1)
    .max(500),
});
export type LeadImportInput = z.infer<typeof leadImportSchema>;

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
): 'no_email' | 'no_reason' | 'placeholder' | null {
  if (lead.channel !== 'email' || !lead.contactEmail) return 'no_email';
  if (!lead.whyNow) return 'no_reason';
  if (/\[[^\]]*\]/.test(body)) return 'placeholder';
  return null;
}

// --- which leads are worth writing to ---

/** Addresses nobody in particular reads: a person beats these. */
const GENERIC_INBOX =
  /^(info|contact|kontakt|office|hello|hallo|mail|admin|welcome|empfang|reception|bonjour|sales|verkauf|service|team|pr|press|presse|media|medien|mediarelations|com|communication|kommunikation|marketing|europe)([._-][^@]*)?@/i;
/** "Mammut-Team (Medienstelle)", "Équipe Gruner": a greeting for many, not a person. */
const TEAM_NAME = /team|équipe|medienstelle|redaktion/i;

export type LeadFit = 'good' | 'ok' | 'weak';

/**
 * How promising a lead is. The seating pain starts at about 40 people and is sharpest during a
 * move, growth or hybrid work; a named person beats a shared inbox; a real "why now" matters.
 */
export function leadScore(lead: {
  employees: number | null;
  tags: readonly string[];
  contactName: string | null;
  contactEmail: string | null;
  whyNow: string | null;
}): { score: number; fit: LeadFit } {
  let score = 0;
  const n = lead.employees;
  if (n != null) score += n < 20 ? -2 : n < 40 ? 1 : n <= 300 ? 3 : n <= 1000 ? 1 : 0;
  const points: Record<string, number> = {
    moving: 3,
    growing: 2,
    hybrid: 2,
    multiple_sites: 1,
    microsoft365: 1,
    warm: 2,
  };
  for (const t of lead.tags) score += points[t] ?? 0;
  if (
    lead.contactName &&
    !TEAM_NAME.test(lead.contactName) &&
    lead.contactEmail &&
    !GENERIC_INBOX.test(lead.contactEmail)
  )
    score += 2;
  if (lead.whyNow) score += 1;
  return { score, fit: score >= 6 ? 'good' : score >= 3 ? 'ok' : 'weak' };
}

/** A clear "no" in a reply (de/fr/en). Our own quoted e-mail must be removed first. */
const NO = [
  /\bnein,?\s+danke\b/i,
  /\bkein(en)?\s+(interesse|bedarf)\b/i,
  /\bnicht\s+interessiert\b/i,
  /\bbrauchen\s+(wir\s+)?(das\s+|so\s+etwas\s+)?nicht\b/i,
  /\bnon,?\s+merci\b/i,
  /\bpas\s+(int[ée]ress[ée]s?|besoin|d.int[ée]r[êe]t)\b/i,
  /\bne\s+sommes\s+pas\s+int[ée]ress[ée]s\b/i,
  /\bno,?\s+thanks?\b/i,
  /\bnot\s+interested\b/i,
  /\b(no|don.t)\s+need\b/i,
  /\b(unsubscribe|remove\s+me|abmelden|désinscri)/i,
  /^\s*stop\s*[.!]?\s*$/im,
];
export const isNo = (text: string) => NO.some((r) => r.test(text));

/** The reply without the lines of our own e-mails it quotes (so our "Nein danke genügt" never counts). */
export function ownLinesRemoved(reply: string, ours: string[]): string {
  const own = new Set(
    ours
      .flatMap((b) => b.split('\n'))
      .map((l) => l.trim())
      .filter((l) => l.length > 3),
  );
  return reply
    .split('\n')
    .filter((l) => !own.has(l.replace(/^[>\s]+/, '').trim()))
    .join('\n');
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

/**
 * The first e-mail: short, personal, no price and no link. It asks one easy question and makes
 * one offer that costs them nothing (send the floor plan, we set the office up), so answering
 * is easier than ignoring it. The last line lets them say no politely.
 */
const FIRST: Record<LeadLanguage, { subject: string; body: string }> = {
  de: {
    subject: 'Wer sitzt wo bei {company}?',
    body: `Guten Tag {greeting}

{whyNow}

Darf ich kurz fragen: Wie behalten Sie heute den Überblick, wer bei {company} wo sitzt? Noch mit Excel?

Ich habe dafür Seatline gebaut, einen Sitzplan, den alle im Browser sehen und der bei jedem Umzug mitwächst. Mein Angebot: Sie schicken mir Ihren Grundriss (ein PDF reicht), und ich richte Ihr Büro kostenlos ein. Sie schauen es sich einfach an, ohne Verpflichtung.

Wäre das hilfreich, oder passt es gerade nicht?

{signature}`,
  },
  fr: {
    subject: 'Qui est assis où chez {company} ?',
    body: `Bonjour {greeting}

{whyNow}

Puis-je vous poser une petite question : comment savez-vous aujourd’hui qui est assis où chez {company} ? Encore avec Excel ?

J’ai créé Seatline pour cela, un plan de bureau que tout le monde voit dans le navigateur et qui suit chaque déménagement. Ma proposition : vous m’envoyez votre plan d’étage (un PDF suffit) et je configure votre bureau gratuitement. Vous n’avez qu’à regarder, sans engagement.

Est-ce que cela vous aiderait, ou ce n’est pas le bon moment ?

{signature}`,
  },
  en: {
    subject: 'Who sits where at {company}?',
    body: `Hello {greeting}

{whyNow}

May I ask a quick question: how do you keep track today of who sits where at {company}? Still in Excel?

I built Seatline for exactly that, a seating plan everyone sees in the browser that keeps up with every move. My offer: send me your floor plan (a PDF is fine) and I’ll set up your office for free. You just take a look, no strings attached.

Would that help, or is now not a good time?

{signature}`,
  },
};

/** A week later, as a reply: the offer once more, the 90-second video, and who else to ask. */
const FOLLOW_UP: Record<LeadLanguage, string> = {
  de: `Guten Tag {greeting}

Kurz nachgefasst: Mein Angebot steht. Sie schicken mir den Grundriss, ich richte Ihr Büro in Seatline kostenlos ein.

Lieber zuerst selbst sehen? 90 Sekunden:
{video}

Falls jemand anderes bei Ihnen für das Büro zuständig ist, bin ich für einen Hinweis dankbar.

{signature}`,
  fr: `Bonjour {greeting}

Je me permets de revenir brièvement vers vous : ma proposition tient toujours. Vous m’envoyez le plan d’étage, je configure votre bureau dans Seatline gratuitement.

Vous préférez d’abord voir par vous-même ? 90 secondes :
{video}

Si quelqu’un d’autre s’occupe des bureaux chez vous, je vous remercie de me l’indiquer.

{signature}`,
  en: `Hello {greeting}

A quick follow-up: my offer still stands. Send me the floor plan and I’ll set up your office in Seatline for free.

Rather see it yourself first? 90 seconds:
{video}

If someone else looks after the office at your company, I’d be grateful for a pointer.

{signature}`,
};

/** After a "no": thanks, and one question about why (sent at most once, as a reply). */
const ASK_WHY: Record<LeadLanguage, string> = {
  de: `Guten Tag {greeting}

Danke für Ihre Antwort, ich schreibe Ihnen nicht mehr.

Nur eine kurze Frage, falls Sie eine Sekunde haben: Reicht Excel, haben Sie schon ein Tool, oder passt es gerade zeitlich nicht? Ein Wort genügt, das hilft mir sehr.

{signature}`,
  fr: `Bonjour {greeting}

Merci pour votre réponse, je ne vous écrirai plus.

Juste une petite question, si vous avez une seconde : Excel suffit, vous avez déjà un outil, ou ce n’est simplement pas le bon moment ? Un mot suffit, cela m’aide beaucoup.

{signature}`,
  en: `Hello {greeting}

Thanks for letting me know, I won’t write again.

Just one quick question, if you have a second: is Excel enough, do you already use a tool, or is it just not the right time? One word is plenty and helps me a lot.

{signature}`,
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
  const fill = (s: string) =>
    s
      .replaceAll('{company}', lead.company)
      .replaceAll('{greeting}', lead.greeting ?? '[Name]')
      .replaceAll('{whyNow}', lead.whyNow ?? '[Why now]')
      .replaceAll('{video}', videoLink(l))
      .replaceAll('{signature}', SIGNATURE[l]);
  if (kind === 'ask_why')
    return {
      subject: `Re: ${firstSubject ?? fill(FIRST[l].subject)}`,
      body: fill(ASK_WHY[l]),
    };
  if (kind === 'follow_up')
    return {
      subject: `Re: ${firstSubject ?? fill(FIRST[l].subject)}`,
      body: fill(FOLLOW_UP[l]),
    };
  return { subject: fill(FIRST[l].subject), body: fill(FIRST[l].body) };
}
