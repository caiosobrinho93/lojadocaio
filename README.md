# Loja do Caio (NeonDeals)

Loja de ofertas (visual neon original **mantido**) + **painel de administração** para adicionar, editar e excluir produtos, com banco de dados **Supabase**.

## Arquivos

```
index.html            -> a loja (design original)
admin.html            -> o painel/dashboard (senha padrão: admin)
data.js               -> camada de dados (local + Supabase)
config.js             -> URL e chave do Supabase
supabase-schema.sql   -> cria a tabela no Supabase (rode 1x)
imgs/                 -> fotos dos produtos
```

## Como funcionar localmente

1. Abra `index.html` (duplo clique) → a loja.
2. Abra `admin.html` → o painel (senha: **admin**).

> A loja funciona **mesmo sem internet/Supabase** (modo local, salvo no navegador). Ao conectar o Supabase, os produtos passam a ser **públicos para todos**.

## Conectar o Supabase (para os produtos ficarem públicos)

1. Entre em **https://supabase.com** → seu projeto → **SQL Editor** → *New query*.
2. Cole todo o conteúdo de **`supabase-schema.sql`** e clique em **Run**.
3. Abra `admin.html` → aba **Identidade** → seção **Nuvem (Supabase)**.
   - Deve aparecer **“● Conectado ao Supabase”**.
   - Clique em **“Enviar produtos para a nuvem”** (envia os 8 produtos de exemplo).
4. Pronto: a loja passa a mostrar os produtos vindos do banco.

A conexão usa `config.js` (sem segredos no repo):

```js
// config.js — lê de localStorage (chave salva no admin) ou config.local.js (dev)
window.NEON_CONFIG = { supabaseUrl: 'https://...', supabaseKey: '', table: 'products' };
```

> **Chave publishable:** cole no painel `admin.html` → seção **Nuvem → Chave local**
> (fica só no navegador, nunca commitada). Para dev local, copie
> `config.local.example.js` para `config.local.js` (ignorado pelo git).

## Painel (admin.html)

- **Produtos**: `+ Novo produto`, `Editar`, `Excluir`, busca e contador.
- **Identidade**: nome da loja, rodapé, senha do painel.
- **Backup**: exportar/importar JSON e restaurar original.
- **Nuvem**: status da conexão, enviar e baixar produtos do Supabase.

O badge no topo mostra **Nuvem** (conectado) ou **Local**.

## Deploy

### Vercel (recomendado — site estático)
1. Suba este repositório no GitHub.
2. Em https://vercel.com → **Add New… → Project** → importe o repositório.
3. Framework Preset: **Other**. Build Command: (vazio). Output Directory: (raiz `.`).
4. **Deploy**. A loja fica em `https://SEU-PROJETO.vercel.app` e o painel em `/admin.html`.

> Como é 100% estático, **não precisa** de variáveis de ambiente no Vercel — a chave
> publishable é colada no painel (admin → Nuvem → Chave local) e fica só no navegador.

### GitHub Pages (alternativa)
Settings → Pages → Deploy from branch → `main` / `root`.

## Segurança (importante)

A chave `sb_publishable_` é **pública** — quem protege os dados são as **políticas (RLS)** + **Supabase Auth**.

**Estado atual do banco:** escrita liberada para a chave pública (para o painel funcionar sem login).
**Para blindar (recomendado):**

1. Supabase → **Authentication → Users → Add user**: crie e-mail/senha e marque **"Auto Confirm User"**.
2. SQL Editor → cole **`supabase-security.sql`** → **Run** (deixa a escrita só para usuários logados).
3. `admin.html` → aba **Identidade** → **"Segurança — login na nuvem"** → entre com esse e-mail/senha.
4. A partir daí, só quem está logado altera produtos. (Para voltar ao modo simples, as instruções estão no fim do próprio `supabase-security.sql`.)

A senha antiga (`admin`) do painel é só uma proteção de tela client-side; **não** substitui o login real acima.
