/** Navegacao principal do app - unico lugar que define as views validas (antes duplicado entre App.tsx e Sidebar.tsx). */
export type View = 'main' | 'privacy' | 'security' | 'docs' | 'dre';

export type AlertType = 'Ativo com saldo C' | 'Passivo/PL com saldo D';

export interface LedgerLine {
  account: string;
  name: string;
  previousBalance: string;
  debit: string;
  credit: string;
  currentBalance: string;
  code?: string | undefined;
  page?: number;
  raw: string;
  previousBalanceNumber: number;
  debitNumber: number;
  creditNumber: number;
  currentBalanceNumber: number;
  /**
   * Diferenca absoluta quando saldo anterior + debito - credito nao reproduz o
   * saldo atual. Ausente quando a linha fecha. Sinaliza possivel desalinhamento
   * de coluna ou valor truncado - a linha continua valida e utilizavel.
   */
  balanceMismatch?: number;
}

export interface UnclassifiedLine {
  page: number;
  text: string;
  reason: string;
}

export interface CompanyReport {
  id: string;
  fileName: string;
  companyCode?: string | undefined;
  companyName: string;
  cnpj: string;
  period: string;
  rows: LedgerLine[];
  /**
   * Linhas que o parser NAO conseguiu interpretar. Deve ficar proximo de zero
   * num arquivo bem lido - se subir, algo do layout mudou. Cabecalho e rodape
   * do relatorio ficam em `structuralLines`, nao aqui.
   */
  unclassified: UnclassifiedLine[];
  /**
   * Cabecalho/rodape do proprio relatorio (identificacao da empresa, titulos de
   * coluna, totalizadores de fechamento, assinatura). Nao sao linhas contabeis
   * e nao indicam problema - ficam registradas so para que nenhuma linha do PDF
   * seja descartada sem rastro.
   */
  structuralLines?: UnclassifiedLine[];
  invertedRows: InvertedBalanceRow[];
  zeroMovementRows: LedgerLine[];
  comparisonReport: BalanceComparisonReport;
  analysisReports: AnalysisReport[];
  errors: string[];
}

export interface InvertedBalanceRow extends LedgerLine {
  alertType: AlertType;
}

export interface BalanceComparisonReport {
  distributionRow?: LedgerLine | undefined;
  account3Row?: LedgerLine | undefined;
  account6Row?: LedgerLine | undefined;
  account2413Row?: LedgerLine | undefined;
  mode: 'distribution' | 'fallback';
  baseValue: number;
  targetValue: number;
  difference: number;
  isAttention: boolean;
  message: string;
}

export type AnalysisKind =
  | 'analysis1'
  | 'analysis2'
  | 'analysis3'
  | 'analysis4'
  | 'analysis5'
  | 'analysis6'
  | 'analysis7'
  | 'analysis8'
  | 'analysis9'
  | 'analysis10'
  | 'analysis11'
  | 'analysis12'
  | 'analysis13'
  | 'analysis14'
  | 'analysis15'
  | 'analysis16';

export interface AnalysisReport {
  kind: AnalysisKind;
  title: string;
  intro: string;
  message: string;
  rows: LedgerLine[];
  depreciationPairs?: DepreciationPairRow[];
  isAttention: boolean;
  calculation?: AnalysisCalculation | undefined;
}

export type ReportKind = 'inverted' | 'zero' | 'comparison' | AnalysisKind;

export interface AnalysisCalculation {
  formula: string;
  items: AnalysisCalculationItem[];
}

export interface AnalysisCalculationItem {
  label: string;
  value: number;
  format?: 'money' | 'percentage';
}

export interface DepreciationPairRow {
  assetCode: string;
  assetName: string;
  /**
   * Valor absoluto do S. Atual do bem (natureza C/D ignorada de proposito
   * nesta analise - ver intro de buildAnalysis11 em parser.ts). `undefined`
   * quando nao foi encontrado um bem equivalente - distinto de um bem com
   * saldo genuinamente zero, que sempre vem como `0`.
   */
  assetCurrentBalance?: number | undefined;
  depreciationCode: string;
  depreciationName: string;
  /** Valor absoluto do S. Atual da depreciacao/amortizacao/exaustao. */
  depreciationCurrentBalance: number;
  correctiveAction: string;
}

/**
 * DRE (Demonstracao do Resultado) - documento diferente do balancete, com seu
 * proprio parser (`dreParser.ts`) e sua propria arvore de tipos, sem estender
 * `CompanyReport`/`AnalysisKind`. Ver CLAUDE.md e o plano de implementacao
 * para o porque da separacao.
 */
export interface DreColumnValue {
  /** Texto exatamente como aparece no PDF (preserva parenteses/formatacao). */
  raw: string;
  value: number;
}

export interface DreLineItem {
  label: string;
  /** Nivel de indentacao visual no PDF (0 = categoria de topo). */
  level: number;
  /** Um valor por periodo, na mesma ordem de `DreReport.periods`. */
  periodValues: Array<DreColumnValue | undefined>;
  total?: DreColumnValue | undefined;
  percent?: DreColumnValue | undefined;
  average?: DreColumnValue | undefined;
  averagePreviousYear?: DreColumnValue | undefined;
}

export type DreAnalysisKind = 'dreWaterfall' | 'dreVariation' | 'dreMargins' | 'dreMissingComparison';

/**
 * Uma linha generica de resultado de analise de DRE: um rotulo mais uma lista
 * ordenada de celulas (cabecalho + valor ja formatado). As 4 analises tem
 * formatos bem diferentes entre si (cascata, variacao, margens, colunas
 * zeradas) - esse formato flexivel deixa a UI renderizar todas de forma
 * generica, sem uma tabela dedicada por analise.
 */
export interface DreAnalysisRow {
  label: string;
  cells: Array<{ header: string; value: string }>;
}

export interface DreAnalysisReport {
  kind: DreAnalysisKind;
  title: string;
  intro: string;
  message: string;
  rows: DreAnalysisRow[];
  isAttention: boolean;
}

export interface DreReport {
  id: string;
  fileName: string;
  companyName: string;
  cnpj: string;
  /** Rotulos dos periodos como aparecem no PDF (ex.: "jan/2026", "fev/2026"). */
  periods: string[];
  /** Rotulo da coluna de media do ano anterior como aparece no PDF (ex.: "Média 2025"). */
  previousYearLabel: string;
  lines: DreLineItem[];
  analysisReports: DreAnalysisReport[];
  errors: string[];
}
