# Plano de Implementação Faseado — Analisador Contábil Pro Dashboard

> **Status:** Fases 1, 2, 3 e 4 concluídas na branch `fase-1-seguranca-privacidade`. Fases 5 e 6 pendentes.

## Contexto

Varredura completa do projeto em busca de melhorias, bugs e erros, organizada em fases de desenvolvimento, com indicação do modelo de IA mais adequado e o nível de esforço **por fase**.

Uma auditoria com 3 agentes de exploração em paralelo (motor de parsing/relatórios, chatbot/Gemini/componentes de UI, configuração de build/design tokens) levantou achados concretos e confirmados no código da branch `main`. Destaque crítico: `gemini.ts` envia CNPJ, nomes de empresas e saldos ao Gemini quando o chat de IA é usado, o que **contradiz diretamente** as alegações de "processamento 100% local" em `PrivacyPolicy.tsx` e `DataSecurity.tsx` — esse é o achado de maior severidade e deve ser resolvido primeiro.

Não há suíte de testes, lint ou CI hoje (`npm run build` = `tsc` + `vite build` é o único gate) — isso amplia o risco de qualquer mudança e é endereçado na Fase 5.

**Critério de faseamento:** (1) segurança/confiança do usuário → (2) risco de corrupção de dados contábeis → (3) visibilidade/UX (estilos quebrados) → (4) acessibilidade → (5) infraestrutura de longo prazo.

---

## Fase 1 — Segurança e contradições de marketing ✅ CONCLUÍDA

> Aplicada na branch `fase-1-seguranca-privacidade` (commit `5f4bec4`). Extra não previsto: `buildLocalPromptForGemini` embrulhava um prompt já montado, enviando o resumo do balancete duas vezes por requisição — corrigido. `npm audit`: 7 → 3 vulnerabilidades (as 3 restantes viraram a Fase 6A).


**Modelo recomendado: Opus 5 · Esforço: Alto (~3-4 dias)**
Justificativa: a fase mescla decisões legais/de produto (o que revelar sobre o envio de dados ao Gemini, LGPD), uma possível mudança arquitetural (proxy de backend para a API key) e uma decisão de supply-chain (dependência vulnerável) — nenhum item é mecânico, e o custo de errar aqui é reputacional/legal. Mesmo os subitens mais simples (1.2, 1.4) devem ficar sob a mesma revisão de alto nível para garantir coerência com a decisão tomada em 1.1.

Itens:
- **1.1** Alinhar a alegação de "processamento 100% local" com o uso real do Gemini — `PrivacyPolicy.tsx:20`, `DataSecurity.tsx:16`, `LocalProcessingDoc.tsx`, `gemini.ts:168-263` (`summarizeReportsForPrompt`). Atualizar textos legais com opt-in claro e/ou mascarar CNPJ/nomes antes do envio.
- **1.2** Expiração/consentimento explícito para a API key do Gemini em `localStorage` — `gemini.ts:29-40` (`storeGeminiApiKey`).
- **1.3** Auditar embedding de `VITE_GEMINI_API_KEY` em build-time no bundle público — `gemini.ts:13,26`.
- **1.4** `AbortController`/cleanup no unmount para chamadas Gemini — `gemini.ts` (`requestGemini`), `ChatbotFab.tsx:96-146` (`sendMessage`).
- **1.5** Mitigar `xlsx@^0.18.5` (advisory GHSA-4r6h-8v6p-xvw6) — `package.json:18`.

---

## Fase 2 — Bugs funcionais que afetam a corretude dos dados contábeis ✅ CONCLUÍDA

