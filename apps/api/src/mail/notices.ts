import type { MailLanguage, NotifyEvent } from '@seatline/shared';

/** A seat someone had, written out for people who don't use Seatline ("1.04 · HQ › 1. OG"). */
export interface SeatRef {
  label: string;
  place: string;
}

/** Something IT / facility management wants to hear about. */
export type Notice =
  | { kind: 'left'; person: string; team: string | null; day: string; seats: SeatRef[] }
  | { kind: 'leaving'; person: string; team: string | null; day: string; seats: SeatRef[] }
  | { kind: 'joined'; person: string; team: string | null }
  | { kind: 'team'; person: string; from: string | null; to: string | null }
  | {
      kind: 'moves';
      plan: string;
      moves: Array<{ person: string; from: SeatRef | null; to: SeatRef | null }>;
    };

/** Which workspace setting a notice belongs to. */
export const noticeEvent = (n: Notice): NotifyEvent => (n.kind === 'leaving' ? 'left' : n.kind);

const LOCALE: Record<MailLanguage, string> = { en: 'en-GB', de: 'de-CH', fr: 'fr-CH' };

const T = {
  en: {
    hello: 'Hello,',
    intro: (ws: string, n: number) =>
      n === 1 ? `Here is a change at ${ws}:` : `Here are ${n} changes at ${ws}:`,
    left: (p: string, day: string) => `${p} has left the company (${day}).`,
    leaving: (p: string, day: string) => `${p} leaves the company on ${day}.`,
    freed: (s: string) => `Desk ${s} is free now.`,
    freesOn: (s: string, day: string) => `Desk ${s} will be free from ${day}.`,
    noSeat: 'No desk to free.',
    joined: (p: string) => `${p} has joined.`,
    team: (p: string, from: string, to: string) => `${p} moved from team ${from} to ${to}.`,
    noTeam: 'no team',
    moves: (plan: string, n: number) => `Move plan “${plan}” was carried out (${n} moves):`,
    nowhere: 'no desk',
    open: 'Open Seatline:',
    why: (ws: string) =>
      `You get this e-mail because an admin of ${ws} entered your address for notices in Seatline (People & access → Settings).`,
    subjectOne: (ws: string, what: string) => `Seatline · ${ws}: ${what}`,
    subjectMany: (ws: string, n: number) => `Seatline · ${ws}: ${n} changes`,
    short: {
      left: (p: string) => `${p} has left`,
      leaving: (p: string) => `${p} is leaving`,
      joined: (p: string) => `${p} has joined`,
      team: (p: string) => `${p} changed team`,
      moves: (plan: string) => `move plan “${plan}” done`,
    },
  },
  de: {
    hello: 'Guten Tag',
    intro: (ws: string, n: number) =>
      n === 1 ? `Es gibt eine Änderung bei ${ws}:` : `Es gibt ${n} Änderungen bei ${ws}:`,
    left: (p: string, day: string) => `${p} hat das Unternehmen verlassen (${day}).`,
    leaving: (p: string, day: string) => `${p} verlässt das Unternehmen am ${day}.`,
    freed: (s: string) => `Arbeitsplatz ${s} ist jetzt frei.`,
    freesOn: (s: string, day: string) => `Arbeitsplatz ${s} wird ab ${day} frei.`,
    noSeat: 'Kein Arbeitsplatz wird frei.',
    joined: (p: string) => `${p} ist neu dabei.`,
    team: (p: string, from: string, to: string) => `${p} wechselt vom Team ${from} zu ${to}.`,
    noTeam: 'kein Team',
    moves: (plan: string, n: number) => `Der Umzugsplan «${plan}» wurde ausgeführt (${n} Umzüge):`,
    nowhere: 'kein Platz',
    open: 'Seatline öffnen:',
    why: (ws: string) =>
      `Sie erhalten diese E-Mail, weil ein Admin von ${ws} Ihre Adresse für Mitteilungen in Seatline eingetragen hat (Personen & Zugang → Einstellungen).`,
    subjectOne: (ws: string, what: string) => `Seatline · ${ws}: ${what}`,
    subjectMany: (ws: string, n: number) => `Seatline · ${ws}: ${n} Änderungen`,
    short: {
      left: (p: string) => `${p} ist ausgetreten`,
      leaving: (p: string) => `${p} tritt aus`,
      joined: (p: string) => `${p} ist neu dabei`,
      team: (p: string) => `${p} wechselt das Team`,
      moves: (plan: string) => `Umzugsplan «${plan}» ausgeführt`,
    },
  },
  fr: {
    hello: 'Bonjour,',
    intro: (ws: string, n: number) =>
      n === 1 ? `Voici un changement chez ${ws} :` : `Voici ${n} changements chez ${ws} :`,
    left: (p: string, day: string) => `${p} a quitté l’entreprise (${day}).`,
    leaving: (p: string, day: string) => `${p} quitte l’entreprise le ${day}.`,
    freed: (s: string) => `Le poste ${s} est libre maintenant.`,
    freesOn: (s: string, day: string) => `Le poste ${s} sera libre dès le ${day}.`,
    noSeat: 'Aucun poste à libérer.',
    joined: (p: string) => `${p} nous a rejoints.`,
    team: (p: string, from: string, to: string) => `${p} passe de l’équipe ${from} à ${to}.`,
    noTeam: 'aucune équipe',
    moves: (plan: string, n: number) =>
      `Le plan de déménagement « ${plan} » a été exécuté (${n} déménagements) :`,
    nowhere: 'aucun poste',
    open: 'Ouvrir Seatline :',
    why: (ws: string) =>
      `Vous recevez cet e-mail car un admin de ${ws} a saisi votre adresse pour les avis dans Seatline (Personnes et accès → Réglages).`,
    subjectOne: (ws: string, what: string) => `Seatline · ${ws} : ${what}`,
    subjectMany: (ws: string, n: number) => `Seatline · ${ws} : ${n} changements`,
    short: {
      left: (p: string) => `${p} est parti·e`,
      leaving: (p: string) => `${p} va partir`,
      joined: (p: string) => `${p} nous a rejoints`,
      team: (p: string) => `${p} change d’équipe`,
      moves: (plan: string) => `plan « ${plan} » exécuté`,
    },
  },
};

