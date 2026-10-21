const $ = s => document.querySelector(s)
const e = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const M = c => (Number(c) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const T = c => (c == null || c === '' ? '' : (Number(c) / 100).toFixed(2).replace('.', ','))
const R = v => { const s = String(v ?? '').trim(); if (!s) return null; const n = s.includes(',') ? parseFloat(s.replace(/\./g, '').replace(',', '.')) : parseFloat(s); return isNaN(n) ? null : Math.round(n * 100) }
const ST = { disponivel: 'Disponível', reservado: 'Reservado', avaliacao: 'Aguardando avaliação', troca: 'Recebido em troca', fora_de_venda: 'Fora de venda' }
let D = { produtos: [], categorias: [] }, busca = '', aberto = null

async function api(url, o = {}) {
  const r = await fetch(url, { credentials: 'same-origin', method: o.method, headers: { ...(o.json ? { 'content-type': 'application/json' } : {}), ...o.headers }, body: o.json ? JSON.stringify(o.json) : o.body })
  const j = await r.json().catch(() => ({}))
  if (r.status === 401 && url !== '/api/login') { entrar(); throw new Error('Sessão expirada.') }
  if (!r.ok) throw new Error(j.erro || 'Algo deu errado.')
  return j
}

function entrar(msg = '') {
  $('#dlg').open && $('#dlg').close()
  $('#app').innerHTML = `<form class="lg f" id="lf"><h1>Super <i>Cell</i></h1><label>E-mail<input name="email" type="email" autocomplete="username" required></label><label>Senha<input name="senha" type="password" autocomplete="current-password" required></label><p class="er">${e(msg)}</p><button class="bt">Entrar</button></form>`
  $('#lf').onsubmit = async x => {
    x.preventDefault(); const f = new FormData(x.target)
    try { await api('/api/login', { method: 'POST', json: { email: f.get('email'), senha: f.get('senha') } }); await carregar() } catch (er) { entrar(er.message) }
  }
}

async function carregar() { D = await api('/api/admin/produtos'); lista() }

const cards = () => {
  const q = busca.toLowerCase()
  return D.produtos.filter(p => (p.nome + ' ' + (p.variacao || '')).toLowerCase().includes(q)).map(p =>
    `<div class="card" data-id="${p.id}"><div class="row"><b>${e(p.nome)}</b><span class="chip ${p.status}">${ST[p.status]}</span></div><p class="nt">${e(p.variacao || '')}${p.variacao ? ' · ' : ''}${p.preco ? M(p.promo || p.preco) : 'sem preço'} · ${p.quantidade} un.${p.baixo ? ' · <b class="rd">estoque baixo</b>' : ''}${p.publicado ? ' · <b class="ok">na vitrine</b>' : ''}</p></div>`).join('') || '<p class="nt">Nenhum produto.</p>'
}
function lista() {
  $('#app').innerHTML = `<header><h1>Super <i>Cell</i> · Estoque</h1><button class="bt g" id="sair">Sair</button></header><div class="w"><button class="bt" id="novo" style="width:100%;margin-bottom:10px">+ Novo produto</button><input class="busca" id="q" placeholder="Buscar produto" value="${e(busca)}"><div id="ls">${cards()}</div></div>`
}

const fotosHtml = x => `<div><b style="font-size:13px">Fotos</b><div class="ft" style="margin:6px 0">${x.fotos.map(f => `<span><img src="${e(f.url)}" alt=""><button type="button" data-fd="${f.id}">✕</button></span>`).join('')}</div><label class="bt g" style="text-align:center;cursor:pointer">Adicionar fotos<input type="file" id="fi" accept="image/*" multiple hidden></label></div>`

function form(p) {
  const x = p || { quantidade: 1, status: 'disponivel', fotos: [] }
  aberto = p ? p.id : null
  const sel = (v, k) => (v === k ? ' selected' : '')
  $('#dlg').innerHTML = `<form class="f" id="pf"><h3>${p ? 'Editar produto' : 'Novo produto'}</h3>
<label>Categoria<select name="categoria_id" required>${D.categorias.map(c => `<option value="${c.id}"${sel(x.categoria_id, c.id)}>${e(c.nome)}</option>`).join('')}</select></label>
<label>Nome<input name="nome" required value="${e(x.nome)}"></label>
<label>Variação (ex.: 128 GB · Azul)<input name="variacao" value="${e(x.variacao)}"></label>
<div class="two"><label>Condição<select name="condicao"><option value="">—</option><option value="novo"${sel(x.condicao, 'novo')}>Novo</option><option value="seminovo"${sel(x.condicao, 'seminovo')}>Seminovo</option></select></label><label>Bateria %<input name="bateria" inputmode="numeric" value="${e(x.bateria)}"></label></div>
<div class="two"><label>Quantidade<input name="quantidade" inputmode="numeric" value="${e(x.quantidade)}"></label><label>Status<select name="status">${Object.entries(ST).map(([k, v]) => `<option value="${k}"${sel(x.status, k)}>${v}</option>`).join('')}</select></label></div>
<div class="two"><label>Custo (só você vê)<input name="custo" inputmode="decimal" value="${T(x.custo)}"></label><label>Preço<input name="preco" inputmode="decimal" value="${T(x.preco)}"></label></div>
<label>Preço promocional (opcional)<input name="promo" inputmode="decimal" value="${T(x.promo)}"></label>
<label>Compatibilidade (opcional)<input name="compatibilidade" value="${e(x.compatibilidade)}"></label>
<label>Descrição (aparece na vitrine)<textarea name="descricao" rows="3">${e(x.descricao)}</textarea></label>
<label class="ck"><input type="checkbox" name="publicado"${x.publicado ? ' checked' : ''}> Mostrar na vitrine</label>
${p ? fotosHtml(x) : '<p class="nt">Salve primeiro; depois você adiciona as fotos.</p>'}
<p class="er" id="er"></p><div class="two"><button type="button" class="bt g" id="fx">Fechar</button><button class="bt">Salvar</button></div></form>`
  if (!$('#dlg').open) $('#dlg').showModal()
  $('#pf').onsubmit = async ev => {
    ev.preventDefault(); const f = new FormData(ev.target), g = k => f.get(k)
    const json = { categoria_id: g('categoria_id'), nome: g('nome'), variacao: g('variacao'), condicao: g('condicao'), bateria: g('bateria'), quantidade: g('quantidade'), compatibilidade: g('compatibilidade'), descricao: g('descricao'), custo: R(g('custo')) ?? 0, preco: R(g('preco')), promo: R(g('promo')), status: g('status'), publicado: f.has('publicado') }
    try {
      const r = await api('/api/admin/produtos' + (p ? '?id=' + p.id : ''), { method: p ? 'PATCH' : 'POST', json })
      await carregar()
      if (p) $('#dlg').close(); else form(D.produtos.find(a => a.id === r.id))
    } catch (er) { $('#er').textContent = er.message }
  }
}

async function reduzir(file) {
  const b = await createImageBitmap(file), k = Math.min(1, 1400 / Math.max(b.width, b.height)), c = document.createElement('canvas')
  c.width = Math.round(b.width * k); c.height = Math.round(b.height * k)
  c.getContext('2d').drawImage(b, 0, 0, c.width, c.height)
  return new Promise(r => c.toBlob(r, 'image/jpeg', 0.82))
}

document.addEventListener('click', async x => {
  const t = x.target.closest('button,.card'); if (!t) return
  if (t.id === 'sair') api('/api/login', { method: 'DELETE' }).finally(() => entrar())
  if (t.id === 'novo') form(null)
  if (t.id === 'fx') $('#dlg').close()
  if (t.classList.contains('card')) form(D.produtos.find(p => p.id === t.dataset.id))
  if (t.dataset.fd) {
    try { await api('/api/admin/foto?id=' + t.dataset.fd, { method: 'DELETE' }); await carregar(); form(D.produtos.find(p => p.id === aberto)) } catch (er) { $('#er').textContent = er.message }
  }
})
document.addEventListener('input', x => { if (x.target.id === 'q') { busca = x.target.value; $('#ls').innerHTML = cards() } })
document.addEventListener('change', async x => {
  if (x.target.id !== 'fi') return
  const id = aberto
  $('#er').textContent = 'Enviando…'
  try {
    for (const f of x.target.files) await api('/api/admin/foto?produto=' + id, { method: 'POST', headers: { 'content-type': 'image/jpeg' }, body: await reduzir(f) })
    await carregar(); form(D.produtos.find(a => a.id === id))
  } catch (er) { $('#er').textContent = er.message }
})

api('/api/login').then(carregar).catch(() => entrar())
