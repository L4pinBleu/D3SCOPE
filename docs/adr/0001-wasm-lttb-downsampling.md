# ADR 0001 : Rust/WASM pour le sous-échantillonnage LTTB

- Statut : **Rejeté** (la version TypeScript reste la seule implémentation)
- Date : 2026-11-01
- Référence : PLAN.md §7 (critères d'adoption de Rust/WASM)

## Contexte

PLAN.md §7 n'autorise Rust/WASM pour un module que si trois critères sont
remplis : (1) un gain d'au moins 2× de bout en bout sur des données réalistes
(≥ 100 000 points), transferts JS↔WASM compris ; (2) un coût de bundle inférieur
à 100 kB gzip ; (3) un repli en TypeScript pur. Le premier candidat retenu est
le sous-échantillonnage **LTTB** (Largest-Triangle-Three-Buckets), qui réduit
une série à quelques milliers de points pour l'affichage.

## Méthode

- Implémentation TypeScript de référence (`lttbTs`) et implémentation Rust
  (`lttb_wasm`, ABI C brute, sans `wasm-bindgen`, sans dépendance, profil
  release `opt-level = "z"`, LTO, `panic = "abort"`).
- Les deux versions suivent le même ordre d'opérations en virgule flottante :
  les index produits sont comparés un à un, et doivent être identiques.
- Mesure « bout en bout » : copie des entrées dans la mémoire WASM, appel,
  copie des index sortants. Les tampons WASM sont alloués une seule fois, hors
  chronomètre, comme une application qui les réutilise.
- Données : marche aléatoire déterministe (générateur linéaire à graine
  fixe), seuil de sortie 1 000 points, 3 préchauffages, médiane sur 40 exécutions.
- Environnement : macOS 27.0.1, Apple silicon (arm64), Node v24.21.0, rustc 1.93.0.

## Résultats

| Points    | Sortie | TypeScript (ms) | WASM bout en bout (ms) | Gain  | Index identiques |
| --------- | ------ | --------------- | ---------------------- | ----- | ---------------- |
| 100 000   | 1 000  | 0,375           | 0,238                  | 1,57× | oui              |
| 1 000 000 | 1 000  | 2,704           | 2,345                  | 1,15× | oui              |

Une première exécution, avec 15 mesures au lieu de 40 et Node v24.15.0, donnait
1,7× (100 000 points) et 1,13× (1 000 000 points) : même conclusion.

Taille du module : 19 KB brut, 8,2 KB gzip (cible < 100 kB : atteinte).

## Décision

Critère 1 **non atteint** : le gain est de 1,57× à 100 000 points et de 1,15× à
1 000 000 points, contre 2× exigés. Les critères 2 et 3 seraient remplis, mais
le critère 1 est bloquant.

On garde LTTB en TypeScript. Aucun code Rust n'entre dans le dépôt, conformément
à PLAN.md §7 (pas de Rust avant un ADR accepté).

## Pourquoi le gain est faible

- LTTB lit chaque point une seule fois, avec peu de calcul par point. Le
  moteur JavaScript (JIT) est déjà proche de ce que WASM peut faire.
- La copie des 2 × N flottants vers la mémoire WASM coûte autant que le calcul
  lui-même, surtout à 1 000 000 points.

## Conséquences

- LTTB reste en TypeScript, dans le chemin normal, sans dépendance.
- Ce rejet ne préjuge pas des autres candidats de PLAN.md §7 (agrégation pour
  histogrammes, test de survol à grande échelle). Chacun fera l'objet de son
  propre benchmark et de son propre ADR.

## Ce qui ferait changer la décision

- Des données déjà présentes en mémoire WASM (par exemple décodées en WASM) :
  la copie disparaît, ce qui n'a pas été mesuré ici.
- Un travail par point nettement plus coûteux que LTTB, pour lequel le gain
  de WASM serait plus visible.

Un nouveau benchmark est requis dans ces cas ; cet ADR ne couvre que LTTB.
