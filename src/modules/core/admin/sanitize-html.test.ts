import { describe, expect, it } from 'vitest';
import { sanitizeSimpleHtml } from './sanitize-html';

describe('sanitizeSimpleHtml', () => {
  it('strips script tags and handlers', () => {
    const input = `<p>Halo</p><script>alert(1)</script><a href="x" onclick="evil()">link</a>`;
    const out = sanitizeSimpleHtml(input);
    expect(out).toContain('<p>Halo</p>');
    expect(out).not.toContain('<script');
    expect(out).not.toContain('onclick');
  });
});
