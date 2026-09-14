import { describe, expect, it } from 'vitest';
import {
  buildMarginsAnalysis,
  buildMissingComparisonAnalysis,
  buildVariationAnalysis,
  buildWaterfallAnalysis,
  extractDreLinesFromPage,
  extractDreMetadata,
  findColumnAnchors
} from './dreParser';
import { TextItem } from './parser';
import { DreReport } from '../types';

function item(text: string, x: number, width: number, y: number, page = 1): TextItem {
  return { text, x, y, width, page };
}

// Coordenadas reais extraidas de acompanhamentos/MEDICAR.pdf (confirmadas com
// um script de diagnostico contra o pdf.js antes de escrever o parser) - a
// ordem do texto no stream do pdf.js nao segue a ordem visual das colunas,
// entao os itens abaixo estao deliberadamente fora de ordem esquerda-direita,
// exatamente como o pdf.js realmente devolve para este arquivo.
function medicarHeaderLine(): TextItem[] {
  return [
    item('jan/2026', 173.76, 26.53, 520.68),
    item('fev/2026', 217.93, 26.52, 520.68),
    item('mar/2026', 260.13, 29.34, 520.68),
    item('abr/2026', 305.02, 27.29, 520.68),
    item('Total', 693.12, 15.45, 520.68),
    item('%', 731.04, 6.19, 520.68),
    item('Média', 760.32, 18.76, 520.68),
    item('Média 2025', 784.54, 36.04, 520.68)
  ];
}

function medicarRevenueLine(): TextItem[] {
  // "RECEITA OPERACIONAL BRUTA" - linha real do PDF, ordem de stream scrambled.
  return [
    item('637.400,89', 219.36, 24.98, 511.92), // fev
    item('2.352.326,19', 679.2, 29.18, 511.92), // total
    item('0,00', 727.56, 9.75, 511.92), // %
    item('RECEITA OPERACIONAL BRUTA', 18, 79.62, 511.92),
    item('442.938,14', 175.32, 24.98, 511.92), // jan
    item('0,00', 815.76, 9.75, 511.92), // media 2025
    item('588.081,54', 754.08, 24.98, 511.92), // media
    item('615.910,22', 264.12, 24.98, 511.92), // mar
    item('656.076,94', 306.96, 25.03, 511.92) // abr
  ];
}

function medicarEmpresaLine(): TextItem[] {
  return [item('Empresa:', 19.92, 29.77, 566.4), item('(1826 - 1) MEDICAR - MEDICINA INTENSIVA E CARDIOLOGIA LTDA', 55.2, 221.98, 566.4)];
}

function medicarCnpjLine(): TextItem[] {
  return [item('CNPJ:', 19.2, 20.16, 556.68), item('05.294.519/0001-43', 55.44, 61.84, 556.68)];
}

function medicarFooterLines(): TextItem[] {
  return [
    [item('Data e Hora da Impressão:', 29.28, 96.53, 22.08), item('04/09/2026 10:47:29', 127.44, 73.56, 22.08)],
    [item('-11.894,65', 708.12, 28.89, 16.44)]
  ].flat();
}

describe('findColumnAnchors', () => {
  it('detecta periodos e colunas de resumo a partir da linha de cabecalho', () => {
    const result = findColumnAnchors([medicarHeaderLine()]);
    expect(result).not.toBeNull();
    expect(result?.periods).toEqual(['jan/2026', 'fev/2026', 'mar/2026', 'abr/2026']);
    expect(result?.previousYearLabel).toBe('Média 2025');
    expect(result?.anchors).toHaveLength(8);
  });

  it('retorna null quando nenhuma linha de cabecalho e encontrada', () => {
    expect(findColumnAnchors([medicarRevenueLine()])).toBeNull();
  });
});

