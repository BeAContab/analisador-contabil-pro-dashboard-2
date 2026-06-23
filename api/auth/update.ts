import type { VercelRequest, VercelResponse } from '@vercel/node';
import bcrypt from 'bcryptjs';
import { db } from '../utils/db';
import { verifyToken, getCookie } from '../utils/auth';

/**
 * Endpoint para atualização do perfil do usuário.
 * Permite alterar o nome e a senha do usuário autenticado no sistema.
 * Valida a sessão por cookie HTTP-only JWT e executa as alterações de segurança.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Aceita apenas requisições POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  try {
    // Validação da sessão ativa do usuário
    const token = getCookie(req.headers.cookie, 'session');
    if (!token) {
      return res.status(401).json({ error: 'Sessão expirada. Faça login novamente.' });
    }

    let payload;
    try {
      payload = verifyToken(token);
    } catch {
      return res.status(401).json({ error: 'Sessão inválida. Faça login novamente.' });
    }

    const userId = payload.userId;
    const { name, currentPassword, newPassword } = req.body;

    // Se nenhum parâmetro foi enviado para atualização
    if (!name && (!currentPassword || !newPassword)) {
      return res.status(400).json({ error: 'Nenhum dado informado para atualização.' });
    }

    // Processamento da atualização de Nome
    if (name !== undefined) {
      if (name.trim().length === 0) {
        return res.status(400).json({ error: 'O nome de usuário não pode ser deixado em branco.' });
      }

      await db.execute({
        sql: 'UPDATE users SET name = ? WHERE id = ?',
        args: [name.trim(), userId],
      });
    }

    // Processamento da atualização de Senha
    if (currentPassword && newPassword) {
      if (newPassword.length < 6) {
        return res.status(400).json({ error: 'A nova senha deve possuir no mínimo 6 caracteres.' });
      }

      // Busca o hash de senha atual cadastrado no banco de dados
      const userResult = await db.execute({
        sql: 'SELECT password_hash FROM users WHERE id = ?',
        args: [userId],
      });

      if (userResult.rows.length === 0) {
        return res.status(404).json({ error: 'Usuário não encontrado.' });
      }

      const passwordHash = userResult.rows[0].password_hash as string;

      // Validação da senha atual informada usando bcrypt
      const isValid = await bcrypt.compare(currentPassword, passwordHash);
      if (!isValid) {
        return res.status(400).json({ error: 'A senha atual informada está incorreta.' });
      }

      // Criação de hash seguro para a nova senha informada
      const newHash = await bcrypt.hash(newPassword, 12);

      // Atualização da senha no banco de dados do usuário
      await db.execute({
        sql: 'UPDATE users SET password_hash = ? WHERE id = ?',
        args: [newHash, userId],
      });
    }

    // Busca dados atualizados do usuário para retornar na resposta
    const updatedUserResult = await db.execute({
      sql: 'SELECT id, name, email, subscription_status, plan_type FROM users WHERE id = ?',
      args: [userId],
    });

    const updatedUser = updatedUserResult.rows[0];

    return res.status(200).json({
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      subscription_status: updatedUser.subscription_status,
      plan_type: updatedUser.plan_type,
    });
  } catch (error) {
    console.error('[update] Erro ao atualizar informações cadastrais:', error);
    return res.status(500).json({ error: 'Erro interno ao atualizar perfil. Tente novamente mais tarde.' });
  }
}
