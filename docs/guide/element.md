# Élément `<d3scope-chart>`

`<d3scope-chart>` permet d'écrire un graphique en HTML, sans JavaScript de
rendu. Il est fourni par le sous-chemin `@d3scope/core/element`. Le build
pour balise `<script>` l'enregistre aussi (voir [plugins](./plugins.md)).

```html
<script type="module">
  import { defineChartElement } from '@d3scope/core/element';
  defineChartElement(); // enregistre <d3scope-chart> ; sans appel, la balise reste inconnue
</script>

<d3scope-chart
  type="bar"
  width="480"
  height="280"
  tooltip
  locale="fr-FR"
  data='[{"label":"Jan","value":12},{"label":"Fév","value":7}]'
></d3scope-chart>
```

## Attributs

| Attribut  | Valeur                                                                                 | Défaut         | Rôle                                            |
| --------- | -------------------------------------------------------------------------------------- | -------------- | ----------------------------------------------- |
| `type`    | `bar`, `line`, `area`, `pie`, `donut`, `sparkline`, ou le nom d'un graphique de plugin | `bar`          | Type de graphique.                              |
| `width`   | nombre                                                                                 | `480`          | Largeur en pixels.                              |
| `height`  | nombre                                                                                 | `280`          | Hauteur en pixels.                              |
| `tooltip` | présent                                                                                | absent         | Active l'info-bulle au survol (bar, line, pie). |
| `locale`  | `fr-FR` ou `en-US`                                                                     | locale globale | Format des nombres et des dates.                |
| `theme`   | nom d'un thème enregistré                                                              | `default`      | Applique les jetons de couleur.                 |
| `data`    | tableau JSON                                                                           | aucun          | Données du graphique.                           |

## Données

- `bar`, `pie`, `donut` : `[{ "label": "…", "value": 1 }]`.
- `line`, `area` : `[{ "date": "2026-01-01", "value": 1 }]`. Les dates sont
  des chaînes, converties en `Date`. Une date invalide affiche une erreur.
- `sparkline` : `[1, 2, 3]` ou `[{ "value": 1 }]`.
- Un graphique de plugin reçoit les données telles quelles.

Les données peuvent aussi être une propriété JavaScript, qui remplace l'attribut :

```js
const el = document.querySelector('d3scope-chart');
el.data = [{ label: 'A', value: 3 }];
```

## Erreurs

Les erreurs (JSON invalide, type inconnu, date invalide, thème inconnu) sont
affichées dans l'élément, dans un bloc `role="alert"`. Elles ne lèvent pas
d'exception, pour qu'un graphique cassé n'empêche pas le reste de la page.

## Mise à jour

L'élément se redessine quand un attribut change ou quand `data` est modifié.
Tant qu'il n'est pas connecté au DOM, il ne dessine rien ; quand il est
rattaché, il se redessine.
