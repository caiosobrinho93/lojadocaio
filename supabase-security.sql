-- ============================================================
-- Loja do Caio — SEGURANÇA (RLS)
-- Rode em: Supabase → SQL Editor → New query → Run
-- ------------------------------------------------------------
-- Resultado: leitura PÚBLICA (a loja continua aberta para todos)
-- e escrita SOMENTE para quem estiver logado (Supabase Auth).
--
-- ANTES de rodar, crie o usuário do painel:
--   Authentication → Users → Add user → e-mail + senha
--   → marque "Auto Confirm User" (para não precisar confirmar e-mail)
-- Depois abra admin.html → aba Identidade → "Segurança — login na nuvem"
-- e faça login com esse e-mail/senha.
-- ============================================================

alter table public.products enable row level security;

-- Leitura liberada para todos (catálogo público)
drop policy if exists "products_read" on public.products;
create policy "products_read" on public.products
  for select using (true);

-- Escrita: somente usuários autenticados
drop policy if exists "products_write" on public.products;
drop policy if exists "products_admin_write" on public.products;
create policy "products_admin_write" on public.products
  for all
  to authenticated
  using (true)
  with check (true);

-- ============================================================
-- Para VOLTAR ao modo simples (funciona sem login), rode:
--   drop policy if exists "products_admin_write" on public.products;
--   create policy "products_write" on public.products
--     for all using (true) with check (true);
-- ============================================================
