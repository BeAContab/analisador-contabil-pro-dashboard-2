import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../utils/db';
import { verifyToken, getCookie } from '../utils/auth';

/**
 * Endpoint de verificação de sessão ativa.
 * Lê o cookie JWT, valida o token e retorna os dados atualizados
 * do usuário diretamente do banco (incluindo status de assinatura).
 * Regra de negócio: assinaturas expiradas são marcadas automaticamente como 'inactive'.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  try {
    // Extrai e valida o token JWT do cookie de sessão
    const token = getCookie(req.headers.cookie, 'session');
    if (!token) {
      return res.status(401).json({ error: 'Não autenticado.' });
    }

    let payload;
    try {
      payload = verifyToken(token);
    } catch {
      return res.status(401).json({ error: 'Sessão inválida ou expirada.' });
    }

    // Busca os dados atualizados do usuário no banco
    const result = await db.execute({
      sql: 'SELECT id, name, email, plan_type, subscription_status, expires_at, stripe_customer_id FROM users WHERE id = ?',
      args: [payload.userId],
    });

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    const user = result.rows[0];
    const now = Math.floor(Date.now() / 1000);

    // Verifica se a assinatura de data expirou (não se aplica a planos vitalícios)
    let status = user.subscription_status as string;
    if (
      status === 'active' &&
      user.plan_type !== 'lifetime' &&
      user.expires_at !== null &&
      (user.expires_at as number) < now
    ) {
      // Atualiza o status para inativo no banco
      await db.execute({
        sql: "UPDATE users SET subscription_status = 'inactive' WHERE id = ?",
        args: [payload.userId],
      });
      status = 'inactive';
    }

    return res.status(200).json({
      id: user.id,
      name: user.name,
      email: user.email,
      plan_type: user.plan_type,
      subscription_status: status,
      expires_at: user.expires_at,
      stripe_customer_id: user.stripe_customer_id,
    });
  } catch (error) {
    console.error('[me] Erro:', error);
    return res.status(500).json({ error: 'Erro interno.' });
  }
}