> Aplicada na branch `fase-1-seguranca-privacidade` (commit `93772d8`), exceto 2.8b (Web Worker → Fase 6B).
> **Achado crítico:** o sanity check de 2.1 revelou corrupção de valores pré-existente — o CPF colava no saldo porque o `pdf.js` reporta `width` invadindo a coluna seguinte (gap negativo). Um saldo de R$ 1.530,00 aparecia como R$ 451.530,00. Corrigido na origem, em `groupItemsIntoLines`.
> Validado nos 14 balancetes de `arquivos_de_exemplo/`: 10.329 linhas antes e depois, inconsistências **72 → 0**, não classificadas (2.233) e saldos invertidos (706) inalterados.


**Modelo recomendado: Opus 5 · Esforço: Alto (~1 semana)**
Justificativa: a fase mistura correções mecânicas triviais (2.2-2.5, 2.9-2.10, 2.12) com decisões de semântica contábil genuinamente ambíguas (2.6 dedup de contas, 2.7 heurística de merge, 2.8b Web Worker) que exigem casos reais de PDF e julgamento sobre o que é "correto" para o negócio. Como qualquer erro aqui produz números errados para o contador/usuário final — o risco mais alto do projeto — a fase inteira deve ser conduzida com o modelo de maior capacidade de raciocínio, mesmo que parte do trabalho seja simples.

Itens:
- **2.1** Sanity check dos 4 valores monetários extraídos (previous+debit-credit ≈ current) — `parser.ts:251-263`.
- **2.2** Corrigir detecção de sinal negativo truncado — `format.ts:27`.
- **2.3** Guard de concorrência em `processFiles` — `useFileProcessing.ts:65-92`.
- **2.4** Cleanup do `setTimeout` — `useFileProcessing.ts:86-90`.
- **2.5** Logar o erro original no catch silencioso do parser — `parser.ts:108-124`.
- **2.6** Deduplicação de account codes duplicados entre páginas — `parser.ts` (`findAccountRow`).
- **2.7** Corrigir falha silenciosa de `mergeContinuationLines` — `parser.ts:220`.
- **2.8** `groupItemsIntoLines` O(n²) + travamento de thread — `parser.ts` (otimização de algoritmo + yielding). A migração para Web Worker (2.8b) foi **movida para a Fase 6B**, por ser mudança arquitetural.
- **2.9** Reset de `currentPage` em `DataTable.tsx` ao trocar de rows/kind.
- **2.10** `ProcessingOverlay` não aparece quando `processingIndex === 0` — `App.tsx:148`.
- **2.11** Consolidar lógica duplicada de "occurrence counting" (4 lugares) — `chatbot.ts`, `gemini.ts`, `App.tsx:166-203`, `ChatbotFab.tsx:44-62`.
- **2.12** Deduplicar `signedCurrentBalance`/`absoluteCurrentBalance`/`absoluteValue` — `parser.ts:825`, `reports.ts:575-579`.

---

## Fase 3 — Estilos Tailwind quebrados ✅ CONCLUÍDA

> Aplicada na branch `fase-1-seguranca-privacidade`. Decisão em 3.1: manter os dois sistemas (não migrar tudo para o novo), mas fechar 100% da cobertura — só `text-secondary` e os 3 pares `*-container`/`on-*-container` estavam de fato quebrados (as classes `surface-container-*` já resolviam corretamente). `text-secondary` virou alias de `var(--muted-foreground)`; os pares container ganharam 3 novos tokens de CSS (`--primary-container`, `--secondary-container`, `--tertiary-container` + seus `on-*`) com valores distintos em teal/sky/amber para diferenciar visualmente os 4 badges de ícone. Validado em light e dark mode via computed styles e screenshot nas 3 páginas afetadas.

**Modelo recomendado: Sonnet 5 · Esforço: Médio (~1-2 dias)**
Justificativa: é essencialmente um trabalho de design system — decidir a direção dos tokens e mapear classes ausentes exige julgamento de contraste/dark mode, mas dentro de um escopo bem definido pela auditoria (lista exata de classes e arquivos afetados), sem ambiguidade de negócio ou risco de segurança. Complexidade média o suficiente para não ser puramente mecânico.

