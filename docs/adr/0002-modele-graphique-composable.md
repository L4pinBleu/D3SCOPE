# ADR 0002 : Modèle de graphique composable (marks, échelles, transformations)

- Statut : **Proposé** (en attente de validation avant implémentation)
- Date : 2026-11-02
- Référence : PLAN.md §4 (API plugins), §8 (modules), §9.3 (polish) ; ADR 0001

## Contexte

Le core v0.1 expose des fonctions de rendu par type de graphique (`renderBarChart`,
`renderLineChart`, `renderPieChart`, `renderSparkline`). Elles ne couvrent pas le
besoin réel :

- une seule série par graphique ; pas de regroupement, d'empilement ni de barres
  horizontales ;
- les axes ont `tickCount` et `tickFormat`, mais ni `min`/`max`, ni pas (`step`),
  ni grille, ni titre ;
- les échelles `log`, `time` et `band` existent dans `scales/`, mais ne sont pas
  exposées par les graphiques ;
- aucun graphique de dispersion, histogramme, boîte à moustaches ou carte de
  chaleur ;
- la galerie (`apps/playground`) ne montre que 6 graphiques, sans options.

Ajouter un type de graphique par fonction dupliquerait les axes, les échelles, la
légende et la grille dans chaque fonction. Une plateforme ouverte aux plugins a
besoin d'un modèle commun.

## Décision

Adopter un modèle **composable**, sur le modèle d'Observable Plot : un graphique
est une liste de **marks** (marques) dessinées sur des **échelles**, avec des
**transformations** de données optionnelles.

```ts
import { plot, line, dot, rectY, ruleY, gridY, axisX, axisY } from '@d3scope/core/plot';

plot({
  width: 640,
  height: 360,
  x: { type: 'time', label: 'Date' },
  y: { min: 0, max: 100, step: 20, label: 'Valeur', grid: true },
  color: { legend: true, domain: ['A', 'B'] }, // couleur par libellé
  marks: [
    gridY({ color: '#e5e7eb', dash: '4 4' }),
    line(series, { x: 'date', y: 'value', stroke: 'series' }),
    dot(points, { x: 'date', y: 'value', r: 3, fill: 'series' }),
  ],
});
```

### Principes

1. **Données tabulaires.** Une donnée est un tableau d'objets. Chaque mark indique
   quels champs servent à x, y, couleur, taille, etc. (« canaux »).
2. **Échelles déclarées une fois.** Le type (`linear`, `log`, `time`, `band`,
   `point`, `ordinal`, `sqrt`, `pow`, `symlog`), le domaine (`min`, `max`, `nice`),
   le pas (`step`) et le nombre de graduations (`ticks`) sont des options de
   l'axe. Les marks lisent les échelles, ils ne les recalculent pas.
3. **Couleur par libellé.** Un canal `color` lié à un champ crée une échelle
   ordinale ; la légende est générée automatiquement.
4. **Grille et axes sont des marks comme les autres** (`gridX`, `gridY`,
   `axisX`, `axisY`), pour qu'on puisse les ajouter, les retirer ou les remplacer.
5. **Transformations pures** : `groupX`, `stackY`, `normalizeY`, `bin`, `sort`,
   `filter`, `map`. Elles renvoient de nouvelles données, sans effet de bord.
6. **Rendu SVG uniquement** pour l'instant, avec les modules d3 déjà utilisés et
   les dépendances de licence permissive (ISC ou MIT) : `d3-shape` et `d3-array`
   (ISC) sont ajoutés pour les courbes, empilements et regroupements.

### Points d'extension (plugins)

`PluginDefinition` gagne trois champs facultatifs :

- `marks` : fabriques de marks, par nom ;
- `scales` : types d'échelle supplémentaires ;
- `transforms` : transformations de données supplémentaires.

Ce sont des ajouts compatibles : l'API passe en **1.1.0** (minor). Un plugin qui
déclare ces champs demande `apiVersion: "^1.1.0"`, sinon l'enregistrement échoue
avec le message déjà prévu.

Les plugins n'importent que `@d3scope/core/plugin` (licence, LICENSE-EXCEPTION §1).

### Compatibilité

- Les fonctions `renderBarChart`, `renderLineChart`, `renderPieChart`,
  `renderSparkline` restent exportées et gardent leur signature.
- Elles sont réécrites au-dessus de `plot()` en une seconde étape, une fois
  `plot()` testé. Aucun changement de rendu visible n'est permis sans test de
  non-régression (les tests existants servent de référence).
- Les sorties publiées (0.1.x) ne cassent pas ; la nouvelle API arrive en 0.2.

### Hors périmètre (pour l'instant)

- Rendu Canvas et WebGL ; le rendu SVG reste la référence (export, accessibilité).
- Graphiques 3D.
- Facettes (petits multiples) : prévues dans une étape ultérieure.

## Options de grille et d'axes (cible)

