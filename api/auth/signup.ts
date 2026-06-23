import type { VercelRequest, VercelResponse } from '@vercel/node';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { db, initializeDatabase } from '../utils/db';
import { signToken, buildSessionCookie } from '../utils/auth';

/**
 * Endpoint de cadastro de novos usuários.
 * Recebe nome, email e senha, valida, cria o hash seguro da senha
 * e persiste o usuário no banco Turso. Em seguida, faz o login automático.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Apenas requisições POST são aceitas
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  try {
    await initializeDatabase();

    const { name, email, password } = req.body;

    // Validação dos campos obrigatórios
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Nome, e-mail e senha são obrigatórios.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'A senha deve ter no mínimo 6 caracteres.' });
    }

    // Verifica se o e-mail já está cadastrado
    const existing = await db.execute({
      sql: 'SELECT id FROM users WHERE email = ?',
      args: [email.toLowerCase().trim()],
    });

    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Este e-mail já está cadastrado.' });
    }

    // Criptografa a senha com bcrypt (custo 12 = seguro e performático)
    const passwordHash = await bcrypt.hash(password, 12);

    const userId = uuidv4();
    const now = Math.floor(Date.now() / 1000);

    // Insere o novo usuário no banco de dados
    await db.execute({
      sql: `INSERT INTO users (id, name, email, password_hash, subscription_status, created_at)
            VALUES (?, ?, ?, ?, 'inactive', ?)`,
      args: [userId, name.trim(), email.toLowerCase().trim(), passwordHash, now],
    });

    // Gera token JWT e define o cookie de sessão
    const token = signToken({ userId, email: email.toLowerCase().trim() });
    res.setHeader('Set-Cookie', buildSessionCookie(token));

    return res.status(201).json({
      id: userId,
      name: name.trim(),
      email: email.toLowerCase().trim(),
      plan_type: null,
      subscription_status: 'inactive',
    });
  } catch (error) {
    console.error('[signup] Erro:', error);
    return res.status(500).json({ error: 'Erro interno. Tente novamente.' });
  }
}
