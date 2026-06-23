export function LocalProcessingDoc() {
  return (
    <div className="space-y-xl animate-in fade-in duration-500 text-foreground">
      {/* Cabeçalho da página de instruções */}
      <section className="flex flex-col gap-sm border-b border-surface-border pb-6">
        <span className="text-xs font-bold text-accent uppercase tracking-wider">Guia de Apoio</span>
        <h2 className="text-3xl font-bold text-primary">Instruções de Uso</h2>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Coluna Principal: Regras e Passo a Passo */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Seção 1: Compatibilidade Contábil do Balancete */}
          <article className="bg-surface border border-surface-border rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex items-center gap-3 text-primary">
              <span className="material-symbols-outlined text-[28px]">table_chart</span>
              <h3 className="text-xl font-bold">1. Compatibilidade do Balancete</h3>
            </div>
            
            <p className="text-sm text-muted-foreground leading-relaxed">
              O analisador contábil foi desenvolvido e homologado especificamente para processar balancetes exportados do sistema <strong>Athenas3000</strong>. Para que o parser extraia os dados e execute as 15 regras lógicas com sucesso, o arquivo PDF do balancete deve possuir as seguintes colunas estruturadas:
            </p>

            <div className="bg-background p-4 rounded-xl border border-surface-border space-y-3">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">Colunas Obrigatórias no PDF</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-semibold text-foreground">
                <div className="flex items-center gap-2 bg-surface p-2.5 rounded-lg border border-surface-border">
                  <span className="material-symbols-outlined text-[16px] text-primary">view_column</span>
                  Conta Contábil
                </div>
                <div className="flex items-center gap-2 bg-surface p-2.5 rounded-lg border border-surface-border">
                  <span className="material-symbols-outlined text-[16px] text-primary">view_column</span>
                  Cod. R.
                </div>
                <div className="flex items-center gap-2 bg-surface p-2.5 rounded-lg border border-surface-border">
                  <span className="material-symbols-outlined text-[16px] text-primary">view_column</span>
                  Nome da Conta
                </div>
                <div className="flex items-center gap-2 bg-surface p-2.5 rounded-lg border border-surface-border">
                  <span className="material-symbols-outlined text-[16px] text-primary">view_column</span>
                  S. Anterior
                </div>
                <div className="flex items-center gap-2 bg-surface p-2.5 rounded-lg border border-surface-border">
                  <span className="material-symbols-outlined text-[16px] text-primary">view_column</span>
                  Débito
                </div>
                <div className="flex items-center gap-2 bg-surface p-2.5 rounded-lg border border-surface-border">
                  <span className="material-symbols-outlined text-[16px] text-primary">view_column</span>
                  Crédito
                </div>
                <div className="flex items-center gap-2 bg-surface p-2.5 rounded-lg border border-surface-border sm:col-span-2">
                  <span className="material-symbols-outlined text-[16px] text-primary">view_column</span>
                  S. Atual
                </div>
              </div>
            </div>

            <div className="bg-warning/10 text-warning p-4 rounded-xl border border-warning/20 flex gap-3 items-start">
              <span className="material-symbols-outlined text-[24px] mt-0.5">warning</span>
              <div>
                <h4 className="font-bold text-sm">Atenção ao Layout</h4>
                <p className="text-xs mt-1 leading-relaxed opacity-95">
                  Caso o balancete contábil carregado pertença a outro sistema ou não possua precisamente a estrutura e os nomes das colunas descritas acima, o motor do analisador contábil poderá falhar ao classificar as linhas, não identificando as ocorrências e gerando erros no parsing dos dados.
                </p>
              </div>
            </div>
          </article>

          {/* Seção 2: Configuração do Assistente de IA (Gemini) */}
          <article className="bg-surface border border-surface-border rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex items-center gap-3 text-primary">
              <span className="material-symbols-outlined text-[28px]">psychology</span>
              <h3 className="text-xl font-bold">2. Configuração do Assistente de IA</h3>
            </div>
            
            <p className="text-sm text-muted-foreground leading-relaxed">
              O sistema possui um assistente virtual inteligente integrado para responder a dúvidas contábeis sobre os balancetes processados. O processamento da IA é feito diretamente com a tecnologia da Google (Gemini). Siga o tutorial abaixo para obter e inserir sua chave de API gratuita:
            </p>

            <div className="space-y-4">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Passo a Passo de Configuração</span>
              <div className="space-y-3">
                <div className="flex gap-4 items-start bg-background p-4 rounded-xl border border-surface-border">
                  <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm flex-shrink-0">1</div>
                  <div>
                    <h5 className="font-bold text-sm">Acesse o Google AI Studio</h5>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      Acesse a plataforma de desenvolvedores do Google pelo link oficial:{' '}
                      <a href="https://aistudio.google.com/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-semibold inline-flex items-center gap-0.5">
                        aistudio.google.com
                        <span className="material-symbols-outlined text-[12px]">open_in_new</span>
                      </a>. Faça login com a sua conta Google (corporativa ou pessoal).
                    </p>
                  </div>
                </div>

                <div className="flex gap-4 items-start bg-background p-4 rounded-xl border border-surface-border">
                  <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm flex-shrink-0">2</div>
                  <div>
                    <h5 className="font-bold text-sm">Crie a Chave de API (API Key)</h5>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      No painel lateral esquerdo do Google AI Studio, clique no botão **"Get API key"** (Obter chave de API). Em seguida, clique em **"Create API key"** (Criar chave de API), selecione a política aplicável e confirme a criação.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4 items-start bg-background p-4 rounded-xl border border-surface-border">
                  <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm flex-shrink-0">3</div>
                  <div>
                    <h5 className="font-bold text-sm">Copie o Código Gerado</h5>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      Uma chave contendo letras e números (iniciando normalmente com `AIzaSy...`) será exibida em sua tela. Clique no botão de copiar para salvá-la em sua área de transferência.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4 items-start bg-background p-4 rounded-xl border border-surface-border">
                  <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm flex-shrink-0">4</div>
                  <div>
                    <h5 className="font-bold text-sm">Insira na Plataforma</h5>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      Retorne ao dashboard principal do Analisador Contábil Pro, clique no botão flutuante redondo do **Assistente de IA** (localizado no canto inferior direito) e insira o código no campo de texto indicado para ativar o robô.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-primary/5 text-primary p-4 rounded-xl border border-primary/20 flex gap-3 items-start">
              <span className="material-symbols-outlined text-[24px] mt-0.5">lock</span>
              <div>
                <h4 className="font-bold text-sm">Privacidade Garantida</h4>
                <p className="text-xs mt-1 leading-relaxed opacity-95">
                  A chave de API informada é salva diretamente no `localStorage` do seu navegador. Ela é usada de forma exclusiva a partir da sua máquina para se conectar à API oficial da Google. Nossos servidores nunca salvam, coletam ou expõem a sua chave.
                </p>
              </div>
            </div>
          </article>

        </div>

        {/* Coluna Lateral: Metadados e Requisitos */}
        <div className="space-y-6">
          
          <div className="bg-surface border border-surface-border p-6 rounded-2xl shadow-sm space-y-4">
            <h4 className="font-bold text-sm uppercase tracking-wider text-muted-foreground border-b border-surface-border pb-2">Sobre o Motor Local</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              O analisador faz o processamento dos balancetes no próprio navegador do seu dispositivo utilizando tecnologia de <strong>Edge Computing</strong> (Web Workers e PDF.js).
            </p>
            <div className="space-y-3 pt-2 text-xs">
              <div className="flex items-center gap-2 text-foreground font-semibold">
                <span className="material-symbols-outlined text-[18px] text-success">security</span>
                Seus arquivos não saem da sua máquina
              </div>
              <div className="flex items-center gap-2 text-foreground font-semibold">
                <span className="material-symbols-outlined text-[18px] text-success">bolt</span>
                Processamento instantâneo sem uploads
              </div>
              <div className="flex items-center gap-2 text-foreground font-semibold">
                <span className="material-symbols-outlined text-[18px] text-success">wifi_off</span>
                Zero latência e consumo de banda de internet
              </div>
            </div>
          </div>

          <div className="bg-surface border border-surface-border p-6 rounded-2xl shadow-sm space-y-4">
            <h4 className="font-bold text-sm uppercase tracking-wider text-muted-foreground border-b border-surface-border pb-2">Requisitos Mínimos</h4>
            <ul className="text-xs space-y-2 text-muted-foreground">
              <li className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-primary">check_circle</span>
                Navegador atualizado (Chrome, Edge ou Firefox)
              </li>
              <li className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-primary">check_circle</span>
                Resolução de tela adequada para gráficos
              </li>
              <li className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-primary">check_circle</span>
                Mínimo de 4GB de memória RAM no dispositivo
              </li>
            </ul>
          </div>
          
        </div>

      </div>
    </div>
  );
}
