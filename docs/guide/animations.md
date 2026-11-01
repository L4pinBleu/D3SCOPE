# Animations

L'animation passe par un **pilote** (`AnimationDriver`). Le core fournit un
pilote par défaut basé sur l'API Web Animations, sans dépendance.
Le pilote `motion` (motion.dev, MIT) est disponible en option.

## Effet de fondu

```ts
import { fadeIn } from '@d3scope/core/animation';

await fadeIn(document.querySelector('#chart')!, { duration: 300, delay: 0 });
```

`fadeIn` fait apparaître l'élément (opacité et translation de 4 px). Options :

- `duration` : en millisecondes, 300 par défaut.
- `delay` : en millisecondes, 0 par défaut.
- `easing` : easing CSS, `ease-out` par défaut.

**Préférence « moins de mouvement »** : si le système de l'utilisateur la
demande (`prefers-reduced-motion: reduce`), `fadeIn` ne joue aucune animation et
se termine immédiatement. C'est le cas pour `fadeIn`, le seul effet du core
pour l'instant.

## Utiliser le pilote `motion`

`motion` est une dépendance optionnelle. Installez-la si vous importez ce
sous-chemin :

```bash
pnpm add motion
```

```ts
import { setAnimationDriver, fadeIn } from '@d3scope/core/animation';
import { motionDriver } from '@d3scope/core/animation/motion';

setAnimationDriver(motionDriver);
await fadeIn(document.querySelector('#chart')!);
```

## Écrire son pilote

Un pilote implémente `AnimationDriver` :

```ts
import type { AnimationDriver } from '@d3scope/core/animation';

const myDriver: AnimationDriver = {
  name: 'mon-pilote',
  animate(el, keyframes, options) {
    // options.duration (ms), options.delay (ms), options.easing (CSS)
    // Retourner une promesse résolue à la fin de l'animation.
    return Promise.resolve();
  },
};
```

## Limites de la v0.1

- Les graphiques n'appellent pas encore `fadeIn` seuls : l'intro automatique
  n'existe pas. Il faut l'appeler soi-même.
- Les transitions de données (`d3-transition`) ne sont pas encore branchées.
  Le choix du pilote par défaut est documenté dans le `PLAN.md` (§6).
