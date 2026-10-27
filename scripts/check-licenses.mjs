#!/usr/bin/env node
// License gate for D3SCOPE (see README "Dependency policy" and PLAN.md §8).
//
// - Runtime dependencies ("prod") ship in the build: only open-source licenses
//   compatible with AGPL-3.0-or-later are allowed.
// - Dev dependencies never ship: a slightly wider list of permissive licenses
//   is allowed (e.g. BlueOak-1.0.0, used by minimatch via ESLint).
//
// Usage: node scripts/check-licenses.mjs
// Exit code 1 if any dependency uses a license that is not allowed.

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const PROD_ALLOWED = new Set([
  'MIT',
  'ISC',
  '0BSD',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'Apache-2.0',
  'MPL-2.0',
  'CC0-1.0',
  'Unlicense',
  'LGPL-3.0-only',
  'LGPL-3.0-or-later',
  'GPL-3.0-only',
  'GPL-3.0-or-later',
  'AGPL-3.0-only',
  'AGPL-3.0-or-later',
]);

const DEV_ALLOWED = new Set([...PROD_ALLOWED, 'BlueOak-1.0.0', 'CC-BY-4.0', 'Python-2.0']);

const root = process.cwd();

/** Workspace directories: the root plus every packages/* and apps/* folder. */
function workspaceDirs() {
  const dirs = [root];
  for (const group of ['packages', 'apps']) {
    const base = join(root, group);
    if (!existsSync(base)) continue;
    for (const entry of readdirSync(base, { withFileTypes: true })) {
      if (entry.isDirectory() && existsSync(join(base, entry.name, 'package.json'))) {
        dirs.push(join(base, entry.name));
      }
    }
  }
  return dirs;
}

/** Returns { license: [{ name, versions }] } as reported by pnpm. */
function listLicenses(dir, prodOnly) {
  const args = ['licenses', 'list', '--json'];
  if (prodOnly) args.push('--prod');
  const out = execFileSync('pnpm', args, { cwd: dir, encoding: 'utf8' }).trim();
  return out ? JSON.parse(out) : {};
}

/**
 * Checks a (simple) SPDX expression against an allowlist.
 * "A OR B" passes if one side passes; "A AND B" needs both.
 */
function isAllowed(expression, allowed) {
  const clean = expression.replace(/[()]/g, '').trim();
  return clean
    .split(/\s+OR\s+/i)
    .some((alt) => alt.split(/\s+AND\s+/i).every((id) => allowed.has(id.trim())));
}

const violations = [];
const seen = { prod: new Set(), dev: new Set() };

for (const dir of workspaceDirs()) {
  const where = relative(root, dir) || '.';
  const prod = listLicenses(dir, true);
  const all = listLicenses(dir, false);
  const prodNames = new Set(
    Object.values(prod)
      .flat()
      .map((p) => p.name),
  );

  for (const [license, pkgs] of Object.entries(all)) {
    for (const pkg of pkgs) {
      const isProd = prodNames.has(pkg.name);
      const scope = isProd ? 'prod' : 'dev';
      seen[scope].add(license);
      if (!isAllowed(license, isProd ? PROD_ALLOWED : DEV_ALLOWED)) {
        violations.push(`${where}: ${pkg.name}@${pkg.versions.join(',')} (${scope}) -> ${license}`);
      }
    }
  }
}

console.log(`prod licenses: ${[...seen.prod].sort().join(', ') || '(none)'}`);
console.log(`dev licenses:  ${[...seen.dev].sort().join(', ') || '(none)'}`);

if (violations.length > 0) {
  console.error(`\n✖ ${violations.length} dependency license(s) not allowed:`);
  for (const v of violations) console.error(`  - ${v}`);
  process.exit(1);
}
console.log('\n✔ All dependency licenses are allowed.');
