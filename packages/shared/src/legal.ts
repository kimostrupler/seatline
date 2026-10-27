// Legal texts both apps need: the website shows them, the API sends the DPA as a PDF.
// Imported as '@seatline/shared/dist/legal' (not from the index) so the pages' bundles stay small.

export type LegalLanguage = 'en' | 'de' | 'fr';

export interface LegalSection {
  heading: string;
  paragraphs: string[];
}

/**
 * Who runs Seatline — used by the imprint, privacy policy and terms.
 * A sole proprietor: the person's name and address (Swiss law requires them on the website).
 */
export const OPERATOR = {
  name: 'Kimo Strupler',
  street: 'Salomon-Landolt-Weg 5',
  place: '8193 Eglisau',
  /** Swiss company number (CHE-…), if the business is registered; '' = not shown */
  uid: '',
  email: 'hello@seatline.ch',
};

/** Date of the current legal texts (YYYY-MM-DD). Change it whenever a text changes. */
export const LEGAL_UPDATED = '2026-10-27';

/** The operator's details in a legal text's {name}, {address} and {email}. */
export const fillLegal = (text: string) =>
  text
    .replaceAll('{name}', OPERATOR.name)
    .replaceAll('{address}', `${OPERATOR.street}, ${OPERATOR.place}`)
    .replaceAll('{email}', OPERATOR.email);

/**
 * Data processing agreement (DPA / AVV): Swiss FADP art. 9 and, where it applies, GDPR art. 28.
 * Part of the terms; applies automatically to every workspace. Same sections in every language.
 */