| Option       | Rôle                                                                               |
| ------------ | ---------------------------------------------------------------------------------- |
| `min`, `max` | Bornes du domaine. Une valeur hors domaine est coupée et signalée.                 |
| `nice`       | Arrondit le domaine à des valeurs « rondes ». Désactivé si `min`/`max` sont fixés. |
| `step`       | Pas entre deux graduations. Prioritaire sur `ticks`.                               |
| `ticks`      | Nombre indicatif de graduations (défaut 5).                                        |
| `tickFormat` | Fonction ou format de libellé (locale respectée).                                  |
| `label`      | Titre de l'axe.                                                                    |
| `grid`       | Grille alignée sur les graduations ; `color`, `dash`, `opacity`.                   |
| `position`   | `left`/`right`/`top`/`bottom`.                                                     |
| `type`       | Type d'échelle (voir tableau).                                                     |
| `reverse`    | Inverse le sens.                                                                   |

## Matrice de couverture (cible)

Statut : `à faire` pour tout ce qui n'existe pas encore.

### Types de graphiques

| Graphique                         | Équivalent Chart.js / Observable          | Statut                   |
| --------------------------------- | ----------------------------------------- | ------------------------ |
| Barres (verticales, horizontales) | bar, `rectY`, `rectX`                     | à faire (1 série existe) |
| Barres groupées, empilées, 100 %  | `groupX`, `stackY`, `normalizeY`          | à faire                  |
| Courbe, multi-séries              | line, `line` avec `stroke`                | à faire (1 série existe) |
| Aire, aire empilée                | area, `areaY`                             | à faire                  |
| Points (dispersion)               | scatter, `dot`                            | à faire                  |
| Bulles                            | bubble, `dot` avec `r`                    | à faire                  |
| Histogramme                       | `rectY` + `binX`                          | à faire                  |
| Boîte à moustaches                | `box`                                     | à faire                  |
| Carte de chaleur                  | `cell`                                    | à faire                  |
| Camembert, anneau                 | pie, doughnut                             | fait (hors plot)         |
| Radar                             | radar                                     | à faire                  |
| Aire polaire                      | polarArea                                 | à faire                  |
| Sparkline                         | —                                         | fait (hors plot)         |
| Texte, règles, flèches, liens     | `text`, `ruleX`, `ruleY`, `link`, `arrow` | à faire                  |
| Densité                           | `density`                                 | à faire                  |

### Échelles

| Échelle                                 | Statut               |
| --------------------------------------- | -------------------- |
| linéaire                                | existe (non exposée) |
| logarithmique                           | existe (non exposée) |
| temps                                   | existe (non exposée) |
| bande (catégorielle)                    | existe (non exposée) |
| point, ordinale                         | à faire              |
| racine carrée, puissance, symlog        | à faire              |
| divergente, séquentielle, par quantiles | à faire              |

### Transformations

| Transformation                                                   | Statut                              |
| ---------------------------------------------------------------- | ----------------------------------- |
| `groupX`, `groupY` (agrégats : somme, moyenne, min, max, nombre) | à faire                             |
| `stackY`, `normalizeY`                                           | à faire                             |
| `binX` (histogramme)                                             | à faire                             |
| `sort`, `filter`, `map`                                          | à faire                             |
| `window` (moyenne glissante)                                     | à faire                             |
| Décimation LTTB (grands jeux)                                    | à faire (TypeScript, voir ADR 0001) |

### Interactions

| Interaction                           | Statut                    |
| ------------------------------------- | ------------------------- |
| Info-bulle (SVG, HTML)                | fait (sur bar, line, pie) |
| Survol / clic                         | fait (bar, line, pie)     |
| Légende cliquable (masquer une série) | à faire                   |
| Zoom et panoramique                   | à faire                   |
| Sélection (brush)                     | fait (plugin)             |

## Plan de livraison

Chaque étape = une PR atomique vers `dev`. Les étapes 3 à 6 se parallélisent
entre sous-agents, une fois `plot()` (étape 2) fusionné.

1. ADR 0002 (ce document), validé.
2. `plot()` squelette : marges, échelles (linéaire, temps, bande), axes, grille,
   tests de géométrie.
3. Échelles avancées et options d'axe : `min`, `max`, `nice`, `step`, `label`,
   `position`, `reverse`, log. Tests des bornes et des graduations.
4. Marks de base : `rectY`, `rectX`, `line`, `dot`, `ruleX`, `ruleY`, `text`, avec
   couleur par libellé et légende automatique.
5. Barres groupées, empilées, normalisées ; barres horizontales.
6. Aires empilées ; courbes multi-séries.
7. Dispersion, bulles, histogramme (`binX`).
8. Boîte à moustaches, carte de chaleur, radar, aire polaire.
9. Extension des plugins : `marks`, `scales`, `transforms` (API 1.1.0).
10. Réécriture des `render*` sur `plot()`, sans régression.
11. Galerie `apps/playground` : une page par type, options visibles, export.

## Conséquences

- Plus de code de base à maintenir, mais une seule implémentation des axes, de la
  grille, des échelles et de la légende.
- Les plugins d'entreprise peuvent ajouter une mark ou une échelle sans toucher
  au core.
- Les tests de géométrie (fonctions pures) restent la base de la couverture.
- Nouvelles dépendances : `d3-shape`, `d3-array` (ISC). À valider avec le script
  de licences avant chaque PR.

## Questions ouvertes

- Faut-il exposer les marks comme fonctions à l'import (`line(...)`) ou comme
  objets déclaratifs (`{ type: 'line', ... }`) ? Ce document suppose les fonctions,
  pour la lisibilité et le typage.
- La galerie reste-t-elle dans `apps/playground` ou devient-elle un site de
  documentation séparé (plus tard) ?
