import type { Language } from './locales';

/**
 * Guides on the website, for people searching for seating-plan tools: each in English, German
 * and French, each language with its own address (slug). Plain facts about Seatline only — no
 * claims about named competitors.
 */
export const GUIDES = ['excel', 'switzerland', 'booking'] as const;
export type Guide = (typeof GUIDES)[number];

export interface GuideText {
  slug: string;
  title: string;
  description: string;
  intro: string;
  /** a comparison: the first cell of each row names it, then one cell per column */
  table?: { columns: string[]; rows: string[][] };
  sections: Array<{ heading: string; paragraphs: string[]; bullets?: string[] }>;
}

const EN: Record<Guide, GuideText> = {
  excel: {
    slug: 'seatline-vs-excel',
    title: 'Seatline vs. an Excel seating plan',
    description:
      'Many offices keep their seating plan in Excel. When that stops working, and what a seating plan tool does differently.',
    intro:
      'Most companies start with a spreadsheet: one row per person, a column for the desk. It’s free and everyone knows Excel. It stops working once the office grows, teams move or more than one person keeps the list.',
    table: {
      columns: ['Excel list', 'Seatline'],
      rows: [
        ['See free desks', 'Count rows by hand', 'Floor map: free desks in green'],
        [
          'Find a colleague',
          'Search the file, then find the desk',
          'Search a name, the map shows the desk',
        ],
        [
          'Who sat where before',
          'Lost when the cell is overwritten',
          'Every move kept, with date and who made it',
        ],
        ['Several people editing', 'Copies and versions drift apart', 'One plan, always current'],
        [
          'New and leaving people',
          'Someone has to remember',
          'From Microsoft 365 or an Excel import; leavers free their desk',
        ],
        [
          'Planning a team move',
          'A second sheet and a long evening',
          'Plan the move, it happens overnight on the day',
        ],
        ['Telling IT', 'An e-mail someone forgets', 'IT gets an e-mail for every change'],
      ],
    },
    sections: [
      {
        heading: 'When Excel is enough',
        paragraphs: [
          'For a dozen people on one floor who rarely move, a list works. Keep it in one shared place and note the date of each change.',
        ],
      },
      {
        heading: 'Signs you’ve outgrown the spreadsheet',
        paragraphs: ['If two or more of these sound familiar, a seating plan tool saves time:'],
        bullets: [
          'You’re not sure which version of the file is the right one.',
          'New people arrive and nobody knows which desk is free.',
          'HR, IT and facility each keep their own list.',
          'You can’t say who sat at a desk three months ago.',
          'A team move takes days of planning.',
        ],
      },
      {
        heading: 'Moving from Excel to Seatline',
        paragraphs: [
          'Import your list as it is: Seatline reads Excel and CSV files with column titles in English, German or French. Then draw your floors (or start from an example office) and drag people onto their desks. Most offices are ready in an afternoon.',
          'Seatline costs CHF 2 per desk per month, the first 30 days are free, and your data stays in Switzerland.',
        ],
      },
    ],
  },
  switzerland: {
    slug: 'desk-management-software-switzerland',
    title: 'Seating plan software for Swiss companies',
    description:
      'What to look for in a seating plan or desk management tool in Switzerland: where the data is stored, the nDSG, languages and Microsoft 365.',
    intro:
      'A seating plan holds personal data: who sits where, since when and in which team. For Swiss companies that raises a few questions before choosing a tool.',
    table: {
      columns: ['Seatline'],
      rows: [
        ['Where is the data stored?', 'In Switzerland (Microsoft Azure, Zurich)'],
        [
          'Data protection',
          'Built for the Swiss nDSG and the GDPR; history kept only as long as you choose',
        ],
        ['Data processing agreement', 'Yes, online and signed on request'],
        ['Languages', 'German, French and English, for every user'],
        ['Sign-in', 'Microsoft 365 (Entra ID) or a link by e-mail'],
        ['Price', 'CHF 2 per desk per month, billed in Swiss francs'],
      ],
    },
    sections: [
      {
        heading: 'Data in Switzerland',
        paragraphs: [
          'Under the Swiss Data Protection Act (nDSG), seat history is personal data. Seatline stores it in Switzerland only, in Microsoft Azure’s Zurich region, including backups and logs. You decide how long past seating is kept (1, 2, 5 or 10 years), and people who left can be anonymised.',
        ],
      },
      {
        heading: 'Three languages, one plan',
        paragraphs: [
          'Each person uses Seatline in their own language: German (Swiss spelling), French or English. E-mails to IT and to staff follow the same choice.',
        ],
      },
      {
        heading: 'Fits Microsoft 365 — or works without it',
        paragraphs: [
          'With Microsoft 365, people sign in with their work account and names and departments update every night. Seatline also runs as a tab in Teams and Outlook. Without Microsoft 365, people sign in with a link by e-mail and you import them from Excel.',
        ],
      },
      {
        heading: 'Long-term seating, not desk booking',
        paragraphs: [
          'Seatline is for offices where people have their own desk: assign desks, plan moves and keep the history. If everyone books a different desk every day, a desk booking tool is the better fit.',
        ],
      },
    ],
  },
  booking: {
    slug: 'seating-plan-vs-desk-booking',
    title: 'Seating plan or desk booking: which does your office need?',
    description:
      'Fixed desks or hot desking? The difference between a seating plan tool and a desk booking tool, and how to choose.',
    intro:
      'Desk booking tools are built for hot desking: people reserve a desk for a day. Many offices still give people their own desk, or mix both. They need a different tool: a seating plan.',
    table: {
      columns: ['Desk booking tool', 'Seating plan (Seatline)'],
      rows: [
        ['Main question', 'Which desk is free tomorrow?', 'Who sits where, and since when?'],
        ['Typical office', 'Everyone shares desks', 'People have their own desk'],
        [
          'Daily effort',
          'Everyone books, every day',
          'Nobody books; desks change when people move',
        ],
        ['History', 'Bookings', 'Every assignment and move, with dates'],
        ['Moves', 'Not a topic', 'Plan team moves, carried out on the day'],
        ['IT and facility', 'Usage reports', 'An e-mail when someone joins, leaves or moves'],
      ],
    },
    sections: [
      {
        heading: 'When a seating plan fits',
        paragraphs: [
          'If most people come in most days and sit at the same desk, booking adds daily work for nothing. A seating plan answers what matters there: who sits where, which desks are free for new people and how to move a team.',
        ],
      },
      {
        heading: 'Mixed offices',
        paragraphs: [
          'Many offices have fixed desks plus a few shared ones. In Seatline you can reserve a desk for a visitor or a future colleague, block desks that aren’t in use and see free desks with the features people need (standing desk, two screens, by the window).',
        ],
      },
      {
        heading: 'Try it with your own floors',
        paragraphs: [
          'Open the demo office without signing up, or start a free 30-day trial and import your people from Excel or Microsoft 365.',
        ],
      },
    ],
  },
};

