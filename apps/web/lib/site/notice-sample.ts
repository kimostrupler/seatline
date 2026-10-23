import type { Language } from '../locales';

/**
 * The landing page's sample e-mail, worded exactly like the API's real ones
 * (apps/api/src/mail/notices.ts `noticeMail`) — keep them in step.
 */
const WORKSPACE = 'Muster AG';
const PLAN = {
  en: 'Sales to the 2nd floor',
  de: 'Verkauf in den 2. Stock',
  fr: 'Ventes au 2e étage',
};
const PLACE = { en: 'HQ › 2nd floor', de: 'HQ › 2. OG', fr: 'HQ › 2e étage' };
const MOVES = [
  { person: 'Anna Keller', from: '1.04', to: '2.01' },
  { person: 'Luca Rossi', from: '1.05', to: '2.02' },
  { person: 'Chloé Martin', from: null, to: '2.03' },
];
const T = {
  en: {
    nowhere: 'no desk',
    subject: (plan: string) => `Seatline · ${WORKSPACE}: move plan “${plan}” done`,
  },
  de: {
    nowhere: 'kein Platz',
    subject: (plan: string) => `Seatline · ${WORKSPACE}: Umzugsplan «${plan}» ausgeführt`,
  },
  fr: {
    nowhere: 'aucun poste',
    subject: (plan: string) => `Seatline · ${WORKSPACE} : plan « ${plan} » exécuté`,
  },
};

/** The "moves" notice IT gets when a move plan has been carried out: subject + the move lines. */
export function sampleMovesMail(language: Language) {
  const t = T[language];
  const plan = PLAN[language];
  return {
    subject: t.subject(plan),
    lines: MOVES.map((m) => `${m.person}: ${m.from ?? t.nowhere} → ${m.to} (${PLACE[language]})`),
  };
}
