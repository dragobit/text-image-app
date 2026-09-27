import { describe, expect, it } from 'vitest';

import { fitFontSize, wrapText, type MeasureFn } from './layout';

/** Fixed-width measure: every character is `charWidth` px. */
const fixed =
  (charWidth: number): MeasureFn =>
  (text: string) =>
    text.length * charWidth;

describe('wrapText', () => {
  it('wraps words at the width limit', () => {
    // 'aa bb' = 5 chars = 50px exactly fits; adding ' cc' would exceed.
    const lines = wrapText(fixed(10), 'aa bb cc', 50);
    expect(lines).toEqual(['aa bb', 'cc']);
  });

  it('char-splits a token wider than the line (CJK-style text)', () => {
    const lines = wrapText(fixed(10), 'あいうえおかき', 30);
    expect(lines).toEqual(['あいう', 'えおか', 'き']);
  });

  it('preserves empty lines as paragraph separators', () => {
    const lines = wrapText(fixed(10), 'one\n\ntwo', 400);
    expect(lines).toEqual(['one', '', 'two']);
  });

  it('returns a single empty line for empty input', () => {
    expect(wrapText(fixed(10), '', 400)).toEqual(['']);
  });
});

describe('fitFontSize', () => {
  it('returns the largest size whose wrapped block fits the height', () => {
    // Size-proportional measure: at font size S, 'aaaa bbbb' (9 chars)
    // is 9*S wide, wrapping to 2 lines when 9S > 400 i.e. S > 44.
    let current = 100;
    const measure: MeasureFn = (t) => t.length * current;
    const { fontSize } = fitFontSize(
      (px) => {
        current = px;
      },
      measure,
      'aaaa bbbb',
      400,
      150, // maxHeight: 1 line (S<=44) needs S<=150; 2 lines need 2S<=150
      100,
      10,
      1.0,
    );
    // Largest S with lines*S<=150: S>44 gives 2 lines → 2S<=150 → S<=75.
    expect(fontSize).toBe(75);
  });

  it('clamps at minSize when nothing fits', () => {
    let current = 100;
    const measure: MeasureFn = (t) => t.length * current;
    const { fontSize, lines } = fitFontSize(
      (px) => {
        current = px;
      },
      measure,
      'a'.repeat(100),
      10,
      10,
      50,
      10,
    );
    expect(fontSize).toBe(10);
    expect(lines.length).toBeGreaterThan(0);
  });
});

