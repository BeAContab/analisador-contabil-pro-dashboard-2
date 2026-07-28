import { CompanyReport } from '../types';

/**
 * Camada de pseudonimizacao aplicada a TUDO que sai do navegador rumo ao Gemini.
 *
 * O parsing do PDF continua 100% local; o unico ponto do produto que atravessa a
 * rede e o chat de IA opcional. Antes de qualquer envio, identificadores diretos
 * da empresa sao substituidos por apelidos reversiveis apenas nesta aba, e
 * numeros de documento (CNPJ/CPF) sao removidos por completo.
 *
 * A resposta do modelo volta com os apelidos e e reconvertida para os nomes
 * reais na hora de exibir, entao o usuario nunca percebe a troca.
 */

export interface CompanyAlias {
  /** Nome real da empresa, como extraido do balancete. */
  companyName: string;
  /** Apelido enviado ao modelo, ex.: "Empresa 1". */
  alias: string;
}

/** Captura CNPJ (com ou sem mascara) e CPF em qualquer texto de saida. */
const documentNumberRegex = /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b|\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g;

const DOCUMENT_PLACEHOLDER = '[documento removido]';

export function buildCompanyAliases(reports: CompanyReport[]): CompanyAlias[] {
  const aliases: CompanyAlias[] = [];
  const seen = new Set<string>();

  reports.forEach((report) => {
    const companyName = report.companyName?.trim();
    if (!companyName || seen.has(companyName)) return;
    seen.add(companyName);
    aliases.push({ companyName, alias: `Empresa ${aliases.length + 1}` });
  });

  return aliases;
}

/**
 * Troca nomes reais por apelidos. Nomes mais longos sao substituidos primeiro
 * para que uma razao social nao seja parcialmente consumida por outra menor que
 * seja prefixo dela.
 */
export function anonymizeText(text: string, aliases: CompanyAlias[]): string {
  if (!text) return text;

  const ordered = [...aliases].sort((a, b) => b.companyName.length - a.companyName.length);
  const anonymized = ordered.reduce((current, entry) => {
    return current.split(entry.companyName).join(entry.alias);
  }, text);

  return stripDocumentNumbers(anonymized);
}

/** Rede de seguranca final: nenhum CNPJ/CPF deve sair do navegador. */
export function stripDocumentNumbers(text: string): string {
  if (!text) return text;
  return text.replace(documentNumberRegex, DOCUMENT_PLACEHOLDER);
}

/** Converte a resposta do modelo de volta para os nomes reais antes de exibir. */
export function deanonymizeText(text: string, aliases: CompanyAlias[]): string {
  if (!text) return text;

  // Apelidos maiores primeiro para que "Empresa 1" nao consuma "Empresa 10".
  const ordered = [...aliases].sort((a, b) => b.alias.length - a.alias.length);
  return ordered.reduce((current, entry) => {
    return current.split(entry.alias).join(entry.companyName);
  }, text);
}
