/**
 * D3SCOPE core entry point.
 *
 * Only symbols exported from this file (and, later, `@d3scope/core/plugin`)
 * are part of the public API. See PLAN.md §3 and §4.
 */

/** Library version, kept in sync with package.json by the release process. */
export const VERSION = '0.0.0';

export * from './scales/index.js';
export * from './axes/index.js';
export * from './legends/index.js';
