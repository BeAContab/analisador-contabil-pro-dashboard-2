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
  unclassified: UnclassifiedLine[];
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
  | 'analysis12';

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
