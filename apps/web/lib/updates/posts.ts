import type { HelpImage, HelpTopicId } from '../help/types';
import type { Language } from '../locales';

/** A picture: a help screenshot (public/help-img) or one of the updates' own (public/updates-img). */
export type UpdateImage = { help: HelpImage } | { own: 'price-calculator' | 'desk-booking' };

export interface UpdateText {
  title: string;
  /** one or two sentences: what changed and why it helps */
  summary: string;
  /** the changes, one short line each */
  points: string[];
  /** describes the picture for people who can't see it */
  alt: string;
}

export interface UpdatePost {
  /** the post's anchor: /updates/<language>#<slug> */
  slug: string;
  /** YYYY-MM-DD, the day it went live */
  date: string;
  image: UpdateImage;
  /** a help topic to read more */
  topic?: HelpTopicId;
  text: Record<Language, UpdateText>;
}

/**
 * What's new in Seatline, newest first. Add a post with every change customers notice (same
 * points in all three languages; lib/updates/updates.test.ts checks).
 */
export const POSTS: UpdatePost[] = [
  {
    slug: 'desk-booking',
    date: '2026-10-27',
    image: { own: 'desk-booking' },
    topic: 'seating',
    text: {
      en: {
        title: 'Shared desks you book by the day',
        summary:
          'Hybrid offices can now mix fixed and shared desks. Make a desk shared, and everyone books it for a day on the map.',
        points: [
          'Turn on Shared desk in Edit layout; shared desks have a dotted inner line on the map.',
          'Pick the day above the map (up to 4 weeks ahead) and book a green desk in one click, viewers too.',
          'One desk per person per day; cancelling and Undo work like everywhere else.',
          'Editors and admins can book for someone else; people who leave give their coming bookings back.',
          'Your bookings show on Home under My seat; every booking is in the Activity log.',
        ],
        alt: 'The map with a shared desk booked for today and the booking on the right.',
      },
      de: {
        title: 'Geteilte Plätze, tageweise gebucht',
        summary:
          'Hybride Büros können jetzt feste und geteilte Plätze mischen. Machen Sie einen Platz zum geteilten Platz, und alle buchen ihn für einen Tag auf der Karte.',
        points: [
          'Unter Plan bearbeiten Geteilter Platz einschalten; geteilte Plätze haben auf der Karte eine gepunktete Linie innen.',
          'Über der Karte den Tag wählen (bis 4 Wochen im Voraus) und einen grünen Platz mit einem Klick buchen, auch als Betrachter.',
          'Ein Platz pro Person und Tag; Stornieren und Rückgängig funktionieren wie überall.',
          'Bearbeiter und Admins können für andere buchen; wer austritt, gibt seine kommenden Buchungen zurück.',
          'Ihre Buchungen sehen Sie auf der Startseite unter Mein Platz; jede Buchung steht in der Aktivität.',
        ],
        alt: 'Die Karte mit einem für heute gebuchten geteilten Platz und der Buchung rechts.',
      },
      fr: {
        title: 'Des postes partagés réservés à la journée',
        summary:
          'Les bureaux hybrides peuvent désormais mêler postes fixes et postes partagés. Rendez un poste partagé, et chacun le réserve pour une journée sur le plan.',
        points: [
          'Activez Poste partagé dans Modifier le plan ; les postes partagés ont une ligne pointillée intérieure sur le plan.',
          'Choisissez le jour au-dessus du plan (jusqu’à 4 semaines à l’avance) et réservez un poste vert en un clic, lecteurs compris.',
          'Un poste par personne et par jour ; annuler une réservation ou revenir en arrière fonctionne comme partout.',
          'Les éditeurs et admins peuvent réserver pour quelqu’un d’autre ; les personnes qui partent rendent leurs réservations à venir.',
          'Vos réservations apparaissent sur l’Accueil sous Ma place ; chaque réservation figure dans l’Activité.',
        ],
        alt: 'Le plan avec un poste partagé réservé pour aujourd’hui et la réservation à droite.',
      },
    },
  },
  {
    slug: 'volume-price',
    date: '2026-10-27',
    image: { own: 'price-calculator' },
    topic: 'privacy-and-billing',
    text: {
      en: {
        title: 'Lower price for larger offices',
        summary:
          'Every desk from the 51st now costs CHF 0.99 instead of CHF 2 per month. A price calculator on the website shows what your office would pay.',
        points: [
          'The first 50 desks cost CHF 2 each per month, every further desk CHF 0.99.',
          'One more desk never makes the bill smaller: 100 desks cost CHF 149.50 a month.',
          'Existing subscriptions move to the new price automatically; the bill can only go down.',
          'The Billing page shows both prices and your estimate.',
        ],
        alt: 'The price calculator: 99 desks cost CHF 148.51 per month, split into 50 desks at CHF 2 and 49 at CHF 0.99.',
      },
      de: {
        title: 'Günstiger für grössere Büros',
        summary:
          'Jeder Platz ab dem 51. kostet neu CHF 0.99 statt CHF 2 pro Monat. Ein Preisrechner auf der Website zeigt, was Ihr Büro bezahlen würde.',
        points: [
          'Die ersten 50 Plätze kosten je CHF 2 pro Monat, jeder weitere Platz CHF 0.99.',
          'Ein Platz mehr macht die Rechnung nie kleiner: 100 Plätze kosten CHF 149.50 pro Monat.',
          'Bestehende Abos werden automatisch umgestellt; die Rechnung kann nur sinken.',
          'Die Seite «Abrechnung» zeigt beide Preise und Ihre Schätzung.',
        ],
        alt: 'Der Preisrechner: 99 Plätze kosten CHF 148.51 pro Monat, aufgeteilt in 50 Plätze zu CHF 2 und 49 zu CHF 0.99.',
      },
      fr: {
        title: 'Moins cher pour les grands bureaux',
        summary:
          'Chaque poste dès le 51e coûte désormais CHF 0.99 au lieu de CHF 2 par mois. Un calculateur sur le site montre ce que votre bureau paierait.',
        points: [
          'Les 50 premiers postes coûtent CHF 2 chacun par mois, chaque poste suivant CHF 0.99.',
          'Un poste de plus ne rend jamais la facture plus petite : 100 postes coûtent CHF 149.50 par mois.',
          'Les abonnements existants passent automatiquement au nouveau prix ; la facture ne peut que baisser.',
          'La page « Facturation » montre les deux prix et votre estimation.',
        ],
        alt: 'Le calculateur de prix : 99 postes coûtent CHF 148.51 par mois, soit 50 postes à CHF 2 et 49 à CHF 0.99.',
      },
    },
  },
  {
    slug: 'sign-in-code',
    date: '2026-10-25',
    image: { help: 'desk-phone' },
    topic: 'microsoft-365',
    text: {
      en: {
        title: 'Sign in with a code, and a whole company at once',
        summary:
          'The sign-in e-mail now also has a 6-digit code, so Seatline on the iPhone home screen stays signed in. Large companies can join all at once.',
        points: [
          'Type the 6-digit code from the e-mail instead of opening the link: handy in an app on the home screen.',
          'Signing out ends that sign-in everywhere, also in copies on other devices.',
          'Thousands of people can arrive from Microsoft 365 at the same time, even while colleagues sign in.',
          'New help page for IT: what Seatline asks Microsoft for, how to approve it once for everyone, and how to remove it.',
          'Moving around large floors is smoother.',
        ],
        alt: 'Seatline on a phone: a desk’s own page.',
      },
      de: {
        title: 'Anmelden mit Code, und eine ganze Firma auf einmal',
        summary:
          'Die Anmelde-E-Mail enthält neu auch einen 6-stelligen Code, damit Seatline auf dem iPhone-Homescreen angemeldet bleibt. Grosse Firmen können auf einmal dazukommen.',
        points: [
          'Den 6-stelligen Code aus der E-Mail eintippen statt den Link öffnen: praktisch in der App auf dem Homescreen.',
          'Abmelden beendet diese Anmeldung überall, auch in Kopien auf anderen Geräten.',
          'Tausende Personen können gleichzeitig aus Microsoft 365 dazukommen, auch während sich Kollegen anmelden.',
          'Neue Hilfeseite für die IT: was Seatline bei Microsoft anfragt, wie man es einmal für alle freigibt und wie man es wieder entfernt.',
          'Das Verschieben grosser Etagen läuft flüssiger.',
        ],
        alt: 'Seatline auf dem Handy: die eigene Seite eines Platzes.',
      },
      fr: {
        title: 'Se connecter avec un code, et toute une entreprise d’un coup',
        summary:
          'L’e-mail de connexion contient désormais aussi un code à 6 chiffres, pour que Seatline reste connecté sur l’écran d’accueil de l’iPhone. Les grandes entreprises peuvent arriver d’un coup.',
        points: [
          'Saisissez le code à 6 chiffres de l’e-mail au lieu d’ouvrir le lien : pratique dans l’app sur l’écran d’accueil.',
          'Se déconnecter met fin à cette connexion partout, aussi dans les copies sur d’autres appareils.',
          'Des milliers de personnes peuvent arriver de Microsoft 365 en même temps, même pendant que des collègues se connectent.',
          'Nouvelle page d’aide pour l’IT : ce que Seatline demande à Microsoft, comment l’approuver une fois pour tous et comment le retirer.',
          'Le déplacement sur les grands étages est plus fluide.',
        ],
        alt: 'Seatline sur un téléphone : la page d’un poste.',
      },
    },
  },
  {
    slug: 'easier-start',
    date: '2026-10-24',
    image: { help: 'setup' },
    topic: 'getting-started',
    text: {
      en: {
        title: 'An easier start',
        summary:
          'New workspaces now start with a short setup: your building, a first floor with an example office, and how your people get in.',
        points: [
          'Setup in two steps, with example offices of 12, 33 or 74 desks.',
          'Three short tips on your first visit to the map.',
          'The Help button opens the help for the page you are on.',
          'A 9-minute video tour with chapters and German and French subtitles.',
          'A free Excel template for your seating plan, ready to import later.',
        ],
        alt: 'The setup page: building, first floor and the size of the example office.',
      },
      de: {
        title: 'Einfacher starten',
        summary:
          'Neue Arbeitsbereiche beginnen jetzt mit einer kurzen Einrichtung: Ihr Gebäude, eine erste Etage mit einem Beispielbüro und wie Ihre Leute hineinkommen.',
        points: [
          'Einrichtung in zwei Schritten, mit Beispielbüros mit 12, 33 oder 74 Plätzen.',
          'Drei kurze Tipps beim ersten Besuch der Karte.',
          'Die Hilfe-Schaltfläche öffnet die Hilfe zur Seite, auf der Sie gerade sind.',
          'Eine 9-minütige Videotour mit Kapiteln und deutschen und französischen Untertiteln.',
          'Eine kostenlose Excel-Vorlage für Ihren Sitzplan, später direkt importierbar.',
        ],
        alt: 'Die Einrichtungsseite: Gebäude, erste Etage und die Grösse des Beispielbüros.',
      },
      fr: {
        title: 'Un démarrage plus simple',
        summary:
          'Les nouveaux espaces commencent désormais par une courte configuration : votre bâtiment, un premier étage avec un bureau d’exemple et la façon dont vos collaborateurs arrivent.',
        points: [
          'Configuration en deux étapes, avec des bureaux d’exemple de 12, 33 ou 74 postes.',
          'Trois courts conseils lors de votre première visite du plan.',
          'Le bouton Aide ouvre l’aide de la page où vous êtes.',
          'Une visite vidéo de 9 minutes avec chapitres et sous-titres allemands et français.',
          'Un modèle Excel gratuit pour votre plan de places, à importer plus tard.',
        ],
        alt: 'La page de configuration : bâtiment, premier étage et taille du bureau d’exemple.',
      },
    },
  },
  {
    slug: 'help-center',
    date: '2026-10-23',
    image: { help: 'home' },
    topic: 'home-planning-activity',
    text: {
      en: {
        title: 'Help center, a calmer Home and 30-day sign-in',
        summary:
          'Every part of Seatline now has a help page with steps and screenshots, in English, German and French. Home and the main pages became simpler.',
        points: [
          'Help center with step-by-step guides and real screenshots.',
          'A shorter Home page; more widgets are one “Add widget” away.',
          'On phones, the pages sit in a tab bar at the bottom.',
          'A sign-in now lasts 30 days.',
          'Admins can e-mail themselves the data processing agreement as a PDF with their company’s name.',
        ],
        alt: 'The Home page with quick actions, upcoming moves and how full each floor is.',
      },
      de: {
        title: 'Hilfe-Center, ein ruhigeres Home und 30 Tage angemeldet',
        summary:
          'Jeder Teil von Seatline hat jetzt eine Hilfeseite mit Schritten und Screenshots, auf Deutsch, Französisch und Englisch. Home und die wichtigsten Seiten sind einfacher geworden.',
        points: [
          'Hilfe-Center mit Schritt-für-Schritt-Anleitungen und echten Screenshots.',
          'Eine kürzere Startseite; weitere Widgets sind einen Klick auf «Widget hinzufügen» entfernt.',
          'Auf dem Handy liegen die Seiten in einer Leiste unten.',
          'Eine Anmeldung gilt jetzt 30 Tage.',
          'Admins können sich den Auftragsverarbeitungsvertrag als PDF mit dem Namen ihrer Firma senden.',
        ],
        alt: 'Die Startseite mit Schnellaktionen, geplanten Umzügen und der Belegung jeder Etage.',
      },
      fr: {
        title: 'Centre d’aide, un Accueil plus calme et 30 jours de connexion',
        summary:
          'Chaque partie de Seatline a maintenant une page d’aide avec étapes et captures d’écran, en français, allemand et anglais. L’Accueil et les pages principales sont plus simples.',
        points: [
          'Centre d’aide avec guides pas à pas et vraies captures d’écran.',
          'Une page d’accueil plus courte ; d’autres widgets sont à un clic sur « Ajouter un widget ».',
          'Sur téléphone, les pages sont dans une barre en bas.',
          'Une connexion dure désormais 30 jours.',
          'Les admins peuvent s’envoyer l’accord de sous-traitance en PDF au nom de leur entreprise.',
        ],
        alt: 'La page d’accueil avec actions rapides, déménagements prévus et taux d’occupation de chaque étage.',
      },
    },
  },
  {
    slug: 'qr-stickers-demo',
    date: '2026-10-22',
    image: { help: 'qr' },
    topic: 'exports-and-qr',
    text: {
      en: {
        title: 'QR stickers for desks, and a demo office',
        summary:
          'Print a QR sticker for every desk: scanning it shows who sits there. Anyone can now try Seatline in a sample office without signing up.',
        points: [
          '12 stickers per A4 sheet, never cut across pages.',
          'A sticker opens the desk’s own page: place, person, features and history.',
          '“Try the demo” opens a sample office with two floors and 22 people.',
          'A data processing agreement that applies to every workspace.',
        ],
        alt: 'A sheet of desk QR stickers ready to print.',
      },
      de: {
        title: 'QR-Sticker für Plätze und ein Demo-Büro',
        summary:
          'Drucken Sie für jeden Platz einen QR-Sticker: Scannen zeigt, wer dort sitzt. Alle können Seatline jetzt ohne Anmeldung in einem Musterbüro ausprobieren.',
        points: [
          '12 Sticker pro A4-Blatt, nie über zwei Seiten verteilt.',
          'Ein Sticker öffnet die eigene Seite des Platzes: Ort, Person, Ausstattung und Verlauf.',
          '«Demo ausprobieren» öffnet ein Musterbüro mit zwei Etagen und 22 Personen.',
          'Ein Auftragsverarbeitungsvertrag, der für jeden Arbeitsbereich gilt.',
        ],
        alt: 'Ein Blatt mit QR-Stickern für Plätze, bereit zum Drucken.',
      },
      fr: {
        title: 'Autocollants QR pour les postes, et un bureau de démo',
        summary:
          'Imprimez un autocollant QR pour chaque poste : le scanner montre qui y est assis. Tout le monde peut maintenant essayer Seatline dans un bureau d’exemple, sans inscription.',
        points: [
          '12 autocollants par feuille A4, jamais coupés entre deux pages.',
          'Un autocollant ouvre la page du poste : lieu, personne, équipements et historique.',
          '« Essayer la démo » ouvre un bureau d’exemple avec deux étages et 22 personnes.',
          'Un accord de sous-traitance qui s’applique à chaque espace.',
        ],
        alt: 'Une feuille d’autocollants QR pour les postes, prête à imprimer.',
      },
    },
  },
  {
    slug: 'space-planning',
    date: '2026-10-22',
    image: { help: 'planning' },
    topic: 'home-planning-activity',
    text: {
      en: {
        title: 'Space planning',
        summary:
          'See whether your desks are enough for next year: enter how many people each team expects, and Seatline shows how many desks are short.',
        points: [
          'Per team: people today, seated, expected and desks needed.',
          'Desks in each team’s zone and free desks overall.',
          'Growth and the number of missing desks at a glance.',
        ],
        alt: 'The Planning page with teams, expected headcount and desks needed.',
      },
      de: {
        title: 'Flächenplanung',
        summary:
          'Sehen Sie, ob Ihre Plätze nächstes Jahr reichen: Geben Sie ein, wie viele Personen jedes Team erwartet, und Seatline zeigt, wie viele Plätze fehlen.',
        points: [
          'Pro Team: Personen heute, platziert, erwartet und benötigte Plätze.',
          'Plätze in der Zone jedes Teams und freie Plätze insgesamt.',
          'Wachstum und fehlende Plätze auf einen Blick.',
        ],
        alt: 'Die Planungsseite mit Teams, erwarteter Anzahl Personen und benötigten Plätzen.',
      },
      fr: {
        title: 'Planification des espaces',
        summary:
          'Voyez si vos postes suffiront l’an prochain : indiquez combien de personnes chaque équipe attend, et Seatline montre combien de postes manquent.',
        points: [
          'Par équipe : personnes aujourd’hui, placées, attendues et postes nécessaires.',
          'Postes dans la zone de chaque équipe et postes libres au total.',
          'La croissance et le nombre de postes manquants d’un coup d’œil.',
        ],
        alt: 'La page Planification avec les équipes, l’effectif attendu et les postes nécessaires.',
      },
    },
  },
  {
    slug: 'rich-floors',
    date: '2026-10-22',
    image: { help: 'edit-example' },
    topic: 'editor',
    text: {
      en: {
        title: 'Meeting rooms, team zones and desk features',
        summary:
          'Floor plans now show more than desks: meeting rooms with their equipment, a coloured zone per team, desk features and markers like the kitchen or exits.',
        points: [
          'Meeting rooms with capacity and equipment.',
          'Team zones, tinted in the team’s colour.',
          'Desk features such as standing desk, two screens or docking station, and “Find a desk” to filter by them.',
          'Markers for kitchen, printer, exits, first aid and more.',
        ],
        alt: 'The layout editor with an example office: open space, meeting rooms, an office and markers for reception, printer and kitchen.',
      },
      de: {
        title: 'Sitzungszimmer, Teamzonen und Platzausstattung',
        summary:
          'Grundrisse zeigen jetzt mehr als Plätze: Sitzungszimmer mit Ausstattung, eine farbige Zone pro Team, die Ausstattung der Plätze und Markierungen wie Küche oder Notausgänge.',
        points: [
          'Sitzungszimmer mit Kapazität und Ausstattung.',
          'Teamzonen in der Farbe des Teams.',
          'Platzausstattung wie Stehpult, zwei Bildschirme oder Dockingstation, und «Platz finden» zum Filtern.',
          'Markierungen für Küche, Drucker, Notausgänge, Erste Hilfe und mehr.',
        ],
        alt: 'Der Grundriss-Editor mit einem Beispielbüro: Grossraum, Sitzungszimmer, ein Büro und Markierungen für Empfang, Drucker und Küche.',
      },
      fr: {
        title: 'Salles de réunion, zones d’équipe et équipements des postes',
        summary:
          'Les plans montrent désormais plus que des postes : salles de réunion avec leur équipement, une zone colorée par équipe, les équipements des postes et des repères comme la cuisine ou les sorties.',
        points: [
          'Salles de réunion avec capacité et équipement.',
          'Zones d’équipe, teintées de la couleur de l’équipe.',
          'Équipements des postes comme bureau assis-debout, deux écrans ou station d’accueil, et « Trouver un poste » pour filtrer.',
          'Repères pour cuisine, imprimante, sorties, premiers secours et plus.',
        ],
        alt: 'L’éditeur de plan avec un bureau d’exemple : open space, salles de réunion, un bureau et des repères pour la réception, l’imprimante et la cuisine.',
      },
    },
  },
  {
    slug: 'people-and-teams',
    date: '2026-10-22',
    image: { help: 'changes' },
    topic: 'teams-and-changes',
    text: {
      en: {
        title: 'Teams, HR changes and notices to IT',
        summary:
          'People & access has tabs for people, teams, HR changes and settings. IT can get a short e-mail whenever someone joins, leaves, changes team or moves.',
        points: [
          'Change team, role or leaving date for many people at once.',
          'Leavers lose their desk on their leaving date; their history stays.',
          'Import people from Excel or CSV, or add them by hand.',
          'Companies without Microsoft 365 sign in with a link by e-mail.',
          'People get a short “your new desk” e-mail when they move.',
        ],
        alt: 'The Changes tab: team, role and leaving date for several people.',
      },
      de: {
        title: 'Teams, HR-Änderungen und Meldungen an die IT',
        summary:
          'Personen & Zugang hat Tabs für Personen, Teams, HR-Änderungen und Einstellungen. Die IT kann eine kurze E-Mail erhalten, wenn jemand kommt, geht, das Team wechselt oder umzieht.',
        points: [
          'Team, Rolle oder Austrittsdatum für viele Personen auf einmal ändern.',
          'Wer austritt, verliert am Austrittsdatum den Platz; der Verlauf bleibt.',
          'Personen aus Excel oder CSV importieren oder von Hand erfassen.',
          'Firmen ohne Microsoft 365 melden sich mit einem Link per E-Mail an.',
          'Wer umzieht, erhält eine kurze E-Mail «Ihr neuer Platz».',
        ],
        alt: 'Der Tab Änderungen: Team, Rolle und Austrittsdatum für mehrere Personen.',
      },
      fr: {
        title: 'Équipes, changements RH et avis à l’IT',
        summary:
          'Personnes et accès a des onglets pour les personnes, les équipes, les changements RH et les réglages. L’IT peut recevoir un court e-mail quand quelqu’un arrive, part, change d’équipe ou déménage.',
        points: [
          'Changez l’équipe, le rôle ou la date de départ de plusieurs personnes à la fois.',
          'Les personnes qui partent perdent leur poste à la date de départ ; l’historique reste.',
          'Importez les personnes depuis Excel ou CSV, ou ajoutez-les à la main.',
          'Les entreprises sans Microsoft 365 se connectent avec un lien par e-mail.',
          'Les personnes reçoivent un court e-mail « votre nouveau poste » quand elles déménagent.',
        ],
        alt: 'L’onglet Changements : équipe, rôle et date de départ pour plusieurs personnes.',
      },
    },
  },
  {
    slug: 'move-plans',
    date: '2026-10-22',
    image: { help: 'move-plan' },
    topic: 'moves',
    text: {
      en: {
        title: 'Planned moves with a moving list',
        summary:
          'Plan who moves where on the map, apply it now or schedule it for a night, and print a list for the movers.',
        points: [
          'Plan moves for one person or a whole team on the map.',
          'Seatline checks the plan first: taken, blocked or double-booked desks are flagged.',
          'Scheduled plans are carried out overnight; the history keeps every move.',
          'A printable moving list sorted by starting place, with tick boxes and signature lines.',
        ],
        alt: 'A move plan: who moves where, and the buttons to apply or schedule it.',
      },
      de: {
        title: 'Geplante Umzüge mit Zügelliste',
        summary:
          'Planen Sie auf der Karte, wer wohin zieht, führen Sie es sofort aus oder planen Sie es für eine Nacht, und drucken Sie eine Liste für die Zügelfirma.',
        points: [
          'Umzüge für eine Person oder ein ganzes Team auf der Karte planen.',
          'Seatline prüft den Plan zuerst: besetzte, gesperrte oder doppelt vergebene Plätze werden markiert.',
          'Geplante Umzüge werden über Nacht ausgeführt; der Verlauf behält jeden Umzug.',
          'Eine druckbare Zügelliste, sortiert nach Ausgangsort, mit Häkchen und Unterschriftszeilen.',
        ],
        alt: 'Ein Umzugsplan: wer wohin zieht, und die Schaltflächen zum Ausführen oder Planen.',
      },
      fr: {
        title: 'Déménagements planifiés avec liste pour les déménageurs',
        summary:
          'Planifiez sur le plan qui va où, appliquez-le tout de suite ou programmez-le pour une nuit, et imprimez une liste pour les déménageurs.',
        points: [
          'Planifiez les déménagements d’une personne ou de toute une équipe sur le plan.',
          'Seatline vérifie d’abord le plan : postes occupés, bloqués ou attribués deux fois sont signalés.',
          'Les plans programmés sont appliqués pendant la nuit ; l’historique garde chaque déménagement.',
          'Une liste imprimable triée par lieu de départ, avec cases à cocher et lignes de signature.',
        ],
        alt: 'Un plan de déménagement : qui va où, et les boutons pour l’appliquer ou le programmer.',
      },
    },
  },
];
