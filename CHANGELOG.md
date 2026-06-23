# Changelog

## 1.0.29 - 2026-06-23
### Adicionado
- Botão flutuante para alternância de tema Claro/Escuro na Landing Page com persistência no navegador.
- Instruções sobre compatibilidade de colunas com o sistema Athenas3000 no Dashboard.
- Aviso de exclusividade para Athenas3000 na Landing Page.
- Instruções passo a passo para configurar a chave de API da IA (Gemini) dentro do menu de Instruções do Dashboard.

### Corrigido
- Ajuste de contraste das cores no card de Score de Precisão de Conciliação no tema claro (branco no branco) e escuro (vermelho escuro no preto).

### Segurança (Security)
- **Stripe Webhook:** Desabilitado o `bodyParser` na Vercel e implementada leitura direta em buffer do body da requisição, resolvendo falhas de validação de assinatura (`stripe-signature`).
- **Cookies de Sessão (JWT):** Adicionada a flag `Secure` dinamicamente para os cookies emitidos em ambiente de produção.
- **Proteção de Credenciais:** Removidas as senhas hardcoded em texto puro dos scripts de seed (`api/db/seed.ts` e `seed_local.ts`), substituídas por derivação determinística `HMAC-SHA256` utilizando `SEED_SECRET`.
- **Gitignore:** Adicionados arquivos de credenciais de ambiente local (`acessos.xlsx`, `seed_local.ts`) para evitar commits acidentais.

## 1.0.28 - 2026-06-23
- Corrigido o contraste e a legibilidade do card de Score de Precisão da conciliação do resultado no arquivo `src/components/CompanyCard.tsx`. Substituição dos gradientes transparentes (que falhavam com variáveis hexadecimais do Tailwind) por fundos sólidos adequados para os modos claro e escuro.
- Renomeada a opção do menu na barra lateral de "Documentação" para "Instruções" no arquivo `src/components/Sidebar.tsx`.
- Reestruturada a página de documentação no arquivo `src/components/LocalProcessingDoc.tsx` para servir como guia de instruções, detalhando a compatibilidade obrigatória com o sistema Athenas3000 (com listagem das 7 colunas requeridas) e o tutorial passo a passo sobre como obter e configurar a chave de API do Gemini no Google AI Studio.
- Inseridas informações sobre a exclusividade de balancetes do sistema Athenas3000 na seção Hero da Landing Page (`src/components/LandingPage.tsx`).

## 1.0.27 - 2026-06-23
- Adicionada a exibição explícita do status de assinatura contábil ("ASSINATURA ATIVA" ou "ASSINATURA INATIVA") no dropdown do cabeçalho de perfil na Landing Page.
- Alterado o comportamento do botão "Ir para o Dashboard" no dropdown de perfil da Landing Page: direciona para o dashboard contábil se o usuário possuir plano ativo, ou fecha o menu e realiza scroll suave para a seção de planos e preços se a assinatura estiver inativa.

## 1.0.26 - 2026-06-23
- Corrigida a falha de controle de acesso (paywall) na função `handleAuthSuccess` do `src/App.tsx`, garantindo que usuários logados sem assinatura ativa sejam redirecionados corretamente para o paywall e não para a área principal do dashboard.
- Habilitado o redirecionamento correto em tempo de execução no cabeçalho da Landing Page ao clicar no botão "Ir para o Dashboard", roteando de forma condicional para a área principal (com assinatura) ou paywall (sem assinatura).
- Ajustado o logo do cabeçalho da Landing Page para funcionar como botão clicável que dá scroll suave para o topo da página.
- Removido o rótulo "Conta ativa" do menu suspenso de perfil para evitar ambiguidades com o status da assinatura do plano.

