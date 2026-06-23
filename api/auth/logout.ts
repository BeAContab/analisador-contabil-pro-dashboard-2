import type { VercelRequest, VercelResponse } from '@vercel/node';
import { clearSessionCookie } from '../utils/auth';

/**
 * Endpoint de logout.
 * Invalida a sessão do usuário apagando o cookie HTTP-only.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  // Sobrescreve o cookie de sessão com um valor vazio e expiração imediata
  res.setHeader('Set-Cookie', clearSessionCookie());
  return res.status(200).json({ message: 'Sessão encerrada com sucesso.' });
}
