import { CompanyReport } from '../types';
import { formatNumberAsBrazilianMoney } from './format';
import { CompanyAlias, anonymizeText, buildCompanyAliases, deanonymizeText, stripDocumentNumbers } from './anonymize';

const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
const GEMINI_API_KEY_STORAGE_KEY = 'gemini_api_key';
const GEMINI_CONSENT_STORAGE_KEY = 'gemini_ai_consent';

/**
 * A chave expira sozinha para nao ficar indefinidamente exposta no navegador.
 * Ver DataSecurity.tsx: o produto promete nao guardar nada sem acao explicita
 * do usuario, entao o armazenamento precisa ter prazo e ser revogavel.
 */
export const GEMINI_API_KEY_TTL_DAYS = 30;
const GEMINI_API_KEY_TTL_MS = GEMINI_API_KEY_TTL_DAYS * 24 * 60 * 60 * 1000;

export interface ChatTurn {
  role: 'user' | 'model';
  text: string;
}

interface StoredApiKey {
  value: string;
  savedAt: number;
}

/**
 * A env var so e considerada em desenvolvimento. Qualquer valor `VITE_*` e
 * embutido em texto puro no bundle publico durante o build, entao honra-la em
 * producao equivaleria a publicar a chave para qualquer visitante.
 */
function getBuildTimeApiKey(): string {
  if (!import.meta.env.DEV) return '';
  return import.meta.env.VITE_GEMINI_API_KEY?.trim() ?? '';
}

function readStoredApiKey(): StoredApiKey | null {
  const raw = window.localStorage.getItem(GEMINI_API_KEY_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<StoredApiKey>;
    if (typeof parsed?.value === 'string' && typeof parsed?.savedAt === 'number') {
      return { value: parsed.value, savedAt: parsed.savedAt };
    }
  } catch {
    // Formato antigo: a chave era gravada como string pura, sem data de validade.
  }

  const legacyValue = raw.trim();
  if (!legacyValue) return null;

  // Migra o formato antigo carimbando a data de agora para iniciar a contagem do TTL.
  const migrated: StoredApiKey = { value: legacyValue, savedAt: Date.now() };
  window.localStorage.setItem(GEMINI_API_KEY_STORAGE_KEY, JSON.stringify(migrated));
  return migrated;
}

export function getStoredGeminiApiKey(): string {
  if (typeof window === 'undefined') return getBuildTimeApiKey();

  const stored = readStoredApiKey();
  if (stored) {
    if (Date.now() - stored.savedAt > GEMINI_API_KEY_TTL_MS) {
      window.localStorage.removeItem(GEMINI_API_KEY_STORAGE_KEY);
    } else if (stored.value) {
      return stored.value;
    }
  }

  const legacySessionKey = window.sessionStorage.getItem(GEMINI_API_KEY_STORAGE_KEY)?.trim();
  if (legacySessionKey) {
    // Migra chaves salvas no formato antigo para preservar a configuracao do usuario.
    storeGeminiApiKey(legacySessionKey);
    window.sessionStorage.removeItem(GEMINI_API_KEY_STORAGE_KEY);
    return legacySessionKey;
  }

  return getBuildTimeApiKey();
}

export function storeGeminiApiKey(apiKey: string) {
  if (typeof window === 'undefined') return;
  const trimmed = apiKey.trim();
  if (!trimmed) {
    window.localStorage.removeItem(GEMINI_API_KEY_STORAGE_KEY);
    window.sessionStorage.removeItem(GEMINI_API_KEY_STORAGE_KEY);
    return;
  }

  const payload: StoredApiKey = { value: trimmed, savedAt: Date.now() };
  window.localStorage.setItem(GEMINI_API_KEY_STORAGE_KEY, JSON.stringify(payload));
  window.sessionStorage.removeItem(GEMINI_API_KEY_STORAGE_KEY);
}

/** Data em que a chave salva deixa de valer, ou null quando nao ha chave persistida. */
export function getGeminiApiKeyExpiration(): Date | null {
  if (typeof window === 'undefined') return null;
  const stored = readStoredApiKey();
  if (!stored?.value) return null;
  return new Date(stored.savedAt + GEMINI_API_KEY_TTL_MS);
}

/**
 * O envio ao Gemini so acontece apos consentimento explicito, porque e o unico
 * fluxo do produto em que dados do balancete saem do navegador.
 */
export function hasGeminiConsent(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(GEMINI_CONSENT_STORAGE_KEY) === 'true';
}

