# Démarrage rapide

D3SCOPE est une librairie de graphiques construite sur D3. Ce guide couvre
l'usage direct du core : graphiques, export, format et thème.

> **Statut** : version `0.1.0`. Le core n'est pas encore publié sur npm : il
> s'utilise depuis le dépôt (`pnpm install && pnpm build`). L'API est stable
> pour les graphiques décrits ici, mais peut évoluer avant la `1.0`.

## Installation depuis le dépôt

```bash
git clone https://github.com/L4pinBleu/D3SCOPE.git
cd D3SCOPE
pnpm install
pnpm build   # produit packages/core/dist
```

Le core est importé depuis `@d3scope/core`. Les sous-chemins sont listés dans
[`packages/core/package.json`](../../packages/core/package.json).

## Premier graphique

Un graphique se dessine dans un élément `<svg>` existant. La taille est fixée
par les options, pas par CSS.

```html
<svg id="chart"></svg>
```

```ts
import { renderBarChart } from '@d3scope/core';

const svg = document.querySelector<SVGSVGElement>('#chart');
if (!svg) throw new Error('#chart introuvable');

renderBarChart(
  svg,
  [
    { label: 'Jan', value: 12 },
    { label: 'Fév', value: 7 },
    { label: 'Mar', value: -3 },
  ],
  { width: 480, height: 280, tooltip: true },
);
```

Chaque graphique exporte une fonction `render…` et une fonction `layout…`. La
seconde calcule la géométrie sans toucher au DOM, ce qui permet de la tester.

| Graphique           | Fonction de rendu                       | Données                                                   |
| ------------------- | --------------------------------------- | --------------------------------------------------------- |
| Barres              | `renderBarChart(svg, data, options)`    | `{ label, value, color? }[]`                              |
| Courbe et aire      | `renderLineChart(svg, points, options)` | `{ date: Date, value: number }[]`                         |
| Camembert et anneau | `renderPieChart(svg, data, options)`    | `{ label, value, color? }[]`, `innerRadius` pour l'anneau |
| Sparkline           | `renderSparkline(svg, values, options)` | `number[]`                                                |

Les courbes et aires prennent des objets `Date`. Pour du JSON, utilisez plutôt
[`<d3scope-chart>`](./element.md), qui convertit les chaînes de dates.

## Tooltip et interactions

- `tooltip: true` affiche une info-bulle SVG au survol. Un objet
  `{ mode: 'html' }` l'affiche en HTML à la place.
- `onBarClick`, `onPointClick`, `onSliceClick` reçoivent l'élément cliqué.

## Format et langue

Les nombres, pourcentages, devises et dates suivent la locale. La valeur par
défaut est `fr-FR`. Pour changer la locale de toute la librairie :

```ts
import { configure } from '@d3scope/core';

configure({ locale: 'en-US' });
```

Un graphique accepte aussi une locale propre, via l'option `locale`.
Les locales disponibles sont `fr-FR` et `en-US`.

## Thème

Les couleurs viennent de jetons (`ThemeTokens`) exposés en variables CSS
`--d3s-*`. Le thème par défaut est clair. Un thème supplémentaire peut être
enregistré par un plugin (voir [plugins](./plugins.md)).

```ts
import { getTheme, applyTheme } from '@d3scope/core';

applyTheme(document.querySelector('#chart')!, getTheme('default'));
```

## Export

```ts
import { downloadPng, downloadSvg } from '@d3scope/core';

await downloadPng(svg, 'graphique.png', { scale: 2, background: '#ffffff' });
downloadSvg(svg, 'graphique.svg');
```

L'export PNG rasterise le SVG (fond blanc par défaut, `transparent` pour le
désactiver). L'export SVG garde les styles calculés, pour que le fichier
s'affiche hors de la page.

## Voir aussi

- [`<d3scope-chart>`](./element.md) : graphiques écrits en HTML.
- [Plugins](./plugins.md) : ajouter des graphiques, thèmes et palettes.
- [Animations](./animations.md) : le pilote `motion` et l'effet de fondu.
- [`PLAN.md`](../../PLAN.md) : architecture et feuille de route.
