-- =====================================================================
-- Super Cell — banco de dados (PostgreSQL / Neon)
-- Como usar: Neon > SQL Editor > cole tudo > Run.
-- Pode rodar de novo sem perder dados.
-- Dinheiro: SEMPRE em centavos (bigint). R$ 2.699,00 = 269900.
-- =====================================================================
begin;

-- ---------- USUÁRIOS E SESSÕES ----------
create table if not exists usuarios (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  email text not null,
  senha_hash text not null,                       -- hash (bcrypt/argon2), nunca a senha
  papel text not null default 'funcionario' check (papel in ('dono','funcionario')),
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  ultimo_login timestamptz
);
create unique index if not exists usuarios_email_uq on usuarios (lower(email));

create table if not exists sessoes (
  token_hash text primary key,                    -- guarda o hash do token, não o token
  usuario_id uuid not null references usuarios(id) on delete cascade,
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null,
  ip text,
  user_agent text
);
create index if not exists sessoes_usuario_idx on sessoes (usuario_id);
create index if not exists sessoes_expira_idx on sessoes (expira_em);

-- ---------- CATEGORIAS ----------
create table if not exists categorias (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  nome text not null,
  ordem int not null default 0,
  tipo text not null default 'acessorio' check (tipo in ('aparelho','acessorio')),   -- define quais campos o cadastro mostra
  ativa boolean not null default true
);
create unique index if not exists categorias_nome_uq on categorias (lower(nome));   -- sem categorias repetidas

-- ---------- PRODUTOS / ESTOQUE ----------
create table if not exists produtos (
  id uuid primary key default gen_random_uuid(),
  categoria_id uuid not null references categorias(id),
  nome text not null,
  marca text,
  variacao text,                                  -- ex.: "128 GB · Azul"
  identificador text,                             -- IMEI / número de série (opcional)
  condicao text check (condicao in ('novo','seminovo')),
  saude_bateria smallint check (saude_bateria between 0 and 100),
  quantidade int not null default 1 check (quantidade >= 0),   -- unidades em estoque
  estoque_minimo int check (estoque_minimo >= 0),              -- avisar quando quantidade <= isso
  compatibilidade text,                           -- ex.: capinha de "iPhone 13"
  descricao text,                                 -- aparece na vitrine
  observacoes_internas text,                      -- NUNCA aparece na vitrine
  custo_centavos bigint not null default 0 check (custo_centavos >= 0),   -- interno
  preco_centavos bigint check (preco_centavos > 0),
  preco_promo_centavos bigint check (preco_promo_centavos > 0),
  status text not null default 'disponivel'
    check (status in ('disponivel','reservado','avaliacao','troca','fora_de_venda')),
  publicado boolean not null default false,       -- aparece na vitrine?
  origem text not null default 'compra' check (origem in ('compra','troca')),
  data_entrada date not null default current_date,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint promo_menor_que_preco check
    (preco_promo_centavos is null or (preco_centavos is not null and preco_promo_centavos < preco_centavos)),
  constraint publicado_exige_venda check
    (not publicado or (status = 'disponivel' and preco_centavos is not null))
);
create unique index if not exists produtos_identificador_uq on produtos (identificador) where identificador is not null;
create index if not exists produtos_status_idx on produtos (status);
create index if not exists produtos_categoria_idx on produtos (categoria_id);
create index if not exists produtos_entrada_idx on produtos (data_entrada);
create index if not exists produtos_publicados_idx on produtos (categoria_id) where publicado;

create table if not exists produto_fotos (
  id uuid primary key default gen_random_uuid(),
  produto_id uuid not null references produtos(id) on delete cascade,
  url text not null,                              -- link do Vercel Blob
  ordem int not null default 0,
  criado_em timestamptz not null default now()
);
create index if not exists produto_fotos_idx on produto_fotos (produto_id, ordem);

