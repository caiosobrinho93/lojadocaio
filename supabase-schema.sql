-- ============================================================
-- NEONS — esquema do banco (Supabase)
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
-- POLÍTICAS — configuração SEGURA por padrão
-- Leitura liberada para todos (catálogo público), escrita
-- somente para quem estiver autenticado no Supabase Auth.
--
-- ⚠️ NÃO apague a policy "products_admin_write": enquanto ela
-- não existir, o painel não consegue salvar nada. Antes de logar
-- pela 1ª vez, rode supabase-security.sql (o mesmo resultado).
--
-- Antes de usar o painel, crie o usuário em:
--   Authentication → Users → Add user → e-mail + senha
--   → marque "Auto Confirm User"
-- Depois desabilite cadastros novos em:
--   Authentication → Providers → Email → "Enable sign ups" = OFF
-- e faça login em admin.html → aba Identidade →
-- "Segurança — login na nuvem".
-- ------------------------------------------------------------
drop policy if exists "products_read"       on public.products;
drop policy if exists "products_write"      on public.products;
drop policy if exists "products_admin_write" on public.products;

create policy "products_read" on public.products
  for select using (true);

create policy "products_admin_write" on public.products
  for all
  to authenticated
  using (true)
  with check (true);

-- ============================================================
-- SOMENTE se você quiser o painel SEM login (menos seguro —
-- qualquer pessoa com a chave pública passa a escrever):
--   drop policy if exists "products_admin_write" on public.products;
--   create policy "products_write" on public.products
--     for all using (true) with check (true);
-- ============================================================
