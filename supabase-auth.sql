-- ============================================================
--  NEONS — contas, perfil e base para carrinho/pedidos
--  Rode no SQL Editor do Supabase ANTES de usar o login.
--  Pode rodar quantas vezes quiser: tudo aqui é idempotente.
-- ============================================================

-- ---------- 1. Tabela de perfil ----------
-- Uma linha por usuário. `id` é o mesmo UUID do auth.users,
-- então o login já traz a conta pronta sem trabalho extra.
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text,
  nome          text not null default '',
  telefone      text not null default '',
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- ---------- 2. Carrinho ----------
-- Guardamos por usuário. `variant` já vem pronta para quando os
-- produtos ganharem variações (cor, tamanho, voltagem).
create table if not exists public.cart_items (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  product_id text not null,
  variant    jsonb not null default '{}'::jsonb,
  quantidade int  not null default 1 check (quantidade > 0),
  criado_em  timestamptz not null default now()
);

-- Um item por produto+variação: evita duplicar a mesma oferta
-- quando o usuário clica no botão de novo.
create unique index if not exists cart_items_uniq
  on public.cart_items (user_id, product_id, variant);

create index if not exists cart_items_user
  on public.cart_items (user_id);

-- ---------- 3. Pedidos ----------
-- Histórico do que foi reservado. O preço é congelado no momento
-- do pedido: se o preço mudar depois, o histórico continua correto.
create table if not exists public.orders (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete set null,
  status     text not null default 'pendente',
  total      numeric(12,2) not null default 0,
  itens      jsonb not null default '[]'::jsonb,
  criado_em  timestamptz not null default now()
);

create index if not exists orders_user
  on public.orders (user_id, criado_em desc);

-- ---------- 4. Row Level Security ----------
-- Regra única: cada usuário só enxerga e mexe no que é dele.
-- Leitura anônima continua bloqueada; a vitrine usa a tabela `products`.
alter table public.profiles   enable row level security;
alter table public.cart_items enable row level security;
alter table public.orders     enable row level security;

-- profiles
drop policy if exists "perfil proprio: ler"    on public.profiles;
drop policy if exists "perfil proprio: criar"  on public.profiles;
drop policy if exists "perfil proprio: alterar" on public.profiles;
create policy "perfil proprio: ler"    on public.profiles for select using (auth.uid() = id);
create policy "perfil proprio: criar"  on public.profiles for insert with check (auth.uid() = id);
create policy "perfil proprio: alterar" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

-- cart_items
drop policy if exists "carrinho proprio: tudo" on public.cart_items;
create policy "carrinho proprio: tudo" on public.cart_items for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- orders
drop policy if exists "pedidos proprios: ler"  on public.orders;
drop policy if exists "pedidos proprios: criar" on public.orders;
create policy "pedidos proprios: ler"  on public.orders for select using (auth.uid() = user_id);
create policy "pedidos proprios: criar" on public.orders for insert with check (auth.uid() = user_id);

-- ---------- 5. Criar o perfil automaticamente no cadastro ----------
-- Sem isso a linha em `profiles` só existiria depois do primeiro
-- upsert feito pelo painel, e nome/avatar ficariam vazios até lá.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, nome)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'nome', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
--  PRÓXIMOS PASSOS
--  1. No Supabase: Authentication → Providers → Email.
--     Desligue "Confirm email" se quiser login imediato;
--     ligado é mais seguro, mas exige clicar no link do e-mail.
--  2. Site Settings → URL Configuration: copie o domínio real
--     para os redirects de recuperação de senha.
--  3. Em Authentication → URL Configuration, adicione
--     http://localhost:8000/** para desenvolvimento local.
-- ============================================================