import { createHash } from 'node:crypto'
import { db } from './_db.js'
export const hash = t => createHash('sha256').update(t).digest('hex')
export const tokenDe = req => /(?:^|;\s*)sc_sessao=([a-f0-9]{64})/.exec(req.headers.cookie || '')?.[1]
export const setCookie = (res, v, maxAge) =>
  res.setHeader('Set-Cookie', `sc_sessao=${v}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAge}`)
export async function usuario(req) {
  const t = tokenDe(req); if (!t) return null
  const [u] = await db()`select u.id, u.nome, u.papel from sessoes s join usuarios u on u.id = s.usuario_id
    where s.token_hash = ${hash(t)} and s.expira_em > now() and u.ativo`
  return u || null
}
export async function exigir(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  const u = await usuario(req).catch(() => null)
  if (!u) { res.status(401).json({ erro: 'Entre novamente.' }); return null }
  return u
}
