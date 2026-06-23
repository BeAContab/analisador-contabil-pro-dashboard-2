import type { VercelRequest, VercelResponse } from '@vercel/node';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { db, initializeDatabase } from '../utils/db';

/**
 * Função para derivar uma senha determinística segura para o usuário
 * utilizando HMAC SHA256 com o e-mail e o segredo de seed.
 */
function deriveUserPassword(email: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(email.toLowerCase().trim()).digest('hex').slice(0, 12);
}

/**
 * Lista de usuários vitalícios extraídos de acessos.xlsx.
 * Estes usuários recebem 9999 dias de acesso a partir da data de cadastro.
 * As senhas foram removidas deste código para segurança e serão geradas via HMAC.
 */
const LIFETIME_USERS = [
  { nome: 'Atyla',      email: 'atyla@bacontabil.com.br' },
  { nome: 'Benedito',   email: 'benedito@bacontabil.com.br' },
  { nome: 'Enderson',   email: 'enderson@bacontabil.com.br' },
  { nome: 'Gabriel',    email: 'gabriel@bacontabil.com.br' },
  { nome: 'Gleison',    email: 'gleison@bacontabil.com.br' },
  { nome: 'Hermerson',  email: 'hermerson@bacontabil.com.br' },
  { nome: 'Italo',      email: 'italo@bacontabil.com.br' },
  { nome: 'Junior',     email: 'junior@bacontabil.com.br' },
  { nome: 'Kaio',       email: 'kaio@bacontabil.com.br' },
  { nome: 'Kelly',      email: 'kelly@bacontabil.com.br' },
  { nome: 'Leticia',    email: 'leticia@bacontabil.com.br' },
  { nome: 'Lucas',      email: 'lucas@bacontabil.com.br' },
  { nome: 'Mayrla',     email: 'mayrla@bacontabil.com.br' },
  { nome: 'Ricardo',    email: 'ricardo@bacontabil.com.br' },
  { nome: 'Rondinelle', email: 'rondinelle@bacontabil.com.br' },
  { nome: 'Rose',       email: 'rose@bacontabil.com.br' },
  { nome: 'Taiuan',     email: 'taiuan@bacontabil.com.br' },
  { nome: 'Yuri',       email: 'yuri@bacontabil.com.br' },
  { nome: 'Yury',       email: 'yury@bacontabil.com.br' },
  { nome: 'Regis',      email: 'regis@bacontabil.com.br' },
  { nome: 'Thais',      email: 'thais@bacontabil.com.br' },
  { nome: 'Adriano',    email: 'adriano@bacontabil.com.br' },
];

/**
 * Rota de seed do banco de dados.
 * Inicializa as tabelas e insere os usuários vitalícios.
 * ATENÇÃO: Esta rota deve ser protegida ou removida após a primeira execução.
 * Utilize a variável de ambiente SEED_SECRET para proteger o acesso.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  // Proteção simples via secret para evitar execução não autorizada
  const secret = req.headers['x-seed-secret'];
  if (!process.env.SEED_SECRET || secret !== process.env.SEED_SECRET) {
    return res.status(403).json({ error: 'Acesso negado.' });
  }

  try {
    await initializeDatabase();

    const now = Math.floor(Date.now() / 1000);
    const DAY_IN_SECONDS = 86400;
    // 9999 dias de acesso a partir de hoje
    const expiresAt = now + 9999 * DAY_IN_SECONDS;

    const results = [];

    for (const user of LIFETIME_USERS) {
      try {
        // Verifica se o usuário já existe para evitar duplicação
        const existing = await db.execute({
          sql: 'SELECT id FROM users WHERE email = ?',
          args: [user.email],
        });

        if (existing.rows.length > 0) {
          results.push({ email: user.email, status: 'já existia - ignorado' });
          continue;
        }

        // Deriva a senha determinística para o usuário vitalício
        const generatedPassword = deriveUserPassword(user.email, process.env.SEED_SECRET!);
        // Gera hash seguro da senha com bcrypt
        const passwordHash = await bcrypt.hash(generatedPassword, 12);

        await db.execute({
          sql: `INSERT INTO users (id, name, email, password_hash, plan_type, subscription_status, expires_at, created_at)
                VALUES (?, ?, ?, ?, 'lifetime', 'active', ?, ?)`,
          args: [uuidv4(), user.nome, user.email, passwordHash, expiresAt, now],
        });

        results.push({ email: user.email, status: 'inserido com sucesso' });
      } catch (userError) {
        results.push({ email: user.email, status: `erro: ${userError}` });
      }
    }

    return res.status(200).json({
      message: `Seed concluído. ${results.filter(r => r.status === 'inserido com sucesso').length} usuários inseridos.`,
      details: results,
    });
  } catch (error) {
    console.error('[seed] Erro:', error);
    return res.status(500).json({ error: 'Erro ao executar seed do banco de dados.' });
  }
}
