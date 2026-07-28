import { useEffect, useMemo, useState } from 'react';
import { InvertedBalanceRow, LedgerLine, ReportKind } from '../types';
import { classifyAccount, parseBrazilianMoney } from '../utils/format';
import { correctiveAction } from '../utils/reports';

interface DataTableProps {
  rows: Array<LedgerLine | InvertedBalanceRow>;
  kind: ReportKind;
}

type SortKey =
  | 'nature'
  | 'account'
  | 'code'
  | 'name'
  | 'previousBalance'
  | 'debit'
  | 'credit'
  | 'currentBalance';

export function DataTable({ rows, kind }: DataTableProps) {
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('account');
  const [direction, setDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const searchable = rows.filter((row) => {
      if (!normalizedQuery) return true;
      return (
        row.account.toLowerCase().includes(normalizedQuery) ||
        row.name.toLowerCase().includes(normalizedQuery) ||
        (row.code && row.code.toLowerCase().includes(normalizedQuery)) ||
        correctiveAction(kind, row).toLowerCase().includes(normalizedQuery)
      );
    });

    const sorted = [...searchable].sort((a, b) => {
      const left = valueForSort(a, sortKey);
      const right = valueForSort(b, sortKey);
      const result =
        typeof left === 'number' && typeof right === 'number'
          ? left - right
          : String(left).localeCompare(String(right), 'pt-BR', { numeric: true });
      return direction === 'asc' ? result : -result;
    });

    return sorted;
  }, [rows, query, sortKey, direction, kind]);

  const totalPages = Math.ceil(filteredRows.length / itemsPerPage);

  // Trocar de aba (kind) ou receber outro conjunto de linhas mantinha a pagina
  // anterior, podendo exibir uma pagina vazia fora do intervalo.
  useEffect(() => {
    setCurrentPage(1);
  }, [rows, kind]);

  // Rede de seguranca para quando a filtragem encolhe o resultado.
  useEffect(() => {
    if (totalPages > 0 && currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedRows = filteredRows.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  function updateSort(key: SortKey) {
    if (sortKey === key) {
      setDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setDirection('asc');
  }

  return (
    <div className="glass-panel flex flex-col overflow-hidden">
      <div className="p-4 sm:p-6 flex flex-wrap items-center justify-between gap-4 border-b border-surface-border bg-surface-50">
        <div className="relative flex-grow max-w-md">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-[20px]">search</span>
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-10 pr-4 py-2.5 bg-background border border-surface-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            placeholder="Pesquisar por conta, nome ou ação corretiva..."
            type="text"
          />
        </div>
        <div className="flex items-center gap-2 bg-background px-4 py-2 rounded-xl border border-surface-border shadow-sm">
          <span className="text-sm text-foreground font-bold">{filteredRows.length}</span>
          <span className="text-sm text-muted-foreground">registro(s)</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left min-w-[1100px]">
          <thead className="bg-surface-50 border-b border-surface-border sticky top-0 backdrop-blur-md z-10">
            <tr>
              <Th label="Nat." sortKey="nature" activeSort={sortKey} direction={direction} onSort={updateSort} />
              <Th label="Conta" sortKey="account" activeSort={sortKey} direction={direction} onSort={updateSort} />
              <Th label="Nome da Conta" sortKey="name" activeSort={sortKey} direction={direction} onSort={updateSort} />
              <Th label="S. Anterior" sortKey="previousBalance" activeSort={sortKey} direction={direction} onSort={updateSort} align="right" />
              <Th label="Débito" sortKey="debit" activeSort={sortKey} direction={direction} onSort={updateSort} align="right" />
              <Th label="Crédito" sortKey="credit" activeSort={sortKey} direction={direction} onSort={updateSort} align="right" />
              <Th label="S. Atual" sortKey="currentBalance" activeSort={sortKey} direction={direction} onSort={updateSort} align="right" />
              <th className="px-4 py-4 font-bold text-xs text-muted-foreground uppercase tracking-wider min-w-[280px]">
                Ação corretiva
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border bg-surface-30">
            {paginatedRows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-muted-foreground italic">
                  Nenhum registro encontrado.
                </td>
              </tr>
            ) : (
              paginatedRows.map((row, index) => (
                <tr key={`${row.account}-${row.name}-${index}`} className="hover:bg-primary/5 transition-colors group">
                  <td className="px-4 py-3 text-xs text-muted-foreground">{classifyAccount(row.account) || '-'}</td>
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-foreground group-hover:text-primary transition-colors">{row.account}</td>
                  <td className="px-4 py-3 text-sm text-foreground truncate max-w-[200px]" title={row.name}>{row.name}</td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-muted-foreground">{row.previousBalance}</td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-muted-foreground">{row.debit}</td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-muted-foreground">{row.credit}</td>
                  <td className="px-4 py-3 text-right font-mono text-sm font-bold text-foreground group-hover:text-primary transition-colors">{row.currentBalance}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground align-middle">
                    <div className="bg-background border border-surface-border px-3 py-1.5 rounded-md shadow-sm line-clamp-2" title={correctiveAction(kind, row)}>
                      {correctiveAction(kind, row)}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="p-4 sm:p-6 flex items-center justify-between bg-surface-50 border-t border-surface-border">
          <span className="text-sm text-muted-foreground">
            Página <span className="font-bold text-foreground">{currentPage}</span> de <span className="font-bold text-foreground">{totalPages}</span>
          </span>
          <div className="flex items-center gap-2">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => p - 1)}
              className="w-10 h-10 flex items-center justify-center bg-background hover:bg-surface-border rounded-xl border border-surface-border shadow-sm transition-all disabled:opacity-50 disabled:hover:bg-background"
            >
              <span className="material-symbols-outlined">chevron_left</span>
            </button>
            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => p + 1)}
              className="w-10 h-10 flex items-center justify-center bg-background hover:bg-surface-border rounded-xl border border-surface-border shadow-sm transition-all disabled:opacity-50 disabled:hover:bg-background"
            >
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Th({
  label,
  sortKey,
  activeSort,
  direction,
  onSort,
  align = 'left'
}: {
  label: string;
  sortKey: SortKey;
  activeSort: SortKey;
  direction: 'asc' | 'desc';
  onSort: (key: SortKey) => void;
  align?: 'left' | 'right';
}) {
  const isActive = activeSort === sortKey;
  return (
    <th className={`px-4 py-4 font-bold text-xs text-muted-foreground uppercase tracking-wider ${align === 'right' ? 'text-right' : ''}`}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="flex items-center gap-1 hover:text-foreground transition-colors w-full group"
        style={{ justifyContent: align === 'right' ? 'flex-end' : 'flex-start' }}
      >
        {label}
        <span className={`material-symbols-outlined text-[16px] transition-all duration-300 ${isActive ? 'opacity-100 text-primary' : 'opacity-0 group-hover:opacity-50'} ${direction === 'desc' ? 'rotate-180' : ''}`}>
          arrow_upward
        </span>
      </button>
    </th>
  );
}

function valueForSort(row: LedgerLine | InvertedBalanceRow, key: SortKey): string | number {
  if (key === 'nature') return classifyAccount(row.account);
  if (key === 'debit') return row.debitNumber;
  if (key === 'credit') return row.creditNumber;
  if (key === 'previousBalance') return parseBrazilianMoney(row.previousBalance);
  if (key === 'currentBalance') return parseBrazilianMoney(row.currentBalance);
  return row[key] ?? '';
}