describe('extractDreLinesFromPage', () => {
  const anchors = findColumnAnchors([medicarHeaderLine()])!.anchors;

  it('reconstroi uma linha de dados apesar da ordem embaralhada do stream do pdf.js', () => {
    const lines = extractDreLinesFromPage(medicarRevenueLine(), anchors);
    expect(lines).toHaveLength(1);
    const line = lines[0]!;
    expect(line.label).toBe('RECEITA OPERACIONAL BRUTA');
    expect(line.level).toBe(0);
    expect(line.periodValues.map((v) => v?.value)).toEqual([442938.14, 637400.89, 615910.22, 656076.94]);
    expect(line.total?.value).toBeCloseTo(2352326.19);
    expect(line.average?.value).toBeCloseTo(588081.54);
    expect(line.averagePreviousYear?.value).toBe(0);
  });

  it('ignora linhas de metadados (Empresa:/CNPJ:) por nao terem valor com forma de dinheiro', () => {
    expect(extractDreLinesFromPage(medicarEmpresaLine(), anchors)).toHaveLength(0);
    expect(extractDreLinesFromPage(medicarCnpjLine(), anchors)).toHaveLength(0);
  });

  it('ignora ruido de rodape (data de impressao, total residual sem rotulo)', () => {
    expect(extractDreLinesFromPage(medicarFooterLines(), anchors)).toHaveLength(0);
  });

  it('calcula o nivel de indentacao a partir da posicao X do rotulo', () => {
    const subItem = item('Serviços Prestados', 32.4, 43.32, 495.48);
    const value = item('442.938,14', 175.32, 24.98, 495.48);
    const lines = extractDreLinesFromPage([subItem, value], anchors);
    expect(lines[0]?.level).toBe(2);
  });
});

describe('extractDreMetadata', () => {
  it('extrai nome da empresa e CNPJ das linhas rotuladas', () => {
    const meta = extractDreMetadata([[...medicarEmpresaLine(), ...medicarCnpjLine()]]);
    expect(meta.companyName).toBe('(1826 - 1) MEDICAR - MEDICINA INTENSIVA E CARDIOLOGIA LTDA');
    expect(meta.cnpj).toBe('05.294.519/0001-43');
  });

  it('usa mensagens de fallback quando nao encontra as linhas', () => {
    const meta = extractDreMetadata([[]]);
    expect(meta.companyName).toBe('Empresa não identificada');
    expect(meta.cnpj).toBe('CNPJ não identificado');
  });
});

function dreValue(value: number) {
  return { raw: String(value), value };
}

function makeReport(overrides: Partial<DreReport> = {}): DreReport {
  return {
    id: 'test',
    fileName: 'test.pdf',
    companyName: 'Empresa Teste',
    cnpj: '00.000.000/0001-00',
    periods: ['jan/2026', 'fev/2026'],
    previousYearLabel: 'Média 2025',
    lines: [],
    analysisReports: [],
    errors: [],
    ...overrides
  };
}

describe('buildWaterfallAnalysis', () => {
  it('nao sinaliza nada quando a cascata fecha exatamente (caso real do MEDICAR)', () => {
    const report = makeReport({
      periods: ['jan/2026'],
      lines: [
        { label: 'RECEITA OPERACIONAL BRUTA', level: 0, periodValues: [dreValue(442938.14)], total: dreValue(442938.14) },
        { label: '(-) DEDUÇÕES DE SERVIÇOS', level: 0, periodValues: [dreValue(-29455.37)], total: dreValue(-29455.37) },
        { label: '(=) RECEITA LIQUIDA OPERACIONAL', level: 0, periodValues: [dreValue(413482.77)], total: dreValue(413482.77) },
        { label: 'CUSTO DE VENDAS E SERVIÇOS', level: 0, periodValues: [dreValue(-71488.94)], total: dreValue(-71488.94) },
        { label: '(=) LUCRO BRUTO OPERACIONAL', level: 0, periodValues: [dreValue(341993.83)], total: dreValue(341993.83) },
        { label: 'DESPESAS/RECEITAS OPERACIONAIS', level: 0, periodValues: [dreValue(-318456.69)], total: dreValue(-318456.69) },
        { label: '(=) RESULTADO OPERACIONAL', level: 0, periodValues: [dreValue(23537.14)], total: dreValue(23537.14) },
        { label: '(=) RESULTADO ANTES DAS PROVISÔES', level: 0, periodValues: [dreValue(23537.14)], total: dreValue(23537.14) },
        { label: 'Prov.P/Contribuição Social', level: 0, periodValues: [dreValue(-4783.73)], total: dreValue(-4783.73) },
        { label: 'Prov.P/Imposto de Renda', level: 0, periodValues: [dreValue(-6858.76)], total: dreValue(-6858.76) },
        { label: '(=) RESULTADO DEPOIS DAS PROVISOES', level: 0, periodValues: [dreValue(11894.65)], total: dreValue(11894.65) },
        { label: 'LUCRO/PREJUIZO DO EXERCICIO', level: 0, periodValues: [dreValue(11894.65)], total: dreValue(11894.65) }
      ]
    });

    const result = buildWaterfallAnalysis(report);
    expect(result.isAttention).toBe(false);
    expect(result.rows).toHaveLength(0);
  });

  it('sinaliza quando um subtotal nao bate com a soma dos componentes', () => {
    const report = makeReport({
      periods: ['jan/2026'],
      lines: [
        { label: 'RECEITA OPERACIONAL BRUTA', level: 0, periodValues: [dreValue(1000)], total: dreValue(1000) },
        { label: '(-) DEDUÇÕES DE SERVIÇOS', level: 0, periodValues: [dreValue(-100)], total: dreValue(-100) },
        // Deveria ser 900 (1000 - 100); simula erro de extracao/PDF.
        { label: '(=) RECEITA LIQUIDA OPERACIONAL', level: 0, periodValues: [dreValue(950)], total: dreValue(950) }
      ]
    });

    const result = buildWaterfallAnalysis(report);
    expect(result.isAttention).toBe(true);
    expect(result.rows).toHaveLength(2); // uma linha por periodo + total
    expect(result.rows[0]?.label).toContain('RECEITA LIQUIDA OPERACIONAL');
  });

  it('ignora formulas cujas linhas nao existem no relatorio, sem lancar erro', () => {
    const result = buildWaterfallAnalysis(makeReport());
    expect(result.isAttention).toBe(false);
    expect(result.rows).toHaveLength(0);
  });
});

