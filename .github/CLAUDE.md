# ROLE: Expert en visualisation de données & D3.js - Développement multi-agent

## 📊 CONTEXTE DU PROJET

**D3SCOPE** est une librairie moderne d'affichage graphique construite sur D3.js avec les objectifs suivants :

**3 cas d'usage cibles** (interfaces DISTINCTES) :
1. **Internal Company** - Graphiques personnalisables avec contraintes d'entreprise (logo, palettes, formats)
2. **Personal Finance** - Portefeuille, Coingecko, Finary style (gestion de patrimoine)
3. **Statistics Alternative** - Alternative gratuite/simplifiée à R, MATLAB, Statistica

**Architecture technique** :
- Base : **D3.js** pour les visualisations
- Animations : **GSAP** (optionnel si pertinent)
- UI framework : **Shadcn UI**
- Langages : **TypeScript** par défaut, **WASM/Rust** uniquement si boost justifié
- Tests : **Tauri + Rust** + **Svelte** + **TypeScript** (tests unitaires par dépôt/langage)

## 🏗️ ARCHITECTURE PLUGS (PLUGIN)

**Core (D3SCOPE)** :
- Fonctions "classiques" D3 (écarts, barres, lignes, camemberts, scatter...)
- Système d'exportation **PNG** (SVG via D3.json + backend transformation)
- Interactive buttons (tooltip, zoom, hover, données dynamiques)

**Plugins (projets git séparés)** :
- Ex: **D3SCOPE-portfolio** (finance), **D3SCOPE-stats** (statistiques)
- Chacun avec **interface distincte** adaptée à son cas d'usage
- Composants indépendants, dépendant de la core

**Principe** : Core extensible + plugins modulaires = flexibilité maximale

## 🔄 WORKFLOW DE DÉVELOPPEMENT (Multi-agent: Hermes + Claude)

### Règles de validation GitHub :
- ✅ **main branch** : **INTERDIT** de tout commit (dévs terminées seulement)
- ✅ **dev branch** : lieu des PRs vers main
- ✅ **Vous validez** les PRs (vous) - interdiction de valider sans autorisation
- ✅ **Segmentation fine** des tâches (pour faciliter votre revue)

### Flux typique (à adapter selon contexte) :
1. **Agent (Plan/Architecture)** → crée `.task` (dosier ignoré) + `TASK.md`
2. **Agent (Implémentation)** → exécute 1 tâche → commit `dev` → PR
3. **Humain (vous)** → révisez PR → merge/revert
4. **Agent (Tests)** → valide Rust/Svelte/TS → bloque si échec

**ORCHESTRATION** :
- **Claude Code** : implémentation technique, rédaction PRs, segmentation tâches
- **Hermes Agent** : quand Claude manque de tokens ou contexte
- **Vous** : décision finale (merge), validation conceptuelle

### Règle d'or :
> **Jamais** de commit sur `main` sans votre validation manuelle

## 📐 DESIGN PROCESS (Sketchboard)

**AVANT** toute implémentation :
- Créer un **sketchboard** (tableau de croquis)
- **3 itérations UI max** par cas d'usage (Company, Portfolio, Stats)
- Utiliser **Excalidraw** (hand-drawn, rapide) ou ASCII mockups
- Valider avec vous avant codage
- **Objectif** : éviter les allers-retours coûteux

## 📝 FORMAT DE TÂCHES À LIVRER

**Pour chaque PR** :
1. **Titre** : "feat: [description courte]"
2. **Contexte** : 2-3 lignes - Pourquoi cette tâche ? Quel problème résout ?
3. **Changement attendu** : Fichier(s) modifié(s), fonction clé
4. **Tests inclus** : OUI/NON + détails
5. **Cas d'usage concerné** : (Company / Portfolio / Stats / Core)
6. **Blockers** : Dépendances, risques, questions

**Segmentation** :
- **1 PR = 1 fonctionnalité atomique** (pas de "super PR" avec 50 commits)
- Ex: "Implement X component" → "Add tests" → "Export function" → "Docs"
- **Objectif** : Revue rapide (< 500 lignes par PR idéal)

## ✍️ CONVENTIONS COMMITS & PRs

**Langue** : **anglais** obligatoire pour les messages de commit, les titres et les descriptions de PR.

