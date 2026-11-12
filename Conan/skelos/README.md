# Livre de Skelos — module pour le Compagnon de Conan

Un Livre de Skelos numérique, utilisable en pleine partie, intégré comme une nouvelle entrée du menu (« Skelos »).

## Ce que fait le module

**Le plateau de l’Overlord**
- La Rivière de 8 cases, avec les vraies tuiles dessinées par `Tile._cardCode` ; coût de chaque case affiché par un pion.
- Activation en touchant la tuile puis son pion de coût (passé au rouge) : paiement, tuile au bout de la Rivière, glissement des autres. Blocage si gemmes insuffisantes ou activations du tour épuisées.
- Énergie, fatigue, récupération ; les gemmes sont conservées (transferts 1 → Fatigue / Énergie ← 1), le total ne change que par les paramètres ou la dépollution.
- Améliorations ponctuelles (mouvement, relance, défense active, sort), passage en fatigue en fin de tour.
- Phases Héros / Overlord, compte-tour à partir du tour 0, limite de tours.
- Points de vie des lieutenants et monstres (appui long sur le cœur), tuiles mortes, renfort, dépollution.
- Mode solo / coop : pioche de jetons, nombre d’activations égal au nombre de héros, rafraîchissement de la réserve, précisions solo des compétences.
- Compétences lisibles au survol ou à l’appui long, annulation illimitée, sauvegarde automatique.
- Paramètres modifiables en cours de partie, appliqués immédiatement (total de gemmes, répartition, récupération, tuile ajoutée au bout de la Rivière…).

**Autour du plateau**
- Accueil, partie libre, scénarios enregistrés.
- Campagnes : fil des scénarios (préparer, lancer, date, points de victoire, rang selon un barème réglable), compagnie (couleur, archétype libre, héros tombés), cache commune (équipements, sorts, améliorations, liseré à la couleur du héros), journal.
- Sélecteur de cartes en trois onglets avec sélection multiple ; les cartes d’équipement et de sort sont dessinées par `CardEquipment` et `CardSpell`.
- Encyclopédie locale des améliorations de campagne (création, import, export).
- Réglages : image de fond personnelle du plateau (zoom, décalage), export / import de toutes les données.

**Interface (version 2)**
- Charte du Compagnon : thèmes clair et sombre (bascule dans l’en-tête), onglets Partie, Campagnes, Scénarios et Améliorations, boîtes de dialogue plein écran, bouton rond de création, panneau de filtres.
- Jetons du jeu issus des données du Compagnon : pions numérotés pour les coûts de la Rivière, jeton Compte-tour, gemmes rouges ; icônes de mouvement, relance, défense active et sort issues du Compagnon.
- Au-dessus des tuiles 6 à 8 : tour et activations ; phase, bouton Commencer ou Terminer, annuler et paramètres ; étapes du tour (automatiques pour l’Overlord, rappel pour les Héros).
- Une description par tuile Événement, saisie à la préparation et affichée au survol ou à l’appui long.
- Boutons − et + sur tous les champs numériques.
- Mode plein écran (en-tête et navigation masqués), affichage adapté au téléphone en portrait et en paysage.
- Icônes personnalisées : l’utilisateur peut charger ses propres images pour le mouvement, la relance et la défense active ; elles restent sur son appareil et ne font pas partie du module.

Principe retenu : l’utilisateur reste maître des règles. L’application propose des valeurs (points de victoire, coûts…) mais tout reste modifiable, sauf les blocages du plateau (gemmes, activations).

## Fichiers

Nouveaux, dans `Conan/skelos/` :
- `skelos.js` : le plateau et la préparation ;
- `skelos_app.js` : navigation, campagnes, sélecteur, encyclopédie des améliorations, réglages, fin de scénario ;
- `skelos_ui.js` : interface à la charte du Compagnon (jetons, commandes, étapes, onglets, dialogues, plein écran, icônes personnalisées) ;
- `skelos_companion.js` : branchement au Compagnon (`Nav.addIcon`, attente des données de l’encyclopédie, hauteur de la barre de navigation) ;
- `skelos.css` ;
- `lang/skelos.fr.js`, `lang/skelos.en.js`, `lang/skelos.it.js`.

Modifiés :
- `Conan/Files.json` : ajout du CSS et des scripts ;
- `Conan/general/sw-files.js` : ajout des fichiers du module pour le mode hors ligne (à régénérer avec votre outil si besoin).

Le correctif `skelos.patch` contient l’ensemble (`git apply skelos.patch` à la racine du dépôt).

## Intégration au Compagnon
- Les données viennent de `Encyclopedia` (tuiles, compétences, extensions, équipements, sorts, héros) ; les boîtes possédées viennent de `Extensions`.
- Les données propres au module sont dans le `localStorage`, préfixées par `Application` : `Conan_SkelosGame`, `Conan_SkelosScenarios`, `Conan_SkelosCampaigns`, `Conan_SkelosUpgrades`, `Conan_SkelosPrefs`, `Conan_SkelosBackground`.
- Aucune image ni donnée de Monolith n’est ajoutée. Les pions (sablier, gemmes, médaillons) et l’habillage du plateau sont des créations originales en CSS/SVG.

## Testé
Avec le dépôt servi en local (Chromium, 1180 × 820, français et anglais) : partie libre, partie classique complète, mode solo, campagne de bout en bout (héros, cache, lancement, paramètres en cours de partie, fin de scénario avec butin et héros tombé), encyclopédie, réglages. Aucune erreur JavaScript.

## Reste à faire
- Traduction italienne : `lang/skelos.it.js` est pour l’instant en anglais.
- Les fonds d’énergie et de fatigue, l’icône de récupération et le dé de relance du Livre de Skelos pourront remplacer les versions actuelles si Monolith fournit ses fichiers : chaque image est définie à un seul endroit (`Skelos.ICON_DEFAULTS` et `skelos.css`).