export function setGeminiConsent(granted: boolean) {
  if (typeof window === 'undefined') return;
  if (granted) {
    window.localStorage.setItem(GEMINI_CONSENT_STORAGE_KEY, 'true');
    return;
  }
  window.localStorage.removeItem(GEMINI_CONSENT_STORAGE_KEY);
}

/** Verdadeiro apenas quando ha chave valida E consentimento registrado. */
export function isGeminiEnabled(): boolean {
  return Boolean(getStoredGeminiApiKey()) && hasGeminiConsent();
}

export async function generateGeminiChatReply(params: {
  apiKey: string;
  reports: CompanyReport[];
  history: ChatTurn[];
  userMessage: string;
  signal?: AbortSignal;
}): Promise<string> {
  const { apiKey, reports, history, userMessage, signal } = params;

  // Tudo que sai daqui passa pela pseudonimizacao; a resposta e revertida no fim.
  const aliases = buildCompanyAliases(reports);
  const prompt = buildGeminiPrompt(reports, userMessage, aliases);
  const safeHistory = history.map((turn) => ({
    role: turn.role,
    text: anonymizeText(turn.text, aliases)
  }));

  const initial = await requestGemini({
    apiKey,
    history: safeHistory,
    userMessage: prompt,
    signal
  });

  let finalText = initial.text;

  // Gemini can stop due to token limits or occasionally end mid-thought.
  // In that case we transparently ask for a continuation before showing the reply.
  if (shouldContinueGeminiReply(initial)) {
    const continuation = await requestGemini({
      apiKey,
      history: [
        ...safeHistory,
        { role: 'user', text: prompt },
        { role: 'model', text: initial.text }
      ],
      userMessage:
        'Continue exatamente de onde voce parou na ultima resposta. Nao reinicie a explicacao e nao repita o texto ja enviado.',
      signal
    });

    finalText = mergeGeminiResponses(initial.text, continuation.text);
  }

  return deanonymizeText(finalText, aliases);
}

export function buildGeminiBootstrapReply(reports: CompanyReport[]): string {
  if (reports.length === 0) {
    return 'Chave Gemini configurada. Assim que voce processar um balancete, eu passo a responder com leitura mais senior, priorizacao de riscos, limitacoes explicitadas e proximos passos de conferencia.';
  }

  return `Chave Gemini configurada. Ja tenho contexto de ${reports.length} empresa(s) processada(s) e posso interpretar os alertas com uma resposta mais senior, priorizada por risco e com base tecnica mais consistente.`;
}

export function buildLocalFallbackNotice(errorMessage?: string): string {
  if (!errorMessage) {
    return 'Gemini ainda nao esta configurado. Posso continuar no modo local, mas a leitura fica menos profunda e com menor capacidade de priorizacao tecnica ate voce informar a chave da API.';
  }

  return `Nao consegui usar o Gemini agora. Motivo: ${errorMessage} Posso continuar no modo local enquanto isso, mantendo respostas mais cautelosas e resumidas.`;
}

/** Aviso exibido quando existe chave, mas o usuario ainda nao autorizou o envio. */
export function buildConsentPendingNotice(): string {
  return 'Sua chave esta salva, mas o envio de dados para o Gemini ainda nao foi autorizado. Abra as configuracoes do assistente e confirme o aviso de privacidade para ativar a IA. Ate la, sigo no modo local.';
}

function buildGeminiContents(history: ChatTurn[], userMessage: string) {
  const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

  history.forEach((turn) => {
    if (!turn.text.trim()) return;
    contents.push({
      role: turn.role,
      parts: [{ text: turn.text }]
    });
  });

  contents.push({
    role: 'user',
    parts: [{ text: userMessage }]
  });

  return contents;
}