create table if not exists movimentacoes_estoque (
  id bigint generated always as identity primary key,
  produto_id uuid not null references produtos(id) on delete cascade,
  tipo text not null check (tipo in ('entrada','mudanca_status','venda','cancelamento_venda','ajuste')),
  status_anterior text,
  status_novo text not null,
  quantidade_delta int,
  quantidade_apos int,
  observacao text,
  usuario_id uuid references usuarios(id) on delete set null,
  criado_em timestamptz not null default now()
);
create index if not exists movimentacoes_produto_idx on movimentacoes_estoque (produto_id, criado_em);

-- antes de gravar: atualiza a data e tira da vitrine tudo que não está disponível
create or replace function produtos_antes() returns trigger language plpgsql as $$
begin
  new.atualizado_em := now();
  if new.status <> 'disponivel' then new.publicado := false; end if;
  return new;
end $$;
drop trigger if exists trg_produtos_antes on produtos;
create trigger trg_produtos_antes before insert or update on produtos
  for each row execute function produtos_antes();

-- histórico automático de entrada e mudança de status
-- (a API pode informar quem fez: select set_config('app.usuario_id', '<uuid>', true);)
create or replace function produtos_log() returns trigger language plpgsql as $$
declare u uuid := nullif(current_setting('app.usuario_id', true), '')::uuid;
        m text := coalesce(nullif(current_setting('app.motivo', true), ''), 'ajuste');
begin
  if tg_op = 'INSERT' then
    insert into movimentacoes_estoque (produto_id, tipo, status_novo, quantidade_delta, quantidade_apos, usuario_id)
    values (new.id, 'entrada', new.status, new.quantidade, new.quantidade, u);
  elsif new.status is distinct from old.status or new.quantidade is distinct from old.quantidade then
    insert into movimentacoes_estoque (produto_id, tipo, status_anterior, status_novo, quantidade_delta, quantidade_apos, usuario_id)
    values (new.id, case when new.quantidade <> old.quantidade then m else 'mudanca_status' end,
            old.status, new.status, new.quantidade - old.quantidade, new.quantidade, u);
  end if;
  return null;
end $$;
drop trigger if exists trg_produtos_log on produtos;
create trigger trg_produtos_log after insert or update of status, quantidade on produtos
  for each row execute function produtos_log();

-- ---------- VENDAS (uma venda pode ter vários produtos) ----------
create table if not exists vendas (
  id uuid primary key default gen_random_uuid(),
  numero bigint generated always as identity unique,
  usuario_id uuid references usuarios(id) on delete set null,
  data_venda timestamptz not null default now(),
  status text not null default 'concluida' check (status in ('concluida','cancelada')),
  cancelada_em timestamptz,
  motivo_cancelamento text,
  observacoes text,
  constraint cancelamento_coerente check ((status = 'cancelada') = (cancelada_em is not null))
);
create index if not exists vendas_data_idx on vendas (data_venda);

create table if not exists venda_itens (
  id uuid primary key default gen_random_uuid(),
  venda_id uuid not null references vendas(id) on delete cascade,
  produto_id uuid not null references produtos(id),
  preco_tabela_centavos bigint not null check (preco_tabela_centavos > 0),
  preco_final_centavos bigint not null check (preco_final_centavos > 0),
  quantidade int not null default 1 check (quantidade >= 1),                 -- preços abaixo são POR UNIDADE
  desconto_centavos bigint generated always as (greatest(preco_tabela_centavos - preco_final_centavos, 0) * quantidade) stored,
  custo_centavos bigint not null default 0 check (custo_centavos >= 0),   -- custo unitário congelado na hora da venda
  unique (venda_id, produto_id)
);
create index if not exists venda_itens_produto_idx on venda_itens (produto_id);