Itens:
- **3.1** Consolidar os dois sistemas de design tokens (novo `background/foreground/primary/surface/accent` vs. legado `surface-container-*`/`on-surface*`) — `tailwind.config.js`.
- **3.2** Adicionar ao `tailwind.config.js` as classes ausentes usadas em produção (`text-secondary`, `bg-primary-container`, `bg-tertiary-container`, `bg-surface-container-lowest/low/highest`, etc.) que hoje compilam para no-ops.
- **3.3** Revisão visual final dos componentes afetados: `Navbar.tsx`, `Footer.tsx`, `ProcessingOverlay.tsx`, `LocalProcessingDoc.tsx`, `DataSecurity.tsx` (light + dark mode).

---

## Fase 4 — Acessibilidade ✅ CONCLUÍDA

> Aplicada na branch `fase-1-seguranca-privacidade`. Hook compartilhado `src/hooks/useFocusTrap.ts` criado e reaproveitado entre `ChatbotFab` e `ProcessingOverlay`, como previsto. Testado via automação no navegador: Tab/Shift+Tab fazem loop dentro do drawer (6 elementos focáveis), Escape fecha e devolve o foco ao FAB, `Enter`/`Space` ativam o `CompanyOverviewCard`, `aria-sort` alterna `ascending`/`descending` ao clicar no header, skip-link funcional, e o limite de 40MB por arquivo bloqueia upload com mensagem clara (testado com arquivo sintético de 41MB).

**Modelo recomendado: Sonnet 5 · Esforço: Médio (~1-2 dias)**
Justificativa: a maioria dos itens é aplicação de atributos ARIA padrão (mecânico), mas dois itens (drawer do chatbot e overlay de processamento) exigem implementar focus trap e gestão de foco reais, que precisam de teste manual de teclado e não são apenas "adicionar um atributo" — isso eleva a fase inteira de Haiku para Sonnet, para manter consistência de padrão entre os componentes reutilizáveis (o hook de focus trap criado em 4.1 deve ser reaproveitado em 4.6).

Itens:
- **4.1** `ChatbotFab.tsx`: `role="dialog"`, `aria-modal`, focus trap, Escape handler, `aria-live` nas mensagens/loading.
- **4.2** `CompanyOverviewCard.tsx`: card clicável acessível por teclado (`role="button"`, `tabIndex`, `onKeyDown`).
- **4.3** `Sidebar.tsx`: `aria-current="page"`, `aria-pressed` no toggle, skip-link/landmark.
- **4.4** `DataTable.tsx`: `aria-sort` nos headers ordenáveis.
- **4.5** `Dropzone.tsx`: operabilidade via teclado + limite de tamanho/quantidade de arquivo antes do parsing.
- **4.6** `ProcessingOverlay.tsx`: `role="dialog"`, `aria-modal`, focus trap (reaproveitando o hook de 4.1).

---

## Fase 5 — Build/config e qualidade de longo prazo

**Modelo recomendado: Sonnet 5 · Esforço: Alto (~1 semana)**
Justificativa: a maior parte é configuração de tooling com boas práticas conhecidas (lint, chunks, meta tags — mecânico), mas dois itens pesam a fase para "Alto": desenhar a estratégia de testes para lógica contábil com histórico de bugs sutis (5.2) e a migração de shape de tipo de `DepreciationPairRow` (5.8), que tem risco real de regressão espalhada. Recomenda-se Sonnet 5 para a execução do grosso da fase, com escalonamento pontual a Opus 5 especificamente nos itens 5.2 (estratégia de casos de teste) e 5.8 (migração de tipo) se a complexidade se confirmar maior que o esperado durante a execução.