export const DPA: Record<LegalLanguage, LegalSection[]> = {
  en: [
    {
      heading: '1. Parties and purpose',
      paragraphs: [
        'This agreement is between the customer that uses a Seatline workspace (“controller”) and {name}, {address} (“processor”, “we”). It sets out how we process personal data on the customer’s behalf. It is part of the terms of service and applies automatically to every workspace; no signature is needed. Where this agreement and the terms differ on data protection, this agreement wins.',
      ],
    },
    {
      heading: '2. What we do with the data, and for how long',
      paragraphs: [
        'We process personal data only to provide Seatline: showing floor plans and who sits where, assigning and moving people, planned moves, history, notices, exports, sign-in and reading the customer’s Microsoft 365 directory if the customer connects it.',
        'Processing lasts as long as the customer uses Seatline, plus the deletion periods in section 12.',
      ],
    },
    {
      heading: '3. Whose data, which data',
      paragraphs: [
        'People concerned: the customer’s employees and other people the customer adds (for example contractors), and the customer’s admins and users.',
        'Data: name, work e-mail address, department/team, job title, account status and Microsoft IDs; seat assignments and reservations with dates; leaving dates; the change log (who changed what and when); sign-in records. Seatline is not meant for sensitive personal data (for example health data) and the customer does not enter any.',
      ],
    },
    {
      heading: '4. Instructions',
      paragraphs: [
        'We act only on the customer’s documented instructions: these terms, this agreement and what admins set in Seatline (for example how long history is kept). If we believe an instruction breaks data protection law, we tell the customer. We process the data for other purposes only if the law requires it, and then tell the customer unless the law forbids that.',
      ],
    },
    {
      heading: '5. Confidentiality',
      paragraphs: [
        'Everyone who can access customer data on our side is bound to confidentiality, and only gets access when it is needed (for example to help with a support request the customer made).',
      ],
    },
    {
      heading: '6. Security measures',
      paragraphs: [
        'Technical: encrypted connections (HTTPS/TLS) and encrypted storage; strict separation of customers in the database (row-level security, tested automatically); sign-in through Microsoft Entra ID or single-use e-mail links, no stored passwords; secrets in Azure Key Vault; automatic backups; history that cannot be changed afterwards; error logs without personal details.',
        'Organisational: access only where needed and personal; security updates applied promptly (automatic dependency checks); changes reviewed and tested before release; all data and backups in Switzerland. We keep these measures up to date and may replace them with equally good or better ones.',
      ],
    },
    {
      heading: '7. Sub-processors',
      paragraphs: [
        'The customer agrees that we use these sub-processors: Microsoft Ireland Operations Ltd. (hosting, database, backups and logs in Microsoft Azure, region Switzerland North, Zurich; sign-in with Microsoft Entra ID), Hostpoint AG, Rapperswil-Jona, Switzerland (sending e-mails such as sign-in links and notices), and Stripe Payments Europe Ltd., Ireland (payments; only the customer’s billing details, not its employees’ data).',
        'We bind sub-processors to the same data protection duties. We tell the customer’s admins about a new sub-processor at least 30 days in advance by e-mail; the customer may object and, if we cannot find a solution, cancel before the change.',
      ],
    },
    {
      heading: '8. Where the data is',
      paragraphs: [
        'Customer data, backups and logs are stored and processed in Switzerland. Data leaves Switzerland only where a sub-processor in section 7 needs it for its service, and then only under the safeguards required by Swiss law (for example recognised adequacy, standard contractual clauses).',
      ],
    },
    {
      heading: '9. Requests from the people concerned',
      paragraphs: [
        'People who want to see, correct or delete their data contact the customer. Seatline has built-in tools for this (download a person’s data, correct people, forget people who left, set how long history is kept). If a request reaches us, we pass it to the customer and help where needed.',
      ],
    },
    {
      heading: '10. Data breaches',
      paragraphs: [
        'If we become aware of a breach of security affecting customer data, we tell the customer’s admins without undue delay, as a rule within 48 hours, with what we know (what happened, which data, likely consequences, what we did) so the customer can meet its own duties to report.',
      ],
    },
    {
      heading: '11. Information and audits',
      paragraphs: [
        'We give the customer the information needed to show that this agreement is kept. The customer may check this once a year, or after a data breach, with 30 days’ notice, by questionnaire or by an independent auditor bound to confidentiality, at its own cost and without disturbing the service or other customers.',
      ],
    },
    {
      heading: '12. End of the contract',
      paragraphs: [
        'Before the end and up to 30 days after it, admins can export their data (Excel/CSV/PDF and per person). After that we delete the workspace and all customer data, at the latest 6 months after the end of the subscription or trial; backups are overwritten within 35 days after that. We keep only what the law requires (for example billing records).',
      ],
    },
    {
      heading: '13. Law and a copy for your records',
      paragraphs: [
        'Swiss law applies; the place of jurisdiction is the one in the terms. Admins can e-mail themselves this agreement as a PDF with their company’s name (People & access › Settings › Data protection). It applies without a signature; if you still need a hand-signed copy, write to {email}.',
      ],
    },
  ],
  de: [
    {
      heading: '1. Parteien und Zweck',
      paragraphs: [
        'Dieser Vertrag gilt zwischen dem Kunden, der einen Seatline-Arbeitsbereich nutzt („Verantwortlicher“), und {name}, {address} („Auftragsbearbeiter“, „wir“). Er regelt, wie wir Personendaten im Auftrag des Kunden bearbeiten. Er ist Teil der Nutzungsbedingungen und gilt automatisch für jeden Arbeitsbereich; eine Unterschrift ist nicht nötig. Weichen dieser Vertrag und die Nutzungsbedingungen beim Datenschutz voneinander ab, geht dieser Vertrag vor.',
      ],
    },
    {
      heading: '2. Was wir mit den Daten tun, und wie lange',
      paragraphs: [
        'Wir bearbeiten Personendaten nur, um Seatline zu erbringen: Grundrisse und Sitzordnung anzeigen, Personen Plätze zuweisen und umziehen, geplante Umzüge, Verlauf, Mitteilungen, Exporte, Anmeldung und das Lesen des Microsoft-365-Verzeichnisses, falls der Kunde es verbindet.',
        'Die Bearbeitung dauert, solange der Kunde Seatline nutzt, zuzüglich der Löschfristen in Ziffer 12.',
      ],
    },
    {
      heading: '3. Wessen Daten, welche Daten',
      paragraphs: [
        'Betroffene Personen: Mitarbeitende des Kunden und weitere Personen, die der Kunde erfasst (z. B. externe Mitarbeitende), sowie die Admins und Benutzer des Kunden.',
        'Daten: Name, geschäftliche E-Mail-Adresse, Abteilung/Team, Funktion, Kontostatus und Microsoft-IDs; Platzzuweisungen und Reservationen mit Datum; Austrittsdaten; das Änderungsprotokoll (wer hat was wann geändert); Anmeldedaten. Seatline ist nicht für besonders schützenswerte Personendaten (z. B. Gesundheitsdaten) gedacht, und der Kunde erfasst keine.',
      ],
    },
    {
      heading: '4. Weisungen',
      paragraphs: [
        'Wir handeln nur nach den dokumentierten Weisungen des Kunden: diesen Bedingungen, diesem Vertrag und den Einstellungen der Admins in Seatline (z. B. wie lange der Verlauf aufbewahrt wird). Verstösst eine Weisung unserer Ansicht nach gegen Datenschutzrecht, informieren wir den Kunden. Für andere Zwecke bearbeiten wir die Daten nur, wenn das Gesetz es verlangt, und informieren den Kunden dann, sofern das Gesetz es nicht verbietet.',
      ],
    },
    {
      heading: '5. Vertraulichkeit',
      paragraphs: [
        'Alle, die bei uns auf Kundendaten zugreifen können, sind zur Vertraulichkeit verpflichtet und erhalten Zugriff nur, wenn es nötig ist (z. B. für eine Support-Anfrage des Kunden).',
      ],
    },
    {
      heading: '6. Sicherheitsmassnahmen',
      paragraphs: [
        'Technisch: verschlüsselte Verbindungen (HTTPS/TLS) und verschlüsselte Speicherung; strikte Trennung der Kunden in der Datenbank (Row-Level Security, automatisch getestet); Anmeldung über Microsoft Entra ID oder einmalige E-Mail-Links, keine gespeicherten Passwörter; Schlüssel in Azure Key Vault; automatische Backups; ein Verlauf, der nachträglich nicht geändert werden kann; Fehlerprotokolle ohne Personendaten.',
        'Organisatorisch: Zugriff nur, wo nötig, und persönlich; Sicherheitsupdates werden rasch eingespielt (automatische Prüfung der Abhängigkeiten); Änderungen werden vor der Veröffentlichung geprüft und getestet; alle Daten und Backups in der Schweiz. Wir halten diese Massnahmen aktuell und dürfen sie durch gleichwertige oder bessere ersetzen.',
      ],
    },
    {
      heading: '7. Unterauftragsbearbeiter',
      paragraphs: [
        'Der Kunde ist einverstanden, dass wir diese Unterauftragsbearbeiter beiziehen: Microsoft Ireland Operations Ltd. (Hosting, Datenbank, Backups und Protokolle in Microsoft Azure, Region Switzerland North, Zürich; Anmeldung mit Microsoft Entra ID), Hostpoint AG, Rapperswil-Jona, Schweiz (Versand von E-Mails wie Anmeldelinks und Mitteilungen), und Stripe Payments Europe Ltd., Irland (Zahlungen; nur die Rechnungsangaben des Kunden, keine Daten seiner Mitarbeitenden).',
        'Wir verpflichten Unterauftragsbearbeiter zu denselben Datenschutzpflichten. Über einen neuen Unterauftragsbearbeiter informieren wir die Admins des Kunden mindestens 30 Tage im Voraus per E-Mail; der Kunde kann widersprechen und, wenn wir keine Lösung finden, vor der Änderung kündigen.',
      ],
    },
    {
      heading: '8. Wo die Daten sind',
      paragraphs: [
        'Kundendaten, Backups und Protokolle werden in der Schweiz gespeichert und bearbeitet. Daten verlassen die Schweiz nur, wenn ein Unterauftragsbearbeiter aus Ziffer 7 sie für seine Leistung braucht, und dann nur mit den vom Schweizer Recht verlangten Garantien (z. B. anerkannter angemessener Schutz, Standardvertragsklauseln).',
      ],
    },
    {
      heading: '9. Anfragen betroffener Personen',
      paragraphs: [
        'Wer seine Daten einsehen, berichtigen oder löschen lassen möchte, wendet sich an den Kunden. Seatline hat dafür eingebaute Werkzeuge (Daten einer Person herunterladen, Personen korrigieren, ausgetretene Personen vergessen, Aufbewahrungsdauer des Verlaufs festlegen). Erreicht uns eine Anfrage, leiten wir sie an den Kunden weiter und helfen, wo nötig.',
      ],
    },
    {
      heading: '10. Verletzungen der Datensicherheit',
      paragraphs: [
        'Erfahren wir von einer Verletzung der Datensicherheit, die Kundendaten betrifft, informieren wir die Admins des Kunden unverzüglich, in der Regel innert 48 Stunden, mit dem, was wir wissen (was passiert ist, welche Daten, wahrscheinliche Folgen, was wir unternommen haben), damit der Kunde seine eigenen Meldepflichten erfüllen kann.',
      ],
    },
    {
      heading: '11. Auskunft und Kontrollen',
      paragraphs: [
        'Wir geben dem Kunden die Auskünfte, die nötig sind, um die Einhaltung dieses Vertrags nachzuweisen. Der Kunde kann dies einmal pro Jahr oder nach einer Verletzung der Datensicherheit mit 30 Tagen Vorankündigung prüfen, per Fragebogen oder durch eine unabhängige, zur Vertraulichkeit verpflichtete Prüfstelle, auf eigene Kosten und ohne den Betrieb oder andere Kunden zu stören.',
      ],
    },
    {
      heading: '12. Vertragsende',
      paragraphs: [
        'Vor dem Ende und bis 30 Tage danach können Admins ihre Daten exportieren (Excel/CSV/PDF und pro Person). Danach löschen wir den Arbeitsbereich und alle Kundendaten, spätestens 6 Monate nach Ende des Abos oder der Testphase; Backups werden innert weiterer 35 Tage überschrieben. Wir behalten nur, was das Gesetz verlangt (z. B. Buchhaltungsbelege).',
      ],
    },
    {
      heading: '13. Recht und Exemplar für Ihre Unterlagen',
      paragraphs: [
        'Es gilt Schweizer Recht; der Gerichtsstand ist jener der Nutzungsbedingungen. Admins können sich diesen Vertrag als PDF mit dem Namen ihrer Firma per E-Mail senden (Personen & Zugang › Einstellungen › Datenschutz). Er gilt ohne Unterschrift; brauchen Sie trotzdem ein von Hand unterzeichnetes Exemplar, schreiben Sie an {email}.',
      ],
    },
  ],
  fr: [
    {
      heading: '1. Parties et objet',
      paragraphs: [
        'Cet accord lie le client qui utilise un espace Seatline (« responsable du traitement ») et {name}, {address} (« sous-traitant », « nous »). Il règle la manière dont nous traitons des données personnelles pour le compte du client. Il fait partie des conditions d’utilisation et s’applique automatiquement à chaque espace ; aucune signature n’est nécessaire. Si cet accord et les conditions diffèrent en matière de protection des données, cet accord prévaut.',
      ],
    },
    {
      heading: '2. Ce que nous faisons des données, et pendant combien de temps',
      paragraphs: [
        'Nous traitons les données personnelles uniquement pour fournir Seatline : afficher les plans et qui est assis où, attribuer et déménager des personnes, déménagements planifiés, historique, avis, exports, connexion et lecture de l’annuaire Microsoft 365 si le client le connecte.',
        'Le traitement dure tant que le client utilise Seatline, plus les délais d’effacement du chiffre 12.',
      ],
    },
    {
      heading: '3. Les données de qui, quelles données',
      paragraphs: [
        'Personnes concernées : les collaborateurs du client et les autres personnes que le client saisit (p. ex. des externes), ainsi que les admins et utilisateurs du client.',
        'Données : nom, adresse e-mail professionnelle, service/équipe, fonction, statut du compte et identifiants Microsoft ; attributions de places et réservations avec dates ; dates de départ ; le journal des changements (qui a changé quoi et quand) ; données de connexion. Seatline n’est pas prévu pour des données sensibles (p. ex. de santé) et le client n’en saisit pas.',
      ],
    },
    {
      heading: '4. Instructions',
      paragraphs: [
        'Nous agissons uniquement selon les instructions documentées du client : ces conditions, cet accord et les réglages des admins dans Seatline (p. ex. la durée de conservation de l’historique). Si une instruction nous semble violer le droit de la protection des données, nous en informons le client. Nous ne traitons les données à d’autres fins que si la loi l’exige, et en informons alors le client sauf si la loi l’interdit.',
      ],
    },
    {
      heading: '5. Confidentialité',
      paragraphs: [
        'Toutes les personnes pouvant accéder aux données du client chez nous sont tenues à la confidentialité et n’y accèdent que si c’est nécessaire (p. ex. pour une demande de support du client).',
      ],
    },
    {
      heading: '6. Mesures de sécurité',
      paragraphs: [
        'Techniques : connexions chiffrées (HTTPS/TLS) et stockage chiffré ; séparation stricte des clients dans la base de données (row-level security, testée automatiquement) ; connexion via Microsoft Entra ID ou liens e-mail à usage unique, aucun mot de passe stocké ; secrets dans Azure Key Vault ; sauvegardes automatiques ; un historique qui ne peut pas être modifié après coup ; journaux d’erreurs sans données personnelles.',
        'Organisationnelles : accès uniquement si nécessaire et nominatif ; mises à jour de sécurité appliquées rapidement (contrôle automatique des dépendances) ; changements vérifiés et testés avant publication ; toutes les données et sauvegardes en Suisse. Nous tenons ces mesures à jour et pouvons les remplacer par des mesures équivalentes ou meilleures.',
      ],
    },
    {
      heading: '7. Sous-traitants ultérieurs',
      paragraphs: [
        'Le client accepte que nous fassions appel à ces sous-traitants : Microsoft Ireland Operations Ltd. (hébergement, base de données, sauvegardes et journaux dans Microsoft Azure, région Switzerland North, Zurich ; connexion avec Microsoft Entra ID), Hostpoint AG, Rapperswil-Jona, Suisse (envoi d’e-mails comme les liens de connexion et les avis), et Stripe Payments Europe Ltd., Irlande (paiements ; uniquement les données de facturation du client, pas celles de ses collaborateurs).',
        'Nous imposons aux sous-traitants les mêmes obligations de protection des données. Nous informons les admins du client d’un nouveau sous-traitant au moins 30 jours à l’avance par e-mail ; le client peut s’y opposer et, si nous ne trouvons pas de solution, résilier avant le changement.',
      ],
    },
    {
      heading: '8. Où sont les données',
      paragraphs: [
        'Les données du client, les sauvegardes et les journaux sont stockés et traités en Suisse. Les données ne quittent la Suisse que si un sous-traitant du chiffre 7 en a besoin pour son service, et alors uniquement avec les garanties exigées par le droit suisse (p. ex. adéquation reconnue, clauses contractuelles types).',
      ],
    },
    {
      heading: '9. Demandes des personnes concernées',
      paragraphs: [
        'Les personnes qui souhaitent consulter, rectifier ou effacer leurs données s’adressent au client. Seatline a des outils intégrés pour cela (télécharger les données d’une personne, corriger des personnes, oublier les personnes parties, fixer la durée de conservation de l’historique). Si une demande nous parvient, nous la transmettons au client et l’aidons au besoin.',
      ],
    },
    {
      heading: '10. Violations de la sécurité des données',
      paragraphs: [
        'Si nous apprenons une violation de la sécurité touchant des données du client, nous en informons ses admins sans retard injustifié, en règle générale dans les 48 heures, avec ce que nous savons (ce qui s’est passé, quelles données, conséquences probables, mesures prises), afin que le client puisse remplir ses propres obligations d’annonce.',
      ],
    },
    {
      heading: '11. Informations et contrôles',
      paragraphs: [
        'Nous donnons au client les informations nécessaires pour démontrer le respect de cet accord. Le client peut le vérifier une fois par an, ou après une violation de la sécurité des données, avec un préavis de 30 jours, par questionnaire ou par un auditeur indépendant tenu à la confidentialité, à ses frais et sans perturber le service ni les autres clients.',
      ],
    },
    {
      heading: '12. Fin du contrat',
      paragraphs: [
        'Avant la fin et jusqu’à 30 jours après, les admins peuvent exporter leurs données (Excel/CSV/PDF et par personne). Ensuite, nous supprimons l’espace et toutes les données du client, au plus tard 6 mois après la fin de l’abonnement ou de l’essai ; les sauvegardes sont écrasées dans les 35 jours suivants. Nous ne gardons que ce que la loi exige (p. ex. les pièces comptables).',
      ],
    },
    {
      heading: '13. Droit applicable et exemplaire pour vos dossiers',
      paragraphs: [
        'Le droit suisse s’applique ; le for est celui des conditions d’utilisation. Les administrateurs peuvent s’envoyer cet accord par e-mail en PDF, au nom de leur entreprise (Personnes et accès › Réglages › Protection des données). Il s’applique sans signature ; si vous avez tout de même besoin d’un exemplaire signé à la main, écrivez à {email}.',
      ],
    },
  ],
};
