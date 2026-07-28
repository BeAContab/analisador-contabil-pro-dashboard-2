import type { CompanyReport } from '../types';

/**
 * Contrato de mensagens entre a thread principal e o worker de parsing.
 *
 * `CompanyReport` continua sendo a fronteira de dados do app (ver types.ts):
 * o worker devolve exatamente a mesma estrutura que `parsePdfFile` sempre
 * devolveu, entao nada muda para os consumidores (`useFileProcessing`,
 * `reports.ts`, componentes). Tanto `File` quanto `CompanyReport` sao
 * estruturado-clonaveis, dispensando serializacao manual.
 */

export interface ParserWorkerRequest {
  /** Correlaciona resposta com requisicao; o worker processa um arquivo por vez. */
  id: number;
  file: File;
}

export type ParserWorkerResponse =
  | { id: number; ok: true; report: CompanyReport }
  | { id: number; ok: false; error: string };
