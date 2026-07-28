import { LedgerLine } from '../types';
import { balanceNature, parseBrazilianMoney } from './format';

/**
 * Helpers de saldo compartilhados entre o parser e os construtores de relatorio.
 * Estavam duplicados verbatim em parser.ts e reports.ts; qualquer ajuste de
 * convencao de sinal precisa valer para os dois ao mesmo tempo.
 */

export function absoluteValue(value: string): number {
  return Math.abs(parseBrazilianMoney(value));
}

export function absoluteCurrentBalance(row?: LedgerLine): number {
  return row ? absoluteValue(row.currentBalance) : 0;
}

/**
 * Convencao usada nas analises de resultado (contas 3, 6 e 2.4.13): natureza
 * devedora entra como negativa e credora como positiva. NAO confundir com a
 * convencao contabil de razonete usada em `ledgerBalanceMismatch`, onde debito
 * e positivo.
 */
export function signedCurrentBalance(row?: LedgerLine): number {
  if (!row) return 0;
  const value = absoluteCurrentBalance(row);
  return balanceNature(row.currentBalance) === 'D' ? -value : value;
}

/** Saldo com debito positivo e credito negativo, como num razonete. */
function ledgerSignedValue(value: string): number {
  const magnitude = absoluteValue(value);
  return balanceNature(value) === 'C' ? -magnitude : magnitude;
}

/**
 * Confere a identidade contabil da linha: saldo anterior + debito - credito
 * deve reproduzir o saldo atual. Retorna a diferenca absoluta quando a conta
 * nao fecha, ou `null` quando esta consistente.
 *
 * Serve apenas para SINALIZAR linhas suspeitas (OCR trocando digito, coluna
 * desalinhada, valor truncado na quebra de pagina) - nunca para descartar
 * dados, ja que layouts de balancete variam entre sistemas contabeis.
 */
export function ledgerBalanceMismatch(row: {
  previousBalance: string;
  debit: string;
  credit: string;
  currentBalance: string;
}): number | null {
  const expected =
    ledgerSignedValue(row.previousBalance) + absoluteValue(row.debit) - absoluteValue(row.credit);
  const actual = ledgerSignedValue(row.currentBalance);
  const difference = Math.abs(expected - actual);

  // Tolerancia de um centavo cobre arredondamento do proprio documento.
  return difference > 0.01 ? difference : null;
}
