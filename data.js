/* ============================================================
   data.js — camada de dados da loja (v2)
   ------------------------------------------------------------
   Funciona em 2 modos, automaticamente:
     - SUPABASE  -> se a tabela existir e a config estiver certa
     - LOCAL     -> localStorage (fallback: nunca quebra a loja)
   Inclua ANTES do script principal:
       <script src="config.js"></script>
       <script src="...supabase-js.../umd/supabase.js"></script>
       <script src="data.js"></script>
   API pública: window.Store
   ============================================================ */
(function (global) {
  'use strict';

  var CFG = global.NEON_CONFIG || {};
  var KEY_PRODUCTS = 'neondeals.products.v1';
  var KEY_SETTINGS = 'neondeals.settings.v1';
  var TABLE = CFG.table || 'products';

  /* Lojas parceiras (usadas nos filtros e nos selos) */
  var STORES = {
    shopee: { n: 'Shopee', c: '#ff5722' },
    ml:     { n: 'Mercado Livre', c: '#ffe600' },
    amazon: { n: 'Amazon', c: '#ff9900' },
    ali:    { n: 'AliExpress', c: '#ff4747' }
  };

  /* Identidade da loja (editável no painel) */
  var DEFAULT_SETTINGS = {
    brandA: 'NEON',
    brandB: 'DEALS',
    footer: 'NeonDeals reúne ofertas de várias lojas. Ao clicar, você é redirecionado ao site da loja parceira, onde a compra é feita. Podemos receber comissão por vendas, sem custo extra para você. Preços e disponibilidade podem mudar na loja.',
    password: 'admin'
  };

  /* Produtos iniciais (seed) — usados quando ainda não há nada salvo */
  var SEED = [
    { id: 'fone-bt', img: '', nome: 'Fone Bluetooth Gamer RGB', emoji: '🎧', store: 'shopee', preco: 89.9, de: 149.9, nota: 4.8, cor: ['#1b2a6b', '#6b1b8f'], desc: 'Fone sem fio com baixa latência, microfone embutido e iluminação RGB. Ideal para jogos e chamadas.', specs: ['Bluetooth 5.3', 'Bateria de até 30h', 'Microfone com cancelamento de ruído'], link: 'https://shopee.com.br/' },
    { id: 'teclado-mec', img: '', nome: 'Teclado Mecânico 60% Hot-Swap', emoji: '⌨️', store: 'ml', preco: 219, de: 329, nota: 4.9, cor: ['#0f4c5c', '#1b1b4b'], desc: 'Teclado compacto com switches trocáveis e iluminação personalizável.', specs: ['Layout 60%', 'Switch hot-swap', 'Conexão USB-C'], link: 'https://www.mercadolivre.com.br/' },
    { id: 'mouse', img: '', nome: 'Mouse Gamer 12000 DPI', emoji: '🖱️', store: 'amazon', preco: 129.9, de: 189.9, nota: 4.7, cor: ['#5c0f3c', '#1b1b4b'], desc: 'Sensor óptico preciso, 6 botões programáveis e design ergonômico.', specs: ['12000 DPI', '6 botões', 'Peso 85g'], link: 'https://www.amazon.com.br/' },
    { id: 'smartwatch', img: '', nome: 'Smartwatch Fitness Tela AMOLED', emoji: '⌚', store: 'ali', preco: 159, de: 299, nota: 4.5, cor: ['#0f5c3c', '#1b2a6b'], desc: 'Monitora passos, sono e batimentos, com mais de 100 modos esportivos.', specs: ['Tela AMOLED 1.43"', 'Resistente à água', 'Bateria de 7 dias'], link: 'https://pt.aliexpress.com/' },
    { id: 'led', img: '', nome: 'Fita LED RGB 10m com Controle', emoji: '💡', store: 'shopee', preco: 39.9, de: 79.9, nota: 4.6, cor: ['#6b1b8f', '#8f1b4b'], desc: 'Fita LED com app e controle remoto. Sincroniza com música.', specs: ['10 metros', '16 milhões de cores', 'Adesivo 3M'], link: 'https://shopee.com.br/' },
    { id: 'caixa-som', img: '', nome: 'Caixa de Som Portátil à Prova d’Água', emoji: '🔊', store: 'ml', preco: 179, de: 249, nota: 4.8, cor: ['#1b4b8f', '#0f5c5c'], desc: 'Som potente e graves profundos, resistente a respingos e poeira.', specs: ['IPX7', '12h de bateria', 'Bluetooth 5.0'], link: 'https://www.mercadolivre.com.br/' },
    { id: 'webcam', img: '', nome: 'Webcam Full HD 1080p', emoji: '📷', store: 'amazon', preco: 99.9, de: 159.9, nota: 4.4, cor: ['#4b1b8f', '#1b1b4b'], desc: 'Imagem nítida para lives, aulas e reuniões, com microfone duplo.', specs: ['1080p 30fps', 'Foco automático', 'Plug and play'], link: 'https://www.amazon.com.br/' },
    { id: 'suporte', img: '', nome: 'Suporte Articulado para Notebook', emoji: '💻', store: 'ali', preco: 59.9, de: 119.9, nota: 4.6, cor: ['#8f4b1b', '#4b1b6b'], desc: 'Alumínio ajustável em altura e ângulo. Melhora a postura e a ventilação.', specs: ['Alumínio', 'Dobrável', 'Até 17 polegadas'], link: 'https://pt.aliexpress.com/' }
  ];
  /* ---------- helpers ---------- */
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function uid(prefix) { return (prefix || 'id') + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function read(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return clone(fallback);
      var v = JSON.parse(raw);
      return (v === null || v === undefined) ? clone(fallback) : v;
    } catch (e) { console.warn('NeonDeals: dados corrompidos, usando padrão.', e); return clone(fallback); }
  }
  function write(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); return true; }
    catch (e) { console.warn('NeonDeals: não foi possível salvar.', e); return false; }
  }

  /* ---------- estado ---------- */
  var cache = null, settingsCache = null, mode = 'local', lastError = '', sb = null, listeners = [];
  function notify() { for (var i = 0; i < listeners.length; i++) { try { listeners[i](); } catch (e) { console.warn(e); } } }

  /* ---------- mapeamento local <-> banco (coluna descricao <-> desc) ---------- */
  function toDb(p) {
    return {
      id: p.id, nome: p.nome || '', emoji: p.emoji || '', img: p.img || '', store: p.store || '',
      preco: Number(p.preco) || 0, de: Number(p.de) || 0, nota: Number(p.nota) || 0,
      cor: p.cor || ['#1b2a6b', '#6b1b8f'], descricao: p.desc || '', specs: p.specs || [], link: p.link || ''
    };
  }
  function fromDb(r) {
    return {
      id: r.id, nome: r.nome, emoji: r.emoji || '', img: r.img || '', store: r.store || '',
      preco: Number(r.preco) || 0, de: Number(r.de) || 0, nota: Number(r.nota) || 0,
      cor: Array.isArray(r.cor) ? r.cor : ['#1b2a6b', '#6b1b8f'], desc: r.descricao || '',
      specs: Array.isArray(r.specs) ? r.specs : [], link: r.link || ''
    };
  }

  function pushRemote(fn) {
    if (mode !== 'supabase' || !sb) return;
    try {
      Promise.resolve(fn(sb)).then(function (res) { if (res && res.error) lastError = res.error.message; })
        .catch(function (e) { lastError = (e && e.message) || String(e); });
    } catch (e) { lastError = (e && e.message) || String(e); }
  }

  var Store = {
    STORES: STORES,
    uid: uid,
    config: CFG,
    onChange: function (cb) { if (typeof cb === 'function') listeners.push(cb); },
    mode: function () { return mode; },
    status: function () { return { mode: mode, table: TABLE, url: CFG.supabaseUrl || '', error: lastError }; },

    /* Conecta (se possível) e carrega os produtos. Sempre resolve — nunca quebra a loja. */
    init: function () {
      cache = read(KEY_PRODUCTS, SEED);
      settingsCache = Object.assign({}, clone(DEFAULT_SETTINGS), read(KEY_SETTINGS, {}));
      if (!CFG.supabaseUrl || !CFG.supabaseKey || !global.supabase || !global.supabase.createClient) {
        lastError = CFG.supabaseUrl ? 'Biblioteca do Supabase não carregada (offline?).' : 'Supabase não configurado.';
        mode = 'local';
        return Promise.resolve(mode);
      }
      try { sb = global.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey); }
      catch (e) { lastError = e.message; mode = 'local'; return Promise.resolve(mode); }
      return sb.from(TABLE).select('*').then(function (res) {
        if (res && res.error) { lastError = res.error.message; mode = 'local'; }
        else {
          var rows = (res && res.data) || [];
          if (rows.length) { cache = rows.map(fromDb); write(KEY_PRODUCTS, cache); }
          mode = 'supabase'; lastError = '';
        }
        notify(); return mode;
      }).catch(function (e) { lastError = (e && e.message) || String(e); mode = 'local'; notify(); return mode; });
    },

    products: {
      list: function () { return clone(cache || read(KEY_PRODUCTS, SEED)); },
      get: function (id) { return this.list().filter(function (p) { return p.id === id; })[0] || null; },
      saveLocal: function (arr) { cache = arr; write(KEY_PRODUCTS, arr); },
      add: function (p) {
        if (!p.id) p.id = uid('prod');
        var arr = this.list(); arr.unshift(p); this.saveLocal(arr);
        pushRemote(function (c) { return c.from(TABLE).upsert(toDb(p)); });
        notify(); return p;
      },
      update: function (id, patch) {
        var arr = this.list(), i = -1;
        for (var k = 0; k < arr.length; k++) { if (arr[k].id === id) { i = k; break; } }
        if (i < 0) return null;
        arr[i] = Object.assign({}, arr[i], patch);
        this.saveLocal(arr);
        pushRemote(function (c) { return c.from(TABLE).upsert(toDb(arr[i])); });
        notify(); return arr[i];
      },
      remove: function (id) {
        var arr = this.list().filter(function (x) { return x.id !== id; });
        this.saveLocal(arr);
        pushRemote(function (c) { return c.from(TABLE).delete().eq('id', id); });
        notify(); return arr;
      },
      reset: function () { cache = clone(SEED); write(KEY_PRODUCTS, cache); notify(); return clone(cache); },
      replaceAll: function (arr) { this.saveLocal(arr || []); notify(); return clone(cache); }
    },
    settings: {
      get: function () { return Object.assign({}, clone(DEFAULT_SETTINGS), settingsCache || read(KEY_SETTINGS, {})); },
      set: function (patch) {
        var s = this.get();
        Object.assign(s, patch || {});
        settingsCache = s; write(KEY_SETTINGS, s);
        notify(); return s;
      },
      reset: function () {
        settingsCache = clone(DEFAULT_SETTINGS);
        try { localStorage.removeItem(KEY_SETTINGS); } catch (e) {}
        notify(); return clone(settingsCache);
      }
    },

    /* Exporta tudo como JSON (backup) */
    exportJSON: function () {
      return JSON.stringify({ settings: this.settings.get(), products: this.products.list() }, null, 2);
    },

    /* Importa um JSON gerado por exportJSON (ou só uma lista de produtos) */
    importJSON: function (text) {
      var data = JSON.parse(text);
      var arr = Array.isArray(data) ? data : data.products;
      if (!Array.isArray(arr)) throw new Error('O JSON precisa conter uma lista de produtos.');
      if (data && data.settings) this.settings.set(data.settings);
      this.products.replaceAll(arr);
      return arr.length;
    },

    /* ---------- nuvem (Supabase) ---------- */
    cloud: {
      available: function () { return mode === 'supabase' && !!sb; },
      uploadAll: function () {
        if (mode !== 'supabase' || !sb) return Promise.reject(new Error('Supabase indisponível (modo local).'));
        var rows = Store.products.list().map(toDb);
        if (!rows.length) return Promise.resolve(0);
        return sb.from(TABLE).upsert(rows).then(function (res) {
          if (res && res.error) throw new Error(res.error.message);
          return rows.length;
        });
      },
      downloadAll: function () {
        if (mode !== 'supabase' || !sb) return Promise.reject(new Error('Supabase indisponível (modo local).'));
        return sb.from(TABLE).select('*').then(function (res) {
          if (res && res.error) throw new Error(res.error.message);
          var rows = (res && res.data) || [];
          Store.products.replaceAll(rows.map(fromDb));
          return rows.length;
        });
      }
    }
  };

  /* Sincroniza automaticamente entre abas (painel <-> loja) */
  global.addEventListener('storage', function (e) {
    if (e.key === KEY_PRODUCTS) { cache = read(KEY_PRODUCTS, SEED); notify(); }
    else if (e.key === KEY_SETTINGS) { settingsCache = Object.assign({}, clone(DEFAULT_SETTINGS), read(KEY_SETTINGS, {})); notify(); }
  });

  global.Store = Store;

})(window);
