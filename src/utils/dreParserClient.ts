import type { DreReport } from '../types';
import type { ParserWorkerRequest, ParserWorkerResponse } from '../workers/parserProtocol';
import { ParseCancelledError } from './parserClient';

export interface DreParserClient {
  /** Processa um arquivo de DRE no worker. Rejeita com ParseCancelledError se cancelado. */
  parse(file: File): Promise<DreReport>;
  /** Aborta o arquivo em andamento encerrando o worker (unica forma de parar trabalho preso em CPU). */
  cancel(): void;
  /** Libera o worker; chamar no unmount. */
  dispose(): void;
}

interface Pending {
  resolve: (report: DreReport) => void;
  reject: (error: Error) => void;
}

/**
 * Irmao de `createParserClient` (parserClient.ts), mesma logica de
 * worker/fila/cancelamento, so que enviando `kind: 'dre'` e aguardando
 * `DreReport`. Aponta pro mesmo arquivo de worker (`parser.worker.ts`), que
 * roteia pelo `kind` - assim o pdf.js so e empacotado uma vez pelo Vite,
 * mesmo com dois clients/workers distintos em tempo de execucao.
 */
export function createDreParserClient(): DreParserClient {
  let worker: Worker | null = null;
  let nextId = 0;
  const pending = new Map<number, Pending>();
  let workerUnavailable = false;

  function handleMessage(event: MessageEvent<ParserWorkerResponse>) {
    const data = event.data;
    const entry = pending.get(data.id);
    if (!entry) return;
    pending.delete(data.id);
    if (!data.ok) entry.reject(new Error(data.error));
    else if (data.kind === 'dre') entry.resolve(data.report);
    else entry.reject(new Error('Resposta inesperada do worker de parsing (kind incompativel).'));
  }

  function handleError(event: ErrorEvent) {
    const error = new Error(event.message || 'Falha no worker de parsing.');
    pending.forEach((entry) => entry.reject(error));
    pending.clear();
    teardown();
  }

  function teardown() {
    if (!worker) return;
    worker.removeEventListener('message', handleMessage as EventListener);
    worker.removeEventListener('error', handleError as EventListener);
    worker.terminate();
    worker = null;
  }

  function ensureWorker(): Worker | null {
    if (worker) return worker;
    if (workerUnavailable) return null;

    try {
      const created = new Worker(new URL('../workers/parser.worker.ts', import.meta.url), {
        type: 'module'
      });
      created.addEventListener('message', handleMessage as EventListener);
      created.addEventListener('error', handleError as EventListener);
      worker = created;
      return created;
    } catch (error) {
      console.warn('[dreParserClient] Worker indisponivel, usando a thread principal:', error);
      workerUnavailable = true;
      return null;
    }
  }

  return {
    async parse(file: File): Promise<DreReport> {
      const active = ensureWorker();

      if (!active) {
        const { parseDreFile } = await import('./dreParser');
        return parseDreFile(file);
      }

      const id = nextId++;
      const request: ParserWorkerRequest = { id, file, kind: 'dre' };

      return new Promise<DreReport>((resolve, reject) => {
        pending.set(id, { resolve, reject });
        active.postMessage(request);
      });
    },

    cancel() {
      if (pending.size === 0 && !worker) return;
      pending.forEach((entry) => entry.reject(new ParseCancelledError()));
      pending.clear();
      teardown();
    },

    dispose() {
      pending.forEach((entry) => entry.reject(new ParseCancelledError()));
      pending.clear();
      teardown();
    }
  };
}
