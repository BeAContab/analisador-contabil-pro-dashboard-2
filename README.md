# Analisador Contábil Pro — Dashboard v2

> Aplicação web para análise automatizada de balancetes contábeis em PDF, com relatórios de ocorrências, exportação em Excel/PDF e assistente de IA integrado.

---

## ✨ Features

- **Upload Drag & Drop** — Arraste múltiplos PDFs de balancetes para análise simultânea.
- **Análise Automatizada** — Detecção de saldos invertidos, contas sem movimentação, CMV × Receita e mais.
- **Bento Grid de Resumo** — Painel visual com cards de status geral, relatórios afetados e total de ocorrências.
- **Drill-down por Empresa** — Clique em uma empresa para ver detalhes completos com tabelas ordenáveis e paginadas.
- **Dark / Light Mode** — Alternância de tema com transições suaves e persistência em `localStorage`.
- **Chatbot com IA** — Drawer lateral integrado com suporte ao Gemini (API key) ou respostas locais.
- **Exportação** — Geração de relatórios em PDF (jsPDF) e planilhas Excel (SheetJS).
- **Processamento 100% Local** — Nenhum dado contábil sai do navegador do usuário.

---

## 🛠️ Stack Tecnológica

### Frontend (React + Vite)

| Tecnologia | Versão | Uso |
|---|---|---|
| React | 18.3 | UI reativa com componentes funcionais |
| Vite | 6.x | Bundler e dev server ultra-rápido |
| TypeScript | 5.7 | Tipagem estática |
| Tailwind CSS | 3.4 | Sistema de design com CSS variables |
| jsPDF | 2.5 | Exportação de relatórios em PDF |
| SheetJS (xlsx) | 0.18 | Exportação de dados em Excel |
| pdf.js | 4.10 | Parsing de PDFs no navegador |

### Backend (Python + Streamlit) — Opcional

| Tecnologia | Uso |
|---|---|
| Python 3.10+ | Runtime |
| Streamlit | Interface alternativa e API local |

---

## 🚀 Como Executar

### Frontend (principal)

```bash
# Instalar dependências
npm install

# Iniciar servidor de desenvolvimento
npm run dev

# Build de produção
npm run build

# Preview do build
npm run preview
```

O app estará disponível em `http://localhost:5173/`.

### Backend Streamlit (opcional)

```bash
# Criar e ativar ambiente virtual
python -m venv .venv

# Windows
.venv\Scripts\activate

# Linux/macOS
source .venv/bin/activate

# Instalar dependências
pip install -r requirements.txt

# Executar
streamlit run app.py
```

---

## 🔑 Variáveis de Ambiente

Crie um arquivo `.env.local` na raiz do projeto (veja `.env.example`):

```env
VITE_GEMINI_API_KEY=sua_chave_aqui
```

> A chave do Gemini é **opcional**. Sem ela, o chatbot funciona em modo local com respostas baseadas nos dados processados.

---

## 📁 Estrutura do Projeto

```
├── src/
│   ├── components/       # Componentes React (Sidebar, Dropzone, Cards, Chatbot, etc.)
│   ├── hooks/             # Custom hooks (useFileProcessing)
│   ├── types.ts           # Tipos TypeScript compartilhados
│   ├── styles.css         # Design system com CSS variables (Dark/Light)
│   └── App.tsx            # Componente raiz com layout de sidebar
├── utils/                 # Utilitários de parsing e análise
├── tailwind.config.js     # Configuração do Tailwind com tokens customizados
├── vite.config.ts         # Configuração do Vite
├── app.py                 # Backend Streamlit (opcional)
└── package.json
```

---

## 📜 Licença

Projeto privado — © BeAContab. Todos os direitos reservados.
