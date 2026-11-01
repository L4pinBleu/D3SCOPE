// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  applyTheme,
  cssVar,
  getTheme,
  LIGHT_THEME,
  registerTheme,
  themeDeclarations,
  tokenVar,
  type ThemeTokens,
} from '../src/theme/index.js';

describe('tokenVar / cssVar', () => {
  it('turns role names into --d3s-* custom properties', () => {
    expect(tokenVar('surface')).toBe('--d3s-surface');
    expect(tokenVar('textMuted')).toBe('--d3s-text-muted');
    expect(tokenVar('fontFamily')).toBe('--d3s-font-family');
  });

  it('builds a var() reference with a fallback', () => {
    expect(cssVar('text', '#000')).toBe('var(--d3s-text, #000)');
  });
});

describe('themeDeclarations', () => {
  it('emits one variable per role and one per palette colour', () => {
    const decl = themeDeclarations(LIGHT_THEME);
    expect(decl['--d3s-surface']).toBe('#ffffff');
    expect(decl['--d3s-text-muted']).toBe('#59636e');
    expect(decl['--d3s-palette-0']).toBe(LIGHT_THEME.palette[0]);
    expect(decl['--d3s-palette-7']).toBe(LIGHT_THEME.palette[7]);
    expect(Object.keys(decl).some((k) => k.includes('palette-') && k.endsWith('-8'))).toBe(false);
  });
});

describe('applyTheme', () => {
  it('sets the custom properties inline on the element', () => {
    const el = document.createElement('div');
    applyTheme(el, LIGHT_THEME);
    expect(el.style.getPropertyValue('--d3s-surface')).toBe('#ffffff');
    expect(el.style.getPropertyValue('--d3s-palette-1')).toBe(LIGHT_THEME.palette[1]);
  });
});

describe('registry', () => {
  it('provides the light theme as "default"', () => {
    expect(getTheme()).toBe(LIGHT_THEME);
    expect(getTheme('default')).toBe(LIGHT_THEME);
  });

  it('registers a custom theme and rejects unknown or empty names', () => {
    const dark: ThemeTokens = { ...LIGHT_THEME, surface: '#000000', text: '#ffffff' };
    registerTheme('dark', dark);
    expect(getTheme('dark').surface).toBe('#000000');
    expect(() => getTheme('nope')).toThrow(RangeError);
    expect(() => {
      registerTheme(' ', dark);
    }).toThrow(RangeError);
  });
});
