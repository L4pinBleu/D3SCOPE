import { describe, expect, it } from 'vitest';
import { VERSION } from '../src/index';

describe('@d3scope/core', () => {
  it('exposes a semver VERSION string', () => {
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+(-[\w.]+)?$/);
  });
});
