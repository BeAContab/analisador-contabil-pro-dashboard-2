import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { db } from '../utils/db';
import { verifyToken, getCookie } from '../utils/auth';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

/**
 * Endpoint para geração de link do Stripe Customer Portal.
 * Permite ao usuário gerenciar sua assinatura, atualizar o método de pagamento
 * ou cancelar o plano diretamente na interface do Stripe, sem precisar
 * implementar essa lógica manualmente.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  try {
    // Valida a sessão JWT
    const token = getCookie(req.headers.cookie, 'session');
    if (!token) return res.status(401).json({ error: 'Não autenticado.' });

    let payload;
    try {
      payload = verifyToken(token);
    } catch {
      return res.status(401).json({ error: 'Sessão inválida.' });
    }

    // Busca o stripe_customer_id do usuário no banco
    const result = await db.execute({
      sql: 'SELECT stripe_customer_id FROM users WHERE id = ?',
      args: [payload.userId],
    });

    const customerId = result.rows[0]?.stripe_customer_id as string | null;

    if (!customerId) {
      return res.status(400).json({ error: 'Nenhuma assinatura ativa encontrada.' });
    }

    const origin = req.headers.origin || 'https://seudominio.com.br';

    // Cria a sessão do portal de gerenciamento do Stripe
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/conta`,
    });

    return res.status(200).json({ url: portalSession.url });
  } catch (error) {
    console.error('[portal] Erro:', error);
    return res.status(500).json({ error: 'Erro ao acessar portal de faturamento.' });
  }
}
