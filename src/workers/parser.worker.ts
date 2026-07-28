import { parsePdfFile } from '../utils/parser';
import type { ParserWorkerRequest, ParserWorkerResponse } from './parserProtocol';

/**
 * Worker dedicado ao parsing de balancetes.
 *
 * Todo o pipeline pesado (extracao via pdf.js, agrupamento de linhas e as 12
 * analises) roda aqui, fora da thread principal. Antes, so a decodificacao do
 * PDF ficava no worker interno do pdf.js: o agrupamento e as analises rodavam
 * na UI e travavam a interface em balancetes grandes.
 *
 * `parser.ts` nao toca em DOM (o `document` la dentro e o PDFDocumentProxy do
 * pdf.js, nao o do navegador), entao pode ser importado aqui sem adaptacao.
 */
self.onmessage = async (event: MessageEvent<ParserWorkerRequest>) => {
  const { id, file } = event.data;

  try {
    const report = await parsePdfFile(file);
    const response: ParserWorkerResponse = { id, ok: true, report };
    self.postMessage(response);
  } catch (error) {
    // parsePdfFile ja captura falhas de leitura e devolve um CompanyReport com
    // `errors` preenchido; isto aqui e rede de seguranca para o inesperado
    // (ex.: falha ao estruturar-clonar a resposta).
    const response: ParserWorkerResponse = {
      id,
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    };
    self.postMessage(response);
  }
};