const DE: Record<Guide, GuideText> = {
  excel: {
    slug: 'seatline-vs-excel-sitzplan',
    title: 'Seatline oder ein Sitzplan in Excel',
    description:
      'Viele Büros führen ihren Sitzplan in Excel. Wann das nicht mehr reicht und was ein Sitzplan-Tool anders macht.',
    intro:
      'Die meisten Firmen beginnen mit einer Tabelle: eine Zeile pro Person, eine Spalte für den Arbeitsplatz. Das ist gratis und alle kennen Excel. Es funktioniert nicht mehr, sobald das Büro wächst, Teams umziehen oder mehrere Personen die Liste pflegen.',
    table: {
      columns: ['Excel-Liste', 'Seatline'],
      rows: [
        ['Freie Plätze sehen', 'Zeilen von Hand zählen', 'Grundriss: freie Plätze in Grün'],
        [
          'Kollegin finden',
          'Datei durchsuchen, dann den Platz suchen',
          'Namen suchen, der Plan zeigt den Platz',
        ],
        [
          'Wer sass früher wo',
          'Weg, sobald die Zelle überschrieben ist',
          'Jeder Umzug bleibt, mit Datum und wer ihn gemacht hat',
        ],
        [
          'Mehrere bearbeiten',
          'Kopien und Versionen laufen auseinander',
          'Ein Plan, immer aktuell',
        ],
        [
          'Eintritte und Austritte',
          'Jemand muss daran denken',
          'Aus Microsoft 365 oder per Excel-Import; Austretende geben ihren Platz frei',
        ],
        [
          'Teamumzug planen',
          'Ein zweites Blatt und ein langer Abend',
          'Umzug planen, er passiert über Nacht am gewählten Tag',
        ],
        [
          'IT informieren',
          'Ein E-Mail, das jemand vergisst',
          'Die IT erhält bei jeder Änderung ein E-Mail',
        ],
      ],
    },
    sections: [
      {
        heading: 'Wann Excel reicht',
        paragraphs: [
          'Für ein Dutzend Personen auf einem Stockwerk, die selten umziehen, genügt eine Liste. Legen Sie sie an einem gemeinsamen Ort ab und notieren Sie das Datum jeder Änderung.',
        ],
      },
      {
        heading: 'Zeichen, dass die Tabelle zu klein geworden ist',
        paragraphs: [
          'Wenn Ihnen zwei oder mehr davon bekannt vorkommen, spart ein Sitzplan-Tool Zeit:',
        ],
        bullets: [
          'Sie wissen nicht sicher, welche Version der Datei die richtige ist.',
          'Neue Mitarbeitende kommen und niemand weiss, welcher Platz frei ist.',
          'HR, IT und Facility führen je eine eigene Liste.',
          'Sie können nicht sagen, wer vor drei Monaten an einem Platz sass.',
          'Ein Teamumzug braucht tagelange Planung.',
        ],
      },
      {
        heading: 'Von Excel zu Seatline',
        paragraphs: [
          'Importieren Sie Ihre Liste, wie sie ist: Seatline liest Excel- und CSV-Dateien mit Spaltentiteln auf Deutsch, Französisch oder Englisch. Zeichnen Sie dann Ihre Stockwerke (oder beginnen Sie mit einem Beispielbüro) und ziehen Sie die Personen auf ihre Plätze. Die meisten Büros sind an einem Nachmittag bereit.',
          'Seatline kostet CHF 2 pro Arbeitsplatz und Monat, die ersten 30 Tage sind gratis, und Ihre Daten bleiben in der Schweiz.',
        ],
      },
    ],
  },
  switzerland: {
    slug: 'arbeitsplatz-verwaltung-software-schweiz',
    title: 'Sitzplan-Software für Schweizer Firmen',
    description:
      'Worauf Sie bei einer Software für Sitzpläne und Arbeitsplätze in der Schweiz achten sollten: Datenstandort, nDSG, Sprachen und Microsoft 365.',
    intro:
      'Ein Sitzplan enthält Personendaten: wer wo sitzt, seit wann und in welchem Team. Für Schweizer Firmen stellen sich deshalb vor der Wahl eines Tools einige Fragen.',
    table: {
      columns: ['Seatline'],
      rows: [
        ['Wo liegen die Daten?', 'In der Schweiz (Microsoft Azure, Zürich)'],
        [
          'Datenschutz',
          'Für das Schweizer nDSG und die DSGVO gebaut; Verlauf nur so lange, wie Sie wollen',
        ],
        ['Auftragsverarbeitungsvertrag', 'Ja, online und auf Wunsch unterschrieben'],
        ['Sprachen', 'Deutsch, Französisch und Englisch, für alle'],
        ['Anmeldung', 'Microsoft 365 (Entra ID) oder ein Link per E-Mail'],
        ['Preis', 'CHF 2 pro Arbeitsplatz und Monat, in Schweizer Franken'],
      ],
    },
    sections: [
      {
        heading: 'Daten in der Schweiz',
        paragraphs: [
          'Nach dem Schweizer Datenschutzgesetz (nDSG) ist der Sitzverlauf ein Personendatum. Seatline speichert ihn nur in der Schweiz, in der Region Zürich von Microsoft Azure, auch Backups und Logs. Sie bestimmen, wie lange frühere Sitzplätze bleiben (1, 2, 5 oder 10 Jahre), und Ausgetretene lassen sich anonymisieren.',
        ],
      },
      {
        heading: 'Drei Sprachen, ein Plan',
        paragraphs: [
          'Alle nutzen Seatline in ihrer eigenen Sprache: Deutsch (Schweizer Schreibweise), Französisch oder Englisch. E-Mails an die IT und an Mitarbeitende folgen derselben Wahl.',
        ],
      },
      {
        heading: 'Passt zu Microsoft 365 – oder geht ohne',
        paragraphs: [
          'Mit Microsoft 365 melden sich alle mit dem Geschäftskonto an, Namen und Abteilungen werden jede Nacht aktualisiert. Seatline läuft auch als Tab in Teams und Outlook. Ohne Microsoft 365 melden sich die Personen mit einem Link per E-Mail an, und Sie importieren sie aus Excel.',
        ],
      },
      {
        heading: 'Feste Arbeitsplätze, keine Platzbuchung',
        paragraphs: [
          'Seatline ist für Büros, in denen Personen einen eigenen Platz haben: Plätze zuteilen, Umzüge planen und den Verlauf behalten. Wenn alle täglich einen anderen Platz buchen, passt ein Buchungstool besser.',
        ],
      },
    ],
  },
  booking: {
    slug: 'sitzplan-oder-desk-sharing',
    title: 'Sitzplan oder Platzbuchung: Was braucht Ihr Büro?',
    description:
      'Feste Plätze oder Desk-Sharing? Der Unterschied zwischen einem Sitzplan-Tool und einem Buchungstool, und wie Sie wählen.',
    intro:
      'Buchungstools sind für Desk-Sharing gebaut: Man reserviert einen Platz für einen Tag. Viele Büros geben den Leuten aber einen eigenen Platz oder mischen beides. Sie brauchen ein anderes Werkzeug: einen Sitzplan.',
    table: {
      columns: ['Buchungstool', 'Sitzplan (Seatline)'],
      rows: [
        ['Hauptfrage', 'Welcher Platz ist morgen frei?', 'Wer sitzt wo, und seit wann?'],
        ['Typisches Büro', 'Alle teilen sich die Plätze', 'Personen haben einen eigenen Platz'],
        [
          'Täglicher Aufwand',
          'Alle buchen, jeden Tag',
          'Niemand bucht; Plätze ändern sich bei Umzügen',
        ],
        ['Verlauf', 'Buchungen', 'Jede Zuteilung und jeder Umzug, mit Datum'],
        ['Umzüge', 'Kein Thema', 'Teamumzüge planen, am Stichtag ausgeführt'],
        ['IT und Facility', 'Auslastungsberichte', 'Ein E-Mail bei Eintritt, Austritt oder Umzug'],
      ],
    },
    sections: [
      {
        heading: 'Wann ein Sitzplan passt',
        paragraphs: [
          'Wenn die meisten an den meisten Tagen kommen und am selben Platz sitzen, bringt Buchen nur tägliche Arbeit. Ein Sitzplan beantwortet, was dort zählt: wer wo sitzt, welche Plätze für Neue frei sind und wie man ein Team umzieht.',
        ],
      },
      {
        heading: 'Gemischte Büros',
        paragraphs: [
          'Viele Büros haben feste Plätze und einige geteilte. In Seatline reservieren Sie einen Platz für einen Gast oder eine künftige Kollegin, sperren ungenutzte Plätze und sehen freie Plätze mit dem, was gebraucht wird (Stehpult, zwei Bildschirme, am Fenster).',
        ],
      },
      {
        heading: 'Mit Ihren eigenen Stockwerken testen',
        paragraphs: [
          'Öffnen Sie das Demo-Büro ohne Anmeldung oder starten Sie den Gratis-Test über 30 Tage und importieren Sie Ihre Leute aus Excel oder Microsoft 365.',
        ],
      },
    ],
  },
};