## 1.0.25 - 2026-06-23
- Criada a rota de API backend `/api/auth/update` para alteração segura de nome e senha com validação bcrypt e sessão JWT no banco Turso.
- Implementado menu de perfil (dropdown) animado no cabeçalho da Landing Page para usuários autenticados, fornecendo atalhos para dashboard, edição de nome, alteração de senha e logout.
- Corrigida exibição de links de "Entrar" e "Criar conta" no rodapé da Landing Page para usuários já logados.
- Adicionadas funcionalidades de "Editar Nome" e "Alterar Senha" com modais overlays flutuantes de forma consistente tanto na Landing Page quanto no painel de gerenciamento de conta (`AccountPanel`).

## 1.0.24 - 2026-06-23
- Habilitada a aplicação de códigos promocionais e cupons de desconto (`allow_promotion_codes: true`) no Stripe Checkout na rota `api/stripe/checkout.ts`.

## 1.0.23 - 2026-06-23
- Corrigida a parametrização dos identificadores do Stripe nos arquivos de configuração `.env`, `.env.local` e `.env.development.local`. Sincronização dos Price IDs correspondentes (`price_...`) para sanar falha no redirecionamento do checkout de assinaturas.

## 1.0.22 - 2026-06-22
- Otimização completa da terminologia contábil em todas as 15 regras de análise de balancete do sistema.
- Substituição de nomenclaturas de fórmulas matemáticas por termos técnicos da contabilidade brasileira em relatórios, títulos de abas e tabelas de exportação (ex: "Inversão de Saldo Contábil" em vez de "Saldos Invertidos", "Clientes com Saldo Devedor Residual" em vez de "Clientes com Saldo Residual", "Cruzamento de Clientes vs. Faturamento" em vez de "Conciliação Clientes x Receitas Operacionais").
- Atualização das introduções explicativas de relatórios, mensagens de sucesso, avisos de inconsistência e orientações de ações corretivas correspondentes nos arquivos `src/utils/reports.ts` e `src/utils/parser.ts`.
- Ajuste na base de conhecimento e lógica do assistente virtual (Chatbot) no arquivo `src/utils/chatbot.ts` para que responda e recomende análises utilizando a nova terminologia de negócios contábeis.

## 1.0.21 - 2026-05-29
- Removido o fluxo legado em Python/Streamlit, mantendo o projeto focado em React + Vite para deploy na Vercel.
- Assistente de IA passou a persistir a chave Gemini informada pelo usuario em `localStorage`, reaproveitando-a em acessos futuros no mesmo navegador.
- Documentacao atualizada para remover instrucoes de Streamlit e descrever a stack unica do frontend.

## 1.0.20 - 2026-05-22
- Botao `Limpar empresas carregadas` agora reinicia a sessao para estado inicial (home, sem empresas, sem chat e sem uploads), preservando apenas a chave de API salva.
- Sidebar foi separada em dois menus de relatorios: ocorrencias > 0 visiveis direto e ocorrencias = 0 ocultas por padrao, com botao para revelar/ocultar.

## 1.0.19 - 2026-05-22
- Relatorio `CMV x Receita Mercadorias` passou a exibir um card de destaque grande com o percentual, em visual de alta atencao.
- O card de percentual aparece tambem quando o relatorio nao esta em alerta, desde que o calculo esteja disponivel.

## 1.0.18 - 2026-05-22
- Exportacao Excel reestruturada para incluir metadados do cliente no topo (empresa, codigo, CNPJ, periodo, arquivo e data de geracao).
- Relatorios na aba unica passaram a ser organizados em blocos com titulo acima da tabela, sem coluna dedicada para nome do relatorio.
- Inseridas linhas em branco entre blocos de relatorio para melhorar leitura no Excel.
- Botao flutuante do assistente reposicionado para o centro inferior da tela.

