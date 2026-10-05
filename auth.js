/* ============================================================
   auth.js — sistema de login do NEONS
   ------------------------------------------------------------
   Incluir antes de qualquer script que use login:
       config.js / config.local.js / supabase-js / auth.js

   API pública: window.Auth

   Decisões de projeto
   --------------------
   * A senha NUNCA é comparada aqui no navegador. A verificação é feita
     pelo Supabase; o navegador só recebe o token JWT já validado.
   * A sessão é persistida pelo próprio supabase-js, o que sobrevive a
     recarregar a página e evita round-trip no boot.
   * Todo acesso passa por `ready()` ou pelo evento onChange, evitando
     race entre o render e a restauração da sessão.
   * `profiles` guarda nome e telefone. Carrinho e pedidos entram depois,
     como novas tabelas — nada aqui precisa ser reescrito.
   ============================================================ */
(function (global) {
  'use strict';

  var CFG = global.NEON_CONFIG || {};
  var TABLE_PROFILE = (CFG.profileTable || 'profiles');
  var KEY_PROFILE = 'neons.profile.v1';

  var sb = null;
  var state = { status: 'loading', user: null, profile: null, error: null };
  var bootPromise = null;
  var listeners = [];

  /* ---------- utilidades ---------- */
  function nowIso() { return new Date().toISOString(); }
  function clone(o) { return o == null ? o : JSON.parse(JSON.stringify(o)); }

  /* Cache local do perfil: a tela abre instantânea mesmo offline e o
     perfil real substitui o cache assim que a rede responde. */
  function readProfileCache(uid) {
    try {
      var all = JSON.parse(localStorage.getItem(KEY_PROFILE) || '{}');
      return all && all[uid] ? all[uid] : null;
    } catch (e) { return null; }
  }
  function writeProfileCache(uid, data) {
    try {
      var all = JSON.parse(localStorage.getItem(KEY_PROFILE) || '{}');
      all[uid] = data;
      localStorage.setItem(KEY_PROFILE, JSON.stringify(all));
    } catch (e) { /* cache é opcional: falhar aqui não pode quebrar o app */ }
  }
  function clearProfileCache(uid) {
    try {
      var all = JSON.parse(localStorage.getItem(KEY_PROFILE) || '{}');
      delete all[uid];
      localStorage.setItem(KEY_PROFILE, JSON.stringify(all));
    } catch (e) {}
  }

  function emit() {
    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i](state); } catch (e) { console.warn(e); }
    }
  }
  function setState(patch) {
    state = Object.assign({}, state, patch);
    emit();
    return state;
  }
  function configured() {
    return !!(CFG.supabaseUrl && CFG.supabaseKey && global.supabase && global.supabase.createClient);
  }
  /* Converte o erro do Supabase em texto útil. Mensagens cruas em inglês
     não devem vazar para a tela: além de ruins, distinguir "e-mail não
     existe" de "senha errada" é um oráculo para adivinhar contas alheias. */
  function friendly(err) {
    var m = (err && (err.message || err.error_description)) || '';
    var s = String(m).toLowerCase();
    if (!s) return 'Não foi possível continuar. Tente novamente.';
    if (s.indexOf('invalid login credentials') >= 0) return 'E-mail ou senha incorretos.';
    if (s.indexOf('email not confirmed') >= 0) return 'Confirme seu e-mail antes de entrar.';
    if (s.indexOf('user already registered') >= 0) return 'Já existe uma conta com esse e-mail.';
    if (s.indexOf('password should be') >= 0 || s.indexOf('at least') >= 0) return 'A senha precisa de pelo menos 6 caracteres.';
    if (s.indexOf('rate limit') >= 0 || s.indexOf('too many') >= 0) return 'Muitas tentativas. Aguarde alguns instantes.';
    if (s.indexOf('fetch') >= 0 || s.indexOf('network') >= 0) return 'Sem conexao com o servidor.';
    if (s.indexOf('row-level security') >= 0 || s.indexOf('rls') >= 0) return 'Permissao negada. Verifique as politicas do banco.';
    return 'Não foi possível continuar. Tente novamente.';
  }

  /* ---------- perfil ---------- */
  function localProfile(user, extra) {
    var meta = (user && user.user_metadata) || {};
    return Object.assign({
      id: user.id,
      email: user.email,
      nome: meta.nome || meta.name || meta.full_name || '',
      telefone: meta.telefone || '',
      criadoEm: (user.created_at || nowIso())
    }, extra || {});
  }

  function loadProfile(user) {
    if (!user) return Promise.resolve(null);
    var cached = readProfileCache(user.id);
    if (cached) setState({ profile: localProfile(user, cached) });

    if (!sb || !configured()) {
      return Promise.resolve(setState({ profile: localProfile(user, cached) }).profile);
    }
    return sb.from(TABLE_PROFILE).select('*').eq('id', user.id).limit(1).then(function (res) {
      if (res && res.error) throw res.error;
      var row = (res && res.data && res.data[0]) || null;
      var prof = localProfile(user, row || cached || {});
      writeProfileCache(user.id, prof);
      return setState({ profile: prof }).profile;
    }).catch(function () {
      /* RLS pode bloquear a leitura: seguimos com cache + metadados */
      return setState({ profile: localProfile(user, cached) }).profile;
    });
  }
  /* ---------- boot ---------- */
  function boot() {
    if (bootPromise) return bootPromise;

    if (!configured()) {
      state = { status: 'unavailable', user: null, profile: null, error: 'Supabase não configurado.' };
      bootPromise = Promise.resolve(state);
      emit();
      return bootPromise;
    }
    try { sb = global.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey); }
    catch (e) {
      state = { status: 'unavailable', user: null, profile: null, error: e.message };
      bootPromise = Promise.resolve(state); emit(); return bootPromise;
    }

    /* supabase-js já tem a sessão persistida: getSession resolve sem rede */
    bootPromise = sb.auth.getSession().then(function (r) {
      if (r && r.error) throw r.error;
      var user = (r && r.session && r.session.user) || null;
      return loadProfile(user).then(function () {
        return setState({ status: user ? 'authed' : 'anon', user: user, error: null });
      });
    }).catch(function (e) {
      return setState({ status: 'error', user: null, profile: null, error: friendly(e) });
    });

    /* outra aba entrando/saindo: o estado local acompanha */
    if (global.addEventListener) {
      global.addEventListener('storage', function (ev) {
        if (ev.key && ev.key.indexOf('sb-') !== 0) return;
        if (!sb) return;
        sb.auth.getSession().then(function (r) {
          var u = (r && r.session && r.session.user) || null;
          if (!u && state.status === 'authed') {
            setState({ status: 'anon', user: null, profile: null });
          }
        });
      });
      /* refresh automático do token, sem travar a interface */
      if (sb.auth.onAuthStateChange) {
        sb.auth.onAuthStateChange(function (ev, s) {
          if (ev === 'SIGNED_OUT') return setState({ status: 'anon', user: null, profile: null });
          if (ev === 'SIGNED_IN' && s && s.user) {
            loadProfile(s.user).then(function () { setState({ status: 'authed', user: s.user }); });
          }
        });
      }
    }
    return bootPromise;
  }
  /* ---------- API ---------- */
  var Auth = {
    /* espera a sessão ser restaurada; use antes de ler o estado */
    ready: function () { return boot(); },
    state: function () { return clone(state); },
    onChange: function (cb) {
      if (typeof cb !== 'function') return function () {};
      listeners.push(cb);
      if (state.status !== 'loading') { try { cb(state); } catch (e) { console.warn(e); } }
      return function () {
        var i = listeners.indexOf(cb);
        if (i >= 0) listeners.splice(i, 1);
      };
    },
    isAuthed: function () { return state.status === 'authed' && !!state.user; },
    profile: function () { return clone(state.profile); },

    /* Devolve sempre {ok, ...}; nunca lança para o chamador. */
    signIn: function (opts) {
      opts = opts || {};
      var mail = String(opts.email || '').trim();
      if (!mail || !opts.password) return Promise.resolve({ ok: false, error: 'Informe e-mail e senha.' });
      return boot().then(function () {
        if (!sb) return { ok: false, error: 'Login indisponível: Supabase não configurado.' };
        return sb.auth.signInWithPassword({ email: mail, password: opts.password })
          .then(function (r) {
            if (r && r.error) return { ok: false, error: friendly(r.error) };
            var user = (r && r.data && r.data.user) || null;
            return loadProfile(user).then(function () {
              setState({ status: 'authed', user: user, error: null });
              return { ok: true, user: clone(user) };
            });
          });
      }).catch(function (e) { return { ok: false, error: friendly(e) }; });
    },

    signUp: function (opts) {
      opts = opts || {};
      var mail = String(opts.email || '').trim(), pw = opts.password || '';
      if (!mail || pw.length < 6) return Promise.resolve({ ok: false, error: 'E-mail e senha de 6+ caracteres são obrigatórios.' });
      return boot().then(function () {
        if (!sb) return { ok: false, error: 'Cadastro indisponível: Supabase não configurado.' };
        return sb.auth.signUp({
          email: mail,
          password: pw,
          options: { data: { nome: String(opts.nome || '').trim() } }
        }).then(function (r) {
          if (r && r.error) return { ok: false, error: friendly(r.error) };
          var user = (r && r.data && r.data.user) || null;
          /* sem sessão = o projeto exige confirmação por e-mail */
          var needsConfirmation = !(r && r.data && r.data.session);
          if (needsConfirmation) return { ok: true, needsConfirmation: true, user: clone(user) };
          return loadProfile(user).then(function () {
            setState({ status: 'authed', user: user, error: null });
            return { ok: true, user: clone(user), needsConfirmation: false };
          });
        });
      }).catch(function (e) { return { ok: false, error: friendly(e) }; });
    },
  signOut: function () {
      return boot().then(function () {
        if (!sb) { setState({ status: 'anon', user: null, profile: null }); return { ok: true }; }
        return sb.auth.signOut().then(function (r) {
          if (r && r.error) return { ok: false, error: friendly(r.error) };
          setState({ status: 'anon', user: null, profile: null });
          return { ok: true };
        });
      }).catch(function (e) { return { ok: false, error: friendly(e) }; });
    },

    /* Resposta idêntica exista ou não a conta: não revela cadastros. */
    resetPassword: function (email) {
      var mail = String(email || '').trim();
      if (!mail) return Promise.resolve({ ok: false, error: 'Informe o e-mail.' });
      return boot().then(function () {
        if (!sb) return { ok: false, error: 'Recuperação indisponível: Supabase não configurado.' };
        var back = location.origin + location.pathname.replace(/[^/]*$/, 'login.html');
        return sb.auth.resetPasswordForEmail(mail, { redirectTo: back })
          .then(function (r) {
            if (r && r.error) return { ok: false, error: friendly(r.error) };
            return { ok: true };
          });
      }).catch(function () { return { ok: true }; });
    },

    /* Atualiza o perfil. `patch` aceita nome, telefone e preferências. */
    updateProfile: function (patch) {
      patch = patch || {};
      if (!this.isAuthed()) return Promise.resolve({ ok: false, error: 'Faça login para editar o perfil.' });
      var uid = state.user.id;
      var merged = Object.assign({}, state.profile || {}, patch, { id: uid });
      var dbRow = {
        id: uid,
        email: merged.email,
        nome: merged.nome || '',
        telefone: merged.telefone || '',
        atualizado_em: nowIso()
      };
      writeProfileCache(uid, merged);
      setState({ profile: merged });
      if (!sb || !configured()) return Promise.resolve({ ok: true, profile: clone(merged) });
      return sb.from(TABLE_PROFILE).upsert(dbRow).then(function (r) {
        if (r && r.error) return { ok: false, error: friendly(r.error) };
        return { ok: true, profile: clone(merged) };
      }).catch(function (e) { return { ok: false, error: friendly(e) }; });
    },

    /* Guarda onde o usuário queria voltar. Extensão para "retomar a compra". */
    rememberReturnTo: function (url) {
      try { sessionStorage.setItem('neons.returnTo', String(url || '').slice(0, 300)); } catch (e) {}
    },
    consumeReturnTo: function (fallback) {
      try {
        var v = sessionStorage.getItem('neons.returnTo');
        sessionStorage.removeItem('neons.returnTo');
        /* só aceita caminho interno: evita open redirect via ?next= */
        return (v && v.charAt(0) === '/' && v.charAt(1) !== '/') ? v : (fallback || '/');
      } catch (e) { return fallback || '/'; }
    },

    forget: function (uid) { clearProfileCache(uid); },

    /* diagnóstico/testes */
    _internal: { sb: function () { return sb; }, state: function () { return state; } }
  };

  global.Auth = Auth;
})(window);