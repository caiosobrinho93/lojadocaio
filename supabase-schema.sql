-- ============================================================
-- NeonDeals / Loja do Caio — esquema do banco (Supabase)
-- Cole isto em: Supabase → SQL Editor → New query → Run
-- ============================================================

create table if not exists public.products (
  id         text primary key,
  nome       text not null,
  emoji      text default '',
  img        text default '',
  store      text default '',
  preco      numeric default 0,
  de         numeric default 0,
  nota       numeric default 0,
  cor        jsonb   default '["#1b2a6b","#6b1b8f"]'::jsonb,
  descricao  text    default '',
  specs      jsonb   default '[]'::jsonb,
  link       text    default '',
  created_at timestamptz default now()
);

-- Liga a segurança por linha (RLS)
alter table public.products enable row level security;

-- ------------------------------------------------------------
-- POLÍTICAS (versão simples — funciona na hora)
-- Leitura liberada para todos; escrita liberada para a chave
-- pública (o painel). ATENÇÃO: assim qualquer pessoa com a
-- chave pública consegue escrever. Veja a versão segura abaixo.
-- ------------------------------------------------------------
drop policy if exists "products_read"  on public.products;
drop policy if exists "products_write" on public.products;

create policy "products_read"  on public.products
  for select using (true);

create policy "products_write" on public.products
  for all using (true) with check (true);

-- ============================================================
-- VERSÃO SEGURA (opcional, recomendada depois)
-- ------------------------------------------------------------
-- 1) Rode primeiro:
--    drop policy if exists "products_write" on public.products;
-- 2) Desabilite o cadastro público em Authentication → Providers
--    → Email → "Enable sign ups" = OFF, e crie um usuário admin.
-- 3) Descomente as políticas abaixo:
--
-- create policy "products_read" on public.products
--   for select using (true);
--
-- create policy "products_admin_write" on public.products
--   for all to authenticated using (true) with check (true);
-- ============================================================
