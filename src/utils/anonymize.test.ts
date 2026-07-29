import { describe, expect, it } from 'vitest';
import { anonymizeText, buildCompanyAliases, deanonymizeText, stripDocumentNumbers } from './anonymize';
import { CompanyReport } from '../types';

function report(companyName: string): CompanyReport {
  return {
    id: companyName,
    fileName: `${companyName}.pdf`,
    companyName,
    cnpj: '12.345.678/0001-90',
    period: '01/2026',
    rows: [],
    unclassified: [],
    invertedRows: [],
    zeroMovementRows: [],
    comparisonReport: {
      mode: 'distribution',
      baseValue: 0,
      targetValue: 0,
      difference: 0,
      isAttention: false,
      message: ''
    },
    analysisReports: [],
    errors: []
  };
}

// Fase 1: esta e a unica camada que impede CNPJ/razao social de saírem do
// navegador quando o assistente de IA e usado. Qualquer regressao aqui e um
// vazamento de dado real, nao um bug cosmetico.
describe('buildCompanyAliases + anonymizeText + deanonymizeText', () => {
  it('replaces the company name with a numbered alias', () => {
    const aliases = buildCompanyAliases([report('ACME COMERCIO LTDA')]);
    expect(aliases).toEqual([{ companyName: 'ACME COMERCIO LTDA', alias: 'Empresa 1' }]);

    const anonymized = anonymizeText('Relatorio da ACME COMERCIO LTDA no periodo.', aliases);
    expect(anonymized).toBe('Relatorio da Empresa 1 no periodo.');
  });

  it('does not let a longer overlapping company name get partially consumed', () => {
    const reports = [report('ACME COMERCIO LTDA'), report('ACME COMERCIO E SERVICOS LTDA')];
    const aliases = buildCompanyAliases(reports);

    const text = 'ACME COMERCIO E SERVICOS LTDA e ACME COMERCIO LTDA sao empresas distintas.';
    const anonymized = anonymizeText(text, aliases);

    expect(anonymized).not.toContain('ACME');
    expect(anonymized).toContain('Empresa 1');
    expect(anonymized).toContain('Empresa 2');
  });

  it('round-trips back to the real names via deanonymizeText', () => {
    const aliases = buildCompanyAliases([report('ACME COMERCIO LTDA')]);
    const modelReply = 'A Empresa 1 apresenta 3 alertas de saldo invertido.';
    expect(deanonymizeText(modelReply, aliases)).toBe('A ACME COMERCIO LTDA apresenta 3 alertas de saldo invertido.');
  });

  it('does not let "Empresa 1" collide with "Empresa 10" on deanonymize', () => {
    const reports = Array.from({ length: 12 }, (_, i) => report(`EMPRESA REAL ${String.fromCharCode(65 + i)} LTDA`));
    const aliases = buildCompanyAliases(reports);

    const modelReply = 'A Empresa 10 tem mais alertas que a Empresa 1.';
    const back = deanonymizeText(modelReply, aliases);

    expect(back).toContain('EMPRESA REAL J LTDA'); // 10a empresa (indice 9)
    expect(back).toContain('EMPRESA REAL A LTDA'); // 1a empresa (indice 0)
    expect(back).not.toContain('Empresa');
  });

  it('deduplicates repeated company names into a single alias', () => {
    const aliases = buildCompanyAliases([report('ACME LTDA'), report('ACME LTDA')]);
    expect(aliases).toHaveLength(1);
  });
});

describe('stripDocumentNumbers', () => {
  it('removes a masked CNPJ', () => {
    expect(stripDocumentNumbers('CNPJ 12.345.678/0001-90 encontrado')).toBe('CNPJ [documento removido] encontrado');
  });

  it('removes an unmasked CNPJ', () => {
    expect(stripDocumentNumbers('CNPJ 12345678000190 encontrado')).toBe('CNPJ [documento removido] encontrado');
  });

  // Formato alfanumerico da Receita Federal (2026): 12 primeiros caracteres
  // podem ser letras ou digitos, os 2 ultimos (DV) continuam numericos. Sem
  // isso o CNPJ passaria batido para o Gemini.
  it('removes an alphanumeric CNPJ (new Receita Federal format)', () => {
    expect(stripDocumentNumbers('CNPJ 12.ABC.345/01DE-35 encontrado')).toBe('CNPJ [documento removido] encontrado');
  });

  it('removes an unmasked alphanumeric CNPJ', () => {
    expect(stripDocumentNumbers('CNPJ 12ABC34501DE35 encontrado')).toBe('CNPJ [documento removido] encontrado');
  });

  it('removes a CPF', () => {
    expect(stripDocumentNumbers('CPF do socio: 123.456.789-09.')).toBe('CPF do socio: [documento removido].');
  });

  it('leaves ordinary numbers untouched', () => {
    expect(stripDocumentNumbers('Saldo de 1.234,56 na conta 1.1.01.')).toBe('Saldo de 1.234,56 na conta 1.1.01.');
  });
});
