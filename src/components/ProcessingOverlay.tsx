import { useFocusTrap } from '../hooks/useFocusTrap';

interface ProcessingOverlayProps {
  index: number;
  total: number;
  percent: number;
  fileName: string;
}

export function ProcessingOverlay({ index, total, percent, fileName }: ProcessingOverlayProps) {
  // Sem elementos focaveis dentro: o foco vai para o proprio container (evita
  // que o Tab escape para o conteudo atras do overlay enquanto processa) e
  // volta ao elemento anterior quando o processamento termina.
  const overlayRef = useFocusTrap<HTMLDivElement>(true);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-primary/20 backdrop-blur-sm">
      <div
        ref={overlayRef}
        role="dialog"
        aria-modal="true"
        aria-label="Processando balancetes"
        aria-live="polite"
        tabIndex={-1}
        className="bg-surface-container-lowest border border-outline-variant p-xl rounded-2xl shadow-2xl max-w-md w-full mx-md flex flex-col items-center gap-lg outline-none"
      >
        <div className="w-16 h-16 bg-primary-container rounded-full flex items-center justify-center text-on-primary-container">
          <span className="material-symbols-outlined !text-[32px] animate-spin" aria-hidden="true">sync</span>
        </div>
        <div className="text-center space-y-sm">
          <h3 className="font-headline-md text-primary">Processando Balancetes</h3>
          <p className="text-body-md text-secondary">
            {/* index fica em 0 no instante inicial, antes do primeiro arquivo entrar no loop. */}
            {index > 0 ? `Processando ${index} de ${total} arquivo(s) (${percent}%)` : 'Preparando análise...'}
          </p>
          {fileName && (
            <p className="text-body-sm text-on-surface-variant italic truncate max-w-xs">
              "{fileName}"
            </p>
          )}
        </div>
        <div className="w-full bg-surface-container-highest rounded-full h-2 overflow-hidden">
          <div
            className="bg-primary h-full transition-all duration-300 ease-out"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
    </div>
  );
}