const seatText = (s: SeatRef) => `${s.label} (${s.place})`;

/** One plain-text e-mail listing all notices (no tracking, no images). */
export function noticeMail(
  workspace: string,
  notices: Notice[],
  language: MailLanguage,
  appUrl: string,
): { subject: string; text: string } {
  const t = T[language];
  const date = (day: string) =>
    new Date(`${day}T12:00:00Z`).toLocaleDateString(LOCALE[language], {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'Europe/Zurich',
    });
  const who = (p: string, team: string | null) => (team ? `${p} (${team})` : p);
  const lines = notices.flatMap((n): string[] => {
    switch (n.kind) {
      case 'left':
        return [
          `• ${t.left(who(n.person, n.team), date(n.day))}`,
          ...(n.seats.length ? n.seats.map((s) => `  ${t.freed(seatText(s))}`) : [`  ${t.noSeat}`]),
        ];
      case 'leaving':
        return [
          `• ${t.leaving(who(n.person, n.team), date(n.day))}`,
          ...n.seats.map((s) => `  ${t.freesOn(seatText(s), date(n.day))}`),
        ];
      case 'joined':
        return [`• ${t.joined(who(n.person, n.team))}`];
      case 'team':
        return [`• ${t.team(n.person, n.from ?? t.noTeam, n.to ?? t.noTeam)}`];
      case 'moves':
        return [
          `• ${t.moves(n.plan, n.moves.length)}`,
          ...n.moves.map(
            (m) =>
              `  ${m.person}: ${m.from ? m.from.label : t.nowhere} → ${m.to ? seatText(m.to) : t.nowhere}`,
          ),
        ];
    }
  });
  const first = notices[0]!;
  const what =
    first.kind === 'moves' ? t.short.moves(first.plan) : t.short[first.kind](first.person);
  return {
    subject:
      notices.length === 1
        ? t.subjectOne(workspace, what)
        : t.subjectMany(workspace, notices.length),
    text: [
      t.hello,
      '',
      t.intro(workspace, notices.length),
      '',
      ...lines,
      '',
      `${t.open} ${appUrl}`,
      '',
      '—',
      t.why(workspace),
      'Seatline',
    ].join('\n'),
  };
}
