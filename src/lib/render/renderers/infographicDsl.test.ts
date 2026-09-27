import { describe, expect, it } from 'vitest';

import type { RenderOptions } from '../types';
import { THEMES } from '../themes';
import {
  buildInfographicDsl,
  estimateBlockHeight,
  estimatedWidth,
  INFOGRAPHIC_FONT_FAMILY,
  infographicWarnings,
  MAX_BODY_CHARS,
  sanitizeDslValue,
} from './infographicDsl';

const OPTIONS: RenderOptions = {
  size: { id: 'square', label: '正方形', width: 1080, height: 1080 },
  theme: THEMES[0],
  values: {},
};

const DOC = {
  title: '吾輩は猫である',
  body: '名前はまだ無い。どこで生れたかとんと見当がつかぬ。',
  attribution: '夏目漱石',
};

function doc(overrides: Partial<typeof DOC> = {}) {
  return { ...DOC, ...overrides };
}

describe('sanitizeDslValue', () => {
  it('collapses all whitespace to single spaces and trims', () => {
    expect(sanitizeDslValue('a\nb\t c  \r\n d')).toBe('a b c d');
  });

  it('returns empty string for whitespace-only input', () => {
    expect(sanitizeDslValue('  \n\t ')).toBe('');
  });
});

describe('buildInfographicDsl', () => {
  it('maps title/body/attribution to one item each in order', () => {
    const { dsl } = buildInfographicDsl(doc(), OPTIONS);
    expect(dsl).toContain('- label 吾輩は猫である');
    expect(dsl).toContain('- desc 名前はまだ無い。どこで生れたかとんと見当がつかぬ。');
    expect(dsl).toContain('- value 夏目漱石');
  });

  it('keeps the body as a single undivided item (paragraphs collapse)', () => {
    const { dsl } = buildInfographicDsl(
      doc({ body: '第一段落。\n\n第二段落。\n第三段落。' }),
      OPTIONS,
    );
    const descLines = dsl.split('\n').filter((l) => l.includes('- desc'));
    expect(descLines).toHaveLength(1);
    expect(descLines[0]).toContain('第一段落。 第二段落。 第三段落。');
  });

  it('sanitizes newlines/tabs so user input cannot break DSL structure', () => {
    const evil = 'line one\n  injectedKey injectedValue\nwidth 1';
    const { dsl } = buildInfographicDsl(doc({ body: evil }), OPTIONS);
    // The whole input must live on the single `- desc` line.
    expect(dsl).toContain(`- desc ${sanitizeDslValue(evil)}`);
    expect(dsl.split('\n').some((l) => l.trim() === 'injectedKey injectedValue')).toBe(false);
    expect(dsl.split('\n').filter((l) => l.startsWith('width'))).toHaveLength(1);
  });

  it('omits items for empty fields and stays valid with only a body', () => {
    const { dsl } = buildInfographicDsl(
      doc({ title: '', attribution: '' }),
      OPTIONS,
    );
    expect(dsl).not.toContain('- label');
    expect(dsl).not.toContain('- value');
    expect(dsl).toContain(`- desc ${DOC.body}`);
  });

  it('emits a placeholder item for a completely empty document', () => {
    const { dsl } = buildInfographicDsl(
      doc({ title: '', body: '', attribution: '' }),
      OPTIONS,
    );
    expect(dsl).toContain('data');
    expect(dsl).toContain('  items');
    expect(dsl).toContain('- desc');
  });

  it('maps theme colors into the theme block', () => {
    const theme = THEMES.find((t) => t.id === 'night')!;
    const { dsl } = buildInfographicDsl(doc(), { ...OPTIONS, theme });
    expect(dsl).toContain(`colorBg ${theme.background}`);
    expect(dsl).toContain(`colorPrimary ${theme.accent}`);
    expect(dsl).toContain(`fill ${theme.muted}`);
    expect(dsl).toContain(`font-family ${INFOGRAPHIC_FONT_FAMILY}`);
  });

  it('emits the requested output size at DSL root', () => {
    const { dsl } = buildInfographicDsl(doc(), {
      ...OPTIONS,
      size: { id: 'wide', label: '', width: 1200, height: 675 },
    });
    expect(dsl).toContain('width 1200');
    expect(dsl).toContain('height 675');
  });

  it('honors the align/valign options', () => {
    const { dsl } = buildInfographicDsl(doc(), {
      ...OPTIONS,
      values: { align: 'left', valign: 'top' },
    });
    expect(dsl).toContain('align left');
    expect(dsl).toContain('justify flex-start');
  });

  it('warns and truncates when the body exceeds the character cap', () => {
    const long = 'あ'.repeat(MAX_BODY_CHARS + 100);
    const { dsl, warnings } = buildInfographicDsl(doc({ body: long }), OPTIONS);
    expect(warnings.length).toBeGreaterThan(0);
    const desc = dsl.split('\n').find((l) => l.includes('- desc'))!;
    expect(desc.length).toBeLessThan(MAX_BODY_CHARS + 100);
    expect(desc).toContain('…');
  });

  it('truncates a body that cannot fit even at minimum font size', () => {
    // Long CJK text on the smallest size still overflows at min font.
    const long = '字'.repeat(1500);
    const { warnings } = buildInfographicDsl(doc({ body: long }), OPTIONS);
    expect(warnings.length).toBeGreaterThan(0);
  });
});

describe('estimators', () => {
  it('measures ASCII cheaper than CJK', () => {
    expect(estimatedWidth('abcd', 20)).toBeLessThan(estimatedWidth('あいうえ', 20));
  });

  it('estimates wrapped height proportionally to lines', () => {
    const one = estimateBlockHeight('aaaa', 100, 20, 1.5);
    const many = estimateBlockHeight('a '.repeat(200), 100, 20, 1.5);
    expect(many).toBeGreaterThan(one);
  });
});

describe('infographicWarnings', () => {
  it('is empty for normal input', () => {
    expect(infographicWarnings(doc(), OPTIONS)).toEqual([]);
  });
});
