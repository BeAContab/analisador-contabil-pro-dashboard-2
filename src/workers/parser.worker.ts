import { parsePdfFile } from '../utils/parser';
import { parseDreFile } from '../utils/dreParser';
import type { ParserWorkerRequest, ParserWorkerResponse } from './parserProtocol';

/**
 * Worker dedicado ao parsing de PDFs - balancete e DRE, roteado por `kind`.
 *
 * Todo o pipeline pesado (extracao via pdf.js, agrupamento de linhas e as
 * analises) roda aqui, fora da thread principal. Antes, so a decodificacao do
 * PDF ficava no worker interno do pdf.js: o agrupamento e as analises rodavam
 * na UI e travavam a interface em arquivos grandes.
 *
 * Nem `parser.ts` nem `dreParser.ts` tocam em DOM (o `document` la dentro e o
 * PDFDocumentProxy do pdf.js, nao o do navegador), entao podem ser importados
 * aqui sem adaptacao.
 */
self.onmessage = async (event: MessageEvent<ParserWorkerRequest>) => {
  const { id, file, kind } = event.data;

  try {
    const response: ParserWorkerResponse =
      kind === 'dre' ? { id, ok: true, kind: 'dre', report: await parseDreFile(file) } : { id, ok: true, kind: 'balancete', report: await parsePdfFile(file) };
    self.postMessage(response);
  } catch (error) {
    // parsePdfFile/parseDreFile ja capturam falhas de leitura e devolvem um
    // relatorio com `errors` preenchido; isto aqui e rede de seguranca para o
    // inesperado (ex.: falha ao estruturar-clonar a resposta).
    const response: ParserWorkerResponse = {
      id,
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    };
    self.postMessage(response);
  }
};
