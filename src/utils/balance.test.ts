import { describe, expect, it } from 'vitest';
import { absoluteCurrentBalance, absoluteValue, ledgerBalanceMismatch, signedCurrentBalance } from './balance';
import { LedgerLine } from '../types';

function row(currentBalance: string): LedgerLine {
  return {
    account: '1.1.01',
    name: 'Conta Teste',
    previousBalance: '0,00',
    debit: '0,00',
    credit: '0,00',
    currentBalance,
    raw: '',
    previousBalanceNumber: 0,
    debitNumber: 0,
    creditNumber: 0,
    currentBalanceNumber: 0
  };
}

describe('absoluteValue / absoluteCurrentBalance', () => {
  it('always returns a non-negative magnitude', () => {
    expect(absoluteValue('(1.234,56)')).toBeCloseTo(1234.56);
    expect(absoluteCurrentBalance(row('1.234,56D'))).toBeCloseTo(1234.56);
    expect(absoluteCurrentBalance(undefined)).toBe(0);
  });
});

describe('signedCurrentBalance', () => {
  it('treats debit nature as negative and credit as positive', () => {
    expect(signedCurrentBalance(row('100,00D'))).toBeCloseTo(-100);
    expect(signedCurrentBalance(row('100,00C'))).toBeCloseTo(100);
  });

  it('returns 0 when there is no row', () => {
    expect(signedCurrentBalance(undefined)).toBe(0);
  });
});

// Fase 2, item 2.1: o unico invariante de corretude que protege contra colunas
// desalinhadas no parser. Ver CLAUDE.md - nos 14 balancetes de exemplo o numero
// esperado de mismatches e 0; qualquer regressao na extracao de colunas faz
// esse numero subir.
describe('ledgerBalanceMismatch', () => {
  it('returns null when the ledger identity closes exactly', () => {
    // saldo anterior (D) + debito - credito = saldo atual
    // 100 (D, positivo nesta convencao) + 50 - 30 = 120 (D)
    expect(
      ledgerBalanceMismatch({
        previousBalance: '100,00D',
        debit: '50,00',
        credit: '30,00',
        currentBalance: '120,00D'
      })
    ).toBeNull();
  });

  it('tolerates a one-cent rounding difference', () => {
    expect(
      ledgerBalanceMismatch({
        previousBalance: '100,00D',
        debit: '0,00',
        credit: '0,00',
        currentBalance: '100,00D'
      })
    ).toBeNull();
  });

  it('flags a line where the identity does not close', () => {
    const mismatch = ledgerBalanceMismatch({
      previousBalance: '100,00D',
      debit: '50,00',
      credit: '30,00',
      currentBalance: '999,00D'
    });
    expect(mismatch).not.toBeNull();
    expect(mismatch).toBeCloseTo(879);
  });

  it('reproduces the real corruption case found in arquivos_de_exemplo (CPF glued to balance)', () => {
    // Antes do fix em groupItemsIntoLines, "...OLIVEIRA 01504106466" + "0,00C"
    // virava um unico numero "015041064660,00C" na coluna de saldo anterior.
    const corrupted = ledgerBalanceMismatch({
      previousBalance: '015041064660,00C',
      debit: '1.020,00',
      credit: '1.020,00',
      currentBalance: '0,00C'
    });
    expect(corrupted).not.toBeNull();

    const fixed = ledgerBalanceMismatch({
      previousBalance: '0,00C',
      debit: '1.020,00',
      credit: '1.020,00',
      currentBalance: '0,00C'
    });
    expect(fixed).toBeNull();
  });
});
