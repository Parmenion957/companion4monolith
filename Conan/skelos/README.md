# Livre de Skelos — module pour le Compagnon de Conan

Un Livre de Skelos numérique pour jouer à la table, sur iPad en paysage (ou sur téléphone), intégré au Compagnon comme une nouvelle entrée du menu : « Skelos ».

Le plateau reproduit le vrai livre de l'Overlord : rien n'est calculé à la place du joueur. Les gemmes, les jetons, les tuiles, le sablier et les points de vie se déplacent au doigt, comme les pièces du jeu. L'application garde la partie, permet d'annuler et note tout au Journal.

## Le plateau

Le bureau porte la **piste des tours** en haut. Le livre a ensuite quatre bandes :

1. **Mouvement, Défense active, Relance** : les zones où l'on dépense des gemmes.
2. **Énergie disponible** (vert), **tuile de repos** avec la Récupération, **Fatigue** (rouge).
3. **Pions gemmes numérotés 1 à 8** : le coût de chaque case.
4. **Les tuiles** de la Rivière, avec leurs points de vie, leurs gemmes et leurs cartes.

### Gestes

| Geste | Effet |
|---|---|
| Glisser une gemme d'une zone à l'autre | déplace une gemme |
| Appui long sur une zone, puis glisser | prend plusieurs gemmes : le nombre monte tant que le doigt reste posé, la pastille rebondit à chaque gemme |
| Appui long puis lâcher sans bouger | garde les gemmes « en main » ; l'appui suivant sur une zone ou une tuile les y pose |
| Glisser des gemmes sur une tuile | les pose sur la tuile ; si la tuile porte des cartes, une fenêtre « tuile + cartes » s'ouvre pour choisir où les poser |
| Double appui sur la case Récupération | récupération : tout ce qui est dépensé passe en Fatigue, puis la Récupération revient vers l'Énergie (réglage ; peut aussi avancer le tour) |
| Double appui sur la Fatigue | entretien : ramène en Fatigue toutes les gemmes dépensées (zones, tuiles, cartes), sans Récupération (réglage) |
| Appui long sur une tuile, puis glisser | la tuile se soulève, puis se déplace dans sa bande (un cadre pointillé montre où elle se posera) ; un glissé sans appui long ne fait rien |
| Appui long sur une tuile, puis lâcher | menu : Zoom, Mort, Renfort, Dépolluer |
| Double appui sur une tuile | zoom de la tuile et de ses cartes |
| Glisser le sablier ou la fin de partie | les place sur une case de la piste des tours ; l'alarme sonne au dernier tour |
| Glisser une tuile sur la piste des tours | pose sa pastille de points de vie sur la case de ses PV ; la pastille se déplace ensuite pour changer les PV. Les tuiles qui ont des PV y sont placées d'office dès que la piste est affichée ; une pastille sortie de la piste à la main n'y revient pas |
| Survol ou appui long sur une compétence | sa description (aussi sur les tuiles portées) |

La dernière tuile déplacée, ou en Coop le dernier jeton tiré et la tuile qu'il désigne, portent une auréole dorée jusqu'à la prochaine récupération ou au prochain entretien.

**Fenêtre « tuile + cartes »** : les cartes défilent au doigt, ou seules quand une gemme approche du bord. Emmener une gemme vers le haut ou le bas, hors de la fenêtre, la ferme.

**Zoom** : la tuile en grand, ses sorts à gauche, ses équipements et tuiles portées à droite. Le cœur des points de vie est sur la tuile, au-dessus de la flamme, avec + et − ; le + en pastille au coin bas-droit ajoute des cartes, la corbeille d'une carte la retire. Glisser vers le haut ou le bas sur la tuile passe à la tuile voisine. Le × ou un appui à côté ferme le zoom.

### Aventure et Coop

L'interrupteur **Aventure / Coop** est dans la barre des onglets.

- **Aventure** : l'Overlord joue avec ses gemmes.
- **Coop** (solo ou coopératif) : les jetons non tirés sont dans la zone verte ; un appui y tire un jeton au hasard, qui se pose ensuite sur Mouvement, Défense, Relance ou Fatigue. Dans les zones verte et rouge, les gemmes sont à gauche et les jetons à droite, chacun du côté de son nombre. Un double appui sur la Fatigue range les jetons tirés et les gemmes dépensées ; quand le dernier jeton a été tiré, ils redeviennent tous disponibles.

### Mode studio

Le bouton Studio (crayon) prépare ou corrige la partie :

- la **réserve** (bol, à gauche du livre) : y prendre des gemmes en ajoute au livre, y en reposer en retire ;
- le **tas de tuiles** (à droite) : un appui ouvre le choix des tuiles ; y déposer une tuile la retire ;
- les tuiles se glissent tout de suite, sans appui long ;
- les − et + de la Récupération (1 à 8, puis X), du nombre de héros, des points de vie de départ ;
- la couleur du socle des tuiles qui en ont plusieurs ;
- les cartes des tuiles (sorts, équipements, tuiles portées) et le texte des tuiles Événement.

### Outils

Une icône discrète ouvre la bande d'outils : **Annuler** (les 100 dernières actions, jusqu'au rechargement de la page), **Recommencer** (retour à l'état de départ : celui du lancement, ou de la préparation en studio au tour 0 ; pour un scénario enregistré en cours de partie, le point d'enregistrement), **Terminer** le scénario, **Journal**, **Aide**.