Itens:
- **5.1** ESLint + Prettier + scripts de lint/typecheck no `package.json`.
- **5.2** Vitest + testes iniciais para lógica crítica (`parser.ts`, `format.ts`, `reports.ts`), cobrindo os bugs corrigidos na Fase 2 como regressão.
- **5.3** `manualChunks` no `vite.config.ts` para `xlsx`, `jspdf`, `jspdf-autotable`.
- **5.4** `build.sourcemap` + compressão gzip/brotli.
- **5.5** Reforçar `tsconfig.json` (`noUncheckedIndexedAccess`, `noImplicitOverride`, `exactOptionalPropertyTypes`).
- **5.6** SEO/meta básico + remover import duplicado de Google Fonts — `index.html`, `styles.css`.
- **5.7** Substituir cast unsafe `as InvertedBalanceRow | undefined` por type guard — `reports.ts:138,141`.
- **5.8** Migrar `DepreciationPairRow` de strings formatadas para números — `types.ts:96-104`.

---

## Fase 6 — Dívidas arquiteturais deixadas para trás (jspdf + Web Worker)

**Modelo recomendado: Opus 5 · Esforço: Alto (~3-5 dias)**
Justificativa: reúne os dois itens que foram deliberadamente adiados durante as Fases 1 e 2 por serem mudanças arquiteturais, não correções pontuais. Ambos tocam funcionalidade central (exportação de PDF e o motor de parsing), ambos têm alto risco de regressão silenciosa, e ambos ficam muito mais seguros depois que a suíte de testes da Fase 5 existir. Deve rodar **depois da Fase 5**.

### 6A — Upgrade major da cadeia jspdf (dívida de segurança)

Contexto: após a Fase 1, `npm audit` saiu de 7 para 3 vulnerabilidades. As 3 restantes (`jspdf`, `jspdf-autotable`, `dompurify`) exigem upgrade de major (`jspdf` v2.5 → v4.2), que não foi feito na Fase 1 porque mexe na exportação de PDF sem rede de testes. A API do `jspdf-autotable` mudou entre as majors, e `reports.ts` depende de detalhes internos frágeis (o cast de `lastAutoTable` em `getFinalY`, heurísticas de quebra de página com números mágicos).

- **6.1** Avaliar o diff de API entre `jspdf` v2.5 → v4.2 e `jspdf-autotable` v3.8 → v5.x, mapeando cada ponto de uso em `src/utils/reports.ts` (`downloadPdf`, `addPdfSection`, `getFinalY`, `jsPdfInstance`).
- **6.2** Migrar as chamadas e remover o cast unsafe de `lastAutoTable` (`reports.ts`, `getFinalY`) se a nova versão expuser tipos oficiais — resolve também parte do item 5.7.
- **6.3** Revisar as heurísticas de quebra de página (`startY > pageHeight - 120`) contra o novo comportamento de layout do autotable.
- **6.4** Validação de regressão: gerar PDFs dos balancetes de `arquivos_de_exemplo/` antes e depois da migração e comparar seção a seção (tabelas, quebras de página, cabeçalhos, análises com listas longas).
- **6.5** Confirmar `npm audit` limpo e atualizar `manualChunks` no `vite.config.ts` caso o tamanho/nome dos bundles do jspdf mude (interage com o item 5.3).

Alternativa a considerar em 6.1 caso a migração se mostre inviável: substituir `jspdf`+`jspdf-autotable` por outra biblioteca, ou isolar a exportação de forma que entrada não confiável nunca alcance os métodos vulneráveis (`addJS`, AcroForm, parsing de GIF). Vale notar que o app hoje **não** usa nenhum desses caminhos, então a exposição real é baixa e a urgência é menor que a severidade nominal sugere.

### 6B — Mover o parsing de PDF para Web Worker (item 2.8b adiado)

Contexto: a Fase 2 entregou a parte algorítmica do item 2.8 — `groupItemsIntoLines` deixou de ser O(n²) e o loop de páginas passou a devolver a thread ao navegador entre páginas (`yieldToBrowser`). Isso resolveu o travamento observável, mas o parsing continua rodando na thread principal: um balancete muito grande ainda pode causar jank, e a UI fica refém do tempo de CPU do arquivo.

