# Analisador Contabil Pro - Dashboard v2

Aplicacao web para analise automatizada de balancetes contabeis em PDF, com relatorios de ocorrencias, exportacao em Excel/PDF e assistente de IA integrado.

## Funcionalidades

- Upload drag and drop de multiplos PDFs de balancetes.
- Analise automatizada de saldos invertidos, contas sem movimentacao, CMV x Receita e outras regras contabeis.
- Resumo executivo com cards de status, relatorios afetados e total de ocorrencias.
- Drill-down por empresa com tabelas ordenaveis e paginadas.
- Tema claro/escuro com persistencia em `localStorage`.
- Assistente de IA com Gemini ou modo local.
- Exportacao de relatorios em PDF e Excel.
- Processamento dos PDFs no navegador do usuario.

## Stack Tecnologica

| Tecnologia | Uso |
|---|---|
| React 18 | Interface web |
| Vite 6 | Build, desenvolvimento local e deploy Vercel |
| TypeScript 5.7 | Tipagem da aplicacao |
| Tailwind CSS 3.4 | Estilos e tokens visuais |
| pdf.js | Leitura dos PDFs no navegador |
| jsPDF | Exportacao de relatorios em PDF |
| SheetJS (`xlsx`) | Exportacao de dados em Excel |

## Como Executar

```bash
npm install
npm run dev
```

O app fica disponivel em `http://localhost:5173/`.

Para validar o build de producao usado pela Vercel:

```bash
npm run build
npm run preview
```

## Deploy Vercel

O projeto usa somente React + Vite para deploy.

Config atual em `vercel.json`:

- Framework: `vite`
- Build command: `npm run build`
- Output directory: `dist`

## Variaveis de Ambiente

Crie um arquivo `.env.local` na raiz do projeto com base em `.env.example`:

```env
VITE_GEMINI_API_KEY=cole_sua_chave_aqui
```

A chave do Gemini e opcional. Se o usuario informar a chave no assistente, ela fica salva no `localStorage` do navegador daquele usuario e sera reaproveitada em acessos futuros no mesmo perfil do navegador.

## Estrutura do Projeto

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

## Licenca

Projeto privado. Todos os direitos reservados.
