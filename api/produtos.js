import { dbVitrine } from './_db.js'

// Vitrine pública: só lê as views seguras (sem custo nem observações internas)
export default async function handler(req, res) {
  try {
    const sql = dbVitrine()
    const [p, c] = await Promise.all([
      sql`select id, categoria, nome, variacao, condicao, bateria, compatibilidade, descricao, preco, preco_promo, fotos, entrada from vw_vitrine_publica`,
      sql`select id, nome from vw_vitrine_categorias order by ordem, nome`,
    ])
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300')
    res.json({
      categorias: c,
      produtos: p.map(x => ({
        id: x.id, categoria: x.categoria, nome: x.nome, variacao: x.variacao, condicao: x.condicao,
        bateria: x.bateria, compatibilidade: x.compatibilidade, descricao: x.descricao,
        preco: Number(x.preco), precoPromo: x.preco_promo == null ? null : Number(x.preco_promo),
        fotos: x.fotos, entrada: x.entrada,
      })),
    })
  } catch { res.status(500).json({ erro: 'indisponível' }) }
}
