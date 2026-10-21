import './style.css'
import './vitrine.css'

const $ = s => document.querySelector(s)
const brl = c => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const wa = t => 'https://wa.me/554626010325?text=' + encodeURIComponent(t)
const el = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e }
const final = p => p.precoPromo ?? p.preco

// Fonte dos dados: API do servidor (banco). O exemplo só existe em desenvolvimento e na prévia.
async function load() {
  if (window.__PRODUTOS__) return window.__PRODUTOS__
  try { const r = await fetch('/api/produtos', { headers: { accept: 'application/json' } }); if (r.ok) return await r.json() } catch {}
  if (import.meta.env.DEV) return (await import('./produtos-exemplo.json')).default
  return null
}

function card(p) {
  const a = el('article', 'pc'), ph = el('div', 'ph'), im = new Image(), f = p.fotos?.[0]
  im.alt = p.nome; im.loading = 'lazy'; im.src = f || '/images/logo.jpg'; if (!f) im.className = 'lg'
  ph.append(im)
  if (p.condicao) ph.append(el('span', 'bd ' + p.condicao, p.condicao === 'novo' ? 'Novo' : 'Seminovo'))
  if (p.precoPromo) ph.append(el('span', 'bd promo', '-' + Math.round((1 - p.precoPromo / p.preco) * 100) + '%'))
  const b = el('div', 'pb')
  b.append(el('h3', '', p.nome))
  if (p.variacao) b.append(el('p', 'sp', p.variacao))
  if (p.compatibilidade) b.append(el('p', 'sp', 'Compatível com ' + p.compatibilidade))
  if (p.bateria != null) b.append(el('p', 'bat', 'Bateria ' + p.bateria + '%'))
  if (p.descricao) b.append(el('p', 'ds', p.descricao))
  const pr = el('div', 'pr')
  if (p.precoPromo) pr.append(el('s', '', brl(p.preco)))
  pr.append(el('strong', '', brl(final(p))))
  const l = el('a', 'btn'); l.innerHTML = '<span><svg><use href="#wp"/></svg>Tenho interesse</span>'
  l.target = '_blank'; l.rel = 'noopener'
  l.href = wa(`Olá! Tenho interesse em: ${p.nome}${p.variacao ? ' (' + p.variacao + ')' : ''}, que vi no site da Super Cell.`)
  b.append(pr, l); a.append(ph, b); return a
}

let items = [], cat = 'todos'
function render() {
  const s = $('#sort').value, c = $('#cond').value
  const list = items.filter(p => (cat === 'todos' || p.categoria === cat) && (c === 'todos' || p.condicao === c)).sort((x, y) =>
    s === 'menor' ? final(x) - final(y) : s === 'maior' ? final(y) - final(x) : (y.entrada || '').localeCompare(x.entrada || ''))
  $('#grid').replaceChildren(...list.map(card))
  const e = $('#empty'); e.hidden = list.length > 0
  e.textContent = items.length ? 'Nenhum produto nessa seleção agora. Chame no WhatsApp e a gente verifica.' : ''
}

function chips(cats) {
  const box = $('#chips'), all = [{ id: 'todos', nome: 'Todos' }, ...cats]
  box.replaceChildren(...all.map(c => { const b = el('button', c.id === cat ? 'on' : '', c.nome); b.type = 'button'; b.dataset.c = c.id; return b }))
}
$('#chips').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return
  cat = b.dataset.c
  document.querySelectorAll('#chips button').forEach(x => x.classList.toggle('on', x === b)); render()
})
$('#sort').addEventListener('change', render)
$('#cond').addEventListener('change', render)

load().then(d => {
  if (!d) { const e = $('#empty'); e.hidden = false; e.textContent = 'O catálogo está sendo atualizado. Chame a gente no WhatsApp para ver o que temos hoje.'; return }
  items = (d.produtos || []).filter(p => p.disponivel !== false)
  if (d.exemplo) { const n = $('#note'); n.hidden = false; n.textContent = 'Prévia com dados de exemplo: modelos e preços ilustrativos.' }
  const ids = [...new Set(items.map(p => p.categoria))]
  chips((d.categorias || ids.map(id => ({ id, nome: id }))).filter(c => ids.includes(c.id)))
  $('#condw').hidden = !items.some(p => p.condicao)
  render()
})
