import { describe, expect, it } from 'vitest';
import { parseChatMarkdown, parseInlineBold } from './chatMarkdown';

describe('parseChatMarkdown', () => {
  it('treats a single block as one paragraph', () => {
    expect(parseChatMarkdown('Ola, tudo bem?')).toEqual([{ type: 'paragraph', lines: ['Ola, tudo bem?'] }]);
  });

  it('splits blocks separated by a blank line', () => {
    expect(parseChatMarkdown('Primeiro paragrafo.\n\nSegundo paragrafo.')).toEqual([
      { type: 'paragraph', lines: ['Primeiro paragrafo.'] },
      { type: 'paragraph', lines: ['Segundo paragrafo.'] }
    ]);
  });

  it('recognizes a block where every line is a numbered item as a list', () => {
    const block = '1. Primeiro achado.\n2. Segundo achado.\n3. Terceiro achado.';
    expect(parseChatMarkdown(block)).toEqual([
      { type: 'list', items: ['Primeiro achado.', 'Segundo achado.', 'Terceiro achado.'] }
    ]);
  });

  it('keeps bold markers untouched at this level (bold is a separate pass)', () => {
    expect(parseChatMarkdown('1. Achado com **Acao recomendada:** verificar extrato.')).toEqual([
      { type: 'list', items: ['Achado com **Acao recomendada:** verificar extrato.'] }
    ]);
  });

  it('falls back to a paragraph when not every line matches the numbered pattern', () => {
    const block = '1. Primeiro item.\nTexto solto sem numero.';
    expect(parseChatMarkdown(block)).toEqual([
      { type: 'paragraph', lines: ['1. Primeiro item.', 'Texto solto sem numero.'] }
    ]);
  });

  it('ignores surrounding blank lines and empty input', () => {
    expect(parseChatMarkdown('\n\n  Texto com espacos ao redor.  \n\n')).toEqual([
      { type: 'paragraph', lines: ['Texto com espacos ao redor.'] }
    ]);
    expect(parseChatMarkdown('')).toEqual([]);
  });
});

describe('parseInlineBold', () => {
  it('returns a single non-bold segment when there is no marker', () => {
    expect(parseInlineBold('texto simples')).toEqual([{ text: 'texto simples', bold: false }]);
  });

  it('splits a fully bold string into one bold segment', () => {
    expect(parseInlineBold('**tudo em negrito**')).toEqual([{ text: 'tudo em negrito', bold: true }]);
  });

  it('interleaves bold and non-bold segments in order', () => {
    expect(parseInlineBold('antes **meio** depois')).toEqual([
      { text: 'antes ', bold: false },
      { text: 'meio', bold: true },
      { text: ' depois', bold: false }
    ]);
  });

  it('handles multiple bold spans in the same string', () => {
    expect(parseInlineBold('**Acao recomendada:** conferir o **razao analitico**.')).toEqual([
      { text: 'Acao recomendada:', bold: true },
      { text: ' conferir o ', bold: false },
      { text: 'razao analitico', bold: true },
      { text: '.', bold: false }
    ]);
  });
});
