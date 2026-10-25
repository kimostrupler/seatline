import type { MailLanguage } from '@seatline/shared';
import type { Mail } from './mail.service';

// E-mail texts (en, Swiss German, French). Plain text: no tracking, no images.

/** "482193" → "482 193" (easier to read and type) */
const spacedCode = (code: string) => `${code.slice(0, 3)} ${code.slice(3)}`;

export function signInMail(to: string, link: string, code: string, language: MailLanguage): Mail {
  const c = spacedCode(code);
  const t = {
    en: {
      subject: 'Your Seatline sign-in link',
      text: `Hello,\n\nUse this link to sign in to Seatline. It works once and for 15 minutes:\n\n${link}\n\nOr type this code where Seatline asks for it (e.g. in the app on your phone's home screen):\n\n${c}\n\nIf you didn't ask for it, just ignore this e-mail — nobody can sign in without it.\n\nSeatline`,
    },
    de: {
      subject: 'Ihr Anmeldelink für Seatline',
      text: `Guten Tag\n\nMit diesem Link melden Sie sich bei Seatline an. Er funktioniert einmal und 15 Minuten lang:\n\n${link}\n\nOder geben Sie diesen Code dort ein, wo Seatline danach fragt (z. B. in der App auf dem Home-Bildschirm Ihres Telefons):\n\n${c}\n\nFalls Sie ihn nicht angefordert haben, ignorieren Sie diese E-Mail einfach — ohne Link oder Code kann sich niemand anmelden.\n\nSeatline`,
    },
    fr: {
      subject: 'Votre lien de connexion à Seatline',
      text: `Bonjour,\n\nCe lien vous connecte à Seatline. Il fonctionne une seule fois, pendant 15 minutes :\n\n${link}\n\nOu saisissez ce code là où Seatline le demande (par ex. dans l’app sur l’écran d’accueil de votre téléphone) :\n\n${c}\n\nSi vous ne l’avez pas demandé, ignorez simplement cet e-mail — personne ne peut se connecter sans ce lien ou ce code.\n\nSeatline`,
    },
  }[language];
  return { to, ...t };
}

export function inviteMail(
  to: string,
  invitedBy: string,
  workspace: string,
  link: string,
  language: MailLanguage,
): Mail {
  const t = {
    en: {
      subject: `${invitedBy} added you to Seatline`,
      text: `Hello,\n\n${invitedBy} added you to ${workspace} on Seatline, where your office's desks are planned.\n\nTo sign in, open ${link} and enter this e-mail address. You'll get a link to sign in — no password needed.\n\nSeatline`,
    },
    de: {
      subject: `${invitedBy} hat Sie zu Seatline hinzugefügt`,
      text: `Guten Tag\n\n${invitedBy} hat Sie bei ${workspace} auf Seatline hinzugefügt, wo die Arbeitsplätze Ihres Büros geplant werden.\n\nZum Anmelden öffnen Sie ${link} und geben diese E-Mail-Adresse ein. Sie erhalten einen Anmeldelink — ohne Passwort.\n\nSeatline`,
    },
    fr: {
      subject: `${invitedBy} vous a ajouté à Seatline`,
      text: `Bonjour,\n\n${invitedBy} vous a ajouté à ${workspace} sur Seatline, où les postes de travail de votre bureau sont planifiés.\n\nPour vous connecter, ouvrez ${link} et saisissez cette adresse e-mail. Vous recevrez un lien de connexion — sans mot de passe.\n\nSeatline`,
    },
  }[language];
  return { to, ...t };
}

/** To a person: they have a new desk (single move or a carried-out move plan). */
export function deskMail(
  to: string,
  name: string,
  desk: { label: string; place: string; room: string | null },
  link: string | null,
  language: MailLanguage,
): Mail {
  const where = desk.room ? `${desk.place} › ${desk.room}` : desk.place;
  const t = {
    en: {
      subject: `Your desk: ${desk.label}`,
      text: `Hello ${name},\n\nFrom now on your desk is ${desk.label} (${where}).${link ? `\n\nSee it on the map:\n${link}` : ''}\n\nQuestions? Ask your office team.\n\nSeatline`,
    },
    de: {
      subject: `Ihr Arbeitsplatz: ${desk.label}`,
      text: `Guten Tag ${name}\n\nAb jetzt ist Ihr Arbeitsplatz ${desk.label} (${where}).${link ? `\n\nAuf dem Plan ansehen:\n${link}` : ''}\n\nFragen? Wenden Sie sich an Ihr Office-Team.\n\nSeatline`,
    },
    fr: {
      subject: `Votre place : ${desk.label}`,
      text: `Bonjour ${name},\n\nDésormais, votre place est ${desk.label} (${where}).${link ? `\n\nLa voir sur le plan :\n${link}` : ''}\n\nDes questions ? Adressez-vous à votre équipe office.\n\nSeatline`,
    },
  }[language];
  return { to, ...t };
}