create table if not exists venda_pagamentos (
  id uuid primary key default gen_random_uuid(),
  venda_id uuid not null references vendas(id) on delete cascade,
  forma text not null check (forma in ('pix','dinheiro','debito','credito','transferencia','outra')),
  outra_descricao text,
  valor_centavos bigint not null check (valor_centavos > 0),
  parcelas smallint not null default 1 check (parcelas between 1 and 24),
  criado_em timestamptz not null default now(),
  constraint parcelas_so_credito check (forma = 'credito' or parcelas = 1),
  constraint outra_exige_descricao check (forma <> 'outra' or coalesce(trim(outra_descricao), '') <> '')
);
create index if not exists venda_pagamentos_idx on venda_pagamentos (venda_id);

-- ---------- TROCAS (aparelho recebido) ----------
create table if not exists trocas (
  id uuid primary key default gen_random_uuid(),
  venda_id uuid not null references vendas(id) on delete cascade,
  descricao text not null,
  condicao_fisica text,
  saude_bateria smallint check (saude_bateria between 0 and 100),
  observacoes text,
  valor_entrada_centavos bigint not null check (valor_entrada_centavos >= 0),   -- NÃO é dinheiro recebido
  destino text not null check (destino in ('estoque','avaliacao','nao_adicionar')),
  produto_id uuid references produtos(id) on delete set null,   -- produto criado no estoque, se houver
  criado_em timestamptz not null default now()
);
create index if not exists trocas_venda_idx on trocas (venda_id);

create table if not exists troca_fotos (
  id uuid primary key default gen_random_uuid(),
  troca_id uuid not null references trocas(id) on delete cascade,
  url text not null,
  ordem int not null default 0
);

-- congela o custo de cada item na hora da venda (editar o custo depois não muda a margem antiga)
create or replace function venda_itens_antes_insert() returns trigger language plpgsql as $$
begin
  new.custo_centavos := coalesce((select custo_centavos from produtos where id = new.produto_id), 0);
  return new;
end $$;
drop trigger if exists trg_venda_itens_antes_insert on venda_itens;
create trigger trg_venda_itens_antes_insert before insert on venda_itens
  for each row execute function venda_itens_antes_insert();

-- item na venda concluída baixa o estoque (e recusa se não houver quantidade suficiente)
-- Para EDITAR uma venda: apague e recrie os itens na mesma transação.
create or replace function venda_itens_produto() returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if (select status from vendas where id = new.venda_id) = 'concluida' then
      perform set_config('app.motivo', 'venda', true);
      update produtos set quantidade = quantidade - new.quantidade
      where id = new.produto_id and status in ('disponivel','reservado') and quantidade >= new.quantidade;
      if not found then raise exception 'Estoque insuficiente para o produto %', new.produto_id; end if;
      perform set_config('app.motivo', '', true);
    end if;
  elsif tg_op = 'DELETE' then
    if (select status from vendas where id = old.venda_id) = 'concluida' then
      perform set_config('app.motivo', 'cancelamento_venda', true);
      update produtos set quantidade = quantidade + old.quantidade where id = old.produto_id;
      perform set_config('app.motivo', '', true);
    end if;
  end if;
  return null;
end $$;
drop trigger if exists trg_venda_itens_produto on venda_itens;
create trigger trg_venda_itens_produto after insert or delete on venda_itens
  for each row execute function venda_itens_produto();

-- venda cancelada devolve todas as quantidades ao estoque
create or replace function vendas_cancelamento() returns trigger language plpgsql as $$
begin
  if old.status = 'concluida' and new.status = 'cancelada' then
    perform set_config('app.motivo', 'cancelamento_venda', true);
    update produtos p set quantidade = p.quantidade + i.quantidade
    from venda_itens i where i.venda_id = new.id and i.produto_id = p.id;
    perform set_config('app.motivo', '', true);
  end if;
  return null;
end $$;
drop trigger if exists trg_vendas_cancelamento on vendas;
create trigger trg_vendas_cancelamento after update of status on vendas
  for each row execute function vendas_cancelamento();

