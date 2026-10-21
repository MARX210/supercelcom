import { db } from '../_db.js'
import { exigir } from '../_auth.js'

const n = v => (v === '' || v == null ? null : Number(v))
const t = v => (v == null || String(v).trim() === '' ? null : String(v).trim())
const erroV = m => Object.assign(new Error(m), { v: 1 })
const int = v => { const x = n(v); if (x !== null && !Number.isInteger(x)) throw erroV('Número inválido.'); return x }

function limpar(b) {
  const o = {
    categoria_id: t(b.categoria_id), nome: t(b.nome), variacao: t(b.variacao), condicao: t(b.condicao),
    saude_bateria: int(b.bateria), quantidade: int(b.quantidade) ?? 1, compatibilidade: t(b.compatibilidade),
    descricao: t(b.descricao), custo_centavos: int(b.custo) ?? 0, preco_centavos: int(b.preco),
    preco_promo_centavos: int(b.promo), status: b.status || 'disponivel', publicado: !!b.publicado,
  }
  if (!o.nome || !o.categoria_id) throw erroV('Informe a categoria e o nome.')
  if (o.condicao && !['novo', 'seminovo'].includes(o.condicao)) throw erroV('Condição inválida.')
  if (!['disponivel', 'reservado', 'avaliacao', 'troca', 'fora_de_venda'].includes(o.status)) throw erroV('Status inválido.')
  return o
}
const traduzir = e => e.v ? e.message
  : /publicado_exige_venda/.test(e.message) ? 'Para mostrar na vitrine, o produto precisa estar disponível e ter preço.'
  : /promo_menor/.test(e.message) ? 'O preço promocional precisa ser menor que o preço.'
  : /check|violates|invalid/.test(e.message) ? 'Confira os valores informados (quantidade, bateria, preços).'
  : 'Não foi possível salvar.'

export default async function handler(req, res) {
  const u = await exigir(req, res); if (!u) return
  const sql = db()
  try {
    if (req.method === 'GET') {
      const [produtos, categorias] = await Promise.all([
        sql`select p.id, p.categoria_id, p.nome, p.variacao, p.condicao, p.saude_bateria as bateria, p.quantidade,
          p.compatibilidade, p.descricao, p.custo_centavos as custo, p.preco_centavos as preco, p.preco_promo_centavos as promo,
          p.status, p.publicado, p.estoque_baixo as baixo,
          (select coalesce(jsonb_agg(jsonb_build_object('id', f.id, 'url', f.url) order by f.ordem, f.criado_em), '[]'::jsonb)
             from produto_fotos f where f.produto_id = p.id) as fotos
          from vw_estoque p order by p.criado_em desc`,
        sql`select id, nome, tipo from categorias where ativa order by ordem, nome`,
      ])
      return res.json({ produtos, categorias })
    }
    const o = limpar(req.body || {})
    const ctx = sql`select set_config('app.usuario_id', ${u.id}, true)`
    if (req.method === 'POST') {
      const [, [r]] = await sql.transaction([ctx, sql`insert into produtos
        (categoria_id, nome, variacao, condicao, saude_bateria, quantidade, compatibilidade, descricao, custo_centavos, preco_centavos, preco_promo_centavos, status, publicado)
        values (${o.categoria_id}, ${o.nome}, ${o.variacao}, ${o.condicao}, ${o.saude_bateria}, ${o.quantidade}, ${o.compatibilidade}, ${o.descricao}, ${o.custo_centavos}, ${o.preco_centavos}, ${o.preco_promo_centavos}, ${o.status}, ${o.publicado})
        returning id`])
      return res.status(201).json({ id: r.id })
    }
    if (req.method === 'PATCH') {
      const id = req.query.id
      await sql.transaction([ctx, sql`update produtos set categoria_id = ${o.categoria_id}, nome = ${o.nome}, variacao = ${o.variacao},
        condicao = ${o.condicao}, saude_bateria = ${o.saude_bateria}, quantidade = ${o.quantidade}, compatibilidade = ${o.compatibilidade},
        descricao = ${o.descricao}, custo_centavos = ${o.custo_centavos}, preco_centavos = ${o.preco_centavos},
        preco_promo_centavos = ${o.preco_promo_centavos}, status = ${o.status}, publicado = ${o.publicado} where id = ${id}`])
      return res.json({ id })
    }
    res.status(405).end()
  } catch (e) { res.status(400).json({ erro: traduzir(e) }) }
}
