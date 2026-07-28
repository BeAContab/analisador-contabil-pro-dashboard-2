import { describe, expect, it } from 'vitest';
import { balanceNature, classifyAccount, formatNumberAsBrazilianMoney, isZeroMoney, parseBrazilianMoney, slugify } from './format';

describe('parseBrazilianMoney', () => {
  it('parses a plain positive value', () => {
    expect(parseBrazilianMoney('1.234,56')).toBeCloseTo(1234.56);
  });

  it('parses a value with D/C suffix', () => {
    expect(parseBrazilianMoney('1.020,00C')).toBeCloseTo(1020);
    expect(parseBrazilianMoney('1.020,00D')).toBeCloseTo(1020);
  });

  it('parses a value with R$ prefix', () => {
    expect(parseBrazilianMoney('R$ 500,00')).toBeCloseTo(500);
  });

  it('treats a fully parenthesized value as negative', () => {
    expect(parseBrazilianMoney('(1.234,56)')).toBeCloseTo(-1234.56);
  });

  // Fase 2, item 2.2: corte de pagina/OCR as vezes preserva so um dos
  // parenteses. Antes exigir os dois fazia o sinal ser perdido silenciosamente.
  it('treats a value with only the opening parenthesis as negative', () => {
    expect(parseBrazilianMoney('(1.234,56')).toBeCloseTo(-1234.56);
  });

  it('treats a value with only the closing parenthesis as negative', () => {
    expect(parseBrazilianMoney('1.234,56)')).toBeCloseTo(-1234.56);
  });

  it('returns 0 for an empty or unparseable string', () => {
    expect(parseBrazilianMoney('')).toBe(0);
    expect(parseBrazilianMoney('   ')).toBe(0);
  });

  it('returns 0 for a literal zero in different notations', () => {
    expect(parseBrazilianMoney('0,00')).toBe(0);
    expect(parseBrazilianMoney('0,00C')).toBe(0);
  });
});

describe('balanceNature', () => {
  it('reads the trailing D/C marker', () => {
    expect(balanceNature('1.020,00D')).toBe('D');
    expect(balanceNature('1.020,00C')).toBe('C');
  });

  it('returns null when there is no marker', () => {
    expect(balanceNature('1.020,00')).toBeNull();
  });
});

describe('isZeroMoney', () => {
  it('is true when the parsed value is zero regardless of raw formatting', () => {
    expect(isZeroMoney('0,00C', 0)).toBe(true);
    expect(isZeroMoney('(0,00)', 0)).toBe(true);
  });

  it('is false for a non-zero parsed value', () => {
    expect(isZeroMoney('1,00', 1)).toBe(false);
  });
});

describe('classifyAccount', () => {
  it('classifies accounts by leading digit', () => {
    expect(classifyAccount('1.1.01')).toBe('Ativo');
    expect(classifyAccount('2.1.03')).toBe('Passivo');
    expect(classifyAccount('3.1')).toBe('');
  });
});

describe('formatNumberAsBrazilianMoney', () => {
  it('formats using pt-BR thousands/decimal separators', () => {
    expect(formatNumberAsBrazilianMoney(1234.5)).toBe('1.234,50');
  });
});

describe('slugify', () => {
  it('strips accents and non-alphanumeric characters', () => {
    expect(slugify('Análise Contábil Ltda.')).toBe('analise-contabil-ltda');
  });

  it('falls back to a default when the result would be empty', () => {
    expect(slugify('!!!')).toBe('empresa');
  });
});
