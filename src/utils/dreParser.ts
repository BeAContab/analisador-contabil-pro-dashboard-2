import { TextItem, bucketItemsByLine, extractPageItems } from './parser';
import { DreAnalysisReport, DreAnalysisRow, DreColumnValue, DreLineItem, DreReport } from '../types';
import { formatNumberAsBrazilianMoney, formatNumberAsPercentage, parseBrazilianMoney } from './format';

/**
 * Parser da Demonstracao do Resultado (DRE) - documento diferente do
 * balancete (ver types.ts): nao ha codigo de conta, e sim uma cascata de
 * linhas com ate N colunas de periodo (meses) mais Total/%/Média/Média do
 * ano anterior, todas alinhadas a direita dentro de cada coluna.
 *
 * Achado ao investigar o arquivo de exemplo (acompanhamentos/MEDICAR.pdf): a
 * ordem do texto no stream do pdf.js NAO segue a ordem visual esquerda-direita
 * das colunas (diferente do balancete). Cada valor, porem, ja chega como um
 * item de texto completo e a borda direita de cada item e extremamente estavel
 * dentro da mesma coluna (variacao <0.1pt), porque a fonte usada e tabular e as
 * colunas sao alinhadas a direita. A estrategia aqui e calibrar as colunas por
 * arquivo (achando a linha de cabecalho com "Total"/"%"/"Média"/"Média <ano>")
 * em vez de usar posicoes fixas em pixel, e casar cada item de valor com a
 * coluna cuja borda direita fica mais perto - com tolerancia pequena o
 * suficiente para nunca confundir colunas vizinhas (a menor distancia entre
 * duas colunas adjacentes no arquivo de exemplo e de ~29pt).
 */

const moneyLikeRegex = /^\(?-?\d{1,3}(\.\d{3})*,\d{2}\)?$/;
const monthLikeRegex = /^[a-zà-ÿ]{3}\/\d{4}$/i;
const previousYearHeaderRegex = /^Média\s+\d{4}$/i;

const COLUMN_TOLERANCE = 6;
// Indentacao visual da DRE avanca em passos fixos (confirmado no arquivo de
// exemplo: x=18/25.2/32.4, um passo de 7.2pt por nivel).
const INDENT_BASE_X = 18;
const INDENT_STEP = 7.2;

interface ColumnAnchor {
  key: string;
  label: string;
  right: number;
}

function rightEdge(item: TextItem): number {
  return item.x + item.width;
}