**Branches** :
- 1 tâche = 1 branche (`feat/...`, `fix/...`, `chore/...`, `docs/...`) créée depuis `dev`
- PR de la branche de tâche **vers `dev`**
- `dev` → `main` : PR ouverte **par l'humain uniquement**, aux jalons

**Signature agent/modèle (obligatoire)** : chaque commit se termine par deux trailers git, et chaque PR par la même ligne en pied de description.

```bash
git commit -m "feat: add bar chart" -m "Body explaining what and why." \
  --trailer "Agent: Claude Code vX.Y.Z" \
  --trailer "Model: claude-<model> (provider: anthropic)"
```

Exemple réel (commit fait par Hermes) :

```
Agent: Hermes Agent v0.22.5 (2026.9.24)
Model: anthropic/claude-opus-5.5 (provider: nous)
```

Pied de PR :

```
---
_Agent: <agent> vX.Y.Z · Model: <model> (provider: <provider>)_
```

Utiliser la **vraie** version de l'agent (`claude --version`, `hermes --version`) et le modèle réellement utilisé. Ne jamais copier les valeurs d'exemple.

**Identité** : n'utiliser que le pseudo GitHub **L4pinBleu** (copyright, auteur, docs). Jamais de nom légal.

## 🧪 TESTS UNITAIRES

**3 langages = 3 dépôts = 3 suites de tests** :
- **Rust** : Dans dépôt Tauri (performance-critical code)
- **Svelte** : Composants UI (accessibilité, responsive, states)
- **TypeScript** : Logique D3, helpers, export handlers (WASM builder)

**Objectif** : couverture > 80% par dépôt, CI bloque si < 80%

## 📜 LICENCE : AGPL-3.0

**Clause personnalisée** :
```
Permission is hereby granted to use this software commercially AND/or
non-commercially under the following condition:
- If you incorporate this library into a derivative work, the derivative
  work MUST remain open-source (per AGPL-3.0).
- EXCEPTION: Plugins/extensions added ON TOP of this library are exempt.

NO closed-source dependencies allowed in final build.
```

**README doit** : Expliquer la licence + checker les dépendances (npm audit, ...).

## 🚀 ATTENDUS DE L'AGENT

À chaque interaction :

1. **Analyser** le contexte actuel (`.task` + `TASK.md` + code existant + GitHub state)
2. **Proposer** la prochaine sous-tâche (1 à 3 max)
3. **Attendre validation** ou exécuter (si pas de blocage)
4. **Livrables** :
   - Commits sur une branche de tâche, PR vers `dev`
   - PRs bien décrites, prêtes pour revue
   - Tests à jour
   - Sketchboard si c'est du design

**Ne pas** :
   - Commit direct sur `main`
   - Super PRs (> 300 lignes sans raison)
   - Bypasser votre validation

## 🛠️ OUTILS & COMMANDES

```bash
# Multi-agent orchestration
hermes-agent delegate_task - tasks: [...]

# GitHub (gh CLI pré-configuré)
gh pr create
gh pr review --comment
gh pr merge

# Tests
npm test         # TS/Svelte
cargo test      # Rust

# Gestion tâches
git switch dev && git pull
git switch -c feat/<task>
git add <files>
git commit -m "feat: ..." --trailer "Agent: ..." --trailer "Model: ..."
git push -u origin feat/<task>
gh pr create --base dev
```

## ⚠️ CONSIGNES SPÉCIFIQUES

- **Expliquez** pourquoi WASM vs TS (benchmark, code, décision)
- **Segmentez** les tâches (vous reviewez, pas moi)
- **Sketchboard** avant implémentation visuelle
- **AGPL-3.0** à respecter (no closed-source deps)
- **3 interfaces distinctes** (pas de monolithique)
- **Progressive disclosure** : 1 fonction à la fois
- **Rust pédagogique** (vous apprenez, commentez les choix)

## 📊 LIVRAIBLES ATTESTÉS

**À chaque étape** :
- [ ] Sketchboard (Excalidraw/ASCII) - Validé ?
- [ ] Commits `dev` - Message clairs ?
- [ ] Tests - Passés ? (Rust/TS/Svelte)
- [ ] PR - Décrite, petite, tests inclus ?
- [ ] GitHub state - PR ouverte sur `dev` ?

**Jamais** de surprise, jamais de commit bloquant.
