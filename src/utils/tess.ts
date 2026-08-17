import { CompanyReport } from '../types';
import { formatNumberAsBrazilianMoney } from './format';
import { CompanyAlias, anonymizeText, buildCompanyAliases, deanonymizeText, stripDocumentNumbers } from './anonymize';
import { sumOccurrences } from './occurrences';

function tessAgentEndpoint(agentId: string): string {
  return `https://api.tess.im/agents/${encodeURIComponent(agentId)}/openai/chat/completions`;
}

const TESS_API_KEY_STORAGE_KEY = 'tess_api_key';
const TESS_CONSENT_STORAGE_KEY = 'tess_ai_consent';
const TESS_WORKSPACE_ID_STORAGE_KEY = 'tess_workspace_id';
const TESS_AGENT_ID_STORAGE_KEY = 'tess_agent_id';

/**
 * A chave expira sozinha para nao ficar indefinidamente exposta no navegador.
 * Ver DataSecurity.tsx: o produto promete nao guardar nada sem acao explicita
 * do usuario, entao o armazenamento precisa ter prazo e ser revogavel.
 */
export const TESS_API_KEY_TTL_DAYS = 30;
const TESS_API_KEY_TTL_MS = TESS_API_KEY_TTL_DAYS * 24 * 60 * 60 * 1000;

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
  return import.meta.env.VITE_TESS_API_KEY?.trim() ?? '';
}

/**
 * Workspace ID e Agent ID nao sao segredo, mas seguem o mesmo guard "so em
 * dev" da chave para nao acabar fixando o workspace/agent pessoal de alguem
 * no bundle publico por descuido.
 */
function getBuildTimeWorkspaceId(): string {
  if (!import.meta.env.DEV) return '';
  return import.meta.env.VITE_TESS_WORKSPACE_ID?.trim() ?? '';
}

function getBuildTimeAgentId(): string {
  if (!import.meta.env.DEV) return '';
  return import.meta.env.VITE_TESS_AGENT_ID?.trim() ?? '';
}

function readStoredApiKey(): StoredApiKey | null {
  const raw = window.localStorage.getItem(TESS_API_KEY_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<StoredApiKey>;
    if (typeof parsed?.value === 'string' && typeof parsed?.savedAt === 'number') {
      return { value: parsed.value, savedAt: parsed.savedAt };
    }
  } catch {
    return null;
  }

  return null;
}

export function getStoredTessApiKey(): string {
  if (typeof window === 'undefined') return getBuildTimeApiKey();

  const stored = readStoredApiKey();
  if (stored) {
    if (Date.now() - stored.savedAt > TESS_API_KEY_TTL_MS) {
      window.localStorage.removeItem(TESS_API_KEY_STORAGE_KEY);
    } else if (stored.value) {
      return stored.value;
    }
  }

  return getBuildTimeApiKey();
}

export function storeTessApiKey(apiKey: string) {
  if (typeof window === 'undefined') return;
  const trimmed = apiKey.trim();
  if (!trimmed) {
    window.localStorage.removeItem(TESS_API_KEY_STORAGE_KEY);
    return;
  }

  const payload: StoredApiKey = { value: trimmed, savedAt: Date.now() };
  window.localStorage.setItem(TESS_API_KEY_STORAGE_KEY, JSON.stringify(payload));
}

/** Data em que a chave salva deixa de valer, ou null quando nao ha chave persistida. */
export function getTessApiKeyExpiration(): Date | null {
  if (typeof window === 'undefined') return null;
  const stored = readStoredApiKey();
  if (!stored?.value) return null;
  return new Date(stored.savedAt + TESS_API_KEY_TTL_MS);
}

export function getStoredTessWorkspaceId(): string {
  if (typeof window === 'undefined') return getBuildTimeWorkspaceId();
  const stored = window.localStorage.getItem(TESS_WORKSPACE_ID_STORAGE_KEY)?.trim();
  return stored || getBuildTimeWorkspaceId();
}

