import type { Language } from '../locales';

/**
 * The landing page's sample e-mails, worded exactly like the API's real ones
 * (apps/api/src/mail/notices.ts `noticeMail`, texts.ts `deskMail`) — keep them in step.
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
    hello: 'Hello,',
    intro: `Here is a change at ${WORKSPACE}:`,
    moves: (plan: string, n: number) => `Move plan “${plan}” was carried out (${n} moves):`,
    nowhere: 'no desk',
    open: 'Open Seatline:',
    subject: (plan: string) => `Seatline · ${WORKSPACE}: move plan “${plan}” done`,
    desk: (name: string, label: string, where: string) => ({
      subject: `Your desk: ${label}`,
      text: `Hello ${name},\n\nFrom now on your desk is ${label} (${where}).\n\nQuestions? Ask your office team.\n\nSeatline`,
    }),
  },
  de: {
    hello: 'Guten Tag',
    intro: `Es gibt eine Änderung bei ${WORKSPACE}:`,
    moves: (plan: string, n: number) => `Der Umzugsplan «${plan}» wurde ausgeführt (${n} Umzüge):`,
    nowhere: 'kein Platz',
    open: 'Seatline öffnen:',
    subject: (plan: string) => `Seatline · ${WORKSPACE}: Umzugsplan «${plan}» ausgeführt`,
    desk: (name: string, label: string, where: string) => ({
      subject: `Ihr Arbeitsplatz: ${label}`,
      text: `Guten Tag ${name}\n\nAb jetzt ist Ihr Arbeitsplatz ${label} (${where}).\n\nFragen? Wenden Sie sich an Ihr Office-Team.\n\nSeatline`,
    }),
  },
  fr: {
    hello: 'Bonjour,',
    intro: `Voici un changement chez ${WORKSPACE} :`,
    moves: (plan: string, n: number) =>
      `Le plan de déménagement « ${plan} » a été exécuté (${n} déménagements) :`,
    nowhere: 'aucun poste',
    open: 'Ouvrir Seatline :',
    subject: (plan: string) => `Seatline · ${WORKSPACE} : plan « ${plan} » exécuté`,
    desk: (name: string, label: string, where: string) => ({
      subject: `Votre place : ${label}`,
      text: `Bonjour ${name},\n\nDésormais, votre place est ${label} (${where}).\n\nDes questions ? Adressez-vous à votre équipe office.\n\nSeatline`,
    }),
  },
};

/** The "moves" notice IT gets when a move plan has been carried out. */
export function sampleMovesMail(language: Language) {
  const t = T[language];
  const plan = PLAN[language];
  const text = [
    t.hello,
    '',
    t.intro,
    '',
    `• ${t.moves(plan, MOVES.length)}`,
    ...MOVES.map((m) => `  ${m.person}: ${m.from ?? t.nowhere} → ${m.to} (${PLACE[language]})`),
    '',
    `${t.open} https://app.seatline.ch`,
  ].join('\n');
  return { subject: t.subject(plan), text };
}

/** "Your new desk", to the first person in the sample plan. */
export function sampleDeskMail(language: Language) {
  const m = MOVES[0]!;
  return T[language].desk(m.person, m.to, PLACE[language]);
}
