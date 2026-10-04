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

A conexão usa `config.js`:

```js
window.NEON_CONFIG = {
  supabaseUrl: 'https://iieemoegprfqbfuepmgj.supabase.co',
  supabaseKey: 'sb_publishable_...',   // chave PÚBLICA (pode ficar no front)
  table: 'products'
};
```

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

> Como é 100% estático, **não precisa** de variáveis de ambiente no Vercel — as chaves já estão em `config.js` (a chave *publishable* é pública por design).

### GitHub Pages (alternativa)
Settings → Pages → Deploy from branch → `main` / `root`.

## Segurança (importante)

- A chave `sb_publishable_` é **pública** — o que protege os dados são as **políticas (RLS)** no Supabase.
- O `supabase-schema.sql` libera **leitura para todos** e **escrita para a chave pública** (para o painel funcionar). Para produção, use a **versão segura comentada** no fim do SQL (cria um usuário admin e permite escrita só para autenticados).
- A senha do painel é uma proteção de tela (client-side), não substitui a autenticação real do Supabase.
