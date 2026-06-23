# Analisador Contábil Pro - SaaS v2

Aplicação web para análise automatizada de balancetes contábeis em PDF, com relatórios de ocorrências, exportação em Excel/PDF e assistente de IA integrado. Transformada em uma plataforma SaaS completa com assinaturas recorrentes via Stripe.

## Funcionalidades

- **Autenticação Segura**: Login e Cadastro com senhas criptografadas (Bcrypt) e controle de sessão HTTP-Only via JWT.
- **Paywall e Assinaturas (Stripe)**: Sistema de cobrança com planos Mensal, Trimestral e Anual. Redirecionamento automático e bloqueio de usuários inativos.
- **Integração Vercel API Serverless**: Rotas de back-end dedicadas para gerenciamento de contas, webhooks e verificação de sessão (`/api/auth`, `/api/stripe`, `/api/db`).
- **Banco de Dados em Nuvem (Turso/SQLite)**: Armazenamento persistente de usuários, chaves de clientes Stripe e status de assinaturas usando LibSQL na Edge.
- **Processamento 100% no Cliente**: Upload drag and drop de múltiplos PDFs de balancetes sendo processados na máquina local para maior segurança.
- **Assistente de IA**: Chatbot inteligente configurável localmente.

## Stack Tecnológica

| Tecnologia | Uso |
|---|---|
| React 18 | Interface web de alta performance |
| Vite 6 | Build e desenvolvimento local rápido |
| Tailwind CSS 3.4 | Estilos dinâmicos e premium |
| Turso DB (LibSQL) | Banco de dados relacional distribuído na nuvem |
| Stripe | Gateway de pagamento para as assinaturas |
| JWT & Bcrypt | Segurança e controle de sessão |
| Vercel Serverless | Hospedagem das funções backend (Node.js) |

## Estrutura do Projeto

```text
api/
  auth/             Rotas Serverless de Login, Signup, Logout, Me
  db/               Scripts de Seed de banco
  stripe/           Rotas Checkout, Portal e Webhook
  utils/            Helpers de Banco de Dados e JWT
src/
  components/       Componentes de Interface (Landing Page, Sidebar, Cards)
  hooks/            Autenticação (useAuth)
  utils/            Parsing de PDFs e lógicas analíticas
  App.tsx           Gerenciamento de rotas e paywall
.env.local          Configurações sensíveis (Stripe, Turso, JWT)
```

## Configuração Local

1. Instale as dependências:
```bash
npm install
```

2. Crie um arquivo `.env.local` na raiz com base no `.env.example`:
```env
STRIPE_SECRET_KEY=sua_chave_secreta_stripe
VITE_STRIPE_PUBLISHABLE_KEY=sua_chave_publica_stripe
VITE_STRIPE_PRICE_MONTHLY=id_preco_mensal
VITE_STRIPE_PRICE_QUARTERLY=id_preco_trimestral
VITE_STRIPE_PRICE_ANNUAL=id_preco_anual
TURSO_CONNECTION_URL=sua_url_turso
TURSO_AUTH_TOKEN=seu_token_turso
JWT_SECRET=sua_senha_secreta_para_jwt
```

3. Execute o script de seed para criar as tabelas no Turso e inserir usuários vitálicios:
```bash
npx tsx --env-file=.env.local seed_local.ts
```

4. Inicie o servidor em modo de desenvolvimento (as funções `/api` não rodarão via `vite`, então para testar a API localmente utilize o `vercel dev`):
```bash
vercel dev
# ou
npm run dev
```

## Licença

Projeto privado. Todos os direitos reservados à Barreira & Associados.