describe('buildVariationAnalysis', () => {
  it('calcula a variacao percentual entre periodos consecutivos e ordena pela maior', () => {
    const report = makeReport({
      periods: ['jan/2026', 'fev/2026', 'mar/2026'],
      lines: [
        { label: 'Linha A', level: 0, periodValues: [dreValue(100), dreValue(200), dreValue(190)] },
        { label: 'Linha B', level: 0, periodValues: [dreValue(50), dreValue(52), dreValue(54)] }
      ]
    });

    const result = buildVariationAnalysis(report);
    expect(result.isAttention).toBe(true);
    // Maior variacao: Linha A jan->fev, +100%.
    expect(result.rows[0]?.label).toContain('Linha A');
    expect(result.rows[0]?.cells[2]?.value).toContain('100');
  });

  it('ignora pares onde o periodo anterior e zero (evita divisao por zero)', () => {
    const report = makeReport({
      periods: ['jan/2026', 'fev/2026'],
      lines: [{ label: 'Linha A', level: 0, periodValues: [dreValue(0), dreValue(500)] }]
    });
    const result = buildVariationAnalysis(report);
    expect(result.rows).toHaveLength(0);
    expect(result.isAttention).toBe(false);
  });
});

describe('buildMarginsAnalysis', () => {
  it('calcula margem bruta/operacional/liquida sobre a receita liquida', () => {
    const report = makeReport({
      periods: ['jan/2026'],
      lines: [
        { label: '(=) RECEITA LIQUIDA OPERACIONAL', level: 0, periodValues: [dreValue(1000)] },
        { label: '(=) LUCRO BRUTO OPERACIONAL', level: 0, periodValues: [dreValue(600)] },
        { label: '(=) RESULTADO OPERACIONAL', level: 0, periodValues: [dreValue(300)] },
        { label: 'LUCRO/PREJUIZO DO EXERCICIO', level: 0, periodValues: [dreValue(200)] }
      ]
    });

    const result = buildMarginsAnalysis(report);
    expect(result.isAttention).toBe(false);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.cells[0]?.value).toContain('60');
    expect(result.rows[0]?.cells[1]?.value).toContain('30');
    expect(result.rows[0]?.cells[2]?.value).toContain('20');
  });

  it('nao calcula quando as linhas de referencia da cascata nao existem', () => {
    const result = buildMarginsAnalysis(makeReport());
    expect(result.rows).toHaveLength(0);
  });
});

describe('buildMissingComparisonAnalysis', () => {
  it('sinaliza quando Média e a coluna do ano anterior vem zeradas em tudo (caso real do MEDICAR)', () => {
    const report = makeReport({
      lines: [
        {
          label: 'RECEITA OPERACIONAL BRUTA',
          level: 0,
          periodValues: [],
          total: dreValue(2352326.19),
          average: dreValue(588081.54),
          averagePreviousYear: dreValue(0)
        }
      ]
    });
    const result = buildMissingComparisonAnalysis(report);
    expect(result.isAttention).toBe(true);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.label).toContain('Média 2025');
  });

  it('nao sinaliza quando ha dado real nas colunas de comparativo', () => {
    const report = makeReport({
      lines: [
        {
          label: 'RECEITA OPERACIONAL BRUTA',
          level: 0,
          periodValues: [],
          total: dreValue(1000),
          average: dreValue(500),
          averagePreviousYear: dreValue(400)
        }
      ]
    });
    const result = buildMissingComparisonAnalysis(report);
    expect(result.isAttention).toBe(false);
    expect(result.rows).toHaveLength(0);
  });
});