/** To a workspace's admins: the free trial ends in `days` days. */
export function trialMail(
  to: string,
  workspace: string,
  days: number,
  link: string,
  language: MailLanguage,
): Mail {
  const t = {
    en: {
      subject:
        days <= 1
          ? `Your Seatline trial ends tomorrow`
          : `Your Seatline trial ends in ${days} days`,
      text: `Hello,\n\nThe free trial of ${workspace} on Seatline ends ${days <= 1 ? 'tomorrow' : `in ${days} days`}.\n\nTo keep making changes, an admin can subscribe in a few clicks:\n${link}\n\nIf nobody subscribes, the workspace becomes read-only. Nothing is deleted, and you can subscribe at any time later.\n\nQuestions? Just reply to this e-mail.\n\nSeatline`,
    },
    de: {
      subject:
        days <= 1
          ? `Ihre Seatline-Testphase endet morgen`
          : `Ihre Seatline-Testphase endet in ${days} Tagen`,
      text: `Guten Tag\n\nDie Gratis-Testphase von ${workspace} auf Seatline endet ${days <= 1 ? 'morgen' : `in ${days} Tagen`}.\n\nDamit Sie weiter Änderungen machen können, schliesst ein Admin mit wenigen Klicks ein Abo ab:\n${link}\n\nOhne Abo wird der Arbeitsbereich schreibgeschützt. Gelöscht wird nichts, und Sie können jederzeit später abonnieren.\n\nFragen? Antworten Sie einfach auf diese E-Mail.\n\nSeatline`,
    },
    fr: {
      subject:
        days <= 1
          ? `Votre essai Seatline se termine demain`
          : `Votre essai Seatline se termine dans ${days} jours`,
      text: `Bonjour,\n\nL’essai gratuit de ${workspace} sur Seatline se termine ${days <= 1 ? 'demain' : `dans ${days} jours`}.\n\nPour continuer à faire des changements, un admin peut s’abonner en quelques clics :\n${link}\n\nSans abonnement, l’espace passe en lecture seule. Rien n’est supprimé, et vous pouvez vous abonner plus tard à tout moment.\n\nDes questions ? Répondez simplement à cet e-mail.\n\nSeatline`,
    },
  }[language];
  return { to, ...t };
}

/** Onboarding, to a new workspace's admins: day 1 = draw a floor, 3 = add people, 7 = help. */
export function onboardingMail(
  to: string,
  workspace: string,
  day: 1 | 3 | 7,
  link: string,
  language: MailLanguage,
): Mail {
  const t = {
    en: {
      1: {
        subject: 'Draw your first floor in Seatline',
        text: `Hello,\n\nWelcome to Seatline. The quickest start for ${workspace}: open the map, choose an example office (small, medium or large) and change it to fit. Or upload a picture of your floor plan.\n\n${link}\n\nQuestions? Just reply to this e-mail.\n\nSeatline`,
      },
      3: {
        subject: 'Add your people to Seatline',
        text: `Hello,\n\nOnce your people are in ${workspace}, you can give them desks. Add them one by one, or import an Excel or CSV list (name and e-mail are enough):\n\n${link}\n\nQuestions? Just reply to this e-mail.\n\nSeatline`,
      },
      7: {
        subject: 'Can we help with Seatline?',
        text: `Hello,\n\nYou have tried Seatline for a week. If something is unclear or missing, just reply to this e-mail: we read every message and answer personally.\n\nThe help center shows each step with pictures:\n${link}\n\nSeatline`,
      },
    },
    de: {
      1: {
        subject: 'Zeichnen Sie Ihr erstes Stockwerk in Seatline',
        text: `Guten Tag\n\nWillkommen bei Seatline. Der schnellste Start für ${workspace}: Öffnen Sie den Plan, wählen Sie ein Beispielbüro (klein, mittel oder gross) und passen Sie es an. Oder laden Sie ein Bild Ihres Grundrisses hoch.\n\n${link}\n\nFragen? Antworten Sie einfach auf diese E-Mail.\n\nSeatline`,
      },
      3: {
        subject: 'Erfassen Sie Ihre Personen in Seatline',
        text: `Guten Tag\n\nSobald Ihre Personen in ${workspace} erfasst sind, können Sie ihnen Plätze geben. Fügen Sie sie einzeln hinzu oder importieren Sie eine Excel- oder CSV-Liste (Name und E-Mail genügen):\n\n${link}\n\nFragen? Antworten Sie einfach auf diese E-Mail.\n\nSeatline`,
      },
      7: {
        subject: 'Können wir Ihnen bei Seatline helfen?',
        text: `Guten Tag\n\nSie testen Seatline seit einer Woche. Wenn etwas unklar ist oder fehlt, antworten Sie einfach auf diese E-Mail: Wir lesen jede Nachricht und antworten persönlich.\n\nDas Hilfe-Center zeigt jeden Schritt mit Bildern:\n${link}\n\nSeatline`,
      },
    },
    fr: {
      1: {
        subject: 'Dessinez votre premier étage dans Seatline',
        text: `Bonjour,\n\nBienvenue sur Seatline. Le départ le plus rapide pour ${workspace} : ouvrez le plan, choisissez un bureau d’exemple (petit, moyen ou grand) et adaptez-le. Ou téléversez une image de votre plan d’étage.\n\n${link}\n\nDes questions ? Répondez simplement à cet e-mail.\n\nSeatline`,
      },
      3: {
        subject: 'Ajoutez vos collaborateurs dans Seatline',
        text: `Bonjour,\n\nUne fois vos collaborateurs dans ${workspace}, vous pouvez leur attribuer des places. Ajoutez-les un par un, ou importez une liste Excel ou CSV (nom et e-mail suffisent) :\n\n${link}\n\nDes questions ? Répondez simplement à cet e-mail.\n\nSeatline`,
      },
      7: {
        subject: 'Pouvons-nous vous aider avec Seatline ?',
        text: `Bonjour,\n\nVous essayez Seatline depuis une semaine. Si quelque chose n’est pas clair ou manque, répondez simplement à cet e-mail : nous lisons chaque message et répondons personnellement.\n\nLe centre d’aide montre chaque étape en images :\n${link}\n\nSeatline`,
      },
    },
  }[language][day];
  // promotional-style tips need an easy way out (Swiss UWG): the operator stops them on request
  const stop = {
    en: 'Don’t want these tips? Reply “stop” and we won’t send more.',
    de: 'Keine Tipps mehr? Antworten Sie mit «stop», dann senden wir keine weiteren.',
    fr: 'Plus de conseils ? Répondez « stop » et nous n’en enverrons plus.',
  }[language];
  return { to, subject: t.subject, text: `${t.text}\n\n--\n${stop}` };
}

