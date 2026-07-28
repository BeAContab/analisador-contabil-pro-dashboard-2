import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Focus trap para modais/overlays que cobrem a tela inteira (drawer do
 * chatbot, overlay de processamento). Enquanto `active` for true:
 * - move o foco para o primeiro elemento focavel dentro do container (ou
 *   para o proprio container, se nao houver nenhum - caso do overlay de
 *   processamento, que e so leitura);
 * - mantem Tab/Shift+Tab restrito ao conteudo do container;
 * - chama `onEscape` ao pressionar Escape, se fornecido;
 * - restaura o foco ao elemento que estava focado antes de abrir, quando o
 *   modal fecha ou desmonta.
 */
export function useFocusTrap<T extends HTMLElement>(active: boolean, onEscape?: () => void) {
  const containerRef = useRef<T | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;

    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    const container = containerRef.current;

    function getFocusable(): HTMLElement[] {
      if (!container) return [];
      return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
    }

    const initialFocusable = getFocusable();
    (initialFocusable[0] ?? container)?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && onEscape) {
        onEscape();
        return;
      }

      if (event.key !== 'Tab') return;

      const items = getFocusable();
      if (items.length === 0) {
        // Sem nada focavel dentro (ex.: overlay so de leitura) - nao deixa o
        // Tab escapar para o conteudo atras do modal.
        event.preventDefault();
        container?.focus();
        return;
      }

      const first = items[0];
      const last = items[items.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocusedRef.current?.focus();
    };
  }, [active, onEscape]);

  return containerRef;
}