### Téléphone

En portrait étroit ou en paysage bas, le livre se découpe en grille (4 tuiles par rang, chaque pion au-dessus de sa case), la piste des tours est réduite au cadre Tour (sablier et alarme : appui long pour − et +) et les points de vie passent sur les tuiles. Le zoom prend presque toute la largeur.

## Autour du plateau

- **Scénarios** : enregistrer la partie comme scénario (disquette), éditer un scénario sur le même livre en mode studio, le jouer. Le scénario « Dans les griffes des Pictes » est inclus d'office une fois ; supprimé, il ne revient pas.
- **Campagnes** : fil des scénarios (préparer, lancer, date, points de victoire), compagnie de héros (couleur, héros tombés), cache commune (équipements, sorts, améliorations, tuiles), vue d'ensemble de l'équipement, fin de scénario avec butin, journal de campagne. Survol ou appui long sur une compétence d'une fiche de héros : sa description. Une carte de la cache se glisse tout de suite vers un héros en montant ou descendant le doigt ; un glissé horizontal fait défiler la piste.
- **Améliorations** : encyclopédie locale des améliorations de campagne (création, import, export).
- **Réglages** :
  - automatisations, chacune à activer ou non : entretien (double appui sur la Fatigue), récupération (double appui sur la case Récupération), avancée du tour avec la récupération ; en Aventure, activation payante (une tuile vivante glissée en fin de Rivière coûte le pion de sa case, de l'Énergie à la Fatigue) et dépollution à 2 gemmes. Rien ne bloque : s'il manque des gemmes, un message le dit. Aucune automatisation ne se déroule en mode studio ;
  - animations ;
  - piste des tours réduite ;
  - place des points de vie (piste, tuile ou les deux) ;
  - fonds du livre : zone verte, zone rouge, tuile de récupération, pions gemmes 1 à 8. Les images d'origine sont fournies, et chacune peut être remplacée par une image personnelle, qui reste sur l'appareil ;
  - image de fond du bureau ;
  - export et import de toutes les données.

Principe : **l'utilisateur reste maître des règles**. L'application propose des valeurs (coûts, points de victoire) mais ne bloque rien : comme sur le vrai livre, c'est le joueur qui paie, active et range.

## Fichiers

Dans `Conan/skelos/` :

| Fichier | Rôle |
|---|---|
| `skelos.js` | objet `Skelos` : état de partie, préparation, tuiles, points de vie, mort / renfort / purge, annulation, appui long, info-bulles |
| `skelos_app.js` | navigation, campagnes, cache d'objets, sélecteur de cartes, améliorations, réglages, fonds du livre, fin de scénario, import / export |
| `skelos_ui.js` | interface à la charte du Compagnon : onglets, dialogues plein écran, menu des tuiles, studio, cartes des tuiles, Journal, plein écran, icônes |
| `skelos_manuel.js` | **le plateau** : le livre, ses gestes, le zoom, la fenêtre des gemmes, la récupération ; `Skelos.renderGame` y est défini |
| `skelos_anim.js` | cloche du dernier tour |
| `skelos_companion.js` | branchement au Compagnon (`Nav.addIcon`, `Nav.addAction`, attente des données) |
| `skelos.css` | tout le style (thèmes clair et sombre du Compagnon) |
| `lang/skelos.fr.js`, `.en.js`, `.it.js` | textes ; toute chaîne visible passe par `Skelos.t("clé")` |
| `img/` | icônes de mouvement, relance et défense active ; `img/fond/` : fonds du livre, tuile de récupération, pions gemmes |

Le module est déclaré dans `Conan/Files.json` et, pour le hors ligne, dans `Conan/general/sw-files.js`.

L'ordre de chargement compte : chaque fichier peut surcharger des fonctions des précédents (`skelos.js`, `skelos_app.js`, `skelos_ui.js`, `skelos_anim.js`, `skelos_manuel.js`).

## Intégration au Compagnon

- Données du jeu : `Encyclopedia` (tuiles, compétences, extensions, équipements, sorts, héros), boîtes possédées via `Extensions` ; tuiles et cartes dessinées par `Tile`, `CardEquipment` et `CardSpell`.
- Images de Monolith utilisées avec l'autorisation accordée au projet Compagnon.
- Données propres au module, dans le `localStorage` (préfixe `Conan_`) : `SkelosGame`, `SkelosScenarios`, `SkelosCampaigns`, `SkelosUpgrades`, `SkelosPrefs`, `SkelosBackground`, `SkelosSkin`.

## Historique

Le module avait d'abord un plateau automatique (panneau de commandes, activation par le pion de coût). Il a été remplacé par le livre manuel. Son dernier état est conservé dans l'étiquette Git `plateau-auto` (`git checkout plateau-auto`).

## Tester

- Servir le dépôt : `python -m http.server 8080` à la racine, puis `http://localhost:8080/Conan/`, onglet « Skelos ». Recharger avec Ctrl+F5 après une modification (le Compagnon met ses fichiers en cache).
- Console du navigateur : aucune erreur JavaScript.

## Reste à faire

- Traduction italienne : `lang/skelos.it.js` est encore en anglais.
