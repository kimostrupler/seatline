import type { HelpContent } from './types';

export const DE: HelpContent = {
  topics: {
    'getting-started': {
      title: 'Erste Schritte',
      summary: 'Arbeitsbereich erstellen und Ihr Büro in wenigen Minuten in Seatline bringen.',
      steps: [
        {
          title: 'Registrieren oder Demo ausprobieren',
          text: [
            'Wählen Sie auf seatline.ch «30 Tage gratis testen». Melden Sie sich mit Ihrem Microsoft-365-Geschäftskonto an oder geben Sie Ihre geschäftliche E-Mail ein und klicken Sie auf den Link, den wir senden. Kein Passwort, keine Kreditkarte.',
            'Nur schauen? «Demo ausprobieren» öffnet ein Beispielbüro, das Sie frei ändern können – ohne Konto.',
          ],
        },
        {
          title: 'Arbeitsbereich benennen',
          text: [
            'Bei der ersten Anmeldung fragt Seatline nach dem Namen Ihrer Organisation. Sie werden Admin. Mit Microsoft 365 kommen Kolleginnen und Kollegen derselben Organisation automatisch in denselben Arbeitsbereich.',
          ],
        },
        {
          title: 'Ihr Büro in zwei Schritten einrichten',
          text: [
            'Gleich danach fragt Seatline nach Ihrem Gebäude, dem Namen des Stockwerks und der Grösse des Büros (Klein 12, Mittel 33 oder Gross 74 Plätze, oder ein leeres Stockwerk). Es zeichnet ein Beispielbüro für Sie; anpassen können Sie es später unter «Plan bearbeiten».',
            'Dann wählen Sie, wie Ihre Kolleginnen und Kollegen hinzukommen: eine Excel- oder CSV-Liste importieren, einzeln hinzufügen oder – mit Microsoft 365 – aus Ihrem Verzeichnis übernehmen. Beim ersten Öffnen des Plans zeigen drei kurze Tipps, wie es funktioniert.',
          ],
          image: 'setup',
        },
        {
          title: 'Der Checkliste auf Start folgen',
          text: [
            'Start zeigt die Checkliste «Erste Schritte mit Seatline»: Gebäude hinzufügen, ein Stockwerk mit Arbeitsplätzen zeichnen, Mitarbeitende hinzufügen und Plätze zuteilen. Jeder Schritt hat einen Knopf, der Sie an die richtige Stelle führt, und hakt sich selbst ab.',
            'Start zeigt auch, wie voll jedes Stockwerk ist, wer noch keinen Platz hat und was sich diese Woche geändert hat.',
          ],
          image: 'home',
        },
      ],
      tips: [
        'Der schnellste Start: Lassen Sie die Einrichtung ein Beispielbüro zeichnen und verschieben Sie dann Plätze und benennen Sie Räume wie bei Ihnen.',
        'Alles lässt sich rückgängig machen, und jede Platzänderung bleibt im Verlauf.',
      ],
    },
    floors: {
      title: 'Gebäude und Stockwerke',
      summary:
        'Gebäude und Stockwerke anlegen, mit einem Beispielbüro beginnen oder den Architektenplan importieren.',
      steps: [
        {
          title: 'Gebäude und Stockwerk hinzufügen',
          text: [
            'Öffnen Sie Plan. Klicken Sie links auf + neben Gebäude, geben Sie Name und Adresse ein, dann auf + neben Stockwerk. Geben Sie dem Stockwerk einen Namen (z. B. «3. OG») und eine Ebene; die Platznummern folgen der Ebene (3.01, 3.02 …).',
          ],
        },
        {
          title: 'Mit einem Beispielbüro beginnen',
          text: [
            'Ein neues Stockwerk öffnet sich in «Plan bearbeiten» und bietet fertige Büros an: Klein (12 Plätze), Mittel (33) und Gross (74), mit Sitzungszimmern, Büros, Empfang und Küche.',
            'Wählen Sie eines und verschieben, benennen oder löschen Sie, was nicht passt. Rückgängig entfernt das ganze Beispiel auf einmal. Lieber selbst zeichnen? Wählen Sie «Mit leerem Stockwerk beginnen».',
          ],
          image: 'edit-template',
        },
        {
          title: 'An Ihr Büro anpassen',
          text: [
            'Ziehen Sie Räume und Plätze an ihren Ort, ändern Sie die Grösse von Räumen an Ecken und Seiten und benennen Sie Räume rechts im Bereich. Änderungen speichern sich selbst.',
          ],
          image: 'edit-example',
        },
        {
          title: 'Oder den Architektenplan verwenden',
          text: [
            'Öffnen Sie rechts Plan hinzufügen → Architektenplan importieren und wählen Sie eine DXF-, PDF- oder Bilddatei. Seatline schlägt Räume und Plätze daraus vor; tippen Sie auf einen Vorschlag, um ihn wegzulassen, dann importieren. Der Plan bleibt im Hintergrund, Sie zeichnen darüber.',
            'Bild hochladen legt nur ein Bild hinter das Stockwerk. Setzen Sie den Massstab mit dem Lineal (M): Ziehen Sie entlang einer Wand mit bekannter Länge, dann werden Plätze in echter Grösse gezeichnet.',
          ],
        },
      ],
      tips: [
        'Mehrere ähnliche Stockwerke? ⋯ → Stockwerk duplizieren: gleiche Räume und Plätze, für die neue Ebene nummeriert, ohne Personen.',
        'DWG-Dateien zuerst im CAD-Programm als DXF oder PDF speichern.',
      ],
    },
    editor: {
      title: 'Den Grundriss zeichnen',
      summary:
        'Räume, Plätze, Sitzungszimmer, Küchen und Ausgänge: die Werkzeuge in «Plan bearbeiten».',
      steps: [
        {
          title: 'Zu «Plan bearbeiten» wechseln',
          text: [
            'Klicken Sie auf dem Plan oben rechts auf «Plan bearbeiten». Links erscheinen die Werkzeuge, rechts die Angaben zu dem, was Sie auswählen. Nur Bearbeiter und Admins sehen das.',
          ],
          image: 'edit',
        },
        {
          title: 'Räume zeichnen und Plätze setzen',
          text: [
            'Rechteckigen Raum zeichnen (B): ein Rechteck aufziehen. Raum über Ecken zeichnen (P): jede Ecke anklicken, Doppelklick zum Abschliessen. Platz hinzufügen (S): dort klicken, wo ein Arbeitsplatz steht. Wählen Sie einen Raum, um ihm Namen und Art (Büro, Grossraum, Sitzungszimmer) und bei Sitzungszimmern Plätze und Ausstattung zu geben.',
          ],
        },
        {
          title: 'Küchen, Drucker und Ausgänge',
          text: [
            'Markierung setzen (K) und dort klicken, wo Küche, Drucker, Ausgang oder Erste Hilfe sind, dann rechts wählen, was es ist. Markierungen helfen beim Zurechtfinden.',
          ],
        },
        {
          title: 'Nummerierung, Kopieren und Rückgängig',
          text: [
            'Platznummern folgen dem Stockwerk (3.01, 3.02 …) oder dem Raum (12-A, 12-B …); wählen Sie unter Nummerierung und klicken Sie auf «Arbeitsplätze neu nummerieren», um es auf alle Plätze anzuwenden.',
            'Mehreres auswählen mit Umschalt-Klick oder Umschalt-Ziehen, dann kopieren (⌘C / Ctrl+C) und einfügen (⌘V / Ctrl+V), auch auf einem anderen Stockwerk. Rückgängig mit ⌘Z / Ctrl+Z. ? zeigt alle Tastenkürzel.',
          ],
        },
      ],
      tips: [
        'Auf leerer Fläche ziehen, um sich zu bewegen; scrollen oder mit zwei Fingern zoomen.',
        'Plätze, auf denen je jemand sass, lassen sich nicht löschen (der Verlauf muss bleiben) – sperren Sie sie stattdessen.',
        '«Plan bearbeiten» funktioniert auch auf Tablets und Handys: die Angaben öffnen sich unter dem Stockwerk.',
      ],
    },
    seating: {
      title: 'Arbeitsplätze zuteilen',
      summary:
        'Plätze zuweisen, Personen umziehen, reservieren und freigeben – und sehen, wer wo sitzt.',
      steps: [
        {
          title: 'Einen Platz anklicken',
          text: [
            'Grüne Plätze sind frei, graue belegt, gelbe reserviert. Klicken Sie auf einen Platz, um zu sehen, wer dort sitzt, seit wann und wer vorher dort sass.',
          ],
          image: 'map-seat',
        },
        {
          title: 'Zuweisen oder umziehen',
          text: [
            'Klicken Sie auf einen freien (grünen) Platz, wählen Sie «Person zuweisen» und dann die Person. Oder ziehen Sie einen Namen aus der Liste links auf den Platz. Sitzt sie schon irgendwo, ist das ein Umzug: der alte Platz wird frei.',
            'Jede Änderung zeigt eine Meldung mit Rückgängig. Der Verlauf behält die Änderung und das Rückgängigmachen.',
          ],
        },
        {
          title: 'Reservieren oder freigeben',
          text: [
            'Klicken Sie auf einen freien Platz, wählen Sie Reservieren und geben Sie ein, für wen (z. B. «Neue Mitarbeiterin im Mai»). Zum Beenden den Platz anklicken und «Platz freigeben» oder «Reservation aufheben» wählen.',
          ],
        },
        {
          title: 'Eine Person oder einen freien Platz finden',
          text: [
            'Geben Sie links in der Personensuche einen Namen ein und klicken Sie die Person an: Sie sehen ihren Platz und Verlauf. «Freien Platz finden» filtert freie Plätze nach Ausstattung – Stehpult, zwei Bildschirme, am Fenster.',
            '«Plätze einfärben nach: Team» zeigt jedes Team in eigener Farbe.',
          ],
        },
      ],
      tips: [
        'Betrachter sehen alles, ändern aber keine Plätze; fragen Sie einen Bearbeiter oder Admin.',
        'Mitarbeitende können eine E-Mail zu ihrem neuen Platz erhalten (Personen & Zugang → Einstellungen → Mitteilungen).',
      ],
    },
    people: {
      title: 'Personen und Zugang',
      summary:
        'Mitarbeitende von Hand, aus Excel oder aus Microsoft 365 hinzufügen und festlegen, wer was darf.',
      steps: [
        {
          title: 'Personen & Zugang öffnen',
          text: [
            'Admins finden alle unter «Personen & Zugang»: Team, Platz, Rolle und ob jemand noch hier arbeitet. Filtern Sie nach Personen ohne Platz, bald austretenden oder ausgetretenen Personen.',
          ],
          image: 'people',
        },
        {
          title: 'Eine Person hinzufügen',
          text: [
            'Klicken Sie auf «Person hinzufügen», geben Sie Name und E-Mail ein, optional Team und Rolle. Lassen Sie «Einladung zur Anmeldung per E-Mail senden» an, damit sie sich gleich anmelden kann.',
          ],
          image: 'people-add',
        },
        {
          title: 'Eine Liste aus Excel importieren',
          text: [
            'Klicken Sie auf «Liste importieren» und wählen Sie eine Excel- oder CSV-Datei mit Name und E-Mail (und Team oder Funktion, falls vorhanden). Spaltentitel dürfen deutsch, französisch oder englisch sein. Seatline zeigt vor dem Speichern, welche Zeilen neu sind.',
          ],
          image: 'people-import',
        },
        {
          title: 'Microsoft 365 und Rollen',
          text: [
            'Mit Microsoft 365 werden Personen und Teams jede Nacht aus Ihrem Verzeichnis aktualisiert (Einstellungen → «Jetzt abgleichen» für sofort). Ihre IT gibt Seatline einmal frei.',
            'Rollen: Betrachter sehen den Plan, Bearbeiter ändern Plätze und Grundrisse, Admins verwalten zusätzlich Personen und Einstellungen. Personen «ohne Zugang» können trotzdem einen Platz haben.',
          ],
        },
      ],
    },
    'microsoft-365': {
      title: 'Microsoft 365: Freigabe durch die IT',
      summary:
        'Für IT-Admins: was Seatline bei Microsoft 365 anfragt, wie Sie es einmal freigeben und wie Sie es einschränken oder entfernen.',
      steps: [
        {
          title: 'Was Seatline anfragt',
          text: [
            'Anmelden: Mitarbeitende melden sich mit ihrem Microsoft-365-Geschäftskonto an. Seatline erhält Name, E-Mail-Adresse und die Microsoft-ID der Person (Berechtigungen openid, profile, email und User.Read).',
            'Personenliste für den nächtlichen Abgleich: die Anwendungsberechtigung User.Read.All („Vollständige Profile aller Benutzer lesen“). Davon speichert Seatline nur Name, E-Mail, Abteilung, Funktion und ob das Konto aktiv ist. Gastkonten werden übersprungen.',
            'Seatline schreibt nie etwas in Microsoft 365 und liest keine E-Mails, Kalender, Dateien oder Teams.',
          ],
        },
        {
          title: 'Wer hineinkommt',
          text: [
            'Die erste Person Ihrer Organisation, die sich anmeldet, erstellt den Arbeitsbereich und wird dessen Admin. Alle anderen aus derselben Organisation kommen bei der Anmeldung in diesen Arbeitsbereich — Ihre Organisation hat nie einen zweiten.',
            'Was Neue erhalten, legt ein Admin unter Personen & Zugang → Einstellungen → Wer Seatline öffnen kann fest: „Alle in der Organisation können den Plan ansehen“ (sie starten als Betrachter) oder „Nur Personen, denen Sie eine Rolle geben“.',
          ],
        },
        {
          title: 'Seatline einmal freigeben',
          text: [
            'Die Personenliste braucht immer die Freigabe eines Admins. In Seatline öffnet ein Admin Personen & Zugang → Einstellungen → Microsoft 365 und klickt auf Jetzt abgleichen. Fehlt die Freigabe noch, erscheint die Schaltfläche Bei Microsoft bestätigen: Ein Globaler Administrator oder Administrator für privilegierte Rollen klickt darauf und stimmt zu.',
            'Erlaubt Ihre Organisation nicht, dass Mitarbeitende Apps selbst freigeben, sieht schon die erste Person bei der Anmeldung „Administratorgenehmigung erforderlich“. Dann öffnet die IT den Freigabe-Link unten und stimmt zu — das gilt für die Anmeldung und die Personenliste zusammen.',
          ],
          approvalLink: 'Freigabe-Link für die IT:',
        },
        {
          title: 'Seatline auf einige Personen beschränken (optional)',
          text: [
            'Öffnen Sie im Microsoft Entra Admin Center Unternehmensanwendungen → Seatline → Eigenschaften, stellen Sie „Zuweisung erforderlich?“ auf Ja und speichern Sie. Fügen Sie dann unter Benutzer und Gruppen die Personen oder Gruppen hinzu, die sich anmelden dürfen.',
            'Das beschränkt, wer sich anmelden kann. Die nächtliche Personenliste kommt weiterhin aus dem ganzen Verzeichnis, so können alle einen Platz erhalten.',
          ],
        },
        {
          title: 'Freigabe entfernen',
          text: [
            'Im Microsoft Entra Admin Center entfernt Unternehmensanwendungen → Seatline → Eigenschaften → Löschen Seatline aus Ihrer Organisation. Neue Anmeldungen und der nächtliche Abgleich hören sofort auf; wer bereits angemeldet ist, bleibt bis zu 30 Tage angemeldet.',
            'Ihre Daten in Seatline bleiben, bis Ihr Arbeitsbereich gelöscht wird. Dafür schreiben Sie an hello@seatline.ch.',
          ],
        },
      ],
      tips: [
        'Alle melden sich über Microsoft an — Ihre MFA- und Conditional-Access-Regeln gelten wie gewohnt.',
        'Wer in Microsoft 365 entfernt oder deaktiviert wird, verliert in der folgenden Nacht den Zugang und den Platz; die Platzhistorie bleibt.',
        'Ihre Daten bleiben in der Schweiz (Microsoft Azure, Zürich). Der Auftragsverarbeitungsvertrag steht unter seatline.ch/legal/dpa.',
      ],
    },
    'teams-and-changes': {
      title: 'Teams, HR-Änderungen und Mitteilungen',
      summary:
        'Teams aktuell halten, Ein- und Austritte erledigen und die IT automatisch informieren.',
      steps: [
        {
          title: 'Teams',
          text: [
            'Der Reiter Teams zeigt jedes Team mit Anzahl platzierter Personen und Stockwerken. Dort benennen oder entfernen Sie Teams und fügen Personen hinzu. Teams kommen aus der Abteilung in Microsoft 365; ein von Hand gesetztes Team bleibt.',
          ],
          image: 'teams',
        },
        {
          title: 'Mehrere Änderungen auf einmal',
          text: [
            'Im Reiter Änderungen ändern Sie Team, Rolle und Austrittsdatum für viele Personen und klicken auf «Änderungen speichern» – alles zusammen oder nichts.',
            'Am Austrittstag wird die Person früh morgens als ausgetreten markiert und ihr Platz frei. Der Platzverlauf bleibt.',
          ],
          image: 'changes',
        },
        {
          title: 'Mitteilungen an IT oder Facility',
          text: [
            'Unter Einstellungen → Mitteilungen tragen Sie Adressen ein, die über Änderungen informiert werden sollen (z. B. it@firma.ch), und wählen wofür: Austritt, Eintritt, Teamwechsel oder ausgeführter Umzugsplan. Eine kurze E-Mail pro Änderung.',
          ],
          image: 'settings',
        },
      ],
    },
    moves: {
      title: 'Umzüge planen',
      summary:
        'Einen Teamumzug vorbereiten, auf dem Plan prüfen und am gewählten Tag ausführen lassen.',
      steps: [
        {
          title: 'Umzugsplan erstellen',
          text: [
            'Öffnen Sie Umzüge und klicken Sie auf «Neuer Umzugsplan». Geben Sie ihm einen Namen (z. B. «Verkauf in den 2. Stock»). Auf dem echten Plan ändert sich nichts, bis der Plan angewendet wird.',
          ],
          image: 'moves',
        },
        {
          title: 'Auf dem Plan planen',
          text: [
            'Klicken Sie auf «Auf dem Plan planen». Der Plan zeigt das Stockwerk, wie es sein wird: ziehen Sie Personen wie gewohnt auf Plätze – jeder Umzug kommt in den Plan. «Team umziehen» platziert ein ganzes Team auf einmal.',
          ],
          image: 'move-map',
        },
        {
          title: 'Prüfen und Datum wählen',
          text: [
            'Die Seite des Plans listet jeden Umzug und warnt bei Problemen (Platz besetzt von jemandem, der nicht umzieht, gesperrter Platz, Platz doppelt gewünscht). Wählen Sie «Planen für Datum» – die Umzüge passieren früh morgens an diesem Tag – oder «Jetzt anwenden».',
          ],
          image: 'move-plan',
        },
        {
          title: 'Umzugsliste für die Zügelfirma',
          text: [
            'Die Umzugsliste druckt jeden Umzug nach Ausgangsort sortiert, mit Häkchen pro Umzug und Unterschriftenzeilen.',
          ],
        },
      ],
      tips: ['Ein geplanter Plan ist gesperrt; «Zurück zum Entwurf» macht ihn wieder änderbar.'],
    },
    'home-planning-activity': {
      title: 'Start, Planung und Aktivität',
      summary:
        'Ihr Dashboard, die Flächenplanung für wachsende Teams und das vollständige Änderungsprotokoll.',
      steps: [
        {
          title: 'Start einrichten',
          text: [
            'Klicken Sie auf «Anpassen», um Widgets hinzuzufügen, zu verschieben, zu vergrössern oder zu entfernen: freie Plätze pro Stockwerk, Personen ohne Platz, Reservationen, Wochenverlauf und mehr. Admins können ihr Layout als Firmenstandard speichern.',
          ],
          image: 'home',
        },
        {
          title: 'Flächenplanung',
          text: [
            'Unter Planung geben Sie ein, wie viele Personen jedes Team erwartet und bis wann. Seatline vergleicht das mit den freien Plätzen und zeigt, wie viele fehlen werden.',
          ],
          image: 'planning',
        },
        {
          title: 'Aktivität: wer hat was geändert',
          text: [
            'Aktivität listet jede Änderung in einfachen Worten, die neueste zuerst. Suchen Sie nach Person, Platz oder Raum oder filtern Sie nach Art der Änderung.',
          ],
          image: 'activity',
        },
      ],
    },
    'exports-and-qr': {
      title: 'Exporte, Drucken und QR-Codes',
      summary:
        'Belegungslisten für Excel, gedruckte Stockwerkpläne und QR-Etiketten für jeden Platz.',
      steps: [
        {
          title: 'Menü Exportieren',
          text: [
            '«Exportieren» (auf Start und auf dem Plan) liefert die Belegungsliste als Excel oder CSV, den Platzverlauf, einen druckbaren Stockwerkplan (als PDF speichern) und QR-Codes für Plätze.',
          ],
          image: 'export-menu',
        },
        {
          title: 'QR-Etiketten für Plätze',
          text: [
            '«QR-Codes für Plätze» druckt 12 Etiketten pro A4-Blatt, nie über zwei Seiten geteilt. Kleben Sie eines auf jeden Platz.',
          ],
          image: 'qr',
        },
        {
          title: 'Was ein Etikett öffnet',
          text: [
            'Wer ein Etikett mit dem Handy scannt, sieht die Seite des Platzes: wer dort sitzt, Team und E-Mail, Ausstattung und Verlauf. Nur angemeldete Personen Ihres Arbeitsbereichs sehen sie.',
          ],
          image: 'desk-phone',
        },
      ],
    },
    'privacy-and-billing': {
      title: 'Datenschutz, AVV und Abrechnung',
      summary:
        'Wie lange der Verlauf bleibt, Anfragen von Mitarbeitenden, der Auftragsverarbeitungsvertrag und Ihr Abo.',
      steps: [
        {
          title: 'Wie lange der Verlauf bleibt',
          text: [
            'Unter Personen & Zugang → Einstellungen → Datenschutz wählen Sie, wie lange Platzverlauf und Aktivität bleiben (1, 2, 5 oder 10 Jahre). Älteres wird jede Nacht gelöscht, Ausgetretene werden anonymisiert.',
          ],
          image: 'privacy',
        },
        {
          title: 'Anfragen von Mitarbeitenden',
          text: [
            'Neben jeder Person liefert ⋯ → «Ihre Daten herunterladen» alles, was Seatline über sie speichert. «Diese Person vergessen» entfernt die Personendaten einer ausgetretenen Person; ihr Platzverlauf bleibt als «Ehemalige Person».',
          ],
        },
        {
          title: 'Auftragsverarbeitungsvertrag (AVV)',
          text: [
            'Der AVV ist Teil der Nutzungsbedingungen und gilt bereits für Ihren Arbeitsbereich. Mit «AVV per E-Mail senden (PDF)» erhalten Sie eine Kopie mit dem Namen Ihrer Firma für Ihre Unterlagen.',
          ],
        },
        {
          title: 'Abo',
          text: [
            'Die ersten 30 Tage sind gratis. Admins abonnieren unter Abrechnung (CHF 2 pro aktivem Platz und Monat); die restlichen Testtage bleiben gratis. Ohne Abo wird der Arbeitsbereich nach dem Test schreibgeschützt – nichts wird gelöscht.',
          ],
        },
      ],
    },
  },
  faq: [
    {
      q: 'Ich habe die Anmelde-E-Mail nicht erhalten.',
      a: 'Schauen Sie im Spam- oder Junk-Ordner nach und warten Sie eine Minute. Der Link funktioniert einmal und 15 Minuten lang; fordern Sie sonst einen neuen an. Nutzt Ihre Firma Microsoft 365, melden Sie sich mit Microsoft an.',
    },
    {
      q: 'Seatline auf dem Home-Bildschirm meines Telefons fragt immer wieder nach der Anmeldung.',
      a: 'Eine App auf dem Home-Bildschirm hat ihre eigene Anmeldung, und der Link in der E-Mail öffnet sich immer im Browser. Fordern Sie in der App also wie gewohnt einen Link an und geben Sie dann bei „Schauen Sie in Ihr Postfach“ den Code aus dieser E-Mail ein. Danach bleibt die App 30 Tage angemeldet.',
    },
    {
      q: 'Warum kann ich nichts ändern?',
      a: 'Entweder ist Ihre Rolle Betrachter (ein Admin kann Sie zum Bearbeiter machen), oder der Arbeitsbereich ist schreibgeschützt, weil der Test ohne Abo endete – ein Admin kann unter Abrechnung abonnieren.',
    },
    {
      q: 'Wie gebe ich jemandem einen Platz?',
      a: 'Klicken Sie auf dem Plan auf einen freien (grünen) Platz und wählen Sie «Person zuweisen». Oder ziehen Sie die Person aus der Liste links auf den Platz.',
    },
    {
      q: 'Jemand wechselt den Platz – muss ich den alten zuerst freigeben?',
      a: 'Nein. Ziehen Sie die Person auf den neuen Platz; der alte wird automatisch frei, und beides bleibt im Verlauf.',
    },
    {
      q: 'Ich habe einen Fehler gemacht. Kann ich ihn rückgängig machen?',
      a: 'Ja. Jede Platzänderung zeigt eine Meldung mit Rückgängig, und in «Plan bearbeiten» macht ⌘Z / Ctrl+Z die letzten Schritte rückgängig.',
    },
    {
      q: 'Kann ich einen Platz löschen?',
      a: 'Nur wenn dort nie jemand sass. Plätze mit Verlauf lassen sich nicht löschen (der Verlauf muss bleiben) – sperren Sie sie stattdessen in «Plan bearbeiten».',
    },
    {
      q: 'Wie importiere ich unsere Leute aus Excel?',
      a: 'Personen & Zugang → Liste importieren. Eine Datei mit einer Spalte für Name und E-Mail reicht; Seatline zeigt vor dem Speichern, was es gefunden hat.',
    },
    {
      q: 'Jemand verlässt die Firma. Was tun?',
      a: 'Setzen Sie im Reiter Änderungen das Austrittsdatum (oder ⋯ → Als ausgetreten markieren). An dem Tag wird der Platz automatisch frei, und die IT erhält eine Mitteilung, falls eingerichtet. Mit Microsoft 365 geschieht das von selbst, sobald die Person dort entfernt wird.',
    },
    {
      q: 'Was bedeuten die Farben auf dem Plan?',
      a: 'Grün: frei. Grau: belegt. Gelb: reserviert. Durchgestrichen: gesperrt. Mit «Plätze einfärben nach: Team» zeigen die Farben Teams.',
    },
    {
      q: 'Wer kann den Plan sehen?',
      a: 'Alle in Ihrem Arbeitsbereich mit einer Rolle (Betrachter, Bearbeiter oder Admin). Niemand ausserhalb, und der QR-Code eines Platzes öffnet sich nur für angemeldete Kolleginnen und Kollegen.',
    },
    {
      q: 'Funktioniert Seatline auf dem Handy?',
      a: 'Ja, im Browser – ohne App-Installation. Plan, Personensuche, Platzseiten und sogar «Plan bearbeiten» funktionieren auf Handy und Tablet.',
    },
    {
      q: 'Wo sind unsere Daten gespeichert?',
      a: 'In der Schweiz, in Microsoft Azure (Zürich), samt Backups. Seatline hält sich an das Schweizer nDSG und die DSGVO.',
    },
    {
      q: 'Wie erhalte ich den Auftragsverarbeitungsvertrag?',
      a: 'Personen & Zugang → Einstellungen → Datenschutz → AVV per E-Mail senden (PDF).',
    },
    {
      q: 'Was kostet Seatline?',
      a: 'CHF 2 pro aktivem Platz und Monat. Gesperrte Plätze sind gratis, die ersten 30 Tage auch, und Sie können jeden Monat kündigen.',
    },
    {
      q: 'Was passiert nach dem Test?',
      a: 'Ein Admin abonniert unter Abrechnung. Tut das niemand, wird der Arbeitsbereich schreibgeschützt: alles bleibt sichtbar, nichts wird gelöscht.',
    },
    {
      q: 'Unser Architektenplan ist eine DWG-Datei.',
      a: 'Speichern Sie ihn im CAD-Programm als DXF oder PDF (oder fragen Sie den Architekten) und verwenden Sie dann Plan hinzufügen → Architektenplan importieren.',
    },
    {
      q: 'Können wir ein ganzes Team auf einmal umziehen?',
      a: 'Ja: Umzugsplan erstellen, auf dem Plan öffnen und «Team umziehen» verwenden. Mit einem Datum geplant, passieren die Umzüge früh morgens an diesem Tag.',
    },
    {
      q: 'Ich brauche Hilfe, die hier fehlt.',
      a: 'Schreiben Sie an hello@seatline.ch.',
    },
  ],
};