-- regra de ouro: soma dos itens = pagamentos + troca (conferida no fim da transação)
create or replace function validar_venda(p_id uuid) returns void language plpgsql as $$
declare v record; total bigint; qtd int; pago bigint; troca bigint;
begin
  select status, numero into v from vendas where id = p_id;
  if not found or v.status <> 'concluida' then return; end if;
  select coalesce(sum(preco_final_centavos * quantidade), 0), count(*) into total, qtd from venda_itens where venda_id = p_id;
  if qtd = 0 then raise exception 'Venda %: sem produtos', v.numero; end if;
  select coalesce(sum(valor_centavos), 0) into pago from venda_pagamentos where venda_id = p_id;
  select coalesce(sum(valor_entrada_centavos), 0) into troca from trocas where venda_id = p_id;
  if pago + troca <> total then
    raise exception 'Venda %: pagamentos (%) + troca (%) diferem do total dos itens (%)', v.numero, pago, troca, total;
  end if;
end $$;
create or replace function trg_validar_venda() returns trigger language plpgsql as $$
begin perform validar_venda(new.id); return null; end $$;
create or replace function trg_validar_venda_filho() returns trigger language plpgsql as $$
begin perform validar_venda(coalesce(new.venda_id, old.venda_id)); return null; end $$;
drop trigger if exists ct_venda on vendas;
create constraint trigger ct_venda after insert or update on vendas
  deferrable initially deferred for each row execute function trg_validar_venda();
drop trigger if exists ct_venda_itens on venda_itens;
create constraint trigger ct_venda_itens after insert or update or delete on venda_itens
  deferrable initially deferred for each row execute function trg_validar_venda_filho();
drop trigger if exists ct_venda_pag on venda_pagamentos;
create constraint trigger ct_venda_pag after insert or update or delete on venda_pagamentos
  deferrable initially deferred for each row execute function trg_validar_venda_filho();
drop trigger if exists ct_venda_troca on trocas;
create constraint trigger ct_venda_troca after insert or update or delete on trocas
  deferrable initially deferred for each row execute function trg_validar_venda_filho();

-- ---------- DESPESAS (módulo opcional) ----------
create table if not exists despesas (
  id uuid primary key default gen_random_uuid(),
  descricao text not null,
  categoria text,
  valor_centavos bigint not null check (valor_centavos > 0),
  data_despesa date not null default current_date,
  observacoes text,
  usuario_id uuid references usuarios(id) on delete set null,
  criado_em timestamptz not null default now()
);
create index if not exists despesas_data_idx on despesas (data_despesa);

-- ---------- AUDITORIA (a API grava ações importantes) ----------
create table if not exists auditoria (
  id bigint generated always as identity primary key,
  usuario_id uuid references usuarios(id) on delete set null,
  acao text not null,                             -- ex.: 'venda.criar', 'produto.editar'
  entidade text not null,
  entidade_id text,
  detalhes jsonb,
  ip text,
  criado_em timestamptz not null default now()
);
create index if not exists auditoria_idx on auditoria (entidade, entidade_id, criado_em);

-- ---------- VIEWS ----------
-- Vitrine pública: só o que o cliente pode ver. Sem custo, sem observações internas.
create or replace view vw_vitrine_publica as
select p.id, c.slug as categoria, p.nome, p.variacao, p.condicao,
       p.saude_bateria as bateria, p.compatibilidade, p.descricao,
       p.preco_centavos as preco, p.preco_promo_centavos as preco_promo,
       coalesce((select jsonb_agg(f.url order by f.ordem, f.criado_em)
                 from produto_fotos f where f.produto_id = p.id), '[]'::jsonb) as fotos,
       p.data_entrada as entrada
from produtos p join categorias c on c.id = p.categoria_id
where p.publicado and p.status = 'disponivel' and p.quantidade > 0 and p.preco_centavos is not null and c.ativa;

create or replace view vw_vitrine_categorias as
select c.slug as id, c.nome, c.ordem from categorias c
where c.ativa and exists (select 1 from vw_vitrine_publica v where v.categoria = c.slug);

create or replace view vw_estoque as
select p.*, c.nome as categoria_nome, c.tipo as categoria_tipo,
  current_date - p.data_entrada as dias_no_estoque,
  (p.estoque_minimo is not null and p.quantidade <= p.estoque_minimo) as estoque_baixo
