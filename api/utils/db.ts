import { createClient } from '@libsql/client';

/**
 * Cria e exporta o cliente de conexão com o banco de dados Turso.
 * As credenciais são lidas das variáveis de ambiente para segurança.
 */
export const db = createClient({
  url: process.env.TURSO_CONNECTION_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

/**
 * Inicializa as tabelas do banco de dados caso ainda não existam.
 * Deve ser chamada na primeira execução ou via rota de seed.
 */
export async function initializeDatabase() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      email       TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      stripe_customer_id      TEXT,
      stripe_subscription_id  TEXT,
      plan_type               TEXT DEFAULT NULL,
      subscription_status     TEXT DEFAULT 'inactive',
      expires_at              INTEGER DEFAULT NULL,
      created_at              INTEGER NOT NULL
    )
  `);
}
