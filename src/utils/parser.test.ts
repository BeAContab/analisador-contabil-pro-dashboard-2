import { describe, expect, it } from 'vitest';
import {
  TextItem,
  dedupeLedgerRows,
  extractLedgerLines,
  extractMetadata,
  groupItemsIntoLines,
  mergeContinuationLines,
  parseLedgerLine
} from './parser';
import { LedgerLine } from '../types';

function item(text: string, x: number, width: number, y = 700, page = 1): TextItem {
  return { text, x, y, width, page };
}

describe('groupItemsIntoLines', () => {
  it('joins items on the same line with a space when the gap is genuinely positive', () => {
    const items = [item('2.1.03.001.00157977', 58.2, 57.1), item('ADRIANO OLIVEIRA', 202.3, 100)];
    const lines = groupItemsIntoLines(items);
    expect(lines).toHaveLength(1);
    expect(lines[0]!.text).toBe('2.1.03.001.00157977 ADRIANO OLIVEIRA');
  });

  // Fase 2, item 2.8/achado critico: pdf.js as vezes reporta um `width` que
  // invade a coluna seguinte, produzindo gap negativo entre celulas realmente
  // separadas. Em contas de pessoa fisica o CPF fica colado ao saldo
  // ("...OLIVEIRA 01504106466" + "0,00C"), e sem essa protecao os dois itens
  // eram concatenados num unico numero (015041064660,00C), inflando o saldo em
  // ordens de grandeza. Caso real de arquivos_de_exemplo/ARTE PRODUCOES...pdf.
  it('never merges a trailing digit into a standalone money value even with negative gap', () => {
    const items = [item('ADRIANO EZEQUIEL CLEMENTINO OLIVEIRA 01504106466', 202.3, 193.3), item('0,00C', 377.8, 18.4)];
    const lines = groupItemsIntoLines(items);
    expect(lines).toHaveLength(1);
    expect(lines[0]!.text).toBe('ADRIANO EZEQUIEL CLEMENTINO OLIVEIRA 01504106466 0,00C');
    expect(lines[0]!.text).not.toContain('014660,00C'.slice(0, 6));
  });

  it('splits items into separate lines when Y differs by more than the tolerance', () => {
    const items = [item('linha 1', 0, 20, 700), item('linha 2', 0, 20, 690)];
    const lines = groupItemsIntoLines(items);
    expect(lines).toHaveLength(2);
  });
});

describe('mergeContinuationLines', () => {
  it('absorbs a wrapped name into the previous account line when it still lacks four money values', () => {
    const merged = mergeContinuationLines([
      { page: 1, text: '1.1.01 Caixa Geral 1.000,00' },
      { page: 1, text: 'continuacao do nome 500,00 200,00 1.300,00' }
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0]!.text).toBe('1.1.01 Caixa Geral 1.000,00 continuacao do nome 500,00 200,00 1.300,00');
  });

  it('does not absorb anything into an account line that is already complete', () => {
    const merged = mergeContinuationLines([
      { page: 1, text: '1.1.01 Caixa Geral 1.000,00 500,00 200,00 1.300,00' },
      { page: 1, text: 'texto residual sem numeros' }
    ]);
    expect(merged).toHaveLength(2);
    expect(merged[1]!.text).toBe('texto residual sem numeros');
  });

  // Colar um cabecalho de pagina no nome de uma conta corromperia o registro.
  it('never absorbs a structural line into an incomplete account line', () => {
    const merged = mergeContinuationLines([
      { page: 1, text: '1.1.01 Caixa Geral 1.000,00' },
      { page: 2, text: 'Conta Contábil Cod. R. Nome da Conta S. Anterior Débito Crédito S. Atual' }
    ]);
    expect(merged).toHaveLength(2);
    expect(merged[0]!.text).toBe('1.1.01 Caixa Geral 1.000,00');
  });
});

describe('parseLedgerLine', () => {
  it('extracts account, name and the four money columns', () => {
    const result = parseLedgerLine('1.1.01 Caixa Geral 1.000,00 500,00 200,00 1.300,00', 1);
    expect(result).not.toBeNull();
    expect(result?.account).toBe('1.1.01');
    expect(result?.name).toBe('Caixa Geral');
    expect(result?.previousBalance).toBe('1.000,00');
    expect(result?.currentBalance).toBe('1.300,00');
  });

  it('returns null when fewer than four money values are present', () => {
    expect(parseLedgerLine('1.1.01 Caixa Geral 1.000,00', 1)).toBeNull();
  });

  // Fase 2, item 2.1: a linha continua sendo aceita (nunca descartada), mas
  // fica marcada para conferencia manual quando a identidade contabil nao fecha.
  it('flags balanceMismatch when the accounting identity does not close', () => {
    const result = parseLedgerLine('1.1.01 Caixa Geral 100,00D 0,00 0,00 999,00D', 1);
    expect(result).not.toBeNull();
    expect(result?.balanceMismatch).toBeDefined();
  });

  it('leaves balanceMismatch undefined when the identity closes', () => {
    const result = parseLedgerLine('1.1.01 Caixa Geral 100,00D 50,00 30,00 120,00D', 1);
    expect(result?.balanceMismatch).toBeUndefined();
  });
});