export function storeTessWorkspaceId(workspaceId: string) {
  if (typeof window === 'undefined') return;
  const trimmed = workspaceId.trim();
  if (!trimmed) {
    window.localStorage.removeItem(TESS_WORKSPACE_ID_STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(TESS_WORKSPACE_ID_STORAGE_KEY, trimmed);
}

export function getStoredTessAgentId(): string {
  if (typeof window === 'undefined') return getBuildTimeAgentId();
  const stored = window.localStorage.getItem(TESS_AGENT_ID_STORAGE_KEY)?.trim();
  return stored || getBuildTimeAgentId();
}

export function storeTessAgentId(agentId: string) {
  if (typeof window === 'undefined') return;
  const trimmed = agentId.trim();
  if (!trimmed) {
    window.localStorage.removeItem(TESS_AGENT_ID_STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(TESS_AGENT_ID_STORAGE_KEY, trimmed);
}

/**
 * O envio a TESS so acontece apos consentimento explicito, porque e o unico
 * fluxo do produto em que dados do balancete saem do navegador.
 */
export function hasTessConsent(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(TESS_CONSENT_STORAGE_KEY) === 'true';
}

export function setTessConsent(granted: boolean) {
  if (typeof window === 'undefined') return;
  if (granted) {
    window.localStorage.setItem(TESS_CONSENT_STORAGE_KEY, 'true');
    return;
  }
  window.localStorage.removeItem(TESS_CONSENT_STORAGE_KEY);
}

/** Verdadeiro apenas quando ha chave, workspace, agente e consentimento registrados. */
export function isTessEnabled(): boolean {
  return (
    Boolean(getStoredTessApiKey()) &&
    Boolean(getStoredTessWorkspaceId()) &&
    Boolean(getStoredTessAgentId()) &&
    hasTessConsent()
  );
}

export async function generateTessChatReply(params: {
  apiKey: string;
  workspaceId: string;
  agentId: string;
  reports: CompanyReport[];
  history: ChatTurn[];
  userMessage: string;
  signal?: AbortSignal | undefined;
}): Promise<string> {
  const { apiKey, workspaceId, agentId, reports, history, userMessage, signal } = params;

  // Tudo que sai daqui passa pela pseudonimizacao; a resposta e revertida no fim.
  const aliases = buildCompanyAliases(reports);
  const prompt = buildTessPrompt(reports, userMessage, aliases);
  const safeHistory = history.map((turn) => ({
    role: turn.role,
    text: anonymizeText(turn.text, aliases)
  }));

  const initial = await requestTess({
    apiKey,
    workspaceId,
    agentId,
    history: safeHistory,
    userMessage: prompt,
    signal
  });

  let finalText = initial.text;

  // A TESS pode cortar a resposta por limite de tokens ou terminar no meio de
  // uma frase. Nesse caso, pedimos continuacao antes de exibir a resposta.
  if (shouldContinueTessReply(initial)) {
    const continuation = await requestTess({
      apiKey,
      workspaceId,
      agentId,
      history: [
        ...safeHistory,
        { role: 'user', text: prompt },
        { role: 'model', text: initial.text }
      ],
      userMessage:
        'Continue exatamente de onde voce parou na ultima resposta. Nao reinicie a explicacao e nao repita o texto ja enviado.',
      signal
    });

    finalText = mergeTessResponses(initial.text, continuation.text);
  }

  return deanonymizeText(finalText, aliases);
}

export function buildTessBootstrapReply(reports: CompanyReport[]): string {
  if (reports.length === 0) {
    return 'Chave TESS configurada. Assim que voce processar um balancete, eu passo a responder com leitura mais senior, priorizacao de riscos, limitacoes explicitadas e proximos passos de conferencia.';
  }

  return `Chave TESS configurada. Ja tenho contexto de ${reports.length} empresa(s) processada(s) e posso interpretar os alertas com uma resposta mais senior, priorizada por risco e com base tecnica mais consistente.`;
}

export function buildLocalFallbackNotice(errorMessage?: string): string {
  if (!errorMessage) {
    return 'TESS ainda nao esta configurada. Posso continuar no modo local, mas a leitura fica menos profunda e com menor capacidade de priorizacao tecnica ate voce informar a chave da API.';
  }

  return `Nao consegui usar a TESS agora. Motivo: ${errorMessage} Posso continuar no modo local enquanto isso, mantendo respostas mais cautelosas e resumidas.`;
}

/** Aviso exibido quando existe configuracao, mas o usuario ainda nao autorizou o envio. */
export function buildConsentPendingNotice(): string {
  return 'Sua configuracao esta salva, mas o envio de dados para a TESS ainda nao foi autorizado. Abra as configuracoes do assistente e confirme o aviso de privacidade para ativar a IA. Ate la, sigo no modo local.';
}

function buildTessMessages(history: ChatTurn[], userMessage: string) {
  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: buildSystemInstruction() }
  ];

  history.forEach((turn) => {
    if (!turn.text.trim()) return;
    messages.push({
      role: turn.role === 'model' ? 'assistant' : 'user',
      content: turn.text
    });
  });

  messages.push({ role: 'user', content: userMessage });

  return messages;
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
    'Cada item da secao "Achados priorizados" deve terminar, na mesma linha, com uma frase iniciada por "**Acao recomendada:**" com uma orientacao direta, pratica e especifica daquele achado (nunca generica ou repetida entre achados diferentes).',
    'Se o usuario pedir algo fora do contexto do balancete, responda de forma breve e puxe a conversa de volta para o dominio contabil do produto.'
  ].join(' ');
}

export function buildTessPrompt(
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
    '- Cada achado prioritario deve terminar com "**Acao recomendada:**" seguido de uma orientacao especifica daquele ponto, na mesma linha (sem quebrar o achado em sub-linhas).',
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

function extractTessText(response: TessResponse): string {
  return response.choices?.[0]?.message?.content?.trim() ?? '';
}

async function requestTess(params: {
  apiKey: string;
  workspaceId: string;
  agentId: string;
  history: ChatTurn[];
  userMessage: string;
  signal?: AbortSignal | undefined;
}): Promise<{ text: string; finishReason?: string | undefined }> {
  const { apiKey, workspaceId, agentId, history, userMessage, signal } = params;
  const response = await fetch(tessAgentEndpoint(agentId), {
    method: 'POST',
    // lib.dom tipa RequestInit.signal como `AbortSignal | null` (sem
    // `undefined` no valor, so a chave e opcional) - com
    // exactOptionalPropertyTypes, precisa converter explicitamente.
    signal: signal ?? null,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'x-workspace-id': workspaceId
    },
    body: JSON.stringify({
      // `temperature` fica de fora: a TESS valida esse campo contra um
      // conjunto fixo de valores aceitos (configurado no proprio Agent) e
      // rejeita floats arbitrarios como 0.45 com "The selected temperature
      // is invalid" - omitir usa o valor padrao configurado no Agent Studio.
      messages: buildTessMessages(history, userMessage)
    })
  });

  if (!response.ok) {
    const errorText = await safeReadText(response);
    throw new Error(errorText || `TESS retornou erro HTTP ${response.status}.`);
  }

  const data = (await response.json()) as TessResponse;
  const text = extractTessText(data);
  if (!text) {
    throw new Error('A resposta da TESS veio sem texto utilizavel.');
  }

  return {
    text,
    finishReason: data.choices?.[0]?.finish_reason
  };
}

function shouldContinueTessReply(result: { text: string; finishReason?: string | undefined }) {
  if (result.finishReason === 'length') {
    return true;
  }

  const text = result.text.trim();
  if (!text) return false;

  // Heuristicas leves para detectar respostas cortadas mesmo quando o provedor
  // nao sinaliza explicitamente esgotamento de tokens.
  // `if (!text) return false;` acima garante text.length >= 1.
  const lastChar = text[text.length - 1]!;
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

function mergeTessResponses(first: string, second: string) {
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

interface TessResponse {
  choices?: Array<{
    finish_reason?: string;
    message?: {
      content?: string;
    };
  }>;
}
