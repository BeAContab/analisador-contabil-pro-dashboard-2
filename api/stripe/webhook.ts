import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { db } from '../utils/db';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

/**
 * Mapeamento de intervalos do Stripe para os tipos de plano do sistema.
 * Regra de negócio: define o tipo de plano baseado no intervalo de cobrança.
 */
const INTERVAL_TO_PLAN: Record<string, string> = {
  month: 'monthly',
  // Trimestral: Stripe usa 'month' com interval_count 3
  year: 'annual',
};

/**
 * Calcula a data de expiração da assinatura somando a duração do plano
 * a partir do timestamp atual.
 */
function calculateExpiry(plan: string): number {
  const now = Math.floor(Date.now() / 1000);
  const DAY = 86400;
  if (plan === 'monthly') return now + 30 * DAY;
  if (plan === 'quarterly') return now + 90 * DAY;
  if (plan === 'annual') return now + 365 * DAY;
  return now + 30 * DAY;
}

/**
 * Desabilita o parser automático do corpo para garantir que a assinatura 
 * do webhook seja verificada usando o payload bruto textual.
 */
export const config = {
  api: {
    bodyParser: false,
  },
};

async function getRawBody(req: VercelRequest): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

/**
 * Webhook seguro do Stripe para processar eventos de pagamento e assinatura.
 * Ponto crítico de segurança: a assinatura do webhook é verificada com o
 * STRIPE_WEBHOOK_SECRET para garantir que apenas o Stripe possa acionar este endpoint.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const sig = req.headers['stripe-signature'] as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

  let event: Stripe.Event;

  try {
    // Lê o body bruto como Buffer para validação correta da assinatura
    const rawBody = await getRawBody(req);
    // Verifica a autenticidade do evento usando a assinatura do Stripe
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido';
    console.error('[webhook] Assinatura inválida:', message);
    return res.status(400).json({ error: `Webhook inválido: ${message}` });
  }

  try {
    switch (event.type) {
      /**
       * Evento: pagamento de checkout concluído com sucesso.
       * Ativa a assinatura do usuário identificado pelo client_reference_id.
       */
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id;
        if (!userId) break;

        // Busca detalhes da assinatura para determinar o tipo de plano
        let planType = 'monthly';
        if (session.subscription) {
          const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
          const item = subscription.items.data[0];
          const interval = item.price.recurring?.interval;
          const intervalCount = item.price.recurring?.interval_count;

          if (interval === 'month' && intervalCount === 3) {
            planType = 'quarterly';
          } else if (interval === 'year') {
            planType = 'annual';
          } else {
            planType = 'monthly';
          }
        }

        const expiresAt = calculateExpiry(planType);

        await db.execute({
          sql: `UPDATE users
                SET plan_type = ?, subscription_status = 'active',
                    stripe_subscription_id = ?, expires_at = ?
                WHERE id = ?`,
          args: [planType, session.subscription as string, expiresAt, userId],
        });
        break;
      }

      /**
       * Evento: assinatura atualizada (renovação, mudança de plano, etc.).
       * Mantém a assinatura ativa e atualiza a data de expiração.
       */
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const customer = await stripe.customers.retrieve(subscription.customer as string);

        if (customer.deleted) break;

        const userResult = await db.execute({
          sql: 'SELECT id FROM users WHERE stripe_customer_id = ?',
          args: [(customer as Stripe.Customer).id],
        });

        if (userResult.rows.length === 0) break;
        const userId = userResult.rows[0].id as string;

        const item = subscription.items.data[0];
        const interval = item.price.recurring?.interval;
        const intervalCount = item.price.recurring?.interval_count;

        let planType = 'monthly';
        if (interval === 'month' && intervalCount === 3) planType = 'quarterly';
        else if (interval === 'year') planType = 'annual';

        const newStatus = subscription.status === 'active' ? 'active' : subscription.status;
        const expiresAt = calculateExpiry(planType);

        await db.execute({
          sql: `UPDATE users SET plan_type = ?, subscription_status = ?, expires_at = ? WHERE id = ?`,
          args: [planType, newStatus, expiresAt, userId],
        });
        break;
      }

      /**
       * Evento: assinatura cancelada ou encerrada.
       * Revoga o acesso do usuário ao sistema.
       */
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await db.execute({
          sql: `UPDATE users SET subscription_status = 'canceled', expires_at = ? WHERE stripe_subscription_id = ?`,
          args: [Math.floor(Date.now() / 1000), subscription.id],
        });
        break;
      }

      default:
        // Eventos não tratados são ignorados sem erro
        break;
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('[webhook] Erro ao processar evento:', error);
    return res.status(500).json({ error: 'Erro interno ao processar evento.' });
  }
}
