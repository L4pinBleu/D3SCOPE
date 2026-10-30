/**
 * Theme tokens (PLAN.md §3 `theme/`, §10 decision 11).
 *
 * Tokens are named by role (`surface`, `text`, `positive`, …), not by colour,
 * and are exposed as CSS custom properties `--d3s-<role>`. Charts read the
 * variables, so a dark theme in v2 is just another token set.
 *
 * v1 ships the light theme only.
 */

export interface ThemeTokens {
  /** Chart background and tooltip background. */
  surface: string;
  /** Primary text: labels, tooltip text. */
  text: string;
  /** Secondary text: axis ticks, hints. */
  textMuted: string;
  /** Borders and separators. */
  border: string;
  /** Gridlines and crosshair rules. */
  grid: string;
  /** Accent for focus, selection and highlights. */
  accent: string;
  /** Good values (gains, increases). */
  positive: string;
  /** Bad values (losses, decreases). */
  negative: string;
  /** Font family for chart text. */
  fontFamily: string;
  /** Default series colours, in order. */
  palette: readonly string[];
}

export type ThemeName = string;

export const LIGHT_THEME: ThemeTokens = {
  surface: '#ffffff',
  text: '#1f2328',
  textMuted: '#59636e',
  border: '#d0d7de',
  grid: '#eaeef2',
  accent: '#4a9eed',
  positive: '#1a7f37',
  negative: '#cf222e',
  fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
  palette: ['#4a9eed', '#f5a623', '#7ed321', '#d0021b', '#9013fe', '#50e3c2', '#b8e986', '#8b572a'],
};

const themes = new Map<ThemeName, ThemeTokens>([['default', LIGHT_THEME]]);

/** Register a theme under `name`. Overwrites an existing theme of the same name. */
export function registerTheme(name: ThemeName, tokens: ThemeTokens): void {
  if (name.trim() === '') throw new RangeError('registerTheme: name must not be empty');
  themes.set(name, tokens);
}

/** Look up a registered theme. Unknown names throw. */
export function getTheme(name: ThemeName = 'default'): ThemeTokens {
  const theme = themes.get(name);
  if (!theme) throw new RangeError(`getTheme: unknown theme "${name}"`);
  return theme;
}

/** Whether a theme is registered under `name`. */
export function hasTheme(name: ThemeName): boolean {
  return themes.has(name);
}

/** Remove a registered theme. The built-in `default` theme cannot be removed. */
export function unregisterTheme(name: ThemeName): void {
  if (name === 'default')
    throw new RangeError('unregisterTheme: the default theme cannot be removed');
  themes.delete(name);
}

/** CSS custom property name for a role, for example `--d3s-text`. */
export function tokenVar(role: keyof Omit<ThemeTokens, 'palette'>): string {
  return `--d3s-${role.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;
}

/** `var(--d3s-…)` reference for a role, with a fallback to the theme value. */
export function cssVar(role: keyof Omit<ThemeTokens, 'palette'>, fallback: string): string {
  return `var(${tokenVar(role)}, ${fallback})`;
}

/**
 * Declarations for every token, as a CSS block body. Palette entries become
 * `--d3s-palette-0`, `--d3s-palette-1`, …
 */
export function themeDeclarations(theme: ThemeTokens): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(theme)) {
    if (key === 'palette') continue;
    out[tokenVar(key as keyof Omit<ThemeTokens, 'palette'>)] = value as string;
  }
  theme.palette.forEach((color, i) => {
    out[`--d3s-palette-${String(i)}`] = color;
  });
  return out;
}

/** Set the theme's custom properties on an element (inline style). */
export function applyTheme(el: HTMLElement | SVGElement, theme: ThemeTokens): void {
  for (const [name, value] of Object.entries(themeDeclarations(theme))) {
    el.style.setProperty(name, value);
  }
}