/** To an admin who asked for it: the DPA as a PDF attachment. */
export function dpaMail(to: string, workspace: string, pdf: Buffer, language: MailLanguage): Mail {
  const t = {
    en: {
      subject: `Data processing agreement for ${workspace}`,
      text: `Hello,\n\nAttached is the data processing agreement (DPA) between ${workspace} and Seatline, as you asked. It is part of our terms and already applies to your workspace; this copy is for your records.\n\nQuestions? Just reply to this e-mail.\n\nSeatline`,
      file: 'Seatline-DPA.pdf',
    },
    de: {
      subject: `Auftragsverarbeitungsvertrag für ${workspace}`,
      text: `Guten Tag\n\nIm Anhang finden Sie wie gewünscht den Auftragsverarbeitungsvertrag (AVV) zwischen ${workspace} und Seatline. Er ist Teil unserer Nutzungsbedingungen und gilt bereits für Ihren Arbeitsbereich; diese Kopie ist für Ihre Unterlagen.\n\nFragen? Antworten Sie einfach auf diese E-Mail.\n\nSeatline`,
      file: 'Seatline-AVV.pdf',
    },
    fr: {
      subject: `Accord de sous-traitance pour ${workspace}`,
      text: `Bonjour,\n\nVous trouverez en pièce jointe l’accord de sous-traitance (DPA) entre ${workspace} et Seatline, comme demandé. Il fait partie de nos conditions et s’applique déjà à votre espace ; cette copie est pour vos dossiers.\n\nDes questions ? Répondez simplement à cet e-mail.\n\nSeatline`,
      file: 'Seatline-DPA.pdf',
    },
  }[language];
  return {
    to,
    subject: t.subject,
    text: t.text,
    attachments: [{ filename: t.file, content: pdf, contentType: 'application/pdf' }],
  };
}

/** Outreach, to the operator: follow-ups that are due (the morning job), with links to the leads. */
export function outreachReminderMail(
  to: string,
  leads: Array<{ company: string; link: string }>,
  language: MailLanguage,
): Mail {
  const list = leads.map((l) => `- ${l.company}: ${l.link}`).join('\n');
  const t = {
    en: {
      subject: `${leads.length} follow-up(s) due today`,
      text: `Good morning,\n\nThese leads haven’t answered for a week. Their follow-up is ready to check and schedule:\n\n${list}\n\nSeatline`,
    },
    de: {
      subject: `${leads.length} Nachfass-E-Mail(s) heute fällig`,
      text: `Guten Morgen\n\nDiese Leads haben seit einer Woche nicht geantwortet. Die Nachfass-E-Mail ist bereit zum Prüfen und Planen:\n\n${list}\n\nSeatline`,
    },
    fr: {
      subject: `${leads.length} relance(s) à faire aujourd’hui`,
      text: `Bonjour,\n\nCes leads n’ont pas répondu depuis une semaine. La relance est prête à être relue et planifiée :\n\n${list}\n\nSeatline`,
    },
  }[language];
  return { to, ...t };
}
