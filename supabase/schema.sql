-- PigSync — schema inicial (galpões, silos, lotes, eventos, saldo)

create table public.galpoes (
  id uuid primary key default gen_random_uuid(),
  numero integer not null unique,
  nome text not null
);

create table public.silos (
  id uuid primary key default gen_random_uuid(),
  galpao_id uuid not null references public.galpoes(id) on delete cascade,
  numero integer not null,
  unique (galpao_id, numero)
);

create table public.lotes (
  id uuid primary key default gen_random_uuid(),
  silo_id uuid not null references public.silos(id) on delete cascade,
  quantidade_inicial integer not null,
  data_entrada date not null default current_date,
  status text not null default 'ativo' check (status in ('ativo', 'encerrado'))
);

create table public.perfis (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  papel text not null default 'operador'
);

create table public.eventos_lote (
  id uuid primary key default gen_random_uuid(),
  lote_id uuid not null references public.lotes(id) on delete cascade,
  silo_id uuid not null references public.silos(id),
  tipo text not null check (tipo in ('baixa', 'contagem')),
  quantidade integer not null,
  metodo text,
  confianca numeric,
  motivo text,
  midia_path text,
  usuario_id uuid not null references auth.users(id),
  criado_em timestamptz not null default now(),
  sincronizado_em timestamptz
);

create view public.saldo_lotes as
with ultima_contagem as (
  select distinct on (lote_id)
    lote_id,
    quantidade as valor,
    criado_em
  from public.eventos_lote
  where tipo = 'contagem'
  order by lote_id, criado_em desc
),
baixas_pos_contagem as (
  select e.lote_id, sum(e.quantidade) as total
  from public.eventos_lote e
  left join ultima_contagem uc on uc.lote_id = e.lote_id
  where e.tipo = 'baixa'
    and (uc.criado_em is null or e.criado_em > uc.criado_em)
  group by e.lote_id
)
select
  l.id as lote_id,
  l.silo_id,
  l.quantidade_inicial,
  coalesce(uc.valor, l.quantidade_inicial) - coalesce(bp.total, 0) as quantidade_atual,
  uc.criado_em as ultima_contagem_em,
  uc.valor as ultima_contagem_valor
from public.lotes l
left join ultima_contagem uc on uc.lote_id = l.id
left join baixas_pos_contagem bp on bp.lote_id = l.id;

-- RLS: qualquer usuário autenticado (funcionário logado) pode ler tudo;
-- só pode inserir eventos em nome do próprio usuário.
alter table public.galpoes enable row level security;
alter table public.silos enable row level security;
alter table public.lotes enable row level security;
alter table public.perfis enable row level security;
alter table public.eventos_lote enable row level security;

create policy "authenticated_select_galpoes" on public.galpoes
  for select to authenticated using (true);
create policy "authenticated_select_silos" on public.silos
  for select to authenticated using (true);
create policy "authenticated_select_lotes" on public.lotes
  for select to authenticated using (true);
create policy "authenticated_select_perfis" on public.perfis
  for select to authenticated using (true);
create policy "authenticated_select_eventos" on public.eventos_lote
  for select to authenticated using (true);
create policy "authenticated_insert_eventos" on public.eventos_lote
  for insert to authenticated with check (usuario_id = auth.uid());

grant usage on schema public to authenticated;
grant select on public.galpoes, public.silos, public.lotes, public.perfis, public.saldo_lotes to authenticated;
grant select, insert on public.eventos_lote to authenticated;

-- Perfil do usuário já criado no Auth
insert into public.perfis (id, nome, papel) values
  ('3f94fd69-b916-4929-ad25-1486ea57d954', 'Gabriel', 'admin');

-- Estrutura da fazenda: 6 galpões, silos numerados 1 a 12 (sequencial
-- pela fazenda toda, não reiniciando a cada galpão), 1 lote ativo por silo
do $$
declare
  g_id uuid;
  s_id uuid;
  gnum int;
  silo_num int := 0;
begin
  for gnum in 1..6 loop
    insert into public.galpoes (numero, nome) values (gnum, 'Galpão ' || gnum) returning id into g_id;
    for i in 1..2 loop
      silo_num := silo_num + 1;
      insert into public.silos (galpao_id, numero) values (g_id, silo_num) returning id into s_id;
      insert into public.lotes (silo_id, quantidade_inicial, data_entrada, status)
        values (s_id, 200, current_date - 10, 'ativo');
    end loop;
  end loop;
end $$;
