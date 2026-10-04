/* ============================================================
   config.js — configuração da loja (SEM SEGREDOS NO REPO)
   ------------------------------------------------------------
   A chave "publishable" do Supabase é pública por design, MAS
   não deve ficar hardcoded no repositório (o scanner GitGuardian/
   Gitleaks acusa como generic-api-key). Estratégia segura para
   site 100% estático (sem backend):
     1) Primeiro tenta ler de localStorage (definido no admin ou
        via console): localStorage.neondeals.supabase = JSON com
        {supabaseUrl, supabaseKey, table}.
     2) Senão, usa APENAS a URL pública (sem chave) — a loja cai
        para o modo LOCAL (localStorage) e continua funcionando.
     3) No admin.html há um campo "Nuvem (Supabase)" para colar
        a chave publishable localmente (nunca commitada).
   A segurança de verdade é feita pelas POLÍTICAS (RLS) no banco
   — veja supabase-schema.sql / supabase-security.sql.
   Para reverter ao modo simples (dev local), crie um arquivo
   config.local.js (IGNORADO pelo git) com window.NEON_CONFIG.
   ============================================================ */
(function () {
  var S = {};
  try { S = JSON.parse(localStorage.getItem('neondeals.supabase') || '{}'); } catch (e) { S = {}; }
  var base = window.NEON_CONFIG || {};
  window.NEON_CONFIG = {
    supabaseUrl: S.supabaseUrl || base.supabaseUrl || 'https://iieemoegprfqbfuepmgj.supabase.co',
    supabaseKey: S.supabaseKey || base.supabaseKey || '',
    table: S.table || base.table || 'products'
  };
})();