## 1.0.17 - 2026-05-22
- Corrigidos textos com encoding quebrado na interface e no parser, evitando exibicoes como `PerÃƒÂ­odo nÃƒÂ£o`.
- Exportacao Excel reformulada para gerar uma unica aba (`Relatorios com Ocorrencia`) contendo somente relatorios que possuem ocorrencia.
- Assistente de IA ajustado para botao flutuante redondo no canto inferior direito.
- Quando nao houver chave Google/Gemini, o assistente exibe tutorial passo a passo para gerar chave no `aistudio.google.com`.
- Implementada persistencia local da chave API em `.streamlit/user_prefs.json` para reaproveitamento em acessos futuros.
- Validacao executada com todos os PDFs de `arquivos_de_exemplo`, mantendo `unclassified=0` e `worksheets=1` em todos os arquivos.

## 1.0.16 - 2026-05-22
- Parser ajustado para reduzir falsos positivos de `linhas nao classificadas` em todos os arquivos de `arquivos_de_exemplo`.
- Normalizacao de valores monetarios foi reforcada para tratar quebras como `0, 00` e `590 ,50`.
- Linhas de indice (conta/codigo sem nome e sem bloco completo de 4 valores) passaram a ser ignoradas no contador de nao classificadas.
- Validacao executada em todos os PDFs de exemplo com resultado final `unclassified=0` em todos.

## 1.0.15 - 2026-05-22
- Corrigido parsing do layout compacto do PDF `RC BARES E RESTAURANTES LTDA.pdf`, reconstruindo linhas quando o arquivo separa Conta/Cod.R./S. Anterior de Nome/Debito/Credito/S. Atual.
- Ajustado reconhecimento de valores monetarios para nao confundir trechos como contas bancarias terminadas em `-0` com dinheiro.
- Validado `RC BARES` com `1101` linhas parseadas, `0` linhas nao classificadas, analises executadas e Excel gerado com sucesso.

## 1.0.14 - 2026-05-22
- Sidebar foi transformada em menu navegavel, com item `Home`, relatorios clicaveis por empresa ativa e atalho proprio para exportacao.
- A pagina inicial passou a permanecer institucional mesmo apos o upload, enquanto os relatorios abriram em telas dedicadas por item do menu lateral.
- O corpo principal deixou de depender de abas para relatorios e passou a responder ao estado de navegacao selecionado na sidebar.

## 1.0.13 - 2026-05-22
- Sidebar passou a listar todos os relatorios com emoji e badge numerica por empresa ativa.
- Assistente de IA foi movido para um botao flutuante no canto inferior direito usando `st.popover`.
- Layout principal foi simplificado para remover a aba fixa do assistente e manter o foco em visao geral, ocorrencias e exportacao.

## 1.0.12 - 2026-05-22
- Corrigido `NameError` na exportacao Excel ao adicionar o import de `signed_current_balance` em `utils/reports.py`.
- Fluxo de inicializacao do Streamlit validado apos a correcao.

## 1.0.11 - 2026-05-22
- Reconstruido o `app.py` Streamlit apos corrupcao do arquivo principal, restaurando upload multiplo, processamento local de PDFs, resumo executivo, ocorrencias e exportacao consolidada em Excel.
- Corrigida a causa original do erro de execucao ao garantir que `parsed_nature_exempt` exista antes do primeiro uso no fluxo do dashboard.
- Reintegrado o assistente com Gemini no painel Streamlit e removida a referencia de licenca MIT do metadata raiz do projeto.

## 1.0.10 - 2026-05-22
- Adicionada a analise `Despesas Credoras na Classe 3`, validando contas da classe 3 com `S. Atual` credor fora dos grupos de excecao definidos.
- Mantidas como excecao as familias `3`, `3.1`, `3.1.02`, `3.1.03`, `3.1.06` e `3.9`, com seus respectivos filhos.
- Incluida acao corretiva especifica para orientar a revisao de classificacao e lancamentos das despesas credoras.

