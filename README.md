# 📊 Analisador Contábil Pro

**Transforme balancetes em PDF em insights contábeis em segundos — direto no navegador, sem enviar dados para nenhum servidor.**

Chega de conferir balancetes linha por linha. O Analisador Contábil Pro faz upload em lote dos seus PDFs, aplica automaticamente as principais regras de consistência contábil e devolve um relatório executivo pronto para o cliente, com exportação em Excel e PDF.

---

## ✨ Por que usar

- ⚡ **Rápido** — analise dezenas de balancetes de uma vez, com processamento local no navegador (nenhum arquivo sobe para servidores externos).
- 🔍 **Preciso** — detecta saldos invertidos, contas sem movimentação, inconsistências entre CMV e Receita e outras regras contábeis relevantes.
- 📈 **Visual** — resumo executivo com cards de status, contagem de ocorrências e drill-down por empresa.
- 🤖 **Inteligente** — assistente de IA (Gemini) integrado para tirar dúvidas sobre os achados, com fallback em modo local.
- 📤 **Pronto para entrega** — exporte relatórios formatados em PDF e Excel com um clique.
- 🌓 **Confortável** — tema claro/escuro com preferência salva automaticamente.
- 🔒 **Privado por padrão** — os PDFs são processados no navegador do usuário; nada é enviado para nossos servidores.

---

## 🖥️ Funcionalidades

| Recurso | Descrição |
|---|---|
| 📁 Upload em lote | Drag and drop de múltiplos PDFs de balancetes de uma só vez |
| ✅ Análise automatizada | Saldos invertidos, contas sem movimentação, CMV x Receita e outras regras contábeis |
| 📋 Resumo executivo | Cards de status, relatórios afetados e total de ocorrências |
| 🏢 Drill-down por empresa | Tabelas ordenáveis e paginadas para cada empresa analisada |
| 🎨 Tema claro/escuro | Persistência automática via `localStorage` |
| 💬 Assistente de IA | Integração com Gemini ou modo local, sem dependência obrigatória de API |
| 📑 Exportação | Relatórios em PDF (jsPDF) e Excel (SheetJS) |
| 🛡️ Processamento local | Os PDFs nunca saem do navegador do usuário |

---

## 🛠️ Stack Tecnológica

| Tecnologia | Uso |
|---|---|
| ⚛️ React 18 | Interface web |
| ⚡ Vite 6 | Build, desenvolvimento local e deploy Vercel |
| 🔷 TypeScript 5.7 | Tipagem da aplicação |
| 🎨 Tailwind CSS 3.4 | Estilos e tokens visuais |
| 📄 pdf.js | Leitura dos PDFs no navegador |
| 🧾 jsPDF | Exportação de relatórios em PDF |
| 📊 SheetJS (`xlsx`) | Exportação de dados em Excel |

---

## 🚀 Como Executar

```bash
npm install
npm run dev
```

O app fica disponível em `http://localhost:5173/`.

Para validar o build de produção usado pela Vercel:

```bash
npm run build
npm run preview
```

---

## ☁️ Deploy Vercel

O projeto usa somente React + Vite para deploy.

Config atual em `vercel.json`:

- Framework: `vite`
- Build command: `npm run build`
- Output directory: `dist`

---

## 🔑 Variáveis de Ambiente

Crie um arquivo `.env.local` na raiz do projeto com base em `.env.example`:

```env
VITE_GEMINI_API_KEY=cole_sua_chave_aqui
```

A chave do Gemini é opcional. Se o usuário informar a chave no assistente, ela fica salva no `localStorage` do navegador daquele usuário e será reaproveitada em acessos futuros no mesmo perfil do navegador.

---

## 📂 Estrutura do Projeto

```text
src/
  components/       Componentes React
  hooks/            Hooks da aplicacao
  utils/            Parsing, analises, exportacoes e integracao Gemini
  types.ts          Tipos TypeScript compartilhados
  styles.css        Design system e estilos globais
  App.tsx           Componente raiz
index.html          Entrada HTML
vercel.json         Configuracao de deploy Vercel
vite.config.ts      Configuracao do Vite
package.json        Scripts e dependencias Node.js
```

---

## 📜 Licença

Projeto privado. Todos os direitos reservados.
