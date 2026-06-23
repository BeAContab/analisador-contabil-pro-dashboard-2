import type { VercelRequest, VercelResponse } from '@vercel/node';
import bcrypt from 'bcryptjs';
import { db } from '../utils/db';
import { signToken, buildSessionCookie } from '../utils/auth';

/**
 * Endpoint de autenticação de usuários.
 * Verifica as credenciais fornecidas e, em caso de sucesso,
 * emite um cookie de sessão JWT HTTP-only.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
    }

    // Busca o usuário pelo e-mail
    const result = await db.execute({
      sql: 'SELECT id, name, email, password_hash, plan_type, subscription_status, expires_at FROM users WHERE email = ?',
      args: [email.toLowerCase().trim()],
    });

    if (result.rows.length === 0) {
      // Mensagem genérica para não revelar se o e-mail existe ou não (segurança)
      return res.status(401).json({ error: 'E-mail ou senha inválidos.' });
    }

    const user = result.rows[0];

    // Verifica se a senha fornecida corresponde ao hash armazenado
    const passwordMatch = await bcrypt.compare(password, user.password_hash as string);

    if (!passwordMatch) {
      return res.status(401).json({ error: 'E-mail ou senha inválidos.' });
    }

    // Gera o token JWT e define o cookie de sessão HTTP-only
    const token = signToken({ userId: user.id as string, email: user.email as string });
    res.setHeader('Set-Cookie', buildSessionCookie(token));

    return res.status(200).json({
      id: user.id,
      name: user.name,
      email: user.email,
      plan_type: user.plan_type,
      subscription_status: user.subscription_status,
      expires_at: user.expires_at,
    });
  } catch (error) {
    console.error('[login] Erro:', error);
    return res.status(500).json({ error: 'Erro interno. Tente novamente.' });
  }
}
