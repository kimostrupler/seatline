import type { MailLanguage } from '@seatline/shared';
import type { Mail } from './mail.service';

// E-mail texts (en, Swiss German, French). Plain text: no tracking, no images.

export function signInMail(to: string, link: string, language: MailLanguage): Mail {
  const t = {
    en: {
      subject: 'Your Seatline sign-in link',
      text: `Hello,\n\nUse this link to sign in to Seatline. It works once and for 15 minutes:\n\n${link}\n\nIf you didn't ask for it, just ignore this e-mail — nobody can sign in without it.\n\nSeatline`,
    },
    de: {
      subject: 'Ihr Anmeldelink für Seatline',
      text: `Guten Tag\n\nMit diesem Link melden Sie sich bei Seatline an. Er funktioniert einmal und 15 Minuten lang:\n\n${link}\n\nFalls Sie ihn nicht angefordert haben, ignorieren Sie diese E-Mail einfach — ohne den Link kann sich niemand anmelden.\n\nSeatline`,
    },
    fr: {
      subject: 'Votre lien de connexion à Seatline',
      text: `Bonjour,\n\nCe lien vous connecte à Seatline. Il fonctionne une seule fois, pendant 15 minutes :\n\n${link}\n\nSi vous ne l’avez pas demandé, ignorez simplement cet e-mail — personne ne peut se connecter sans ce lien.\n\nSeatline`,
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
