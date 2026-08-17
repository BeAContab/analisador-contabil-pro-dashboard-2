import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Proxy stateless para a API da TESS: guarda a chave da Barreira do lado do
 * servidor (nunca chega ao bundle publico, diferente de VITE_TESS_API_KEY,
 * que so e honrada em dev - ver src/utils/tess.ts) para que qualquer
 * visitante do site consiga usar o assistente de IA sem colar a propria
 * chave. Quem preferir usar a conta TESS pessoal continua podendo, chamando
 * a API diretamente do navegador com a propria chave (ver requestTess em
 * src/utils/tess.ts) - esta function so cobre o caminho padrao.
 *
 * A pseudonimizacao do balancete (nomes, CNPJ/CPF) acontece inteiramente no
 * navegador antes de chegar aqui; esta function so repassa `messages` para a
 * TESS, sem armazenar nada.
 */

const TESS_ENDPOINT = (agentId: string) =>
  `https://api.tess.im/agents/${encodeURIComponent(agentId)}/openai/chat/completions`;

const MAX_PAYLOAD_CHARS = 20000;

// Rate limit best-effort: reseta a cada cold start e nao e compartilhado
// entre instancias da function, entao nao e uma garantia real - so um
// obstaculo a mais contra abuso trivial de bot, sem precisar de infra nova
// (Redis/Vercel KV). Se abuso continuar sendo um problema, o proximo passo e
// um rate limit de verdade com armazenamento compartilhado.
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 10;
const requestLog = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = (requestLog.get(ip) ?? []).filter((ts) => now - ts < RATE_LIMIT_WINDOW_MS);
  timestamps.push(now);
  requestLog.set(ip, timestamps);
  return timestamps.length > RATE_LIMIT_MAX_REQUESTS;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Metodo nao permitido.' });
    return;
  }

  const ip = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ?? 'unknown';
  if (isRateLimited(ip)) {
    res.status(429).json({ error: 'Muitas requisicoes. Tente novamente em instantes.' });
    return;
  }

  const apiKey = process.env.TESS_API_KEY;
  const workspaceId = process.env.TESS_WORKSPACE_ID;
  const agentId = process.env.TESS_AGENT_ID;
  if (!apiKey || !workspaceId || !agentId) {
    res.status(503).json({ error: 'Assistente de IA nao configurado no servidor.' });
    return;
  }

  const messages = req.body?.messages;
  if (!Array.isArray(messages)) {
    res.status(400).json({ error: 'Corpo invalido: "messages" deve ser um array.' });
    return;
  }
  if (JSON.stringify(messages).length > MAX_PAYLOAD_CHARS) {
    res.status(413).json({ error: 'Mensagem excede o tamanho maximo permitido.' });
    return;
  }

  try {
    const tessResponse = await fetch(TESS_ENDPOINT(agentId), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'x-workspace-id': workspaceId
      },
      body: JSON.stringify({ messages })
    });

    const text = await tessResponse.text();
    res.status(tessResponse.status);
    res.setHeader('Content-Type', 'application/json');
    res.send(text);
  } catch {
    res.status(502).json({ error: 'Falha ao contatar a TESS.' });
  }
}