function buildSystemInstruction(): string {
  return [
    'Voce e a IA especialista do chatbot do Analisador Contabil Pro, com atuacao senior em analise de balancete no contexto brasileiro.',
    'Seu objetivo e interpretar os achados do sistema com precisao tecnica, linguagem clara e foco em apoio a conferencia contabil.',
    'Responda sempre em portugues do Brasil.',
    'As empresas do contexto sao identificadas por apelidos ("Empresa 1", "Empresa 2"). Use exatamente esses apelidos ao se referir a elas e nunca tente adivinhar a razao social ou o CNPJ real.',
    'Nao invente contas, valores, documentos, fatos, pareceres ou conclusoes que nao estejam no contexto recebido.',
    'Quando faltar dado, diferencie explicitamente [Fato], [Inferencia] e [Hipotese].',
    'Quando houver risco alto, destaque isso logo no inicio da resposta.',
    'Classifique os achados por severidade: Alto, Medio ou Baixo, considerando materialidade e impacto provavel no fechamento.',
    'Explique de forma pratica o que aconteceu, por que isso importa e qual verificacao manual fazer em seguida.',
    'Nao afirme conformidade fiscal, societaria ou contabil definitiva.',
    'Considere como referencia de alto nivel a Lei 6.404/1976, as Leis 11.638/2007 e 11.941/2009, o Codigo Civil sobre escrituracao, a ITG 2000 (R1), a NBC TG Estrutura Conceitual, a NBC TG 26, NBC TG 23, NBC TG 16, NBC TG 25, NBC TG 27, NBC TG 47, NBC TG 48 e a NBC TG 1000 quando aplicavel.',
    'Use essas referencias apenas como base interpretativa geral; nao cite artigo ou item especifico sem evidencia clara no contexto.',
    'Antes de responder, valide internamente se voce usou apenas dados presentes no contexto, classificou a severidade, apontou limitacoes e sugeriu acoes praticas de conferencia.',
    'Padrao visual obrigatorio: use titulos em negrito, uma linha em branco entre secoes, frases curtas e listas numeradas para prioridades.',
    'Evite texto corrido longo, excesso de asteriscos e repeticoes.',
    'Quando citar numeros, destaque em negrito os totais principais e a severidade.',
    'Se a resposta ficar extensa, entregue primeiro uma versao executiva curta e ofereca aprofundamento em seguida.',
    'Formato obrigatorio da resposta: Empresa com mais alertas; Resumo executivo; Achados priorizados; Limitacoes e incertezas; Proximos passos.',
    'Se o usuario pedir algo fora do contexto do balancete, responda de forma breve e puxe a conversa de volta para o dominio contabil do produto.'
  ].join(' ');
}

export function buildGeminiPrompt(
  reports: CompanyReport[],
  userMessage: string,
  aliases: CompanyAlias[] = buildCompanyAliases(reports)
): string {
  // O modelo recebe um resumo operacional em vez da base completa para manter
  // o prompt mais leve e focado na interpretacao.
  const prompt = [
    'Contexto estruturado do sistema:',
    summarizeReportsForPrompt(reports, aliases),
    '',
    'Checklist interno antes de responder:',
    '- Use apenas dados presentes no contexto.',
    '- Diferencie [Fato], [Inferencia] e [Hipotese] quando houver incerteza.',
    '- Classifique a severidade dos achados em Alto, Medio ou Baixo.',
    '- Informe limitacoes de parsing, ausencia de conta ou dado insuficiente.',
    '- Sugira proximos passos concretos de conferencia.',
    '- A resposta deve ser legivel: secoes curtas, espaco entre blocos e sem paragrafos longos.',
    '- Destaque em negrito empresa lider, totais e severidade.',
    '',
    'Formato obrigatorio da resposta:',
    '1. Empresa com mais alertas',
    '2. Resumo executivo',
    '3. Achados priorizados',
    '4. Limitacoes e incertezas',
    '5. Proximos passos',
    '',
    'Instrucao de resposta:',
    'Use apenas o contexto acima e a pergunta do usuario para responder de forma util, objetiva, tecnicamente cautelosa e adequada a um contador senior.',
    'Nao use markdown de lista com asterisco (*). Prefira lista numerada.',
    'Cada secao deve ter no maximo 3 a 5 linhas, salvo quando o usuario pedir aprofundamento.',
    '',
    `Pergunta do usuario: ${anonymizeText(userMessage, aliases)}`
  ].join('\n');

  // Rede de seguranca: nenhum numero de documento deve escapar no prompt final.
  return stripDocumentNumbers(prompt);
}

