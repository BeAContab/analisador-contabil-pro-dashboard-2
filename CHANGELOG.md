# Changelog

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