function normalizeLabel(value: string): string {
  // \p{Mark} (categoria Unicode "marca combinante") remove os acentos apos
  // a decomposicao NFD - mesmo resultado do range de combining marks usado
  // em parser.ts/anonymize.ts, so que escrito sem depender de escape numerico.
  return value
    .normalize('NFD')
    .replace(/\p{Mark}/gu, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Acha a linha de cabecalho que calibra as colunas deste arquivo (em vez de
 * posicoes fixas): procura uma linha com um item "Total" exato, "%" exato,
 * "Média" exato e "Média <ano>" exato. Os itens de periodo (ex. "jan/2026")
 * na mesma linha viram as colunas de periodo, na ordem em que aparecem.
 */
export function findColumnAnchors(
  pages: TextItem[][]
): { anchors: ColumnAnchor[]; periods: string[]; previousYearLabel: string } | null {
  for (const pageItems of pages) {
    for (const line of bucketItemsByLine(pageItems)) {
      const totalItem = line.find((it) => it.text.trim() === 'Total');
      const percentItem = line.find((it) => it.text.trim() === '%');
      const averageItem = line.find((it) => it.text.trim() === 'Média');
      const previousYearItem = line.find((it) => previousYearHeaderRegex.test(it.text.trim()));
      if (!totalItem || !percentItem || !averageItem || !previousYearItem) continue;

      const periodItems = line.filter((it) => monthLikeRegex.test(it.text.trim()));
      if (periodItems.length === 0) continue;

      const anchors: ColumnAnchor[] = [
        ...periodItems.map((it, index) => ({ key: `period${index}`, label: it.text.trim(), right: rightEdge(it) })),
        { key: 'total', label: 'Total', right: rightEdge(totalItem) },
        { key: 'percent', label: '%', right: rightEdge(percentItem) },
        { key: 'average', label: 'Média', right: rightEdge(averageItem) },
        { key: 'averagePreviousYear', label: previousYearItem.text.trim(), right: rightEdge(previousYearItem) }
      ];

      return {
        anchors,
        periods: periodItems.map((it) => it.text.trim()),
        previousYearLabel: previousYearItem.text.trim()
      };
    }
  }
  return null;
}

function nearestColumn(anchors: ColumnAnchor[], edge: number): ColumnAnchor | undefined {
  let best: ColumnAnchor | undefined;
  let bestDistance = Infinity;
  for (const anchor of anchors) {
    const distance = Math.abs(anchor.right - edge);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = anchor;
    }
  }
  return best !== undefined && bestDistance <= COLUMN_TOLERANCE ? best : undefined;
}

function toColumnValue(raw: string): DreColumnValue {
  return { raw, value: parseBrazilianMoney(raw) };
}

/**
 * Interpreta as linhas de uma pagina ja calibrada. Uma linha vira DreLineItem
 * quando tem rotulo (texto a esquerda da primeira coluna numerica) E pelo
 * menos um valor com formato monetario reconhecido casado a uma coluna
 * conhecida - isso filtra cabecalho/rodape/metadados (ex. "Empresa:",
 * "CNPJ:", "Data e Hora da Impressão") automaticamente, sem precisar de um
 * padrao especifico para cada um: o "valor" deles nunca tem forma de dinheiro.
 */
export function extractDreLinesFromPage(pageItems: TextItem[], anchors: ColumnAnchor[]): DreLineItem[] {
  const labelBoundary = Math.min(...anchors.map((a) => a.right)) - 30;
  const periodCount = anchors.filter((a) => a.key.startsWith('period')).length;
  const results: DreLineItem[] = [];

  for (const line of bucketItemsByLine(pageItems)) {
    const labelItems = line.filter((it) => rightEdge(it) <= labelBoundary);
    const label = labelItems
      .map((it) => it.text.trim())
      .join(' ')
      .trim();
    if (!label) continue;

    const valuesByKey = new Map<string, DreColumnValue>();
    for (const item of line) {
      if (rightEdge(item) <= labelBoundary) continue;
      const text = item.text.trim();
      if (!moneyLikeRegex.test(text)) continue;
      const column = nearestColumn(anchors, rightEdge(item));
      if (column) valuesByKey.set(column.key, toColumnValue(text));
    }
    if (valuesByKey.size === 0) continue;

    const first = labelItems[0];
    const level = first ? Math.max(0, Math.round((first.x - INDENT_BASE_X) / INDENT_STEP)) : 0;

    results.push({
      label,
      level,
      periodValues: Array.from({ length: periodCount }, (_, index) => valuesByKey.get(`period${index}`)),
      total: valuesByKey.get('total'),
      percent: valuesByKey.get('percent'),
      average: valuesByKey.get('average'),
      averagePreviousYear: valuesByKey.get('averagePreviousYear')
    });
  }

  return results;
}

export function extractDreMetadata(pages: TextItem[][]): { companyName: string; cnpj: string } {
  // "Empresa:" e "CNPJ:" ficam em linhas (Y) diferentes no cabecalho - precisa
  // varrer todas as linhas antes de decidir, nunca retornar assim que um dos
  // dois for encontrado (um retorno antecipado no primeiro match perdia o
  // outro campo sempre que ele estivesse numa linha seguinte).
  let companyName: string | undefined;
  let cnpj: string | undefined;

  for (const pageItems of pages) {
    for (const line of bucketItemsByLine(pageItems)) {
      if (companyName === undefined) {
        const empresaIndex = line.findIndex((it) => it.text.trim() === 'Empresa:');
        if (empresaIndex !== -1 && line[empresaIndex + 1]) companyName = line[empresaIndex + 1]!.text.trim();
      }
      if (cnpj === undefined) {
        const cnpjIndex = line.findIndex((it) => it.text.trim() === 'CNPJ:');
        if (cnpjIndex !== -1 && line[cnpjIndex + 1]) cnpj = line[cnpjIndex + 1]!.text.trim();
      }
      if (companyName !== undefined && cnpj !== undefined) break;
    }
    if (companyName !== undefined && cnpj !== undefined) break;
  }

  return {
    companyName: companyName || 'Empresa não identificada',
    cnpj: cnpj || 'CNPJ não identificado'
  };
}

function emptyDreReport(file: File, errors: string[]): DreReport {
  return {
    id: `${file.name}-${file.size}-${file.lastModified}`,
    fileName: file.name,
    companyName: file.name.replace(/\.pdf$/i, ''),
    cnpj: 'CNPJ não identificado',
    periods: [],
    previousYearLabel: '',
    lines: [],
    analysisReports: [],
    errors
  };
}

export async function parseDreFile(file: File): Promise<DreReport> {
  try {
    const pages = await extractPageItems(file);
    const calibration = findColumnAnchors(pages);

    if (!calibration) {
      return emptyDreReport(file, [
        'Não foi possível identificar o layout de colunas da DRE (linha com Total/%/Média não encontrada). O arquivo pode estar em um formato diferente do esperado.'
      ]);
    }

    const meta = extractDreMetadata(pages);
    const lines = pages.flatMap((pageItems) => extractDreLinesFromPage(pageItems, calibration.anchors));
    const errors: string[] = [];
    if (lines.length === 0) {
      errors.push('Não foi possível identificar nenhuma linha de resultado neste arquivo.');
    }

    const report: DreReport = {
      id: `${file.name}-${file.size}-${file.lastModified}`,
      fileName: file.name,
      companyName: meta.companyName,
      cnpj: meta.cnpj,
      periods: calibration.periods,
      previousYearLabel: calibration.previousYearLabel,
      lines,
      analysisReports: [],
      errors
    };

    report.analysisReports = buildDreAnalysisReports(report);
    return report;
  } catch (error) {
    console.error(`[dreParser] Falha ao ler "${file.name}":`, error);
    const detail = error instanceof Error ? error.message : String(error);
    return emptyDreReport(file, [
      'Não foi possível ler este PDF. Verifique se o arquivo está no formato esperado.',
      `Detalhe técnico: ${detail}`
    ]);
  }
}

// ===================== Analises (fase C) =====================

function findLine(report: DreReport, normalizedLabel: string): DreLineItem | undefined {
  return report.lines.find((line) => normalizeLabel(line.label) === normalizedLabel);
}

interface DreFormula {
  result: string;
  components: string[];
}

/**
 * Formulas da cascata do DRE, no mesmo espirito do `ledgerBalanceMismatch` do
 * balancete: uma rede de seguranca que nunca deveria disparar num arquivo bem
 * formado, mas pega tanto erro de origem do PDF quanto bug de extracao aqui.
 * Rotulos normalizados (sem acento, maiusculo) para tolerar variacoes como
 * "PROVISÔES" vs "PROVISOES" entre arquivos.
 */
const dreFormulas: DreFormula[] = [
  { result: '(=) RECEITA LIQUIDA OPERACIONAL', components: ['RECEITA OPERACIONAL BRUTA', '(-) DEDUCOES DE SERVICOS'] },
  { result: '(=) LUCRO BRUTO OPERACIONAL', components: ['(=) RECEITA LIQUIDA OPERACIONAL', 'CUSTO DE VENDAS E SERVICOS'] },
  { result: '(=) RESULTADO OPERACIONAL', components: ['(=) LUCRO BRUTO OPERACIONAL', 'DESPESAS/RECEITAS OPERACIONAIS'] },
  { result: '(=) RESULTADO ANTES DAS PROVISOES', components: ['(=) RESULTADO OPERACIONAL'] },
  {
    result: '(=) RESULTADO DEPOIS DAS PROVISOES',
    components: ['(=) RESULTADO ANTES DAS PROVISOES', 'PROV.P/CONTRIBUICAO SOCIAL', 'PROV.P/IMPOSTO DE RENDA']
  },
  { result: 'LUCRO/PREJUIZO DO EXERCICIO', components: ['(=) RESULTADO DEPOIS DAS PROVISOES'] }
];

const MISMATCH_TOLERANCE = 0.01;

export function buildWaterfallAnalysis(report: DreReport): DreAnalysisReport {
  const rows: DreAnalysisRow[] = [];

  for (const formula of dreFormulas) {
    const resultLine = findLine(report, formula.result);
    const componentLines = formula.components.map((label) => findLine(report, label));
    if (!resultLine || componentLines.some((line) => !line)) continue;

    const columns: Array<{ label: string; index: number | 'total' }> = [
      ...report.periods.map((label, index) => ({ label, index })),
      { label: 'Total', index: 'total' as const }
    ];

    for (const column of columns) {
      const actual =
        column.index === 'total' ? resultLine.total?.value : resultLine.periodValues[column.index]?.value;
      if (actual === undefined) continue;

      const expected = componentLines.reduce((sum, line) => {
        const value = column.index === 'total' ? line!.total?.value : line!.periodValues[column.index as number]?.value;
        return sum + (value ?? 0);
      }, 0);

      const difference = actual - expected;
      if (Math.abs(difference) > MISMATCH_TOLERANCE) {
        rows.push({
          label: `${resultLine.label} — ${column.label}`,
          cells: [
            { header: 'Esperado (soma dos componentes)', value: formatNumberAsBrazilianMoney(expected) },
            { header: 'Informado no PDF', value: formatNumberAsBrazilianMoney(actual) },
            { header: 'Diferença', value: formatNumberAsBrazilianMoney(difference) }
          ]
        });
      }
    }
  }

  return {
    kind: 'dreWaterfall',
    title: 'Conferência da Cascata do DRE',
    intro:
      'Recalcula cada subtotal da cascata (Receita Líquida, Lucro Bruto, Resultado Operacional, Resultado Depois das Provisões) a partir dos componentes anteriores e sinaliza qualquer diferença.',
    message:
      rows.length > 0
        ? 'Atenção: um ou mais subtotais do DRE não fecham com a soma dos componentes.'
        : 'Tudo OK: todos os subtotais da cascata do DRE fecham com a soma dos componentes.',
    rows,
    isAttention: rows.length > 0
  };
}

const VARIATION_TOP_N = 10;

export function buildVariationAnalysis(report: DreReport): DreAnalysisReport {
  interface Variation {
    label: string;
    fromPeriod: string;
    toPeriod: string;
    from: number;
    to: number;
    percentChange: number;
  }

  const variations: Variation[] = [];

  for (const line of report.lines) {
    for (let i = 0; i < report.periods.length - 1; i += 1) {
      const from = line.periodValues[i]?.value;
      const to = line.periodValues[i + 1]?.value;
      if (from === undefined || to === undefined || from === 0) continue;

      const percentChange = (to - from) / Math.abs(from);
      variations.push({
        label: line.label,
        fromPeriod: report.periods[i]!,
        toPeriod: report.periods[i + 1]!,
        from,
        to,
        percentChange
      });
    }
  }

  const top = variations.sort((a, b) => Math.abs(b.percentChange) - Math.abs(a.percentChange)).slice(0, VARIATION_TOP_N);

  const rows: DreAnalysisRow[] = top.map((variation) => ({
    label: `${variation.label} (${variation.fromPeriod} → ${variation.toPeriod})`,
    cells: [
      { header: variation.fromPeriod, value: formatNumberAsBrazilianMoney(variation.from) },
      { header: variation.toPeriod, value: formatNumberAsBrazilianMoney(variation.to) },
      { header: 'Variação', value: formatNumberAsPercentage(variation.percentChange) }
    ]
  }));

  return {
    kind: 'dreVariation',
    title: 'Maiores Variações Mês a Mês',
    intro: 'Lista as maiores variações percentuais entre meses consecutivos, linha a linha da DRE — útil para identificar oscilações que merecem explicação.',
    message:
      rows.length > 0
        ? `Top ${rows.length} variações encontradas entre os períodos disponíveis.`
        : 'Não há dados suficientes (pelo menos 2 períodos com valor) para calcular variação.',
    rows,
    isAttention: rows.length > 0
  };
}

const NET_REVENUE_LABEL = '(=) RECEITA LIQUIDA OPERACIONAL';
const GROSS_PROFIT_LABEL = '(=) LUCRO BRUTO OPERACIONAL';
const OPERATING_RESULT_LABEL = '(=) RESULTADO OPERACIONAL';
const NET_RESULT_LABEL = 'LUCRO/PREJUIZO DO EXERCICIO';

export function buildMarginsAnalysis(report: DreReport): DreAnalysisReport {
  const revenueLine = findLine(report, NET_REVENUE_LABEL);
  const grossProfitLine = findLine(report, GROSS_PROFIT_LABEL);
  const operatingLine = findLine(report, OPERATING_RESULT_LABEL);
  const netLine = findLine(report, NET_RESULT_LABEL);

  const rows: DreAnalysisRow[] = [];

  if (revenueLine && grossProfitLine && operatingLine && netLine) {
    report.periods.forEach((periodLabel, index) => {
      const revenue = revenueLine.periodValues[index]?.value;
      if (!revenue) return;

      const grossProfit = grossProfitLine.periodValues[index]?.value ?? 0;
      const operating = operatingLine.periodValues[index]?.value ?? 0;
      const net = netLine.periodValues[index]?.value ?? 0;

      rows.push({
        label: periodLabel,
        cells: [
          { header: 'Margem Bruta', value: formatNumberAsPercentage(grossProfit / revenue) },
          { header: 'Margem Operacional', value: formatNumberAsPercentage(operating / revenue) },
          { header: 'Margem Líquida', value: formatNumberAsPercentage(net / revenue) }
        ]
      });
    });
  }

  return {
    kind: 'dreMargins',
    title: 'Margens Mensais',
    intro: 'Margem Bruta, Operacional e Líquida (% sobre a Receita Líquida Operacional) em cada período — indicador informativo, não é um alerta de erro.',
    message: rows.length > 0 ? 'Margens calculadas para os períodos disponíveis.' : 'Não foi possível calcular margens (linhas de referência da cascata não encontradas).',
    rows,
    isAttention: false
  };
}

export function buildMissingComparisonAnalysis(report: DreReport): DreAnalysisReport {
  const linesWithTotal = report.lines.filter((line) => line.total !== undefined && line.total.value !== 0);
  const rows: DreAnalysisRow[] = [];

  if (linesWithTotal.length > 0) {
    const averageAllZero = linesWithTotal.every((line) => !line.average || line.average.value === 0);
    const previousYearAllZero = linesWithTotal.every((line) => !line.averagePreviousYear || line.averagePreviousYear.value === 0);

    if (averageAllZero) {
      rows.push({
        label: 'Coluna "Média"',
        cells: [{ header: 'Situação', value: 'Todas as linhas com Total diferente de zero vieram com Média zerada.' }]
      });
    }
    if (previousYearAllZero) {
      rows.push({
        label: `Coluna "${report.previousYearLabel || 'Média do ano anterior'}"`,
        cells: [
          {
            header: 'Situação',
            value: `Todas as linhas com Total diferente de zero vieram com "${report.previousYearLabel || 'Média do ano anterior'}" zerada.`
          }
        ]
      });
    }
  }

  return {
    kind: 'dreMissingComparison',
    title: 'Comparativo Anual Ausente',
    intro:
      'Sinaliza quando as colunas de Média e Média do ano anterior existem no layout do PDF mas vêm zeradas em todas as linhas — indício de que o comparativo anual não foi exportado, não de que não houve variação.',
    message:
      rows.length > 0
        ? 'Atenção: uma ou mais colunas de comparativo anual vieram zeradas em todas as linhas.'
        : 'Tudo OK: as colunas de comparativo anual têm dados.',
    rows,
    isAttention: rows.length > 0
  };
}

function buildDreAnalysisReports(report: DreReport): DreAnalysisReport[] {
  return [
    buildWaterfallAnalysis(report),
    buildVariationAnalysis(report),
    buildMarginsAnalysis(report),
    buildMissingComparisonAnalysis(report)
  ];
}
