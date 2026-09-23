import { useEffect, useMemo, useState } from 'react';
import { CompanyReport } from '../types';
import { ExportFormat, SelectionMode, downloadReportsZip, selectionForMode } from '../utils/batchExport';
import { companyAlertCount, companyHasAlerts } from '../utils/reports';

interface ExportModalProps {
  companies: CompanyReport[];
  onClose: () => void;
}

export function ExportModal({ companies, onClose }: ExportModalProps) {
  const [mode, setMode] = useState<SelectionMode>('alerts');
  const [selected, setSelected] = useState<Set<string>>(() => selectionForMode(companies, 'alerts'));
  const [formats, setFormats] = useState<Record<ExportFormat, boolean>>({ xlsx: true, pdf: true });
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState('');

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isExporting) onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isExporting, onClose]);

  const chosenFormats = (Object.keys(formats) as ExportFormat[]).filter((format) => formats[format]);
  const selectedCompanies = useMemo(() => companies.filter((company) => selected.has(company.id)), [companies, selected]);
  const withAlertsCount = useMemo(() => companies.filter(companyHasAlerts).length, [companies]);
  const canExport = selectedCompanies.length > 0 && chosenFormats.length > 0 && !isExporting;
  const allSelected = selected.size === companies.length;

  function changeMode(next: SelectionMode) {
    setMode(next);
    setSelected(selectionForMode(companies, next));
  }

  function toggleCompany(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleExport() {
    setError('');
    setIsExporting(true);
    try {
      await downloadReportsZip(selectedCompanies, chosenFormats, (done, total) => setProgress({ done, total }));
      onClose();
    } catch (exportError) {
      console.error('[ExportModal] Falha ao gerar o ZIP:', exportError);
      setError('Não foi possível gerar os relatórios. Tente novamente ou reduza a seleção.');
      setIsExporting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={() => !isExporting && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-modal-title"
        className="glass-panel bg-surface w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="p-6 border-b border-surface-border flex items-start justify-between gap-4">
          <div>
            <h2 id="export-modal-title" className="text-xl font-bold text-foreground">Baixar relatórios</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Escolha as empresas e os formatos. Os arquivos são reunidos em um único ZIP.
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isExporting}
            aria-label="Fechar"
            className="w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:bg-surface-border transition-colors disabled:opacity-50"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto">
          <fieldset className="flex flex-wrap gap-3" disabled={isExporting}>
            <legend className="sr-only">Quais relatórios marcar</legend>
            {(
              [
                { value: 'alerts', label: `Somente com alertas (${withAlertsCount})` },
                { value: 'all', label: `Todos (${companies.length})` }
              ] as const
            ).map((option) => (
              <label
                key={option.value}
                className={`cursor-pointer px-4 py-2 rounded-xl border text-sm font-semibold transition-all ${
                  mode === option.value
                    ? 'bg-primary text-primary-foreground border-primary shadow-md'
                    : 'bg-surface border-surface-border text-muted-foreground hover:text-foreground'
                }`}
              >
                <input
                  type="radio"
                  name="export-mode"
                  className="sr-only"
                  checked={mode === option.value}
                  onChange={() => changeMode(option.value)}
                />
                {option.label}
              </label>
            ))}
          </fieldset>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">
                <span className="font-bold text-foreground">{selected.size}</span> de {companies.length} selecionado(s)
              </span>
              <button
                disabled={isExporting}
                onClick={() => setSelected(allSelected ? new Set() : new Set(companies.map((company) => company.id)))}
                className="text-sm font-semibold text-primary hover:underline disabled:opacity-50"
              >
                {allSelected ? 'Desmarcar todos' : 'Marcar todos'}
              </button>
            </div>
            <ul className="border border-surface-border rounded-xl divide-y divide-surface-border max-h-72 overflow-y-auto">
              {companies.map((company) => {
                const alerts = companyAlertCount(company);
                const hasAlerts = companyHasAlerts(company);
                return (
                  <li key={company.id}>
                    <label className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-primary/5 transition-colors">
                      <input
                        type="checkbox"
                        className="w-4 h-4 accent-primary"
                        checked={selected.has(company.id)}
                        disabled={isExporting}
                        onChange={() => toggleCompany(company.id)}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-foreground truncate" title={company.companyName}>
                          {company.companyName}
                        </span>
                        <span className="block text-xs text-muted-foreground">{company.period || '-'}</span>
                      </span>
                      <span
                        className={`text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap ${
                          hasAlerts ? 'bg-error/10 text-error' : 'bg-success/10 text-success'
                        }`}
                      >
                        {hasAlerts ? `${alerts} Alerta(s)` : 'Sem Alertas'}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>

          <fieldset className="flex flex-wrap items-center gap-6" disabled={isExporting}>
            <legend className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Formatos</legend>
            {(['xlsx', 'pdf'] as const).map((format) => (
              <label key={format} className="flex items-center gap-2 text-sm font-semibold text-foreground cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-primary"
                  checked={formats[format]}
                  onChange={() => setFormats((current) => ({ ...current, [format]: !current[format] }))}
                />
                {format.toUpperCase()}
              </label>
            ))}
          </fieldset>

          {error && (
            <div className="bg-error/10 text-error p-3 rounded-xl border border-error/20 text-sm font-medium">{error}</div>
          )}
        </div>

        <div className="p-6 border-t border-surface-border flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="text-sm text-muted-foreground" aria-live="polite">
            {isExporting
              ? `Gerando arquivos... ${progress.done} de ${progress.total}`
              : `${selectedCompanies.length * chosenFormats.length} arquivo(s) no ZIP`}
          </div>
          <div className="flex gap-3 justify-end">
            <button
              onClick={onClose}
              disabled={isExporting}
              className="px-5 py-2.5 bg-surface border border-surface-border rounded-xl text-sm font-bold text-foreground hover:shadow-md transition-all disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleExport}
              disabled={!canExport}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary border border-primary text-primary-foreground rounded-xl text-sm font-bold hover:bg-primary-hover hover:shadow-md transition-all disabled:opacity-50"
            >
              <span className={`material-symbols-outlined text-[18px] ${isExporting ? 'animate-spin' : ''}`}>
                {isExporting ? 'sync' : 'download'}
              </span>
              Baixar ZIP
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