## 1.0.9 - 2026-05-22
- Refinada a analise `Depreciacao x Bens` com pareamento semantico entre bens e depreciacoes, cobrindo variacoes como `p/`, `Contr.` e `Expl.`.
- O relatorio passou a usar colunas especificas para bem e depreciacao/amortizacao/exaustao, em vez da tabela contabil generica.
- Exportacoes `XLSX` e `PDF` da analise `Depreciacao x Bens` agora seguem o layout pareado com acao corretiva por linha.

## 1.0.8 - 2026-05-22
- Adicionada a analise `Depreciacao x Bens`, comparando os valores numericos de `S. Atual` entre bens do grupo `IMOBILIZADO` e suas depreciacoes equivalentes.
- Excluido da validacao o grupo `IMOBILIZADO EM ANDAMENTO` e suas contas filhas.
- A analise agora sinaliza dois cenarios: depreciacao maior que o bem equivalente e depreciacao sem bem correspondente.

## 1.0.7 - 2026-05-22
- Ajustada a analise `CMV x Receita Mercadorias` para diferenciar o motivo de atencao: percentual acima de 100%, base incompleta (Cod. R. ausentes) ou receita total zerada.
- Atualizado o quadro de percentual para exibir mensagem coerente com o motivo real do alerta.
- Refinada a acao corretiva do relatorio para cobrir os tres cenarios de validacao.

## 1.0.6 - 2026-05-22
- Adicionada a analise `CMV x Receita Mercadorias` com a formula baseada no Cod. R. 3001 dividido pela soma dos creditos dos Cod. R. 2603, 2652 e 2700.
- Incluido quadro visual com o percentual `CMV/Receita` na interface quando o relatorio estiver ativo.
- Exportacoes `XLSX` e `PDF` passaram a respeitar itens de calculo em formato percentual.

## 1.0.5 - 2026-05-21
- Adicionada a coluna `Acao corretiva` nos relatorios exibidos em tela para orientar o contador sobre o proximo ajuste sugerido.
- Exportacoes `XLSX` e `PDF` atualizadas para incluir a mesma orientacao por tipo de relatorio.
- Padronizadas regras de orientacao corretiva para saldos invertidos, contas sem movimentacao, distribuicao x resultado e analises de clientes/fornecedores/estoques.

## 1.0.4 - 2026-05-21
- Migracao da configuracao de deploy para Vercel, com remocao da base fixa do GitHub Pages no Vite.
- Adicao de configuracao declarativa em `vercel.json` para build em `npm run build` com saida em `dist`.
- Remocao do workflow de deploy do GitHub Pages e ignorado do diretÃ³rio `.vercel/`.

## 1.0.3 - 2026-05-20
- Evolucao do agente Gemini para um perfil senior de analise de balancete, com priorizacao de risco, cautela tecnica e referencias normativas de alto nivel.
- Padronizacao do prompt do Gemini com checklist interno e formato obrigatorio de resposta: resumo executivo, achados priorizados, fundamentacao tecnica, limitacoes e proximos passos.
- Ajuste das mensagens de bootstrap e fallback para diferenciar melhor o modo local do modo Gemini.
- Refinamento da mensagem de boas-vindas do chatbot local para reforcar foco em risco, limitacoes e conferencia manual.

## 1.0.2 - 2026-05-20
- Refatoracao da exportacao de relatorios para imports dinamicos de `xlsx`, `jspdf` e `jspdf-autotable`.
- Ajuste de chunking no `vite.config.ts`, removendo agrupamento artificial de `reports`.
- Build validado sem warning de chunk acima de 500 kB.

## 1.0.1 - 2026-05-20
- Refatoracao do fluxo de upload/processamento para hook dedicado `useFileProcessing`.
- Simplificacao do `App.tsx` com separacao de responsabilidades.
- Correcao de textos de interface com acentuacao no `App.tsx`.
- Lazy loading para `PrivacyPolicy`, `DataSecurity`, `LocalProcessingDoc` e `ChatbotFab`.
- Otimizacao de build no Vite com `manualChunks` para `react`, `pdf` e `reports`.