function summarizeReportsForPrompt(reports: CompanyReport[], aliases: CompanyAlias[]): string {
  if (reports.length === 0) {
    return [
      '- Nenhum balancete foi processado nesta sessao.',
      '- O sistema consegue detectar saldos invertidos, contas sem movimentacao, divergencias entre distribuicao e resultado e analises de clientes, fornecedores e estoques.',
      '- O processamento do balancete e local no navegador; apenas este resumo pseudonimizado e enviado para a IA.'
    ].join('\n');
  }

  const aliasByCompany = new Map(aliases.map((entry) => [entry.companyName, entry.alias]));

  const blocks = reports.map((report, index) => {
    const analysisFlags = report.analysisReports
      .filter((analysis) => analysis.isAttention)
      .map((analysis) => `${analysis.title}: ${analysis.rows.length > 0 ? analysis.rows.length : 1} ocorrencia(s)`);

    const topInverted = report.invertedRows
      .slice(0, 4)
      .map((row) => `${row.account} ${row.name} (${row.currentBalance})`)
      .join('; ');

    const topZero = report.zeroMovementRows
      .slice(0, 4)
      .map((row) => `${row.account} ${row.name}`)
      .join('; ');

    return [
      // Identificadores diretos ficam no navegador: o modelo so ve o apelido.
      `Empresa: ${aliasByCompany.get(report.companyName?.trim() ?? '') ?? `Empresa ${index + 1}`}`,
      `Periodo: ${report.period}`,
      `Linhas extraidas: ${report.rows.length}`,
      `Saldos invertidos: ${report.invertedRows.length}${topInverted ? ` | exemplos: ${topInverted}` : ''}`,
      `Sem movimentacao: ${report.zeroMovementRows.length}${topZero ? ` | exemplos: ${topZero}` : ''}`,
      `Comparacao distribuicao x resultado: ${report.comparisonReport.isAttention ? 'atencao' : 'ok'} | mensagem: ${report.comparisonReport.message}`,
      `Linhas nao classificadas: ${report.unclassified.length}`,
      `Erros de leitura: ${report.errors.length}`,
      `Analises em atencao: ${analysisFlags.length > 0 ? analysisFlags.join(' | ') : 'nenhuma'}`
    ].join('\n');
  });

  const totals = [
    `Empresas processadas: ${reports.length}`,
    `Ocorrencias totais detectadas: ${formatNumberAsBrazilianMoney(sumOccurrences(reports)).replace(',00', '')}`
  ].join('\n');

  return [totals, ...blocks.map((block) => `---\n${block}`)].join('\n');
}

function sumOccurrences(reports: CompanyReport[]) {
  return reports.reduce((sum, report) => {
    return (
      sum +
      report.invertedRows.length +
      report.zeroMovementRows.length +
      (report.comparisonReport.isAttention ? 1 : 0) +
      report.analysisReports.reduce((inner, analysis) => inner + (analysis.rows.length > 0 ? analysis.rows.length : analysis.isAttention ? 1 : 0), 0)
    );
  }, 0);
}

function extractGeminiText(response: GeminiResponse): string {
  return (
    response.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? '')
      .join('')
      .trim() ?? ''
  );
}

async function requestGemini(params: {
  apiKey: string;
  history: ChatTurn[];
  userMessage: string;
  signal?: AbortSignal;
}): Promise<{ text: string; finishReason?: string }> {
  const { apiKey, history, userMessage, signal } = params;
  const response = await fetch(GEMINI_ENDPOINT, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [
          {
            text: buildSystemInstruction()
          }
        ]
      },
      contents: buildGeminiContents(history, userMessage),
      generationConfig: {
        temperature: 0.45,
        topP: 0.9,
        maxOutputTokens: 1200
      },
      safetySettings: []
    })
  });

  if (!response.ok) {
    const errorText = await safeReadText(response);
    throw new Error(errorText || `Gemini retornou erro HTTP ${response.status}.`);
  }

  const data = (await response.json()) as GeminiResponse;
  const text = extractGeminiText(data);
  if (!text) {
    throw new Error('A resposta do Gemini veio sem texto utilizavel.');
  }

  return {
    text,
    finishReason: data.candidates?.[0]?.finishReason
  };
}

function shouldContinueGeminiReply(result: { text: string; finishReason?: string }) {
  if (result.finishReason === 'MAX_TOKENS') {
    return true;
  }

  const text = result.text.trim();
  if (!text) return false;

  // Heuristicas leves para detectar respostas cortadas mesmo quando o provedor
  // nao sinaliza explicitamente esgotamento de tokens.
  const lastChar = text[text.length - 1];
  const endsAbruptly =
    /[A-Za-z0-9)]/.test(lastChar) &&
    !text.endsWith('...') &&
    !text.endsWith('.') &&
    !text.endsWith('!') &&
    !text.endsWith('?') &&
    !text.endsWith(':');

  const hasUnclosedMarkdown = (text.match(/\*\*/g)?.length ?? 0) % 2 !== 0;
  return endsAbruptly || hasUnclosedMarkdown;
}

function mergeGeminiResponses(first: string, second: string) {
  const normalizedSecond = second.trim();
  if (!normalizedSecond) return first;
  if (first.endsWith(' ') || normalizedSecond.startsWith(',') || normalizedSecond.startsWith('.')) {
    return `${first}${normalizedSecond}`;
  }
  return `${first} ${normalizedSecond}`;
}

async function safeReadText(response: Response) {
  try {
    return await response.text();
  } catch {
    return '';
  }
}

interface GeminiResponse {
  candidates?: Array<{
    finishReason?: string;
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
}