from produtos p join categorias c on c.id = p.categoria_id;

-- lista de reposição: produtos no limite que o dono definiu (inclui os zerados)
create or replace view vw_estoque_baixo as
select * from vw_estoque where estoque_baixo and status = 'disponivel';

create or replace view vw_vendas_resumo as
select v.id, v.numero, v.data_venda, v.status,
       it.un as unidades, it.nomes as produtos,
       it.tabela as preco_tabela_centavos, it.desconto as desconto_centavos, it.final as preco_final_centavos,
       coalesce(pg.total, 0) as recebido_centavos,
       coalesce(tr.total, 0) as troca_centavos,
       it.custo as custo_centavos,
       it.final - it.custo as margem_bruta_centavos
from vendas v
left join lateral (
  select sum(i.quantidade) un, string_agg(p.nome, ', ' order by p.nome) nomes,
         coalesce(sum(i.preco_tabela_centavos * i.quantidade), 0) tabela, coalesce(sum(i.desconto_centavos), 0) desconto,
         coalesce(sum(i.preco_final_centavos * i.quantidade), 0) final, coalesce(sum(i.custo_centavos * i.quantidade), 0) custo
  from venda_itens i join produtos p on p.id = i.produto_id where i.venda_id = v.id) it on true
left join lateral (select sum(valor_centavos) total from venda_pagamentos where venda_id = v.id) pg on true
left join lateral (select sum(valor_entrada_centavos) total from trocas where venda_id = v.id) tr on true;

-- negociado ≠ recebido ≠ lucro. Margem bruta NÃO é lucro líquido.
create or replace view vw_financeiro_mensal as
select date_trunc('month', data_venda at time zone 'America/Sao_Paulo')::date as mes,
       count(*) as vendas,
       sum(preco_final_centavos) as negociado_centavos,
       sum(desconto_centavos) as descontos_centavos,
       sum(recebido_centavos) as recebido_centavos,
       sum(troca_centavos) as trocas_centavos,
       sum(custo_centavos) as custo_centavos,
       sum(margem_bruta_centavos) as margem_bruta_centavos
from vw_vendas_resumo where status = 'concluida' group by 1;

create or replace view vw_pagamentos_por_forma_mensal as
select date_trunc('month', v.data_venda at time zone 'America/Sao_Paulo')::date as mes,
       pg.forma, count(*) as pagamentos, sum(pg.valor_centavos) as total_centavos
from venda_pagamentos pg join vendas v on v.id = pg.venda_id
where v.status = 'concluida' group by 1, 2;

-- ---------- DADOS INICIAIS ----------
insert into categorias (slug, nome, ordem, tipo) values
  ('celulares','Celulares',1,'aparelho'), ('smartwatches','Smartwatches',2,'aparelho'), ('caixas-de-som','Caixas de som',3,'acessorio'),
  ('fones','Fones de ouvido',4,'acessorio'), ('peliculas-e-acessorios','Películas e acessórios',5,'acessorio')
on conflict (slug) do nothing;

commit;

-- =====================================================================
-- OPCIONAL (recomendado): usuário só-leitura para a API pública da vitrine.
-- Troque a senha, rode e use a connection string dele em DATABASE_URL_VITRINE.
-- =====================================================================
-- create role app_vitrine login password 'TROQUE-ESTA-SENHA';
-- grant select on vw_vitrine_publica, vw_vitrine_categorias to app_vitrine;

-- =====================================================================
-- PRIMEIRO ACESSO (rode UMA vez, com seu e-mail e uma senha forte).
-- Gera hash bcrypt compatível com bcryptjs/bcrypt.
-- =====================================================================
-- create extension if not exists pgcrypto;
-- insert into usuarios (nome, email, senha_hash, papel)
-- values ('Dono', 'seu@email.com', crypt('SUA-SENHA-FORTE', gen_salt('bf', 12)), 'dono');
