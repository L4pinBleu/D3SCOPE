# Plugins

Un plugin ajoute des graphiques, des thèmes ou des palettes sans modifier le
core. Il ne dépend que de l'API publique `@d3scope/core/plugin`, ce qui
autorise n'importe quelle licence (voir
[`LICENSE-EXCEPTION.md`](../../LICENSE-EXCEPTION.md)).

Le modèle de départ est [`packages/plugin-template`](../../packages/plugin-template/README.md).

## Écrire un plugin

```ts
import { definePlugin, defineChart } from '@d3scope/core/plugin';

export default definePlugin({
  name: 'd3scope-plugin-points',
  version: '0.1.0',
  apiVersion: '^1.0.0',
  charts: {
    points: defineChart<{ x: number; y: number }[], { width: number; height: number }>({
      render(svg, data, options) {
        // Dessiner dans svg. Les dimensions viennent des options.
      },
    }),
  },
});
```

Champs de `PluginDefinition` :

- `name` : unique, en minuscules. Le nom est global.
- `version` : version du plugin, `MAJOR.MINOR.PATCH`.
- `apiVersion` : plage de l'API supportée, par exemple `^1.0.0`. Si le core
  fournit une API hors de cette plage, l'enregistrement échoue avec un message
  explicite.
- `charts`, `themes`, `palettes` : tout est facultatif. Les noms de graphiques
  sont globaux : deux plugins ne peuvent pas en utiliser le même.

## Enregistrer un plugin

Trois façons, selon le contexte.

**1. Dans une application (module)**

```ts
import { registerPlugin, renderChart } from '@d3scope/core/plugin';
import points from './mon-plugin/index.js'; // votre plugin, qui appelle definePlugin

registerPlugin(points);
renderChart('points', svg, data, { width: 480, height: 280 });
```

**2. Dossier de plugins (manifeste)**

```ts
import { loadPlugins } from '@d3scope/core/plugin';

const result = await loadPlugins('/plugins/');
// result.loaded : noms enregistrés ; result.failed : { url, error }
```

Le fichier `/plugins/manifest.json` liste les modules, relatifs à lui :

```json
{ "plugins": ["./points/index.js", "./treemap/index.js"] }
```

Un plugin qui échoue n'empêche pas les autres de se charger.

**3. Balise `<script>` (sans import)**

Chargez d'abord le build pour balise, qui expose `window.D3SCOPE` :

```html
<script src="d3scope.global.js"></script>
<script src="mon-plugin.js"></script>
```

Dans `mon-plugin.js`, le plugin est un objet simple, sans import :

```js
window.D3SCOPE.registerPlugin({
  name: 'script-points',
  version: '0.1.0',
  apiVersion: '^1.0.0',
  charts: {
    'script-points': {
      render(svg, data) {
        // …
      },
    },
  },
});
```

`window.D3SCOPE` est gelé : il ne peut pas être remplacé par un script.

## Plugins officiels

Ils sont dans `plugins/` et sont publiés avec le core, sous `AGPL-3.0-or-later`.

- `@d3scope/plugin-treemap` : treemap avec navigation (clic pour descendre,
  bouton retour). Graphique `treemap`.
- `@d3scope/plugin-brush` : sélection de plage temporelle, partageable avec
  d'autres graphiques via `createTimeRangeLink()`. Graphique `brush`.

## Points d'extension (API 1.1)

Un plugin peut aussi fournir des **marks**, des **échelles** et des
**transformations** du modèle composable (`plot()`). Ils s'enregistrent comme
les graphiques, dans le même `definePlugin`, avec `apiVersion: '^1.0.0'` ou
plus récent (les plugins écrits pour 1.0 restent compatibles).

```ts
import { definePlugin, defineMark, defineTransform } from '@d3scope/core/plugin';
import { plot } from '@d3scope/core/plot';

export default definePlugin({
  name: 'd3scope-plugin-candles',
  version: '0.1.0',
  apiVersion: '^1.1.0',
  marks: {
    // Une mark : elle reçoit des lignes et des options, et renvoie un Mark.
    candles: defineMark<{ day: number; low: number; high: number }, unknown>((rows) => ({
      name: 'candles',
      xValues: () => rows.map((r) => r.day),
      yValues: () => rows.flatMap((r) => [r.low, r.high]),
      render(ctx) {
        // Dessiner dans une couche : ctx.layer('candles') ...
      },
    })),
  },
  transforms: {
    // Une transformation pure : lignes et options en entrée, lignes en sortie.
    moving: defineTransform<{ v: number }, { window?: number }, { v: number }>(
      (rows, { window = 3 }) => rows.map((r) => ({ v: r.v / window })),
    ),
  },
  scales: {
    // Une échelle : `d3` doit être une échelle d3 (les axes sont dessinés avec d3-axis).
    // Son nom peut ensuite servir de type d'axe : { x: { type: 'log-custom' } }.
  },
});
```

Règles :

- Les noms sont globaux : deux plugins ne peuvent pas fournir la même mark,
  échelle ou transformation.
- Les types d'échelle intégrés (`linear`, `log`, `time`, `band`) sont réservés.
- L'enregistrement est atomique : si une mark est refusée, rien n'est
  enregistré, pas même les autres extensions du plugin.
- `unregisterPlugin(name)` retire ses marks, échelles et transformations.
- Accès : `createMark(name, rows, options)`, `applyTransform(name, rows, options)`,
  `listMarks()`, `listScales()`, `listTransforms()`.

