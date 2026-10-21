import { randomBytes } from 'node:crypto'
import { db } from './_db.js'
import { hash, setCookie, tokenDe, usuario } from './_auth.js'

// GET = quem sou eu · POST = entrar · DELETE = sair
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  try {
    const sql = db()
    if (req.method === 'GET') {
      const u = await usuario(req)
      return u ? res.json(u) : res.status(401).json({ erro: 'Não autenticado.' })
    }
    if (req.method === 'DELETE') {
      const t = tokenDe(req); if (t) await sql`delete from sessoes where token_hash = ${hash(t)}`
      setCookie(res, '', 0); return res.json({ ok: true })
    }
    if (req.method !== 'POST') return res.status(405).end()
    const { email, senha } = req.body || {}
    const [u] = await sql`select id, nome, papel from usuarios
      where lower(email) = lower(${String(email || '')}) and ativo and senha_hash = crypt(${String(senha || '')}, senha_hash)`
    if (!u) { await new Promise(r => setTimeout(r, 800)); return res.status(401).json({ erro: 'E-mail ou senha incorretos.' }) }
    const token = randomBytes(32).toString('hex')
    await sql`insert into sessoes (token_hash, usuario_id, expira_em, ip, user_agent)
      values (${hash(token)}, ${u.id}, now() + interval '7 days', ${req.headers['x-forwarded-for']?.split(',')[0] ?? null}, ${req.headers['user-agent'] ?? null})`
    await sql`update usuarios set ultimo_login = now() where id = ${u.id}`
    await sql`delete from sessoes where expira_em < now()`
    setCookie(res, token, 604800)
    res.json(u)
  } catch (e) { console.error('login falhou:', e?.message || e); res.status(500).json({ erro: 'Erro no servidor.' }) }
}