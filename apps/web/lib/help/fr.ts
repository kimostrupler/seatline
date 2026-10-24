import type { HelpContent } from './types';

export const FR: HelpContent = {
  topics: {
    'getting-started': {
      title: 'Bien démarrer',
      summary: 'Créez votre espace et mettez votre bureau dans Seatline en quelques minutes.',
      steps: [
        {
          title: 'S’inscrire ou essayer la démo',
          text: [
            'Sur seatline.ch, choisissez « Essayer 30 jours gratuitement ». Connectez-vous avec votre compte professionnel Microsoft 365, ou saisissez votre e-mail professionnel et cliquez sur le lien que nous vous envoyons. Sans mot de passe ni carte de crédit.',
            'Vous voulez juste regarder ? « Essayer la démo » ouvre un bureau d’exemple modifiable librement, sans compte.',
          ],
        },
        {
          title: 'Nommer votre espace',
          text: [
            'À la première connexion, Seatline demande le nom de votre organisation. Vous en devenez l’admin. Avec Microsoft 365, vos collègues de la même organisation rejoignent automatiquement le même espace.',
          ],
        },
        {
          title: 'Configurer votre bureau en deux étapes',
          text: [
            'Juste après, Seatline demande votre bâtiment, le nom de l’étage et la taille du bureau (Petit 12, Moyen 33 ou Grand 74 places, ou un étage vide). Il dessine un bureau d’exemple pour vous ; vous l’adaptez ensuite dans « Modifier le plan ».',
            'Choisissez ensuite comment vos collègues arrivent : importer une liste Excel ou CSV, les ajouter un par un ou – avec Microsoft 365 – les reprendre de votre annuaire. À la première ouverture du plan, trois courts conseils montrent comment ça marche.',
          ],
          image: 'setup',
        },
        {
          title: 'Suivre la liste sur l’accueil',
          text: [
            'L’accueil affiche la liste « Bien démarrer avec Seatline » : ajouter votre bâtiment, dessiner un étage avec des postes, ajouter vos collègues et attribuer les postes. Chaque étape a un bouton qui vous mène au bon endroit et se coche toute seule.',
            'L’accueil montre aussi le taux d’occupation de chaque étage, qui n’a pas encore de poste et ce qui a changé cette semaine.',
          ],
          image: 'home',
        },
      ],
      tips: [
        'Le départ le plus rapide : laissez la configuration dessiner un bureau d’exemple, puis déplacez les places et renommez les salles comme chez vous.',
        'Tout peut être annulé, et chaque changement de place reste dans l’historique.',
      ],
    },
    floors: {
      title: 'Bâtiments et étages',
      summary:
        'Ajoutez vos bâtiments et étages, partez d’un bureau d’exemple ou importez le plan de votre architecte.',
      steps: [
        {
          title: 'Ajouter un bâtiment et un étage',
          text: [
            'Ouvrez Plan. À gauche, cliquez sur + à côté de Bâtiment, saisissez nom et adresse, puis sur + à côté d’Étage. Donnez un nom à l’étage (p. ex. « 3e étage ») et un niveau ; les numéros de poste suivent le niveau (3.01, 3.02 …).',
          ],
        },
        {
          title: 'Partir d’un bureau d’exemple',
          text: [
            'Un nouvel étage s’ouvre dans « Modifier le plan » et propose des bureaux tout faits : Petit (12 postes), Moyen (33) et Grand (74), avec salles de réunion, bureaux, accueil et cuisine.',
            'Choisissez-en un, puis déplacez, renommez ou supprimez ce qui ne correspond pas. Annuler retire tout l’exemple d’un coup. Vous préférez dessiner ? Choisissez « Commencer avec un étage vide ».',
          ],
          image: 'edit-template',
        },
        {
          title: 'L’adapter à votre bureau',
          text: [
            'Glissez pièces et postes à leur place, redimensionnez les pièces par leurs coins et côtés, et renommez-les dans le panneau de droite. Les changements s’enregistrent tout seuls.',
          ],
          image: 'edit-example',
        },
        {
          title: 'Ou utiliser le plan de l’architecte',
          text: [
            'À droite, ouvrez Ajouter un plan → Importer un plan d’architecte et choisissez un fichier DXF, PDF ou une image. Seatline en propose pièces et postes ; touchez une proposition pour l’écarter, puis importez. Le plan reste en arrière-plan, vous dessinez par-dessus.',
            'Importer une image place seulement une image derrière l’étage. Définissez l’échelle avec la règle (M) : glissez le long d’un mur dont vous connaissez la longueur, et les postes sont dessinés à leur taille réelle.',
          ],
        },
      ],
      tips: [
        'Plusieurs étages semblables ? ⋯ → Dupliquer l’étage : mêmes pièces et postes, numérotés pour le nouveau niveau, sans personnes.',
        'Fichiers DWG : enregistrez-les d’abord en DXF ou PDF dans le logiciel de CAO.',
      ],
    },
    editor: {
      title: 'Dessiner le plan',
      summary:
        'Pièces, postes, salles de réunion, cuisines et sorties : les outils de « Modifier le plan ».',
      steps: [
        {
          title: 'Passer à « Modifier le plan »',
          text: [
            'Sur le plan, cliquez sur « Modifier le plan » en haut à droite. Les outils apparaissent à gauche, les détails de ce que vous sélectionnez à droite. Seuls les éditeurs et les admins le voient.',
          ],
          image: 'edit',
        },
        {
          title: 'Dessiner les pièces et placer les postes',
          text: [
            'Dessiner une pièce rectangulaire (B) : tirez un rectangle. Dessiner une pièce par ses coins (P) : cliquez chaque coin, double-cliquez pour terminer. Ajouter une place (S) : cliquez là où se trouve un poste. Sélectionnez une pièce pour lui donner un nom, un type (bureau, open space, salle de réunion) et, pour les salles de réunion, places et équipement.',
          ],
        },
        {
          title: 'Cuisines, imprimantes et sorties',
          text: [
            'Ajouter un repère (K) et cliquez là où se trouvent cuisine, imprimante, sortie ou premiers secours, puis choisissez à droite ce que c’est. Les repères aident à s’orienter.',
          ],
        },
        {
          title: 'Numérotation, copie et annulation',
          text: [
            'Les numéros suivent l’étage (3.01, 3.02 …) ou la pièce (12-A, 12-B …) ; choisissez sous Numérotation et cliquez sur « Renuméroter les postes » pour l’appliquer à tous.',
            'Sélectionnez plusieurs éléments avec Maj-clic ou Maj-glisser, puis copiez (⌘C / Ctrl+C) et collez (⌘V / Ctrl+V), même sur un autre étage. Annulez avec ⌘Z / Ctrl+Z. ? affiche tous les raccourcis.',
          ],
        },
      ],
      tips: [
        'Glissez sur une zone vide pour vous déplacer ; faites défiler ou pincez pour zoomer.',
        'Les postes déjà occupés une fois ne peuvent pas être supprimés (l’historique doit rester) — bloquez-les plutôt.',
        '« Modifier le plan » fonctionne aussi sur tablette et téléphone : les détails s’ouvrent sous l’étage.',
      ],
    },
    seating: {
      title: 'Attribuer les postes',
      summary: 'Attribuer, déménager, réserver et libérer des postes — et voir qui est assis où.',
      steps: [
        {
          title: 'Cliquer sur un poste',
          text: [
            'Les postes verts sont libres, les gris occupés, les jaunes réservés. Cliquez sur un poste pour voir qui y est assis, depuis quand et qui l’occupait avant.',
          ],
          image: 'map-seat',
        },
        {
          title: 'Attribuer ou déménager',
          text: [
            'Cliquez sur un poste libre (vert), choisissez « Attribuer une personne », puis la personne. Ou glissez un nom de la liste de gauche sur le poste. Si elle a déjà un poste, c’est un déménagement : l’ancien devient libre.',
            'Chaque changement affiche un message avec Annuler. L’historique garde le changement et l’annulation.',
          ],
        },
        {
          title: 'Réserver ou libérer',
          text: [
            'Cliquez sur un poste libre, choisissez Réserver et indiquez pour qui (p. ex. « Nouvelle collaboratrice en mai »). Pour terminer, cliquez sur le poste et choisissez « Libérer la place » ou « Annuler la réservation ».',
          ],
        },
        {
          title: 'Trouver une personne ou un poste libre',
          text: [
            'Saisissez un nom dans la recherche de gauche et cliquez sur la personne : vous voyez son poste et son historique. « Trouver un poste libre » filtre les postes libres selon leur équipement — bureau debout, deux écrans, près de la fenêtre.',
            '« Colorer les places par : Équipe » affiche chaque équipe dans sa couleur.',
          ],
        },
      ],
      tips: [
        'Les lecteurs voient tout mais ne modifient pas les postes ; demandez à un éditeur ou un admin.',
        'Les collaborateurs peuvent recevoir un e-mail pour leur nouveau poste (Personnes et accès → Réglages → Avis).',
      ],
    },
    people: {
      title: 'Personnes et accès',
      summary:
        'Ajoutez vos collègues à la main, depuis Excel ou Microsoft 365, et décidez qui peut faire quoi.',
      steps: [
        {
          title: 'Ouvrir Personnes et accès',
          text: [
            'Les admins trouvent tout le monde sous « Personnes et accès » : équipe, poste, rôle et si la personne travaille encore ici. Filtrez les personnes sans poste, celles qui partent bientôt ou qui sont parties.',
          ],
          image: 'people',
        },
        {
          title: 'Ajouter une personne',
          text: [
            'Cliquez sur « Ajouter une personne », saisissez nom et e-mail, éventuellement équipe et rôle. Laissez « Envoyer une invitation de connexion par e-mail » activé pour qu’elle puisse se connecter tout de suite.',
          ],
          image: 'people-add',
        },
        {
          title: 'Importer une liste Excel',
          text: [
            'Cliquez sur « Importer une liste » et choisissez un fichier Excel ou CSV avec nom et e-mail (et équipe ou fonction si vous les avez). Les titres de colonnes peuvent être en français, allemand ou anglais. Seatline montre les lignes nouvelles avant d’enregistrer.',
          ],
          image: 'people-import',
        },
        {
          title: 'Microsoft 365 et rôles',
          text: [
            'Avec Microsoft 365, personnes et équipes sont mises à jour chaque nuit depuis votre annuaire (Réglages → « Synchroniser maintenant » pour le faire tout de suite). Votre IT approuve Seatline une fois.',
            'Rôles : les lecteurs voient le plan, les éditeurs modifient postes et plans, les admins gèrent aussi personnes et réglages. Les personnes « sans accès » peuvent quand même avoir un poste.',
          ],
        },
      ],
    },
    'microsoft-365': {
      title: 'Microsoft 365 : approbation par l’IT',
      summary:
        'Pour les admins IT : ce que Seatline demande à Microsoft 365, comment l’approuver une fois, comment le limiter ou le retirer.',
      steps: [
        {
          title: 'Ce que Seatline demande',
          text: [
            'Connexion : vos collègues se connectent avec leur compte professionnel Microsoft 365. Seatline reçoit leur nom, leur adresse e-mail et leur identifiant Microsoft (autorisations openid, profile, email et User.Read).',
            'Liste des personnes, pour la mise à jour de nuit : l’autorisation d’application User.Read.All (« Lire les profils complets de tous les utilisateurs »). Seatline n’en garde que le nom, l’e-mail, le service, la fonction et si le compte est actif. Les comptes invités sont ignorés.',
            'Seatline n’écrit jamais rien dans Microsoft 365 et ne lit ni e-mails, ni calendriers, ni fichiers, ni Teams.',
          ],
        },
        {
          title: 'Qui peut entrer',
          text: [
            'La première personne de votre organisation qui se connecte crée l’espace de travail et en devient l’admin. Toutes les autres personnes de la même organisation rejoignent cet espace en se connectant — votre organisation n’en a jamais un deuxième.',
            'Un admin choisit ce que reçoivent les nouveaux sous Personnes et accès → Réglages → Qui peut ouvrir Seatline : « Tout le monde dans l’organisation peut consulter le plan » (ils commencent comme Lecteur) ou « Seulement les personnes à qui vous donnez un rôle ».',
          ],
        },
        {
          title: 'Approuver Seatline une fois',
          text: [
            'La liste des personnes demande toujours l’approbation d’un admin. Dans Seatline, un admin ouvre Personnes et accès → Réglages → Microsoft 365 et clique sur Synchroniser maintenant. Si l’approbation manque encore, le bouton Approuver chez Microsoft apparaît : un administrateur général ou un administrateur de rôle privilégié clique dessus et accepte.',
            'Si votre organisation ne permet pas aux personnes d’approuver elles-mêmes des applications, la première personne voit déjà à la connexion un message demandant l’approbation d’un administrateur. L’IT ouvre alors le lien d’approbation ci-dessous et accepte — cela couvre la connexion et la liste des personnes ensemble.',
          ],
          approvalLink: 'Lien d’approbation pour l’IT :',
        },
        {
          title: 'Limiter Seatline à certaines personnes (facultatif)',
          text: [
            'Dans le centre d’administration Microsoft Entra, ouvrez Applications d’entreprise → Seatline → Propriétés, mettez « Affectation obligatoire ? » sur Oui et enregistrez. Ajoutez ensuite sous Utilisateurs et groupes les personnes ou groupes qui peuvent se connecter.',
            'Cela limite qui peut se connecter. La liste des personnes de nuit vient toujours de tout l’annuaire, ainsi tout le monde peut recevoir une place.',
          ],
        },
        {
          title: 'Retirer l’approbation',
          text: [
            'Dans le centre d’administration Microsoft Entra, Applications d’entreprise → Seatline → Propriétés → Supprimer retire Seatline de votre organisation. Les nouvelles connexions et la mise à jour de nuit s’arrêtent tout de suite ; une personne déjà connectée le reste jusqu’à 30 jours.',
            'Vos données dans Seatline restent jusqu’à la suppression de votre espace de travail. Pour cela, écrivez à hello@seatline.ch.',
          ],
        },
      ],
      tips: [
        'Tout le monde se connecte via Microsoft : vos règles MFA et d’accès conditionnel s’appliquent comme d’habitude.',
        'Les personnes supprimées ou désactivées dans Microsoft 365 perdent l’accès et leur place la nuit suivante ; leur historique de places reste.',
        'Vos données restent en Suisse (Microsoft Azure, Zurich). L’accord de traitement des données se trouve sur seatline.ch/legal/dpa.',
      ],
    },
    'teams-and-changes': {
      title: 'Équipes, changements RH et avis',
      summary:
        'Garder les équipes à jour, gérer arrivées et départs, et informer l’IT automatiquement.',
      steps: [
        {
          title: 'Équipes',
          text: [
            'L’onglet Équipes montre chaque équipe avec le nombre de personnes placées et leurs étages. Renommez ou supprimez une équipe, ou ajoutez-y des personnes. Les équipes viennent du service dans Microsoft 365 ; une équipe définie à la main est conservée.',
          ],
          image: 'teams',
        },
        {
          title: 'Plusieurs changements à la fois',
          text: [
            'Dans l’onglet Changements, modifiez équipe, rôle et date de départ pour plusieurs personnes, puis enregistrez — tout ensemble ou rien.',
            'Le jour du départ, tôt le matin, la personne est marquée comme partie et son poste devient libre. Son historique reste.',
          ],
          image: 'changes',
        },
        {
          title: 'Avis à l’IT ou au facility management',
          text: [
            'Dans Réglages → Avis, ajoutez les adresses à informer (p. ex. it@entreprise.ch) et choisissez quoi : départ, arrivée, changement d’équipe ou plan de déménagement exécuté. Un court e-mail par changement.',
          ],
          image: 'settings',
        },
      ],
    },
    moves: {
      title: 'Planifier des déménagements',
      summary:
        'Préparer le déménagement d’une équipe, le vérifier sur le plan et le faire exécuter le jour choisi.',
      steps: [
        {
          title: 'Créer un plan de déménagement',
          text: [
            'Ouvrez Déménagements et cliquez sur « Nouveau plan de déménagement ». Donnez-lui un nom (p. ex. « Ventes au 2e étage »). Rien ne change sur le vrai plan tant que le plan n’est pas appliqué.',
          ],
          image: 'moves',
        },
        {
          title: 'Planifier sur le plan',
          text: [
            'Cliquez sur « Planifier sur le plan ». Le plan montre l’étage tel qu’il sera : glissez les personnes sur les postes comme d’habitude — chaque déménagement s’ajoute au plan. « Déménager une équipe » place toute une équipe d’un coup.',
          ],
          image: 'move-map',
        },
        {
          title: 'Vérifier et programmer',
          text: [
            'La page du plan liste chaque déménagement et signale les problèmes (poste occupé par quelqu’un qui ne bouge pas, poste bloqué, poste demandé deux fois). Choisissez « Programmer » pour une date — les déménagements ont lieu tôt ce matin-là — ou « Appliquer maintenant ».',
          ],
          image: 'move-plan',
        },
        {
          title: 'Liste de déménagement',
          text: [
            'La liste de déménagement imprime chaque déménagement trié par point de départ, avec une case à cocher par ligne et des lignes de signature.',
          ],
        },
      ],
      tips: ['Un plan programmé est verrouillé ; « Revenir au brouillon » le rend modifiable.'],
    },
    'home-planning-activity': {
      title: 'Accueil, planification et activité',
      summary:
        'Votre tableau de bord, la planification des espaces pour les équipes qui grandissent et le journal complet.',
      steps: [
        {
          title: 'Organiser l’accueil',
          text: [
            'Cliquez sur « Personnaliser » pour ajouter, déplacer, agrandir ou retirer des widgets : postes libres par étage, personnes sans poste, réservations, tendance de la semaine et plus. Les admins peuvent enregistrer leur disposition comme standard de l’entreprise.',
          ],
          image: 'home',
        },
        {
          title: 'Planification des espaces',
          text: [
            'Sous Planification, indiquez combien de personnes chaque équipe attend et pour quand. Seatline compare avec les postes libres et montre combien il en manquera.',
          ],
          image: 'planning',
        },
        {
          title: 'Activité : qui a changé quoi',
          text: [
            'Activité liste chaque changement en mots simples, du plus récent au plus ancien. Cherchez une personne, un poste ou une pièce, ou filtrez par type de changement.',
          ],
          image: 'activity',
        },
      ],
    },
    'exports-and-qr': {
      title: 'Exports, impression et QR codes',
      summary:
        'Listes d’occupation pour Excel, plans d’étage imprimés et étiquettes QR pour chaque poste.',
      steps: [
        {
          title: 'Menu Exporter',
          text: [
            '« Exporter » (sur l’accueil et sur le plan) fournit la liste d’occupation en Excel ou CSV, l’historique des places, un plan d’étage imprimable (à enregistrer en PDF) et les QR codes des places.',
          ],
          image: 'export-menu',
        },
        {
          title: 'Étiquettes QR pour les postes',
          text: [
            '« QR codes des places » imprime 12 étiquettes par feuille A4, jamais coupées entre deux pages. Collez-en une sur chaque poste.',
          ],
          image: 'qr',
        },
        {
          title: 'Ce qu’ouvre une étiquette',
          text: [
            'En scannant une étiquette avec un téléphone, on voit la page du poste : qui y est assis, équipe et e-mail, équipement et historique. Seuls les collègues connectés à votre espace la voient.',
          ],
          image: 'desk-phone',
        },
      ],
    },
    'privacy-and-billing': {
      title: 'Protection des données, DPA et facturation',
      summary:
        'Durée de conservation de l’historique, demandes des collaborateurs, l’accord de sous-traitance et votre abonnement.',
      steps: [
        {
          title: 'Durée de conservation',
          text: [
            'Sous Personnes et accès → Réglages → Protection des données, choisissez combien de temps l’historique et l’activité sont gardés (1, 2, 5 ou 10 ans). Le plus ancien est supprimé chaque nuit et les personnes parties sont anonymisées.',
          ],
          image: 'privacy',
        },
        {
          title: 'Demandes des collaborateurs',
          text: [
            'À côté de chaque personne, ⋯ → « Télécharger ses données » fournit tout ce que Seatline enregistre sur elle. « Oublier cette personne » supprime les données personnelles d’une personne partie ; son historique reste sous « Ancien·ne employé·e ».',
          ],
        },
        {
          title: 'Accord de sous-traitance (DPA)',
          text: [
            'Le DPA fait partie des conditions et s’applique déjà à votre espace. « M’envoyer le DPA par e-mail (PDF) » vous en envoie une copie au nom de votre entreprise pour vos dossiers.',
          ],
        },
        {
          title: 'Abonnement',
          text: [
            'Les 30 premiers jours sont gratuits. Les admins s’abonnent sous Facturation (CHF 2 par poste actif et par mois) ; les jours d’essai restants restent gratuits. Sans abonnement, l’espace passe en lecture seule après l’essai — rien n’est supprimé.',
          ],
        },
      ],
    },
  },
  faq: [
    {
      q: 'Je n’ai pas reçu l’e-mail de connexion.',
      a: 'Regardez dans vos courriers indésirables et attendez une minute. Le lien fonctionne une fois, pendant 15 minutes ; demandez-en un nouveau s’il a expiré. Si votre entreprise utilise Microsoft 365, connectez-vous avec Microsoft.',
    },
    {
      q: 'Pourquoi ne puis-je rien modifier ?',
      a: 'Soit votre rôle est Lecteur (un admin peut vous rendre éditeur), soit l’espace est en lecture seule parce que l’essai s’est terminé sans abonnement — un admin peut s’abonner sous Facturation.',
    },
    {
      q: 'Comment attribuer un poste ?',
      a: 'Sur le plan, cliquez sur un poste libre (vert) et choisissez « Attribuer une personne ». Ou glissez la personne de la liste de gauche sur le poste.',
    },
    {
      q: 'Quelqu’un change de poste — dois-je d’abord libérer l’ancien ?',
      a: 'Non. Glissez la personne sur le nouveau poste ; l’ancien devient libre automatiquement et les deux restent dans l’historique.',
    },
    {
      q: 'J’ai fait une erreur. Puis-je l’annuler ?',
      a: 'Oui. Chaque changement de place affiche un message avec Annuler, et dans « Modifier le plan » ⌘Z / Ctrl+Z annule vos dernières étapes.',
    },
    {
      q: 'Puis-je supprimer un poste ?',
      a: 'Seulement si personne ne l’a jamais occupé. Les postes avec historique ne peuvent pas être supprimés (l’historique doit rester) — bloquez-les plutôt dans « Modifier le plan ».',
    },
    {
      q: 'Comment importer nos collaborateurs depuis Excel ?',
      a: 'Personnes et accès → Importer une liste. Un fichier avec une colonne nom et une colonne e-mail suffit ; Seatline montre ce qu’il a trouvé avant d’enregistrer.',
    },
    {
      q: 'Quelqu’un quitte l’entreprise. Que faire ?',
      a: 'Indiquez sa date de départ dans l’onglet Changements (ou ⋯ → Marquer comme parti·e). Ce jour-là, son poste se libère automatiquement et l’IT reçoit un avis si vous l’avez configuré. Avec Microsoft 365, cela se fait tout seul quand la personne y est supprimée.',
    },
    {
      q: 'Que signifient les couleurs du plan ?',
      a: 'Vert : libre. Gris : occupé. Jaune : réservé. Barré : bloqué. Avec « Colorer les places par : Équipe », les couleurs montrent les équipes.',
    },
    {
      q: 'Qui peut voir le plan ?',
      a: 'Toutes les personnes de votre espace qui ont un rôle (Lecteur, Éditeur ou Admin). Personne à l’extérieur, et le QR code d’un poste ne s’ouvre que pour des collègues connectés.',
    },
    {
      q: 'Seatline fonctionne-t-il sur téléphone ?',
      a: 'Oui, dans le navigateur — sans app à installer. Plan, recherche de personnes, pages de poste et même « Modifier le plan » fonctionnent sur téléphone et tablette.',
    },
    {
      q: 'Où sont stockées nos données ?',
      a: 'En Suisse, dans Microsoft Azure (Zurich), sauvegardes comprises. Seatline respecte la nLPD suisse et le RGPD.',
    },
    {
      q: 'Comment obtenir l’accord de sous-traitance ?',
      a: 'Personnes et accès → Réglages → Protection des données → M’envoyer le DPA par e-mail (PDF).',
    },
    {
      q: 'Combien coûte Seatline ?',
      a: 'CHF 2 par poste actif et par mois. Les postes bloqués sont gratuits, les 30 premiers jours aussi, et vous pouvez résilier chaque mois.',
    },
    {
      q: 'Que se passe-t-il après l’essai ?',
      a: 'Un admin s’abonne sous Facturation. Sinon, l’espace passe en lecture seule : tout reste visible et rien n’est supprimé.',
    },
    {
      q: 'Le plan de notre architecte est un fichier DWG.',
      a: 'Enregistrez-le en DXF ou PDF dans le logiciel de CAO (ou demandez à l’architecte), puis utilisez Ajouter un plan → Importer un plan d’architecte.',
    },
    {
      q: 'Peut-on déménager toute une équipe d’un coup ?',
      a: 'Oui : créez un plan de déménagement, ouvrez-le sur le plan et utilisez « Déménager une équipe ». Programmé pour une date, il s’exécute tôt ce matin-là.',
    },
    {
      q: 'J’ai besoin d’une aide qui ne figure pas ici.',
      a: 'Écrivez à hello@seatline.ch.',
    },
  ],
};