- **6.6** Extrair o pipeline de `parsePdfFile` para um Web Worker dedicado, mantendo `pdf.js` dentro do worker (hoje ele já usa worker próprio só para decodificar o PDF, mas o agrupamento de linhas e todas as análises rodam na main thread).
- **6.7** Definir o contrato de mensagens worker↔main preservando o formato de `CompanyReport` (`types.ts` continua sendo o contrato) e o progresso por arquivo consumido por `useFileProcessing`.
- **6.8** Suportar cancelamento: hoje `processFiles` não tem como abortar um arquivo em andamento — o worker torna isso viável e complementa o guard de reentrada adicionado em 2.3.
- **6.9** Ajustar `manualChunks` no `vite.config.ts` para o novo bundle do worker e confirmar que o `yieldToBrowser` entre páginas pode ser removido depois da migração (deixa de ser necessário fora da main thread).
- **6.10** Validar com os 14 balancetes de `arquivos_de_exemplo/`: contagem de linhas, inconsistências (`balanceMismatch` deve seguir em **0**), não classificadas e saldos invertidos precisam bater exatamente com os números pré-migração.

---

## Resumo por fase

| Fase | Modelo | Esforço | Tempo estimado |
|---|---|---|---|
| 1 — Segurança e marketing | Opus 5 | Alto | 3-4 dias |
| 2 — Corretude de dados | Opus 5 | Alto | ~1 semana |
| 3 — Estilos Tailwind | Sonnet 5 | Médio | 1-2 dias |
| 4 — Acessibilidade | Sonnet 5 | Médio | 1-2 dias |
| 5 — Build/tooling | Sonnet 5 | Alto | ~1 semana |
| 6 — Dívidas arquiteturais (jspdf + Web Worker) | Opus 5 | Alto | 3-5 dias |

## Ordem de execução recomendada

1. **Fase 1** completa — prioridade máxima (implicação legal/de confiança).
2. **Fase 2** completa — corretude de dados antes de qualquer polimento visual.
3. **Fase 3** — 3.1 antes de 3.2/3.3 (define a direção do design system).
4. **Fase 4** — pode rodar em paralelo com a Fase 3 nos componentes que não se sobrepõem.
5. **Fase 5** — priorizar 5.1/5.2 (lint + testes) o quanto antes, pois reduzem o risco de regressão em qualquer trabalho futuro.
6. **Fase 6** — obrigatoriamente depois da Fase 5: tanto a migração do jspdf (6A) quanto a do Web Worker (6B) só são seguras com os testes de `reports.ts` e `parser.ts` já no lugar. 6A e 6B são independentes entre si e podem rodar em paralelo.

## Verificação

Como não há suíte de testes hoje, a verificação de cada fase deve ser manual até que a Fase 5 (5.1/5.2) esteja implementada:
- **Fase 1:** revisar textos legais atualizados; inspecionar Network tab do navegador para confirmar payload enviado ao Gemini após a mitigação (1.1); confirmar expiração da key no DevTools > Application > Local Storage (1.2).
- **Fase 2:** rodar `npm run build` (gate de tipo existente); testar manualmente com PDFs reais de balancetes (incluindo casos multi-página e valores negativos) para validar os fixes do parser.
- **Fase 3:** `npm run dev`, navegar pelas páginas afetadas em light e dark mode, conferir contraste visual.
- **Fase 4:** navegação 100% por teclado (Tab/Shift+Tab/Enter/Escape) nas telas afetadas; testar com leitor de tela (NVDA/VoiceOver) nos pontos críticos (drawer do chat, cards clicáveis).
- **Fase 5:** `npm run lint`, `npm run typecheck`, `npm run test` (novos scripts) devem passar sem erros antes do merge de qualquer PR subsequente.
