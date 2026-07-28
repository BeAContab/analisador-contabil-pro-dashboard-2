import type { CompanyReport } from '../types';
import type { ParserWorkerRequest, ParserWorkerResponse } from '../workers/parserProtocol';

/** Lancado quando `cancel()` interrompe um arquivo em andamento. */
export class ParseCancelledError extends Error {
  constructor() {
    super('Processamento cancelado.');
    this.name = 'ParseCancelledError';
  }
}

export interface ParserClient {
  /** Processa um arquivo no worker. Rejeita com ParseCancelledError se cancelado. */
  parse(file: File): Promise<CompanyReport>;
  /** Aborta o arquivo em andamento encerrando o worker (unica forma de parar trabalho preso em CPU). */
  cancel(): void;
  /** Libera o worker; chamar no unmount. */
  dispose(): void;
}

interface Pending {
  resolve: (report: CompanyReport) => void;
  reject: (error: Error) => void;
}

export function createParserClient(): ParserClient {
  let worker: Worker | null = null;
  let nextId = 0;
  const pending = new Map<number, Pending>();
  // Uma falha de construcao do worker e permanente (browser sem suporte,
  // CSP bloqueando blob/module worker): nao vale retentar a cada arquivo.
  let workerUnavailable = false;

  function handleMessage(event: MessageEvent<ParserWorkerResponse>) {
    const data = event.data;
    const entry = pending.get(data.id);
    if (!entry) return;
    pending.delete(data.id);
    if (data.ok) entry.resolve(data.report);
    else entry.reject(new Error(data.error));
  }

  function handleError(event: ErrorEvent) {
    // Erro fatal no worker derruba tudo que estava em voo.
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
      // A URL relativa + import.meta.url e o formato que o Vite reconhece para
      // empacotar o worker (e gerar o chunk proprio dele no build).
      const created = new Worker(new URL('../workers/parser.worker.ts', import.meta.url), {
        type: 'module'
      });
      created.addEventListener('message', handleMessage as EventListener);
      created.addEventListener('error', handleError as EventListener);
      worker = created;
      return created;
    } catch (error) {
      console.warn('[parserClient] Worker indisponivel, usando a thread principal:', error);
      workerUnavailable = true;
      return null;
    }
  }

  return {
    async parse(file: File): Promise<CompanyReport> {
      const active = ensureWorker();

      if (!active) {
        // Fallback: mantem o app funcional mesmo sem worker. `parsePdfFile`
        // devolve a thread entre paginas (ver yieldToBrowser) exatamente para
        // este caso.
        const { parsePdfFile } = await import('./parser');
        return parsePdfFile(file);
      }

      const id = nextId++;
      const request: ParserWorkerRequest = { id, file };

      return new Promise<CompanyReport>((resolve, reject) => {
        pending.set(id, { resolve, reject });
        active.postMessage(request);
      });
    },

    cancel() {
      if (pending.size === 0 && !worker) return;
      pending.forEach((entry) => entry.reject(new ParseCancelledError()));
      pending.clear();
      // Encerrar e a unica forma confiavel de interromper parsing ja em curso;
      // o proximo `parse()` recria o worker sob demanda.
      teardown();
    },

    dispose() {
      pending.forEach((entry) => entry.reject(new ParseCancelledError()));
      pending.clear();
      teardown();
    }
  };
}
