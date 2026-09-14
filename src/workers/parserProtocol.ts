import type { CompanyReport, DreReport } from '../types';

/**
 * Contrato de mensagens entre a thread principal e o worker de parsing.
 *
 * Um worker so (`parser.worker.ts`) atende os dois tipos de documento
 * (balancete e DRE), roteando pelo campo `kind` - assim o pdf.js (~385 kB)
 * so e empacotado uma vez, em vez de duplicado num segundo worker. Tanto
 * `File` quanto `CompanyReport`/`DreReport` sao estruturado-clonaveis,
 * dispensando serializacao manual.
 */

export interface ParserWorkerRequest {
  /** Correlaciona resposta com requisicao; o worker processa um arquivo por vez. */
  id: number;
  file: File;
  kind: 'balancete' | 'dre';
}

export type ParserWorkerResponse =
  | { id: number; ok: true; kind: 'balancete'; report: CompanyReport }
  | { id: number; ok: true; kind: 'dre'; report: DreReport }
  | { id: number; ok: false; error: string };
