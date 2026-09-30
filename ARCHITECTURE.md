# Cartooniseur PRO MAX — architecture refactorisée

## Phase 1 — séparation sûre

La logique existante est conservée à l'identique dans `js/app.js` afin de ne pas casser les fonctions actuelles.
Le CSS est sorti de `index.html` vers `css/style.css`.

## Phase 2 — modularisation JavaScript

Le prochain découpage prévu est :

- `js/core/state.js` — état global et constantes
- `js/core/storage.js` — persistance locale puis API
- `js/characters.js` — personnages et identité
- `js/wardrobe.js` — tenues
- `js/scenes.js` — scènes et prompts
- `js/ai.js` — appels IA via backend
- `js/video.js` — génération/enregistrement vidéo
- `js/studio3d.js` — Three.js/VR/export
- `js/ui.js` — interface, modales, notifications

Cette phase doit être réalisée après tests de la version séparée, car le code actuel utilise de nombreuses fonctions et variables partagées.

## Phase 3 — backend

Les secrets API, quotas, authentification, stockage distant et tâches de rendu doivent être déplacés côté serveur.