const FR: Record<Guide, GuideText> = {
  excel: {
    slug: 'seatline-vs-excel-plan-de-places',
    title: 'Seatline ou un plan de places dans Excel',
    description:
      'Beaucoup de bureaux tiennent leur plan de places dans Excel. Quand cela ne suffit plus, et ce qu’un outil de plan de places fait autrement.',
    intro:
      'La plupart des entreprises commencent avec un tableau : une ligne par personne, une colonne pour le poste. C’est gratuit et tout le monde connaît Excel. Cela ne fonctionne plus dès que le bureau grandit, que des équipes déménagent ou que plusieurs personnes tiennent la liste.',
    table: {
      columns: ['Liste Excel', 'Seatline'],
      rows: [
        [
          'Voir les postes libres',
          'Compter les lignes à la main',
          'Plan de l’étage : postes libres en vert',
        ],
        [
          'Trouver une collègue',
          'Chercher dans le fichier, puis le poste',
          'Chercher un nom, le plan montre le poste',
        ],
        [
          'Qui était où avant',
          'Perdu dès que la cellule est écrasée',
          'Chaque déménagement est gardé, avec la date et son auteur',
        ],
        [
          'Plusieurs personnes modifient',
          'Les copies et versions divergent',
          'Un seul plan, toujours à jour',
        ],
        [
          'Arrivées et départs',
          'Quelqu’un doit y penser',
          'Depuis Microsoft 365 ou un import Excel ; les départs libèrent leur poste',
        ],
        [
          'Planifier un déménagement',
          'Une deuxième feuille et une longue soirée',
          'Planifiez-le, il se fait pendant la nuit le jour choisi',
        ],
        [
          'Informer l’IT',
          'Un e-mail que quelqu’un oublie',
          'L’IT reçoit un e-mail à chaque changement',
        ],
      ],
    },
    sections: [
      {
        heading: 'Quand Excel suffit',
        paragraphs: [
          'Pour une douzaine de personnes sur un étage qui déménagent rarement, une liste suffit. Gardez-la à un endroit partagé et notez la date de chaque changement.',
        ],
      },
      {
        heading: 'Signes que le tableau ne suffit plus',
        paragraphs: [
          'Si au moins deux de ces points vous parlent, un outil de plan de places vous fait gagner du temps :',
        ],
        bullets: [
          'Vous ne savez pas quelle version du fichier est la bonne.',
          'De nouvelles personnes arrivent et personne ne sait quel poste est libre.',
          'Les RH, l’IT et le facility tiennent chacun leur liste.',
          'Vous ne pouvez pas dire qui occupait un poste il y a trois mois.',
          'Un déménagement d’équipe demande des jours de planification.',
        ],
      },
      {
        heading: 'Passer d’Excel à Seatline',
        paragraphs: [
          'Importez votre liste telle quelle : Seatline lit les fichiers Excel et CSV avec des titres de colonnes en français, en allemand ou en anglais. Dessinez ensuite vos étages (ou partez d’un bureau d’exemple) et glissez les personnes sur leur poste. La plupart des bureaux sont prêts en un après-midi.',
          'Seatline coûte CHF 2 par poste et par mois, les 30 premiers jours sont gratuits et vos données restent en Suisse.',
        ],
      },
    ],
  },
  switzerland: {
    slug: 'logiciel-gestion-postes-de-travail-suisse',
    title: 'Logiciel de plan de places pour les entreprises suisses',
    description:
      'Ce qu’il faut vérifier pour un logiciel de plan de places ou de gestion des postes en Suisse : lieu des données, nLPD, langues et Microsoft 365.',
    intro:
      'Un plan de places contient des données personnelles : qui est assis où, depuis quand et dans quelle équipe. Pour une entreprise suisse, quelques questions se posent avant de choisir un outil.',
    table: {
      columns: ['Seatline'],
      rows: [
        ['Où sont les données ?', 'En Suisse (Microsoft Azure, Zurich)'],
        [
          'Protection des données',
          'Conçu pour la nLPD suisse et le RGPD ; historique gardé aussi longtemps que vous le décidez',
        ],
        ['Contrat de sous-traitance', 'Oui, en ligne et signé sur demande'],
        ['Langues', 'Français, allemand et anglais, pour chaque personne'],
        ['Connexion', 'Microsoft 365 (Entra ID) ou un lien par e-mail'],
        ['Prix', 'CHF 2 par poste et par mois, en francs suisses'],
      ],
    },
    sections: [
      {
        heading: 'Des données en Suisse',
        paragraphs: [
          'Selon la loi suisse sur la protection des données (nLPD), l’historique des places est une donnée personnelle. Seatline le stocke uniquement en Suisse, dans la région de Zurich de Microsoft Azure, sauvegardes et journaux compris. Vous décidez combien de temps garder les anciennes places (1, 2, 5 ou 10 ans), et les personnes parties peuvent être anonymisées.',
        ],
      },
      {
        heading: 'Trois langues, un plan',
        paragraphs: [
          'Chacun utilise Seatline dans sa langue : français, allemand ou anglais. Les e-mails à l’IT et au personnel suivent le même choix.',
        ],
      },
      {
        heading: 'Avec Microsoft 365 – ou sans',
        paragraphs: [
          'Avec Microsoft 365, chacun se connecte avec son compte professionnel et les noms et services sont mis à jour chaque nuit. Seatline fonctionne aussi comme onglet dans Teams et Outlook. Sans Microsoft 365, les personnes se connectent avec un lien par e-mail et vous les importez depuis Excel.',
        ],
      },
      {
        heading: 'Des places attribuées, pas de réservation',
        paragraphs: [
          'Seatline est fait pour les bureaux où chacun a son poste : attribuer les postes, planifier les déménagements et garder l’historique. Si chacun réserve un poste différent chaque jour, un outil de réservation convient mieux.',
        ],
      },
    ],
  },
  booking: {
    slug: 'plan-de-places-ou-reservation-de-postes',
    title: 'Plan de places ou réservation de postes : de quoi votre bureau a-t-il besoin ?',
    description:
      'Postes fixes ou desk sharing ? La différence entre un outil de plan de places et un outil de réservation, et comment choisir.',
    intro:
      'Les outils de réservation sont faits pour le desk sharing : on réserve un poste pour une journée. Beaucoup de bureaux donnent pourtant un poste à chacun, ou mélangent les deux. Il leur faut un autre outil : un plan de places.',
    table: {
      columns: ['Outil de réservation', 'Plan de places (Seatline)'],
      rows: [
        [
          'Question principale',
          'Quel poste est libre demain ?',
          'Qui est assis où, et depuis quand ?',
        ],
        ['Bureau typique', 'Tout le monde partage les postes', 'Chacun a son poste'],
        [
          'Effort quotidien',
          'Tout le monde réserve, chaque jour',
          'Personne ne réserve ; les postes changent lors des déménagements',
        ],
        ['Historique', 'Les réservations', 'Chaque attribution et déménagement, avec les dates'],
        ['Déménagements', 'Pas prévu', 'Planifier les déménagements d’équipe, faits le jour J'],
        [
          'IT et facility',
          'Rapports d’utilisation',
          'Un e-mail à chaque arrivée, départ ou déménagement',
        ],
      ],
    },
    sections: [
      {
        heading: 'Quand un plan de places convient',
        paragraphs: [
          'Si la plupart des gens viennent presque tous les jours et s’assoient au même poste, réserver ajoute du travail quotidien pour rien. Un plan de places répond à ce qui compte : qui est où, quels postes sont libres pour les nouveaux et comment déménager une équipe.',
        ],
      },
      {
        heading: 'Bureaux mixtes',
        paragraphs: [
          'Beaucoup de bureaux ont des postes fixes et quelques postes partagés. Dans Seatline, vous réservez un poste pour un visiteur ou une future collègue, bloquez les postes inutilisés et trouvez les postes libres avec ce qu’il faut (bureau debout, deux écrans, près de la fenêtre).',
        ],
      },
      {
        heading: 'Essayez avec vos propres étages',
        paragraphs: [
          'Ouvrez le bureau de démonstration sans inscription, ou commencez l’essai gratuit de 30 jours et importez vos personnes depuis Excel ou Microsoft 365.',
        ],
      },
    ],
  },
};

export const GUIDE_TEXT: Record<Language, Record<Guide, GuideText>> = { en: EN, de: DE, fr: FR };

/** The guide and language behind an address. */
export function guideBySlug(slug: string): { guide: Guide; language: Language } | undefined {
  for (const language of ['en', 'de', 'fr'] as const)
    for (const guide of GUIDES)
      if (GUIDE_TEXT[language][guide].slug === slug) return { guide, language };
  return undefined;
}

export const guidePath = (guide: Guide, language: Language) =>
  `/guides/${GUIDE_TEXT[language][guide].slug}`;

/** hreflang alternates of a guide (English is the default). */
export function guideAlternates(base: string, guide: Guide) {
  return {
    en: `${base}${guidePath(guide, 'en')}`,
    de: `${base}${guidePath(guide, 'de')}`,
    fr: `${base}${guidePath(guide, 'fr')}`,
    'x-default': `${base}${guidePath(guide, 'en')}`,
  };
}
