import type { Language } from '@/lib/locales';
import { OPERATOR } from './operator';

/**
 * Terms of service and privacy policy in German, French and English.
 * Plain words on purpose; have a Swiss lawyer review them before selling (docs/legal.md).
 * {name} {address} {email} are filled in from OPERATOR.
 */
export const LEGAL_DOCS = ['terms', 'privacy'] as const;
export type LegalDoc = (typeof LEGAL_DOCS)[number];

export interface LegalSection {
  heading: string;
  paragraphs: string[];
}

type Texts = Record<LegalDoc, Record<Language, LegalSection[]>>;

const TEXTS: Texts = {
  terms: {
    en: [
      {
        heading: '1. Who we are and what these terms cover',
        paragraphs: [
          'Seatline is run by {name}, {address} (“we”). These terms apply between us and the company or organisation that creates a Seatline workspace (“customer”). Seatline is for businesses only, not for consumers.',
          'The person who creates the workspace confirms that they may accept these terms for their organisation.',
        ],
      },
      {
        heading: '2. The service',
        paragraphs: [
          'Seatline is web software for managing office seating: floor plans, seat assignments, reservations, planned moves, history, dashboards and exports. People sign in with their Microsoft 365 work account.',
          'We keep improving Seatline and may change features, as long as the main purpose stays the same. We tell admins about important changes in advance.',
        ],
      },
      {
        heading: '3. Free trial',
        paragraphs: [
          'Every new workspace can use Seatline free of charge for 30 days, with no payment details needed. After the trial the workspace becomes read-only until an admin subscribes: everything stays visible, nothing is deleted, but changes are no longer possible.',
        ],
      },
      {
        heading: '4. Prices and payment',
        paragraphs: [
          'The price is per active seat per month, as shown on our website and on the Billing page when subscribing. Blocked seats are not counted. The number of seats is updated automatically each night; changes during a month are charged or credited pro rata.',
          'Payment is made in advance each month by card or other methods offered by our payment provider Stripe. Prices are in Swiss francs. If we become subject to VAT, it will be added at the legal rate.',
          'We may change prices with at least 30 days’ notice by e-mail to the workspace admins. The new price applies from the next billing period; you may cancel before then.',
          'If a payment fails and is not settled after reminders, the workspace becomes read-only until it is paid.',
        ],
      },
      {
        heading: '5. Term and cancellation',
        paragraphs: [
          'The subscription runs month by month. Admins can cancel at any time on the Billing page; it ends at the end of the paid month. Already paid fees are not refunded.',
          'We may end the contract with 30 days’ notice, or immediately for serious breaches (for example misuse, attacks on the service or unpaid fees after reminders).',
          'Before and up to 30 days after the end, admins can export their data (Excel/CSV/PDF). After that we delete the workspace as described in the privacy policy.',
        ],
      },
      {
        heading: '6. Your data and data processing',
        paragraphs: [
          'The customer owns all data in its workspace and decides which people and data are processed. For personal data of its employees the customer is the controller; we process it only on its behalf and on its instructions (processor under art. 9 of the Swiss FADP and, where applicable, art. 28 GDPR).',
          'We process customer data only to provide Seatline, keep it confidential, store it in Switzerland (Microsoft Azure, region Switzerland North), protect it with appropriate technical and organisational measures, and only use the sub-processors listed in the privacy policy. We inform the customer of new sub-processors in advance; the customer may object and cancel.',
          'We help the customer answer requests from employees (access, correction, deletion — Seatline has built-in tools for this), report data breaches without undue delay, and delete or return all customer data at the end of the contract.',
          'The customer makes sure it may use its employees’ data for seat management (for example by informing them) and that its Microsoft 365 admin approves the access Seatline asks for.',
        ],
      },
      {
        heading: '7. Your responsibilities',
        paragraphs: [
          'The customer decides who gets access and with which role, keeps its Microsoft accounts secure, and uses Seatline lawfully. It must not attack, overload, copy or resell the service.',
        ],
      },
      {
        heading: '8. Availability and support',
        paragraphs: [
          'We aim for high availability but cannot promise uninterrupted service. Maintenance is done at quiet times where possible. Support is by e-mail at {email}, usually on Swiss working days.',
        ],
      },
      {
        heading: '9. Liability',
        paragraphs: [
          'We are liable for damage caused intentionally or through gross negligence. Otherwise, as far as the law allows, our liability is excluded, and in any case limited to the fees the customer paid in the 12 months before the event. We are not liable for indirect damage, lost profit or lost data that could have been avoided by regular exports.',
        ],
      },
      {
        heading: '10. Changes to these terms',
        paragraphs: [
          'We may update these terms. We inform the workspace admins at least 30 days before important changes take effect. If the customer does not agree, it can cancel before then.',
        ],
      },
      {
        heading: '11. Law and place of jurisdiction',
        paragraphs: [
          'Swiss law applies, excluding the UN Convention on Contracts for the International Sale of Goods. The place of jurisdiction is our registered office.',
        ],
      },
    ],
    de: [
      {
        heading: '1. Wer wir sind und wofür diese Bedingungen gelten',
        paragraphs: [
          'Seatline wird von {name}, {address} betrieben («wir»). Diese Bedingungen gelten zwischen uns und dem Unternehmen oder der Organisation, die einen Seatline-Arbeitsbereich erstellt («Kunde»). Seatline richtet sich nur an Unternehmen, nicht an Konsumentinnen und Konsumenten.',
          'Wer den Arbeitsbereich erstellt, bestätigt, diese Bedingungen für seine Organisation annehmen zu dürfen.',
        ],
      },
      {
        heading: '2. Die Leistung',
        paragraphs: [
          'Seatline ist eine Web-Software für die Verwaltung von Büroarbeitsplätzen: Grundrisse, Platzzuweisungen, Reservationen, geplante Umzüge, Verlauf, Dashboards und Exporte. Die Anmeldung erfolgt mit dem Microsoft-365-Geschäftskonto.',
          'Wir entwickeln Seatline laufend weiter und dürfen Funktionen ändern, solange der Hauptzweck gleich bleibt. Über wichtige Änderungen informieren wir die Admins im Voraus.',
        ],
      },
      {
        heading: '3. Gratis-Testphase',
        paragraphs: [
          'Jeder neue Arbeitsbereich kann Seatline 30 Tage lang kostenlos nutzen, ohne Zahlungsangaben. Nach der Testphase ist der Arbeitsbereich schreibgeschützt, bis ein Admin ein Abo abschliesst: Alles bleibt sichtbar, nichts wird gelöscht, aber Änderungen sind nicht mehr möglich.',
        ],
      },
      {
        heading: '4. Preise und Zahlung',
        paragraphs: [
          'Der Preis gilt pro aktivem Arbeitsplatz und Monat, wie auf unserer Website und beim Abschluss auf der Seite «Abrechnung» angegeben. Gesperrte Plätze werden nicht gezählt. Die Anzahl Plätze wird jede Nacht automatisch nachgeführt; Änderungen während eines Monats werden anteilig belastet oder gutgeschrieben.',
          'Die Zahlung erfolgt monatlich im Voraus per Karte oder über andere Zahlungsarten unseres Zahlungsanbieters Stripe. Die Preise verstehen sich in Schweizer Franken. Werden wir mehrwertsteuerpflichtig, kommt die MWST zum gesetzlichen Satz hinzu.',
          'Wir können die Preise mit mindestens 30 Tagen Vorlauf per E-Mail an die Admins ändern. Der neue Preis gilt ab der nächsten Abrechnungsperiode; Sie können vorher kündigen.',
          'Bleibt eine Zahlung trotz Mahnung aus, wird der Arbeitsbereich bis zur Zahlung schreibgeschützt.',
        ],
      },
      {
        heading: '5. Laufzeit und Kündigung',
        paragraphs: [
          'Das Abo läuft monatlich. Admins können es jederzeit auf der Seite «Abrechnung» kündigen; es endet mit dem bezahlten Monat. Bereits bezahlte Gebühren werden nicht zurückerstattet.',
          'Wir können den Vertrag mit 30 Tagen Frist kündigen, bei schweren Verstössen (z. B. Missbrauch, Angriffe auf den Dienst oder trotz Mahnung unbezahlte Gebühren) auch fristlos.',
          'Bis 30 Tage nach Vertragsende können Admins ihre Daten exportieren (Excel/CSV/PDF). Danach löschen wir den Arbeitsbereich wie in der Datenschutzerklärung beschrieben.',
        ],
      },
      {
        heading: '6. Ihre Daten und Auftragsbearbeitung',
        paragraphs: [
          'Alle Daten im Arbeitsbereich gehören dem Kunden; er entscheidet, welche Personen und Daten bearbeitet werden. Für Personendaten seiner Mitarbeitenden ist der Kunde verantwortlich; wir bearbeiten sie nur in seinem Auftrag und nach seinen Weisungen (Auftragsbearbeitung nach Art. 9 DSG und, soweit anwendbar, Art. 28 DSGVO).',
          'Wir bearbeiten Kundendaten nur, um Seatline zu erbringen, behandeln sie vertraulich, speichern sie in der Schweiz (Microsoft Azure, Region Switzerland North), schützen sie mit angemessenen technischen und organisatorischen Massnahmen und setzen nur die in der Datenschutzerklärung genannten Unterauftragsbearbeiter ein. Über neue Unterauftragsbearbeiter informieren wir im Voraus; der Kunde kann widersprechen und kündigen.',
          'Wir unterstützen den Kunden bei Anfragen von Mitarbeitenden (Auskunft, Berichtigung, Löschung — Seatline hat dafür eingebaute Werkzeuge), melden Datensicherheitsverletzungen unverzüglich und löschen oder übergeben alle Kundendaten bei Vertragsende.',
          'Der Kunde stellt sicher, dass er die Daten seiner Mitarbeitenden für die Arbeitsplatzverwaltung nutzen darf (z. B. indem er sie informiert) und dass sein Microsoft-365-Admin den von Seatline verlangten Zugriff genehmigt.',
        ],
      },
      {
        heading: '7. Ihre Pflichten',
        paragraphs: [
          'Der Kunde entscheidet, wer mit welcher Rolle Zugriff erhält, schützt seine Microsoft-Konten und nutzt Seatline rechtmässig. Er darf den Dienst nicht angreifen, überlasten, kopieren oder weiterverkaufen.',
        ],
      },
      {
        heading: '8. Verfügbarkeit und Support',
        paragraphs: [
          'Wir streben eine hohe Verfügbarkeit an, können aber keinen unterbruchsfreien Betrieb garantieren. Wartungen erfolgen wenn möglich zu ruhigen Zeiten. Support gibt es per E-Mail an {email}, in der Regel an Schweizer Werktagen.',
        ],
      },
      {
        heading: '9. Haftung',
        paragraphs: [
          'Wir haften für absichtlich oder grobfahrlässig verursachte Schäden. Im Übrigen ist unsere Haftung, soweit gesetzlich zulässig, ausgeschlossen und in jedem Fall auf die vom Kunden in den 12 Monaten vor dem Ereignis bezahlten Gebühren begrenzt. Für indirekte Schäden, entgangenen Gewinn oder Datenverlust, der durch regelmässige Exporte vermeidbar gewesen wäre, haften wir nicht.',
        ],
      },
      {
        heading: '10. Änderungen dieser Bedingungen',
        paragraphs: [
          'Wir können diese Bedingungen anpassen. Über wichtige Änderungen informieren wir die Admins mindestens 30 Tage vor Inkrafttreten. Ist der Kunde nicht einverstanden, kann er vorher kündigen.',
        ],
      },
      {
        heading: '11. Anwendbares Recht und Gerichtsstand',
        paragraphs: [
          'Es gilt Schweizer Recht unter Ausschluss des Wiener Kaufrechts (CISG). Gerichtsstand ist unser Sitz.',
        ],
      },
    ],
    fr: [
      {
        heading: '1. Qui nous sommes et ce que couvrent ces conditions',
        paragraphs: [
          'Seatline est exploité par {name}, {address} («nous»). Ces conditions s’appliquent entre nous et l’entreprise ou l’organisation qui crée un espace de travail Seatline («client»). Seatline s’adresse uniquement aux entreprises, pas aux consommateurs.',
          'La personne qui crée l’espace de travail confirme qu’elle peut accepter ces conditions pour son organisation.',
        ],
      },
      {
        heading: '2. Le service',
        paragraphs: [
          'Seatline est un logiciel web de gestion des places de travail : plans d’étage, attributions de places, réservations, déménagements planifiés, historique, tableaux de bord et exports. La connexion se fait avec le compte professionnel Microsoft 365.',
          'Nous améliorons Seatline en continu et pouvons modifier des fonctions tant que l’objectif principal reste le même. Nous informons les admins à l’avance des changements importants.',
        ],
      },
      {
        heading: '3. Essai gratuit',
        paragraphs: [
          'Chaque nouvel espace de travail peut utiliser Seatline gratuitement pendant 30 jours, sans données de paiement. Après l’essai, l’espace passe en lecture seule jusqu’à ce qu’un admin souscrive un abonnement : tout reste visible, rien n’est supprimé, mais les modifications ne sont plus possibles.',
        ],
      },
      {
        heading: '4. Prix et paiement',
        paragraphs: [
          'Le prix s’entend par place active et par mois, comme indiqué sur notre site et sur la page «Facturation» lors de la souscription. Les places bloquées ne sont pas comptées. Le nombre de places est mis à jour automatiquement chaque nuit ; les changements en cours de mois sont facturés ou crédités au prorata.',
          'Le paiement se fait chaque mois à l’avance par carte ou par d’autres moyens proposés par notre prestataire de paiement Stripe. Les prix sont en francs suisses. Si nous devenons assujettis à la TVA, elle s’ajoute au taux légal.',
          'Nous pouvons modifier les prix avec un préavis d’au moins 30 jours par e-mail aux admins. Le nouveau prix s’applique dès la période de facturation suivante ; vous pouvez résilier avant.',
          'Si un paiement reste impayé malgré des rappels, l’espace de travail passe en lecture seule jusqu’au paiement.',
        ],
      },
      {
        heading: '5. Durée et résiliation',
        paragraphs: [
          'L’abonnement est mensuel. Les admins peuvent le résilier à tout moment sur la page «Facturation» ; il prend fin à l’échéance du mois payé. Les montants déjà payés ne sont pas remboursés.',
          'Nous pouvons résilier le contrat avec un préavis de 30 jours, ou avec effet immédiat en cas de manquement grave (par exemple abus, attaques contre le service ou montants impayés malgré des rappels).',
          'Jusqu’à 30 jours après la fin du contrat, les admins peuvent exporter leurs données (Excel/CSV/PDF). Ensuite, nous supprimons l’espace de travail comme décrit dans la politique de confidentialité.',
        ],
      },
      {
        heading: '6. Vos données et sous-traitance',
        paragraphs: [
          'Toutes les données de l’espace de travail appartiennent au client ; il décide quelles personnes et quelles données sont traitées. Pour les données personnelles de ses collaborateurs, le client est le responsable du traitement ; nous ne les traitons que pour son compte et selon ses instructions (sous-traitance au sens de l’art. 9 LPD et, le cas échéant, de l’art. 28 RGPD).',
          'Nous ne traitons les données du client que pour fournir Seatline, les traitons de manière confidentielle, les stockons en Suisse (Microsoft Azure, région Switzerland North), les protégeons par des mesures techniques et organisationnelles appropriées et ne faisons appel qu’aux sous-traitants cités dans la politique de confidentialité. Nous informons à l’avance de tout nouveau sous-traitant ; le client peut s’y opposer et résilier.',
          'Nous aidons le client à répondre aux demandes de ses collaborateurs (accès, rectification, effacement — Seatline dispose d’outils intégrés pour cela), signalons sans délai les violations de la sécurité des données et supprimons ou restituons toutes les données du client à la fin du contrat.',
          'Le client s’assure qu’il peut utiliser les données de ses collaborateurs pour la gestion des places (par exemple en les informant) et que son admin Microsoft 365 approuve l’accès demandé par Seatline.',
        ],
      },
      {
        heading: '7. Vos obligations',
        paragraphs: [
          'Le client décide qui obtient un accès et avec quel rôle, protège ses comptes Microsoft et utilise Seatline de manière licite. Il ne doit pas attaquer, surcharger, copier ou revendre le service.',
        ],
      },
      {
        heading: '8. Disponibilité et support',
        paragraphs: [
          'Nous visons une haute disponibilité, mais ne pouvons pas garantir un service sans interruption. Les maintenances ont lieu si possible à des heures calmes. Le support est assuré par e-mail à {email}, en général les jours ouvrables en Suisse.',
        ],
      },
      {
        heading: '9. Responsabilité',
        paragraphs: [
          'Nous répondons des dommages causés intentionnellement ou par négligence grave. Pour le reste, notre responsabilité est exclue dans la mesure permise par la loi et, en tout cas, limitée aux montants payés par le client durant les 12 mois précédant l’événement. Nous ne répondons pas des dommages indirects, du manque à gagner ni des pertes de données qui auraient pu être évitées par des exports réguliers.',
        ],
      },
      {
        heading: '10. Modification des conditions',
        paragraphs: [
          'Nous pouvons modifier ces conditions. Nous informons les admins au moins 30 jours avant l’entrée en vigueur de changements importants. Si le client n’est pas d’accord, il peut résilier avant.',
        ],
      },
      {
        heading: '11. Droit applicable et for',
        paragraphs: [
          'Le droit suisse s’applique, à l’exclusion de la Convention de Vienne sur la vente internationale de marchandises. Le for est à notre siège.',
        ],
      },
    ],
  },
  privacy: {
    en: [
      {
        heading: '1. Who is responsible',
        paragraphs: [
          '{name}, {address}, e-mail {email}, is responsible for this website and for the data Seatline processes for its own purposes (for example billing). We follow the Swiss Federal Act on Data Protection (FADP) and, where it applies, the EU General Data Protection Regulation (GDPR).',
        ],
      },
      {
        heading: '2. Your employer’s data — our role',
        paragraphs: [
          'When a company uses Seatline, it decides which data about its employees is processed (for example who sits where). For that data the company is responsible and we process it only on its behalf. If you are an employee with a question about your data, please contact your employer first; we support them in answering.',
        ],
      },
      {
        heading: '3. What we process',
        paragraphs: [
          'Website: we use no tracking, no analytics, no advertising and no third-party cookies. Our servers record technical logs (IP address, time, page, browser) for security and error analysis.',
          'Sign-in: from your Microsoft work account we receive your name, e-mail address and Microsoft user and organisation IDs. Your password never reaches us.',
          'People directory: if your company’s Microsoft 365 admin approves it, Seatline reads each employee’s name, e-mail, department, job title and whether the account is active, once a night. Nothing else.',
          'Seating: seats, floor plans, assignments, reservations, planned moves, and a history of who changed what and when.',
          'Billing: company name, billing e-mail, address and VAT number entered during checkout. Card and payment details are handled by Stripe only; we never see full card numbers.',
          'Error reports: if something breaks in your browser, the error message and the page address, with personal details removed.',
        ],
      },
      {
        heading: '4. Why',
        paragraphs: [
          'To provide Seatline and support, to keep it secure, to bill subscriptions and to meet legal duties. Under the GDPR the legal bases are the contract (art. 6(1)(b)), our legitimate interest in a secure and working service (art. 6(1)(f)) and legal obligations (art. 6(1)(c)). We do not sell data and do not use it for advertising.',
        ],
      },
      {
        heading: '5. Where your data is stored',
        paragraphs: [
          'All Seatline data, backups and logs are stored in Switzerland, in Microsoft Azure’s region Switzerland North (Zurich).',
          'Sign-in runs through Microsoft Entra ID, part of your company’s own Microsoft 365. Payments are processed by Stripe Payments Europe Ltd. (Ireland); Stripe may transfer data to the USA under recognised safeguards (Swiss–US and EU–US Data Privacy Framework, standard contractual clauses).',
        ],
      },
      {
        heading: '6. Service providers',
        paragraphs: [
          'Microsoft (hosting and sign-in, Switzerland), Stripe (payments, Ireland/USA), Hostpoint (domain and e-mail, Switzerland). They process data only as needed for their service and under contracts that protect it.',
        ],
      },
      {
        heading: '7. Cookies',
        paragraphs: [
          'Only cookies that are needed for Seatline to work: an encrypted sign-in cookie (ends when you sign out, at the latest after 10 hours), a short-lived cookie during Microsoft sign-in (a few minutes) and, if you choose a language, a language cookie (1 year). No consent banner is needed because nothing tracks you.',
        ],
      },
      {
        heading: '8. How long we keep data',
        paragraphs: [
          'Seat history: as long as your company sets (12 months to 10 years; 24 months unless changed). People who left are anonymised after that period.',
          'When a company stops using Seatline, we delete its workspace on request, and otherwise at the latest 6 months after the subscription or trial ended. Technical logs: 30 days. Billing records: 10 years, as Swiss law requires.',
        ],
      },
      {
        heading: '9. Security',
        paragraphs: [
          'Encrypted connections (HTTPS) and encrypted storage, strict separation between companies in the database, sign-in only through Microsoft, keys kept in a secured vault, and access limited to what is needed.',
        ],
      },
      {
        heading: '10. Your rights',
        paragraphs: [
          'You may ask what data we have about you, have it corrected or deleted, receive it in a common format and object to processing. Write to {email}. If you think we handle your data wrongly, you can complain to the Swiss Federal Data Protection and Information Commissioner (FDPIC) or to your EU data protection authority.',
        ],
      },
      {
        heading: '11. Changes',
        paragraphs: [
          'We update this policy when Seatline changes. The date at the top shows the current version.',
        ],
      },
    ],
    de: [
      {
        heading: '1. Verantwortlich',
        paragraphs: [
          '{name}, {address}, E-Mail {email}, ist verantwortlich für diese Website und für die Daten, die Seatline für eigene Zwecke bearbeitet (z. B. die Abrechnung). Wir halten uns an das Schweizer Datenschutzgesetz (DSG) und, soweit anwendbar, an die EU-Datenschutz-Grundverordnung (DSGVO).',
        ],
      },
      {
        heading: '2. Daten Ihres Arbeitgebers — unsere Rolle',
        paragraphs: [
          'Nutzt ein Unternehmen Seatline, entscheidet es, welche Daten über seine Mitarbeitenden bearbeitet werden (z. B. wer wo sitzt). Für diese Daten ist das Unternehmen verantwortlich; wir bearbeiten sie nur in seinem Auftrag. Haben Sie als Mitarbeiterin oder Mitarbeiter Fragen zu Ihren Daten, wenden Sie sich bitte zuerst an Ihren Arbeitgeber; wir unterstützen ihn bei der Antwort.',
        ],
      },
      {
        heading: '3. Welche Daten wir bearbeiten',
        paragraphs: [
          'Website: Wir verwenden kein Tracking, keine Analyse-Tools, keine Werbung und keine Cookies von Dritten. Unsere Server zeichnen technische Protokolle auf (IP-Adresse, Zeit, Seite, Browser), für Sicherheit und Fehleranalyse.',
          'Anmeldung: Von Ihrem Microsoft-Geschäftskonto erhalten wir Name, E-Mail-Adresse sowie Microsoft-Benutzer- und Organisations-ID. Ihr Passwort erreicht uns nie.',
          'Personenverzeichnis: Wenn der Microsoft-365-Admin Ihres Unternehmens zustimmt, liest Seatline einmal pro Nacht Name, E-Mail, Abteilung, Funktion und Kontostatus (aktiv oder nicht) der Mitarbeitenden. Sonst nichts.',
          'Arbeitsplätze: Plätze, Grundrisse, Zuweisungen, Reservationen, geplante Umzüge und ein Verlauf, wer wann was geändert hat.',
          'Abrechnung: Firmenname, Rechnungs-E-Mail, Adresse und MWST-Nummer aus dem Bezahlvorgang. Karten- und Zahlungsdaten bearbeitet nur Stripe; vollständige Kartennummern sehen wir nie.',
          'Fehlerberichte: Geht in Ihrem Browser etwas schief, die Fehlermeldung und die Seitenadresse, ohne Personendaten.',
        ],
      },
      {
        heading: '4. Wozu',
        paragraphs: [
          'Um Seatline und Support zu erbringen, den Dienst sicher zu halten, Abos abzurechnen und gesetzliche Pflichten zu erfüllen. Nach DSGVO stützen wir uns auf den Vertrag (Art. 6 Abs. 1 lit. b), unser berechtigtes Interesse an einem sicheren, funktionierenden Dienst (lit. f) und gesetzliche Pflichten (lit. c). Wir verkaufen keine Daten und nutzen sie nicht für Werbung.',
        ],
      },
      {
        heading: '5. Wo Ihre Daten gespeichert sind',
        paragraphs: [
          'Alle Seatline-Daten, Backups und Protokolle liegen in der Schweiz, in der Microsoft-Azure-Region Switzerland North (Zürich).',
          'Die Anmeldung läuft über Microsoft Entra ID, Teil des Microsoft 365 Ihres Unternehmens. Zahlungen bearbeitet Stripe Payments Europe Ltd. (Irland); Stripe kann Daten mit anerkannten Garantien in die USA übermitteln (Swiss-US und EU-US Data Privacy Framework, Standardvertragsklauseln).',
        ],
      },
      {
        heading: '6. Dienstleister',
        paragraphs: [
          'Microsoft (Hosting und Anmeldung, Schweiz), Stripe (Zahlungen, Irland/USA), Hostpoint (Domain und E-Mail, Schweiz). Sie bearbeiten Daten nur soweit für ihre Leistung nötig und unter Verträgen, die sie schützen.',
        ],
      },
      {
        heading: '7. Cookies',
        paragraphs: [
          'Nur Cookies, die Seatline zum Funktionieren braucht: ein verschlüsseltes Anmelde-Cookie (endet beim Abmelden, spätestens nach 10 Stunden), ein kurzlebiges Cookie während der Microsoft-Anmeldung (einige Minuten) und, wenn Sie eine Sprache wählen, ein Sprach-Cookie (1 Jahr). Ein Cookie-Banner braucht es nicht, weil Sie nicht verfolgt werden.',
        ],
      },
      {
        heading: '8. Wie lange wir Daten aufbewahren',
        paragraphs: [
          'Platzverlauf: so lange, wie Ihr Unternehmen es einstellt (12 Monate bis 10 Jahre; ohne Änderung 24 Monate). Ausgetretene Personen werden nach dieser Frist anonymisiert.',
          'Hört ein Unternehmen mit Seatline auf, löschen wir seinen Arbeitsbereich auf Anfrage, sonst spätestens 6 Monate nach Ende des Abos oder der Testphase. Technische Protokolle: 30 Tage. Buchhaltungsbelege: 10 Jahre, wie es das Schweizer Recht verlangt.',
        ],
      },
      {
        heading: '9. Sicherheit',
        paragraphs: [
          'Verschlüsselte Verbindungen (HTTPS) und verschlüsselte Speicherung, strikte Trennung der Unternehmen in der Datenbank, Anmeldung nur über Microsoft, Schlüssel in einem gesicherten Tresor und Zugriff nur, wo nötig.',
        ],
      },
      {
        heading: '10. Ihre Rechte',
        paragraphs: [
          'Sie können Auskunft über Ihre Daten verlangen, sie berichtigen oder löschen lassen, sie in einem gängigen Format erhalten und der Bearbeitung widersprechen. Schreiben Sie an {email}. Sind Sie der Meinung, dass wir Ihre Daten falsch behandeln, können Sie sich beim Eidgenössischen Datenschutz- und Öffentlichkeitsbeauftragten (EDÖB) oder Ihrer EU-Datenschutzbehörde beschweren.',
        ],
      },
      {
        heading: '11. Änderungen',
        paragraphs: [
          'Wir passen diese Erklärung an, wenn sich Seatline ändert. Das Datum oben zeigt die aktuelle Fassung.',
        ],
      },
    ],
    fr: [
      {
        heading: '1. Responsable',
        paragraphs: [
          '{name}, {address}, e-mail {email}, est responsable de ce site et des données que Seatline traite pour ses propres besoins (par exemple la facturation). Nous respectons la loi suisse sur la protection des données (LPD) et, lorsqu’il s’applique, le Règlement général européen sur la protection des données (RGPD).',
        ],
      },
      {
        heading: '2. Les données de votre employeur — notre rôle',
        paragraphs: [
          'Lorsqu’une entreprise utilise Seatline, elle décide quelles données de ses collaborateurs sont traitées (par exemple qui est assis où). Pour ces données, l’entreprise est responsable et nous ne les traitons que pour son compte. Si vous êtes collaboratrice ou collaborateur et avez une question sur vos données, adressez-vous d’abord à votre employeur ; nous l’aidons à répondre.',
        ],
      },
      {
        heading: '3. Ce que nous traitons',
        paragraphs: [
          'Site web : aucun suivi, aucun outil d’analyse, aucune publicité ni cookie tiers. Nos serveurs enregistrent des journaux techniques (adresse IP, heure, page, navigateur) pour la sécurité et l’analyse des erreurs.',
          'Connexion : de votre compte professionnel Microsoft, nous recevons votre nom, votre adresse e-mail et vos identifiants Microsoft d’utilisateur et d’organisation. Votre mot de passe ne nous parvient jamais.',
          'Annuaire : si l’admin Microsoft 365 de votre entreprise l’approuve, Seatline lit une fois par nuit le nom, l’e-mail, le service, la fonction et le statut (actif ou non) des collaborateurs. Rien d’autre.',
          'Places : places, plans d’étage, attributions, réservations, déménagements planifiés et un historique de qui a modifié quoi et quand.',
          'Facturation : nom de l’entreprise, e-mail de facturation, adresse et numéro de TVA saisis lors du paiement. Les données de carte et de paiement sont traitées uniquement par Stripe ; nous ne voyons jamais les numéros de carte complets.',
          'Rapports d’erreur : si quelque chose ne fonctionne pas dans votre navigateur, le message d’erreur et l’adresse de la page, sans données personnelles.',
        ],
      },
      {
        heading: '4. Pourquoi',
        paragraphs: [
          'Pour fournir Seatline et le support, assurer la sécurité du service, facturer les abonnements et respecter nos obligations légales. Selon le RGPD, nos bases légales sont le contrat (art. 6, par. 1, let. b), notre intérêt légitime à un service sûr et fonctionnel (let. f) et les obligations légales (let. c). Nous ne vendons pas de données et ne les utilisons pas à des fins publicitaires.',
        ],
      },
      {
        heading: '5. Où sont stockées vos données',
        paragraphs: [
          'Toutes les données Seatline, sauvegardes et journaux sont stockés en Suisse, dans la région Microsoft Azure Switzerland North (Zurich).',
          'La connexion passe par Microsoft Entra ID, qui fait partie du Microsoft 365 de votre entreprise. Les paiements sont traités par Stripe Payments Europe Ltd. (Irlande) ; Stripe peut transférer des données vers les États-Unis avec des garanties reconnues (Swiss-US et EU-US Data Privacy Framework, clauses contractuelles types).',
        ],
      },
      {
        heading: '6. Prestataires',
        paragraphs: [
          'Microsoft (hébergement et connexion, Suisse), Stripe (paiements, Irlande/États-Unis), Hostpoint (domaine et e-mail, Suisse). Ils ne traitent les données que dans la mesure nécessaire à leur service et selon des contrats qui les protègent.',
        ],
      },
      {
        heading: '7. Cookies',
        paragraphs: [
          'Uniquement les cookies nécessaires au fonctionnement de Seatline : un cookie de connexion chiffré (supprimé à la déconnexion, au plus tard après 10 heures), un cookie de courte durée pendant la connexion Microsoft (quelques minutes) et, si vous choisissez une langue, un cookie de langue (1 an). Aucune bannière n’est nécessaire, car rien ne vous suit.',
        ],
      },
      {
        heading: '8. Durée de conservation',
        paragraphs: [
          'Historique des places : aussi longtemps que votre entreprise le définit (12 mois à 10 ans ; 24 mois par défaut). Les personnes parties sont anonymisées après ce délai.',
          'Lorsqu’une entreprise cesse d’utiliser Seatline, nous supprimons son espace de travail sur demande, sinon au plus tard 6 mois après la fin de l’abonnement ou de l’essai. Journaux techniques : 30 jours. Pièces comptables : 10 ans, comme l’exige le droit suisse.',
        ],
      },
      {
        heading: '9. Sécurité',
        paragraphs: [
          'Connexions chiffrées (HTTPS) et stockage chiffré, séparation stricte des entreprises dans la base de données, connexion uniquement via Microsoft, clés conservées dans un coffre sécurisé et accès limité au nécessaire.',
        ],
      },
      {
        heading: '10. Vos droits',
        paragraphs: [
          'Vous pouvez demander quelles données nous avons sur vous, les faire rectifier ou effacer, les recevoir dans un format courant et vous opposer au traitement. Écrivez à {email}. Si vous estimez que nous traitons mal vos données, vous pouvez vous adresser au Préposé fédéral à la protection des données et à la transparence (PFPDT) ou à votre autorité de protection des données dans l’UE.',
        ],
      },
      {
        heading: '11. Modifications',
        paragraphs: [
          'Nous mettons à jour cette politique lorsque Seatline évolue. La date en haut indique la version actuelle.',
        ],
      },
    ],
  },
};

const fill = (text: string) =>
  text
    .replaceAll('{name}', OPERATOR.name)
    .replaceAll('{address}', `${OPERATOR.street}, ${OPERATOR.place}`)
    .replaceAll('{email}', OPERATOR.email);

export function legalText(doc: LegalDoc, language: Language): LegalSection[] {
  return TEXTS[doc][language].map((s) => ({
    heading: s.heading,
    paragraphs: s.paragraphs.map(fill),
  }));
}

/** for tests: the raw texts */
export const LEGAL_TEXTS = TEXTS;
