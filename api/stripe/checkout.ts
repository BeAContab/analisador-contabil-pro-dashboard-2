import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { db } from '../utils/db';
import { verifyToken, getCookie } from '../utils/auth';

/**
 * Planos disponíveis e seus respectivos Price IDs do Stripe.
 * Os IDs são lidos das variáveis de ambiente para segurança.
 */
const PRICE_IDS: Record<string, string> = {
  monthly: process.env.VITE_STRIPE_PRICE_MONTHLY!,
  quarterly: process.env.VITE_STRIPE_PRICE_QUARTERLY!,
  annual: process.env.VITE_STRIPE_PRICE_ANNUAL!,
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

/**
 * Endpoint de criação de sessão de checkout no Stripe.
 * Valida a sessão do usuário, determina o plano escolhido e redireciona
 * para a página de pagamento hospedada pelo Stripe.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  try {
    // Valida a sessão JWT do usuário
    const token = getCookie(req.headers.cookie, 'session');
    if (!token) {
      return res.status(401).json({ error: 'Não autenticado.' });
    }

    let payload;
    try {
      payload = verifyToken(token);
    } catch {
      return res.status(401).json({ error: 'Sessão inválida.' });
    }

    const { plan } = req.body;

    // Valida o plano selecionado
    if (!plan || !PRICE_IDS[plan]) {
      return res.status(400).json({ error: 'Plano inválido. Escolha: monthly, quarterly ou annual.' });
    }

    // Busca o usuário para obter ou criar o customer_id do Stripe
    const userResult = await db.execute({
      sql: 'SELECT id, email, name, stripe_customer_id FROM users WHERE id = ?',
      args: [payload.userId],
    });

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    const user = userResult.rows[0];
    let customerId = user.stripe_customer_id as string | null;

    // Cria o cliente no Stripe se ainda não existir
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email as string,
        name: user.name as string,
        metadata: { userId: user.id as string },
      });
      customerId = customer.id;

      // Persiste o Stripe customer_id no banco para reutilização futura
      await db.execute({
        sql: 'UPDATE users SET stripe_customer_id = ? WHERE id = ?',
        args: [customerId, payload.userId],
      });
    }

    const origin = req.headers.origin || 'https://seudominio.com.br';

    // Cria a sessão de checkout do Stripe
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: PRICE_IDS[plan], quantity: 1 }],
      mode: 'subscription',
      allow_promotion_codes: true,
      // client_reference_id permite identificar o usuário no Webhook
      client_reference_id: payload.userId,
      success_url: `${origin}/sucesso?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?cancelado=true`,
      locale: 'pt-BR',
    });

    return res.status(200).json({ url: session.url });
  } catch (error) {
    console.error('[checkout] Erro:', error);
    return res.status(500).json({ error: 'Erro ao criar sessão de pagamento.' });
  }
}
