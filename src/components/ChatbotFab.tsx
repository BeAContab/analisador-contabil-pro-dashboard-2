import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { CompanyReport } from '../types';
import {
  buildChatFooterNote,
  buildChatSuggestions,
  buildWelcomeMessage,
  generateChatbotResponse
} from '../utils/chatbot';
import {
  GEMINI_API_KEY_TTL_DAYS,
  buildConsentPendingNotice,
  buildGeminiBootstrapReply,
  buildLocalFallbackNotice,
  generateGeminiChatReply,
  getGeminiApiKeyExpiration,
  getStoredGeminiApiKey,
  hasGeminiConsent,
  setGeminiConsent,
  storeGeminiApiKey
} from '../utils/gemini';

interface ChatbotFabProps {
  reports: CompanyReport[];
  isProcessing: boolean;
}

interface ChatMessage {
  id: string;
  role: 'assistant' | 'user';
  content: string;
}

export function ChatbotFab({ reports, isProcessing }: ChatbotFabProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [apiKeyInput, setApiKeyInput] = useState(() => getStoredGeminiApiKey());
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isLoadingReply, setIsLoadingReply] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: buildWelcomeMessage(reports)
    }
  ]);
  const [hasInjectedReportUpdate, setHasInjectedReportUpdate] = useState(reports.length > 0);
  const [activeApiKey, setActiveApiKey] = useState(() => getStoredGeminiApiKey());
  const [consentGranted, setConsentGranted] = useState(() => hasGeminiConsent());
  const [configError, setConfigError] = useState('');
  const scrollRef = useRef<HTMLDivElement | null>(null);
  // Cancela a requisicao em voo quando o componente desmonta ou quando uma nova
  // mensagem e enviada, evitando setState apos unmount e respostas fora de ordem.
  const abortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const suggestions = useMemo(() => buildChatSuggestions(reports), [reports]);
  const footerNote = useMemo(() => buildChatFooterNote(reports), [reports]);
  const keyExpiration = useMemo(
    () => (activeApiKey ? getGeminiApiKeyExpiration() : null),
    [activeApiKey]
  );
  // A IA so e acionada quando existe chave E o usuario autorizou o envio.
  const isGeminiActive = Boolean(activeApiKey) && consentGranted;
  const totalOccurrences = useMemo(
    () =>
      reports.reduce((sum, report) => {
        return (
          sum +
          report.invertedRows.length +
          report.zeroMovementRows.length +
          (report.comparisonReport.isAttention ? 1 : 0) +
          report.analysisReports.reduce(
            (innerSum, analysis) => innerSum + (analysis.rows.length > 0 ? analysis.rows.length : analysis.isAttention ? 1 : 0),
            0
          )
        );
      }, 0),
    [reports]
  );

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isOpen]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (reports.length === 0) {
      setHasInjectedReportUpdate(false);
      return;
    }

    if (!hasInjectedReportUpdate) {
      setMessages((current) => [
        ...current,
        {
          id: `report-update-${reports.length}-${Date.now()}`,
          role: 'assistant',
          content: `Análise carregada. Agora consigo interpretar ${reports.length} empresa(s) processada(s), explicar alertas e sugerir prioridades de revisão.`
        }
      ]);
      setHasInjectedReportUpdate(true);
    }
  }, [hasInjectedReportUpdate, reports]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;

    void sendMessage(trimmed);
  }

  async function sendMessage(content: string) {
    const trimmed = content.trim();
    if (!trimmed || isLoadingReply) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed
    };

    setMessages((current) => [...current, userMessage]);
    setInput('');
    setIsLoadingReply(true);

    // Descarta qualquer requisicao anterior ainda em voo antes de iniciar a nova.
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const requestId = ++requestIdRef.current;
    const isStale = () => requestId !== requestIdRef.current;

    const apiKey = getStoredGeminiApiKey();
    const localReply = () => generateChatbotResponse(trimmed, reports);

    try {
      let assistantContent: string;

      if (apiKey && consentGranted) {
        assistantContent = await generateGeminiChatReply({
          apiKey,
          reports,
          history: messages
            .filter((message) => message.role === 'assistant' || message.role === 'user')
            .map((message) => ({
              role: message.role === 'assistant' ? ('model' as const) : ('user' as const),
              text: message.content
            })),
          userMessage: trimmed,
          signal: controller.signal
        });
      } else if (apiKey) {
        assistantContent = `${buildConsentPendingNotice()} ${localReply()}`;
      } else {
        assistantContent = `${buildLocalFallbackNotice()} ${localReply()}`;
      }

      if (isStale()) return;

      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now() + 1}`,
          role: 'assistant',
          content: assistantContent
        }
      ]);
    } catch (error) {
      // Cancelamento e fluxo esperado (unmount ou nova pergunta): nao vira mensagem.
      if (controller.signal.aborted || (error instanceof DOMException && error.name === 'AbortError')) {
        return;
      }
      if (isStale()) return;

      const errorMessage = error instanceof Error ? sanitizeGeminiError(error.message) : 'Falha desconhecida ao consultar o Gemini.';
      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now() + 1}`,
          role: 'assistant',
          content: `${buildLocalFallbackNotice(errorMessage)} ${localReply()}`
        }
      ]);
    } finally {
      if (!isStale()) {
        setIsLoadingReply(false);
      }
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
    }
  }

  function handleSuggestion(prompt: string) {
    if (!isOpen) setIsOpen(true);
    void sendMessage(prompt);
  }

  function handleSaveApiKey() {
    if (!apiKeyInput.trim()) {
      setConfigError('Informe uma chave do Gemini antes de salvar.');
      return;
    }

    // Sem autorizacao explicita nada e enviado: o consentimento e pre-requisito
    // para gravar a chave e ativar a IA.
    if (!consentGranted) {
      setConfigError('Confirme o aviso de privacidade para autorizar o envio de dados ao Gemini.');
      return;
    }

    setConfigError('');
    storeGeminiApiKey(apiKeyInput);
    const storedKey = getStoredGeminiApiKey();
    setApiKeyInput(storedKey);
    setActiveApiKey(storedKey);
    setMessages((current) => [
      ...current,
      {
        id: `assistant-bootstrap-${Date.now()}`,
        role: 'assistant',
        content: buildGeminiBootstrapReply(reports)
      }
    ]);
    setIsConfigOpen(false);
  }

  function handleClearApiKey() {
    storeGeminiApiKey('');
    setApiKeyInput('');
    setActiveApiKey('');
    setConfigError('');
  }

  function handleToggleConsent(granted: boolean) {
    setGeminiConsent(granted);
    setConsentGranted(granted);
    if (granted) setConfigError('');
  }

  return (
    <>
      {/* Backdrop para o Drawer */}
      <div 
        className={`fixed inset-0 bg-background/40 backdrop-blur-sm z-[70] transition-opacity duration-500 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} 
        onClick={() => setIsOpen(false)}
      ></div>

      {/* Side Drawer */}
      <div className={`fixed top-0 right-0 h-screen w-[420px] max-w-[100vw] bg-surface border-l border-surface-border shadow-glass-lg z-[80] flex flex-col transition-transform duration-500 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <header className="bg-primary px-6 py-6 text-primary-foreground flex-shrink-0 relative overflow-hidden">
          <div className="absolute -top-12 -right-12 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
          <div className="flex items-start justify-between gap-4 relative z-10">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-80 mb-1">Assistente de IA</p>
              <h2 className="text-xl font-bold">Analisador Pro</h2>
              <p className="mt-1 text-xs opacity-80 leading-relaxed font-medium">
                {isProcessing ? 'Aguardando o processamento terminar para enriquecer o contexto.' : footerNote}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsConfigOpen((current) => !current)}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 transition-colors hover:bg-white/20"
                title="Configurar Gemini"
              >
                <span className="material-symbols-outlined text-[18px]">settings</span>
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 transition-colors hover:bg-white/20"
                title="Fechar chatbot"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
          </div>
        </header>

        {isConfigOpen && (
          <div className="border-b border-surface-border bg-surface-80 p-5 shadow-inner">
            <div className="space-y-3">
              <div className="rounded-xl border border-warning/40 bg-warning/10 p-3 space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-warning">
                  O que sai do seu navegador
                </p>
                <p className="text-xs text-foreground leading-relaxed">
                  A leitura do PDF continua 100% local. Ao ativar a IA, um <strong>resumo pseudonimizado</strong> da
                  análise é enviado ao Google (Gemini): razão social vira &quot;Empresa 1&quot;, CNPJ e CPF são removidos,
                  mas códigos, nomes de contas, saldos e alertas são enviados.
                </p>
                <label className="flex items-start gap-2 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={consentGranted}
                    onChange={(event) => handleToggleConsent(event.target.checked)}
                    className="mt-0.5 h-4 w-4 flex-shrink-0 accent-primary"
                  />
                  <span className="text-xs text-foreground leading-relaxed font-medium">
                    Autorizo o envio desse resumo para o Gemini e entendo que o tratamento passa a seguir a
                    política de privacidade do Google.
                  </span>
                </label>
              </div>

              <label htmlFor="gemini-api-key" className="block text-xs text-muted-foreground font-medium leading-relaxed">
                Chave da API do Gemini
              </label>
              <input
                id="gemini-api-key"
                name="gemini-api-key"
                type="password"
                autoComplete="off"
                value={apiKeyInput}
                onChange={(event) => setApiKeyInput(event.target.value)}
                placeholder="AIza..."
                className="w-full rounded-xl border border-surface-border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary transition-all"
              />
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                A chave fica salva sem criptografia neste navegador e expira automaticamente em{' '}
                {GEMINI_API_KEY_TTL_DAYS} dias.
                {keyExpiration ? ` Validade atual: ${keyExpiration.toLocaleDateString('pt-BR')}.` : ''} Use uma chave
                própria com cota limitada e revogue-a se o dispositivo for compartilhado.
              </p>

              {configError && (
                <p role="alert" className="text-xs font-semibold text-error">
                  {configError}
                </p>
              )}

              <div className="flex items-center justify-between gap-3 pt-1">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleSaveApiKey}
                    className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-primary-hover transition-colors"
                  >
                    Salvar chave
                  </button>
                  <button
                    type="button"
                    onClick={handleClearApiKey}
                    className="rounded-lg border border-surface-border bg-surface px-4 py-2 text-xs font-bold text-foreground hover:bg-muted transition-colors"
                  >
                    Limpar
                  </button>
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md ${isGeminiActive ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>
                  {isGeminiActive ? 'Gemini ativo' : 'Modo local'}
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="border-b border-surface-border bg-surface-50 p-4">
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion.id}
                type="button"
                onClick={() => handleSuggestion(suggestion.prompt)}
                className="whitespace-nowrap rounded-lg border border-surface-border bg-background px-4 py-2 text-xs font-semibold text-foreground hover:border-primary/50 hover:text-primary transition-all shadow-sm"
              >
                {suggestion.label}
              </button>
            ))}
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto bg-surface-30 p-5 flex flex-col gap-6 scrollbar-hide">
          {messages.map((message) => (
            <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <article
                className={`max-w-[85%] rounded-2xl px-5 py-4 text-sm leading-relaxed shadow-sm ${
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground rounded-tr-sm'
                    : 'bg-background text-foreground border border-surface-border rounded-tl-sm'
                }`}
              >
                {message.content}
              </article>
            </div>
          ))}
          {isLoadingReply && (
            <div className="flex justify-start">
              <article className="max-w-[85%] rounded-2xl rounded-tl-sm border border-surface-border bg-background px-5 py-4 text-sm text-muted-foreground flex items-center gap-3">
                <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                {isGeminiActive ? 'Consultando Gemini...' : 'Gerando resposta local...'}
              </article>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="border-t border-surface-border bg-surface-80 p-5 backdrop-blur-sm">
          <div className="flex items-end gap-3">
            <textarea
              id="chatbot-input"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  void sendMessage(input);
                }
              }}
              rows={2}
              placeholder="Faça uma pergunta sobre o balancete..."
              className="min-h-[60px] flex-1 resize-none rounded-2xl border border-surface-border bg-background px-4 py-3 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary shadow-sm"
            />
            <button
              type="submit"
              className="flex h-[60px] w-[60px] flex-shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md transition-all hover:-translate-y-1 hover:shadow-lg disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-md"
              disabled={!input.trim() || isLoadingReply}
              title="Enviar mensagem"
            >
              <span className="material-symbols-outlined text-[24px]">send</span>
            </button>
          </div>
        </form>
      </div>

      {/* Botão Flutuante (FAB) */}
      <div className={`fixed bottom-8 right-8 z-[60] transition-all duration-500 ${isOpen ? 'translate-x-[200%] opacity-0 pointer-events-none' : 'translate-x-0 opacity-100'}`}>
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="group relative flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-all hover:-translate-y-1 hover:scale-105"
          title="Abrir Assistente IA"
        >
          <span className="material-symbols-outlined text-[28px]">smart_toy</span>
          {totalOccurrences > 0 && (
            <span className="absolute -right-2 -top-2 flex h-6 min-w-[24px] items-center justify-center rounded-full bg-error px-1.5 text-[10px] font-bold text-error-foreground shadow-sm ring-2 ring-background">
              {totalOccurrences > 99 ? '99+' : totalOccurrences}
            </span>
          )}
        </button>
      </div>
    </>
  );
}

function sanitizeGeminiError(errorMessage: string) {
  return errorMessage
    .replace(/\s+/g, ' ')
    .replace(/AIza[0-9A-Za-z\-_]+/g, '[api-key-redacted]')
    .trim();
}