describe('dedupeLedgerRows', () => {
  function makeRow(overrides: Partial<LedgerLine> = {}): LedgerLine {
    return {
      account: '1.1.01',
      name: 'Caixa',
      previousBalance: '0,00',
      debit: '0,00',
      credit: '0,00',
      currentBalance: '0,00',
      raw: '',
      previousBalanceNumber: 0,
      debitNumber: 0,
      creditNumber: 0,
      currentBalanceNumber: 0,
      ...overrides
    };
  }

  it('collapses exact duplicate rows (same account, name and values)', () => {
    const { rows, warnings } = dedupeLedgerRows([makeRow(), makeRow()]);
    expect(rows).toHaveLength(1);
    expect(warnings).toHaveLength(0);
  });

  it('keeps rows for the same account when values genuinely differ, with a warning', () => {
    const { rows, warnings } = dedupeLedgerRows([makeRow(), makeRow({ currentBalance: '999,00' })]);
    expect(rows).toHaveLength(2);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('1.1.01');
  });
});

// Item 4: antes, toda linha sem codigo de conta era descartada em silencio ou
// rotulada como "possivel continuacao de nome perdida". Como o cabecalho se
// repete a cada pagina, isso inflava `unclassified` com falsos positivos (1002
// nos balancetes de exemplo) e fazia parecer que linhas contabeis sumiam.
describe('extractLedgerLines (classificação de linhas)', () => {
  const cabecalho = (folha: number, page: number) => [
    { page, text: `(71 - 1) EMPRESA EXEMPLO LTDA NRC:` },
    { page, text: 'CNPJ:04.342.454/0001-00 Inscrição Estadual:063140420' },
    { page, text: 'Endereço:R TIBURCIO CAVALCANTE Número:790 Bairro:ALDEOTA' },
    { page, text: 'B A L A N C E T E A N A L Í T I C O' },
    { page, text: `Referência: 01/JAN/2025 até 31/DEZ/2025 Folha: ${folha}` },
    { page, text: 'Conta Contábil Cod. R. Nome da Conta S. Anterior Débito Crédito S. Atual' }
  ];

  it('classifica cabeçalho repetido como estrutural, não como não-classificado', () => {
    const lines = [
      ...cabecalho(1, 1),
      { page: 1, text: '1.1.01 Caixa Geral 1.000,00 500,00 200,00 1.300,00' },
      ...cabecalho(2, 2),
      { page: 2, text: '1.1.02 Clientes 2.000,00 0,00 0,00 2.000,00' }
    ];

    const { rows, unclassified, structural } = extractLedgerLines(lines);

    expect(rows).toHaveLength(2);
    expect(unclassified).toHaveLength(0);
    expect(structural).toHaveLength(12);
  });

  it('não perde nenhuma linha: rows + unclassified + structural = total de entrada', () => {
    const lines = [
      ...cabecalho(1, 1),
      { page: 1, text: '1.1.01 Caixa Geral 1.000,00 500,00 200,00 1.300,00' },
      { page: 1, text: 'R E S U L T A D O 0,00C' },
      { page: 1, text: 'texto totalmente inesperado' }
    ];

    const { rows, unclassified, structural } = extractLedgerLines(lines);

    expect(rows.length + unclassified.length + structural.length).toBe(lines.length);
  });

  it('mantém em unclassified o que não é linha contábil nem estrutura conhecida', () => {
    const { unclassified } = extractLedgerLines([
      { page: 1, text: '1.1.01 Caixa Geral 1.000,00 500,00 200,00 1.300,00' },
      { page: 1, text: 'texto totalmente inesperado' }
    ]);

    expect(unclassified).toHaveLength(1);
    expect(unclassified[0]!.text).toBe('texto totalmente inesperado');
  });

  it('sinaliza linha que começa com conta mas não tem os quatro valores', () => {
    const { rows, unclassified } = extractLedgerLines([{ page: 1, text: '1.1.01 Caixa Geral 1.000,00' }]);

    expect(rows).toHaveLength(0);
    expect(unclassified).toHaveLength(1);
    expect(unclassified[0]!.reason).toContain('quatro valores');
  });
});

describe('extractMetadata (CNPJ)', () => {
  it('extracts a traditional all-digit CNPJ', () => {
    const meta = extractMetadata('Empresa Teste LTDA\nCNPJ: 12.345.678/0001-90\n', 'balancete.pdf');
    expect(meta.cnpj).toBe('12.345.678/0001-90');
  });

  // Formato alfanumerico da Receita Federal (2026): 12 primeiros caracteres
  // podem ser letras ou digitos, os 2 ultimos (DV) continuam numericos.
  it('extracts an alphanumeric CNPJ (new Receita Federal format)', () => {
    const meta = extractMetadata('Empresa Teste LTDA\nCNPJ: 12.ABC.345/01DE-35\n', 'balancete.pdf');
    expect(meta.cnpj).toBe('12.ABC.345/01DE-35');
  });

  it('falls back to the not-identified message when no CNPJ is present', () => {
    const meta = extractMetadata('Empresa Teste LTDA\nsem numero de documento\n', 'balancete.pdf');
    expect(meta.cnpj).toBe('CNPJ não identificado');
  });
});
