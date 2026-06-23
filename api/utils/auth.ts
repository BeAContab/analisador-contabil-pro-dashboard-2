import jwt from 'jsonwebtoken';

/** Chave secreta para assinar os tokens JWT - obrigatória nas variáveis de ambiente */
const JWT_SECRET = process.env.JWT_SECRET!;

/** Tempo de expiração padrão do token de sessão: 7 dias */
const TOKEN_EXPIRY = '7d';

/** Formato do payload armazenado dentro do JWT */
export interface JwtPayload {
  userId: string;
  email: string;
}

/**
 * Gera um token JWT assinado com o payload do usuário.
 */
export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

/**
 * Verifica e decodifica um token JWT.
 * Lança erro se o token for inválido ou expirado.
 */
export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}

/**
 * Extrai o valor de um cookie específico a partir do cabeçalho Cookie da requisição.
 */
export function getCookie(cookieHeader: string | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.split(';').find(c => c.trim().startsWith(`${name}=`));
  if (!match) return null;
  return decodeURIComponent(match.split('=')[1].trim());
}

/**
 * Gera o valor do cabeçalho Set-Cookie com as configurações seguras de produção.
 * HttpOnly e SameSite=Strict impedem acesso via JavaScript e CSRF.
 */
export function buildSessionCookie(token: string): string {
  const maxAge = 60 * 60 * 24 * 7; // 7 dias em segundos
  const isProd = process.env.NODE_ENV === 'production';
  return `session=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${isProd ? '; Secure' : ''}`;
}

/**
 * Gera o cabeçalho Set-Cookie para invalidar (apagar) a sessão do usuário.
 */
export function clearSessionCookie(): string {
  return `session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`;
}
