import { describe, expect, it } from 'vitest';
import { CompanyReport } from '../types';
import { selectionForMode, uniqueFileNames } from './batchExport';
import { companyAlertCount, companyHasAlerts, reportFileName } from './reports';

function makeCompany(overrides: Partial<Record<string, unknown>> = {}): CompanyReport {
  return {
    id: 'a',
    fileName: 'a.pdf',
    companyName: 'Empresa Teste LTDA',
    cnpj: '00.000.000/0001-00',
    period: '01/AGO/2026 até 31/AGO/2026',
    rows: [],
    invertedRows: [],
    zeroMovementRows: [],
    comparisonReport: { isAttention: false },
    analysisReports: [],
    unclassified: [],
    errors: [],
    ...overrides
  } as unknown as CompanyReport;
}

const invertedRow = { account: '1.1.01', name: 'X' };

describe('companyHasAlerts / companyAlertCount', () => {
  it('nao marca alerta quando nao ha nenhuma ocorrencia', () => {
    const company = makeCompany();
    expect(companyAlertCount(company)).toBe(0);
    expect(companyHasAlerts(company)).toBe(false);
  });

  it('conta cada relatorio com ocorrencia como um alerta', () => {
    const company = makeCompany({ invertedRows: [invertedRow, invertedRow], comparisonReport: { isAttention: true } });
    expect(companyAlertCount(company)).toBe(2);
    expect(companyHasAlerts(company)).toBe(true);
  });

  it('considera alerta a empresa so com erro de leitura ou linha nao classificada, igual ao card', () => {
    expect(companyHasAlerts(makeCompany({ errors: ['falha'] }))).toBe(true);
    expect(companyHasAlerts(makeCompany({ unclassified: [{}] }))).toBe(true);
    expect(companyAlertCount(makeCompany({ errors: ['falha'] }))).toBe(0);
  });
});

describe('selectionForMode', () => {
  const withAlert = makeCompany({ id: '1', invertedRows: [invertedRow] });
  const clean = makeCompany({ id: '2' });

  it('modo "alerts" pre-marca somente empresas com alerta', () => {
    expect([...selectionForMode([withAlert, clean], 'alerts')]).toEqual(['1']);
  });

  it('modo "all" pre-marca todas', () => {
    expect([...selectionForMode([withAlert, clean], 'all')].sort()).toEqual(['1', '2']);
  });
});

describe('nomes de arquivo', () => {
  it('inclui o periodo, evitando colisao entre meses da mesma empresa', () => {
    const aug = makeCompany({ period: '01/AGO/2026 até 31/AGO/2026' });
    const jul = makeCompany({ period: '01/JUL/2026 até 31/JUL/2026' });
    expect(reportFileName(aug, 'pdf')).not.toBe(reportFileName(jul, 'pdf'));
    expect(reportFileName(aug, 'pdf')).toBe('empresa-teste-ltda_01-ago-2026-ate-31-ago-2026_relatorios-consolidados.pdf');
  });

  it('omite o periodo quando ele nao foi identificado', () => {
    expect(reportFileName(makeCompany({ period: '-' }), 'xlsx')).toBe('empresa-teste-ltda_relatorios-consolidados.xlsx');
  });

  it('uniqueFileNames acrescenta sufixo aos repetidos e preserva a extensao', () => {
    expect(uniqueFileNames(['a.pdf', 'b.pdf', 'a.pdf', 'a.pdf'])).toEqual(['a.pdf', 'b.pdf', 'a-2.pdf', 'a-3.pdf']);
  });
});
