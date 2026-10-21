import { put, del } from '@vercel/blob'
import { db } from '../_db.js'
import { exigir } from '../_auth.js'

const MAX = 4 * 1024 * 1024 // limite de corpo das funções da Vercel (~4,5 MB); o painel já reduz a foto
export default async function handler(req, res) {
  const u = await exigir(req, res); if (!u) return
  const sql = db()
  try {
    if (req.method === 'DELETE') {
      const [f] = await sql`delete from produto_fotos where id = ${req.query.id} returning url`
      if (f) await del(f.url).catch(() => {})
      return res.json({ ok: true })
    }
    if (req.method !== 'POST') return res.status(405).end()
    const tipo = req.headers['content-type'] || ''
    if (!/^image\/(jpeg|png|webp)$/.test(tipo)) return res.status(400).json({ erro: 'Envie uma imagem JPG, PNG ou WebP.' })
    const parts = []; let size = 0
    for await (const c of req) { size += c.length; if (size > MAX) return res.status(413).json({ erro: 'Foto muito grande.' }); parts.push(c) }
    const id = req.query.produto
    const b = await put(`produtos/${id}.${tipo.split('/')[1]}`, Buffer.concat(parts), { access: 'public', contentType: tipo, addRandomSuffix: true })
    await sql`insert into produto_fotos (produto_id, url, ordem)
      values (${id}, ${b.url}, (select coalesce(max(ordem) + 1, 0) from produto_fotos where produto_id = ${id}))`
    res.json({ url: b.url })
  } catch (e) {
    console.error('foto:', e)
    const m = String(e?.message || '')
    res.status(400).json({ erro: /token/i.test(m) ? 'Armazenamento de fotos não configurado (falta BLOB_READ_WRITE_TOKEN na Vercel).'
      : /private|public|access/i.test(m) ? 'O Blob da Vercel está privado. Crie um Blob store com acesso público.'
      : 'Não foi possível enviar a foto. Detalhe: ' + m.slice(0, 120) })
  }
}