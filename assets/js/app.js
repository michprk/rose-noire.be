/* ==========================================================================
   Rose Noire — interactions du site
   En-tête, menu, révélations, animations au défilement (bande, boutique
   épinglée, zoom de l’atelier, lettre, citation), cartes en verre, FAQ,
   horaires en direct, formulaires (validation, anti-spam, API ou e-mail),
   cookies + mesure d’audience (après accord), curseur, 404.
   La scène 3D est dans glass.js (facultative).
   ========================================================================== */
(() => {
  'use strict';
  const d = document.documentElement;
  const reduced = d.classList.contains('reduced');
  const BASE = d.dataset.base || '';
  const PAGE = d.dataset.page || '';
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const safe = (name, fn) => { try { fn(); } catch (error) { console.warn('[rose] ' + name, error); } };
  const SHOP_EMAIL = 'rosenoire160@hotmail.com';

  /* ---------- Mesure d’audience (Google Analytics 4, après accord) ---------- */
  const GA_ID = (d.dataset.ga || '').trim();
  const CONSENT_KEY = 'rn_consent';
  function track(name, params) {
    if (window.gtag && window.__rnGa) window.gtag('event', name, params || {});
  }
  function loadAnalytics() {
    if (!GA_ID || window.__rnGa) return;
    window.__rnGa = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('consent', 'default', { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'granted' });
    window.gtag('js', new Date());
    window.gtag('config', GA_ID, { anonymize_ip: true });
    const s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(GA_ID);
    document.head.appendChild(s);
  }
  function clearAnalyticsCookies() {
    const host = location.hostname.split('.');
    document.cookie.split(';').map((c) => c.split('=')[0].trim()).filter((n) => /^_ga/.test(n)).forEach((n) => {
      for (let i = 0; i < host.length; i++) {
        const domain = host.slice(i).join('.');
        document.cookie = n + '=; Max-Age=0; path=/; domain=' + domain;
      }
      document.cookie = n + '=; Max-Age=0; path=/';
    });
  }
  // Le choix est redemandé après 6 mois (durée annoncée dans la politique de confidentialité)
  function readConsent() {
    try {
      const c = JSON.parse(localStorage.getItem(CONSENT_KEY) || 'null');
      if (c && c.date && Date.now() - Date.parse(c.date) > 182 * 864e5) return null;
      return c;
    } catch (e) { return null; }
  }

  safe('cookies', () => {
    const box = $('[data-cookie]');
    const main = box && $('[data-cookie-main]', box);
    const prefs = box && $('[data-cookie-prefs]', box);
    const toggle = box && $('[data-consent-analytics]', box);
    const consent = readConsent();
    if (consent && consent.analytics) loadAnalytics();
    if (!box) return;
    const open = (showPrefs) => {
      const c = readConsent();
      if (toggle) toggle.checked = !!(c && c.analytics);
      box.hidden = false;
      main.hidden = !!showPrefs;
      prefs.hidden = !showPrefs;
      const btn = $('[data-consent="customize"]', box);
      if (btn) btn.setAttribute('aria-expanded', String(!!showPrefs));
    };
    const save = (analytics) => {
      try { localStorage.setItem(CONSENT_KEY, JSON.stringify({ analytics, date: new Date().toISOString().slice(0, 10), v: 1 })); } catch (e) { /* navigation privée */ }
      box.hidden = true;
      if (analytics) loadAnalytics();
      else {
        if (window.gtag && window.__rnGa) window.gtag('consent', 'update', { analytics_storage: 'denied' });
        clearAnalyticsCookies();
      }
    };
    box.addEventListener('click', (e) => {
      const b = e.target.closest('[data-consent]');
      if (!b) return;
      const action = b.dataset.consent;
      if (action === 'accept') save(true);
      else if (action === 'refuse') save(false);
      else if (action === 'customize') open(true);
      else if (action === 'save') save(!!(toggle && toggle.checked));
    });
    $$('[data-cookie-open]').forEach((b) => b.addEventListener('click', () => open(true)));
    if (!consent) setTimeout(() => open(false), PAGE === 'index' ? 2600 : 900);
  });

  // Clics suivis (boutons d’action, téléphone, WhatsApp, e-mail…)
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-track]');
    if (el) track(el.dataset.track, { link_url: el.getAttribute('href') || '', page: PAGE });
  });

  /* ---------- Préchargeur : libéré ici quand il n’y a pas de scène 3D ---------- */
  safe('loader', () => {
    if (!$('#webgl') || reduced) {
      d.classList.add('no-webgl');
      if (window.__rnLoader) window.__rnLoader.done();
    }
  });

  /* ---------- Année, état « défilé » ---------- */
  $$('[data-year]').forEach((el) => { el.textContent = String(new Date().getFullYear()); });

  /* ---------- En-tête : pleine largeur sur la scène, pilule de verre ensuite ---------- */
  const header = $('[data-header]');
  const stage = $('#stage');
  function updateHeader() {
    const y = window.scrollY;
    d.classList.toggle('scrolled', y > 40);
    if (!header) return;
    let pill = true;
    if (stage && PAGE === 'index') {
      pill = d.classList.contains('webgl') ? y > stage.offsetHeight - window.innerHeight * 0.75 : y > 40;
    }
    header.classList.toggle('is-pill', pill);
  }
  safe('header', () => {
    updateHeader();
    window.addEventListener('scroll', updateHeader, { passive: true });
    window.addEventListener('resize', updateHeader);
    // Lien actif selon la section affichée
    const links = $$('.site-nav a[data-nav]');
    if (links.length && 'IntersectionObserver' in window) {
      const map = new Map(links.map((a) => [a.dataset.nav, a]));
      const seen = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          const link = map.get(entry.target.id);
          if (!link) return;
          if (entry.isIntersecting) { links.forEach((a) => a.classList.remove('is-active')); link.classList.add('is-active'); }
          else link.classList.remove('is-active');
        });
      }, { rootMargin: '-45% 0px -50% 0px' });
      map.forEach((_, id) => { const s = document.getElementById(id); if (s) seen.observe(s); });
    }
  });

  /* ---------- Menu mobile ---------- */
  safe('menu', () => {
    const btn = $('[data-menu-toggle]');
    const menu = $('[data-menu]');
    if (!btn || !menu) return;
    const label = $('.sr-only', btn);
    const set = (open) => {
      menu.hidden = !open;
      btn.setAttribute('aria-expanded', String(open));
      if (label) label.textContent = open ? 'Fermer le menu' : 'Ouvrir le menu';
      d.classList.toggle('menu-open', open);
      if (open) { const first = $('a', menu); if (first) first.focus({ preventScroll: true }); }
    };
    btn.addEventListener('click', () => set(menu.hidden));
    menu.addEventListener('click', (e) => { if (e.target.closest('a')) set(false); });
    document.addEventListener('keydown', (e) => {
      if (menu.hidden) return;
      if (e.key === 'Escape') { set(false); btn.focus(); }
      if (e.key === 'Tab') {
        const items = [btn, ...$$('a, button', menu)];
        const i = items.indexOf(document.activeElement);
        if (e.shiftKey && i <= 0) { e.preventDefault(); items[items.length - 1].focus(); }
        else if (!e.shiftKey && i === items.length - 1) { e.preventDefault(); items[0].focus(); }
      }
    });
    window.addEventListener('resize', () => { if (window.innerWidth > 1040 && !menu.hidden) set(false); });
  });

  /* ---------- Ancres douces + présélection du formulaire ---------- */
  const formApi = {};
  safe('anchors', () => {
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href*="#"]');
      if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
      const url = new URL(a.getAttribute('href'), location.href);
      if (url.pathname.replace(/index\.html$/, '') !== location.pathname.replace(/index\.html$/, '') || !url.hash) return;
      const target = document.getElementById(decodeURIComponent(url.hash.slice(1)));
      if (!target) return;
      e.preventDefault();
      if (target.id === 'contact' && formApi.preset) formApi.preset(a.dataset);
      const top = target.getBoundingClientRect().top + window.scrollY - (target.id === 'contact' ? 0 : 70);
      window.scrollTo({ top, behavior: reduced ? 'auto' : 'smooth' });
      history.replaceState(null, '', url.hash);
      if (target.id === 'contact') setTimeout(() => { const f = $('#contact-form [name="name"]'); if (f && fine) f.focus({ preventScroll: true }); }, reduced ? 0 : 900);
    });
  });

  /* ---------- Titres découpés en mots ---------- */
  function splitWords(el) {
    if (el.classList.contains('is-split')) return;
    let i = 0;
    const wrap = (text, parent) => {
      text.split(/([ \t\n\r]+)/).forEach((part) => {
        if (!part) return;
        if (/^[ \t\n\r]+$/.test(part)) { parent.appendChild(document.createTextNode(' ')); return; }
        const w = document.createElement('span');
        w.className = 'w';
        const inner = document.createElement('span');
        inner.textContent = part;
        inner.style.setProperty('--i', String(i++));
        w.appendChild(inner);
        parent.appendChild(w);
      });
    };
    const frag = document.createDocumentFragment();
    Array.from(el.childNodes).forEach((node) => {
      if (node.nodeType === 3) wrap(node.textContent, frag);
      else if (node.nodeType === 1) { const clone = node.cloneNode(false); wrap(node.textContent, clone); frag.appendChild(clone); }
    });
    el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
    el.textContent = '';
    el.appendChild(frag);
    Array.from(el.children).forEach((c) => c.setAttribute('aria-hidden', 'true'));
    el.classList.add('is-split');
  }

  /* ---------- Révélations à l’entrée dans l’écran ---------- */
  safe('reveal', () => {
    $$('[data-split]').forEach(splitWords);
    // Lettres du grand « Rose Noire » du pied de page
    $$('[data-wordmark]').forEach((w) => {
      const text = w.textContent;
      w.textContent = '';
      Array.from(text).forEach((ch, i) => {
        const s = document.createElement('span');
        s.className = 'ch';
        s.style.setProperty('--i', String(i));
        s.textContent = ch === ' ' ? ' ' : ch;
        w.appendChild(s);
      });
      w.classList.add('is-split');
    });
    // Décalage en cascade des éléments frères
    const groups = new Map();
    $$('[data-reveal]').forEach((el) => {
      const p = el.parentElement;
      const n = groups.get(p) || 0;
      groups.set(p, n + 1);
      if (n) el.style.setProperty('--d', (n * 0.08).toFixed(2) + 's');
    });
    $$('[data-deal]').forEach((el) => el.style.setProperty('--deal', el.dataset.deal));
    const targets = $$('[data-reveal], [data-split], [data-deal], [data-wordmark]');
    if (!('IntersectionObserver' in window)) { targets.forEach((el) => el.classList.add('is-in')); return; }
    let dealIndex = 0;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        if (el.hasAttribute('data-deal') && !reduced) {
          // Les cartes arrivent comme un jeu qu’on distribue
          const delay = (dealIndex++ % 4) * 0.12;
          el.style.transitionDelay = delay + 's';
          setTimeout(() => { el.style.transitionDelay = ''; }, 1600 + delay * 1000);
        }
        el.classList.add('is-in');
        io.unobserve(el);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    targets.forEach((el) => io.observe(el));
  });

  /* ---------- Moteur d’animations liées au défilement ---------- */
  const scrubbers = [];
  let rafId = 0;
  let lastY = window.scrollY;
  let velocity = 0;
  const visible = new Set();
  function requestTick() { if (!rafId) rafId = requestAnimationFrame(frame); }
  function frame() {
    rafId = 0;
    const y = window.scrollY;
    const dy = y - lastY;
    lastY = y;
    velocity += (Math.abs(dy) - velocity) * 0.12;
    let keepGoing = false;
    scrubbers.forEach((s) => {
      if (!visible.has(s.el)) return;
      if (s.update(dy) === true) keepGoing = true;
    });
    if (keepGoing || velocity > 0.2) requestTick();
  }
  function addScrubber(el, update, margin) {
    if (!el) return;
    scrubbers.push({ el, update });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((entries) => {
        entries.forEach((e) => { if (e.isIntersecting) visible.add(el); else visible.delete(el); });
        requestTick();
      }, { rootMargin: margin || '20% 0px 20% 0px' }).observe(el);
    } else visible.add(el);
  }
  window.addEventListener('scroll', requestTick, { passive: true });
  window.addEventListener('resize', requestTick);

  // Bande des secteurs : défile en continu, accélère et change de sens avec le défilement
  safe('ribbon', () => {
    const track = $('[data-marquee]');
    if (!track) return;
    const row = track.firstElementChild;
    const clone = row.cloneNode(true);
    clone.setAttribute('aria-hidden', 'true');
    track.appendChild(clone);
    if (reduced) return;
    let x = 0, dir = 1, boost = 0;
    addScrubber(track.parentElement, (dy) => {
      if (dy) dir = dy > 0 ? 1 : -1;
      boost += (Math.min(40, Math.abs(dy)) * 0.5 - boost) * 0.1;
      x -= (0.7 + boost) * dir;
      const w = row.offsetWidth;
      if (w) { if (x <= -w) x += w; if (x > 0) x -= w; }
      track.style.transform = 'translate3d(' + x.toFixed(2) + 'px,0,0)';
      track.style.setProperty('--spin', (x * 0.6).toFixed(1) + 'deg');
      return true;
    }, '10% 0px 10% 0px');
  });

  // Boutique : piste horizontale épinglée (grand écran), défilement au doigt sinon
  safe('collection', () => {
    const section = $('[data-hscroll]');
    if (!section) return;
    const track = $('[data-hscroll-track]', section);
    const viewport = $('[data-hscroll-viewport]', section);
    const fill = $('[data-hscroll-fill]', section);
    const count = $('[data-hscroll-count]', section);
    const items = $$('.product', track);
    const total = items.length;
    const imgs = items.map((li) => $('img', li));
    let pinned = false, dist = 0, lastIndex = -1;
    const setProgress = (p) => {
      if (fill) fill.style.setProperty('--progress', (Math.max(1 / total, p)).toFixed(4));
      const index = Math.min(total, Math.max(1, Math.round(p * (total - 1)) + 1));
      if (index !== lastIndex && count) { count.textContent = String(index).padStart(2, '0'); lastIndex = index; }
    };
    const parallax = () => {
      const mid = window.innerWidth / 2;
      imgs.forEach((img) => {
        if (!img) return;
        const r = img.parentElement.getBoundingClientRect();
        if (r.right < -200 || r.left > window.innerWidth + 200) return;
        img.style.setProperty('--shift', ((r.left + r.width / 2 - mid) * -0.05).toFixed(1));
      });
    };
    const layout = () => {
      pinned = !reduced && window.innerWidth >= 900 && window.innerHeight >= 560;
      section.classList.toggle('is-pinned', pinned);
      if (pinned) {
        dist = Math.max(0, track.scrollWidth - window.innerWidth);
        section.style.setProperty('--pin-h', Math.round(dist + window.innerHeight) + 'px');
      } else {
        section.style.removeProperty('--pin-h');
        track.style.removeProperty('--x');
      }
    };
    layout();
    window.addEventListener('resize', () => { layout(); requestTick(); });
    window.addEventListener('load', layout);
    addScrubber(section, () => {
      if (!pinned) return;
      const r = section.getBoundingClientRect();
      const p = clamp(-r.top / Math.max(1, r.height - window.innerHeight), 0, 1);
      track.style.setProperty('--x', (p * dist).toFixed(1));
      setProgress(p);
      if (!reduced) parallax();
    }, '10% 0px 10% 0px');
    viewport.addEventListener('scroll', () => {
      if (pinned) return;
      const max = Math.max(1, viewport.scrollWidth - viewport.clientWidth);
      setProgress(viewport.scrollLeft / max);
      if (!reduced) parallax();
    }, { passive: true });
    setProgress(0);
  });

  // Atelier : la photo grandit jusqu’à remplir l’écran, puis la citation apparaît
  safe('zoom', () => {
    const zoom = $('[data-scrub="zoom"]');
    if (!zoom || reduced) return;
    addScrubber(zoom, () => {
      const r = zoom.getBoundingClientRect();
      const p = clamp(-r.top / Math.max(1, r.height - window.innerHeight), 0, 1);
      const enter = clamp((window.innerHeight - r.top) / window.innerHeight, 0, 1);
      const e = easeOut(clamp(p / 0.55, 0, 1)) * 0.92 + enter * 0.08;
      zoom.style.setProperty('--e', clamp(e, 0, 1).toFixed(4));
      zoom.style.setProperty('--q', easeOut(clamp((p - 0.42) / 0.3, 0, 1)).toFixed(4));
    }, '0px');
  });

  // Références : la lettre se redresse et monte ; la citation s’allume mot à mot
  safe('proof', () => {
    const letter = $('[data-scrub="letter"]');
    if (letter && !reduced) addScrubber(letter, () => {
      const r = letter.getBoundingClientRect();
      const p = clamp((window.innerHeight - r.top) / (window.innerHeight * 0.75), 0, 1);
      letter.style.setProperty('--p', easeOut(p).toFixed(4));
    });
    const quote = $('[data-scrub="quote"]');
    const text = quote && $('[data-words]', quote);
    if (!quote || !text) return;
    const words = text.textContent.trim().split(/ +/);
    text.setAttribute('aria-label', text.textContent.trim());
    text.textContent = '';
    words.forEach((w, i) => {
      const s = document.createElement('span');
      s.className = 'wd';
      s.setAttribute('aria-hidden', 'true');
      s.style.setProperty('--i', String(i));
      s.textContent = w;
      text.appendChild(s);
      if (i < words.length - 1) text.appendChild(document.createTextNode(' '));
    });
    quote.style.setProperty('--n', String(words.length));
    if (reduced) { quote.style.setProperty('--p', '1'); return; }
    quote.style.setProperty('--p', '0');
    addScrubber(quote, () => {
      const r = quote.getBoundingClientRect();
      const p = clamp((window.innerHeight * 0.88 - r.top) / (window.innerHeight * 0.62), 0, 1);
      quote.style.setProperty('--p', p.toFixed(4));
    });
  });

  // Galerie : trois colonnes à des vitesses différentes
  safe('parallax', () => {
    const wrap = $('[data-parallax]');
    if (!wrap || reduced) return;
    const cols = $$('[data-speed]', wrap);
    addScrubber(wrap, () => {
      const r = wrap.getBoundingClientRect();
      const off = r.top + r.height / 2 - window.innerHeight / 2;
      cols.forEach((c) => c.style.setProperty('--py', (off * Number(c.dataset.speed)).toFixed(1)));
    });
  });

  /* ---------- Cartes en verre : inclinaison et reflet qui suivent la souris ---------- */
  safe('tilt', () => {
    if (!fine || reduced) return;
    $$('[data-tilt]').forEach((card) => {
      card.addEventListener('pointermove', (e) => {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        card.classList.add('is-tilting');
        card.style.setProperty('--ry', ((px - 0.5) * 7).toFixed(2) + 'deg');
        card.style.setProperty('--rx', ((0.5 - py) * 5).toFixed(2) + 'deg');
        card.style.setProperty('--mx', (px * 100).toFixed(1) + '%');
        card.style.setProperty('--my', (py * 100).toFixed(1) + '%');
      });
      card.addEventListener('pointerleave', () => {
        card.classList.remove('is-tilting');
        card.style.setProperty('--rx', '0deg');
        card.style.setProperty('--ry', '0deg');
      });
    });
    // Boutons aimantés
    $$('.btn--rose, .btn--glass').forEach((b) => {
      b.addEventListener('pointermove', (e) => {
        const r = b.getBoundingClientRect();
        const x = (e.clientX - r.left - r.width / 2) * 0.18, y = (e.clientY - r.top - r.height / 2) * 0.3;
        b.style.translate = x.toFixed(1) + 'px ' + y.toFixed(1) + 'px';
      });
      b.addEventListener('pointerleave', () => { b.style.translate = ''; });
    });
  });

  /* ---------- Questions fréquentes (une seule ouverte à la fois) ---------- */
  safe('faq', () => {
    $$('[data-accordion]').forEach((acc) => {
      const items = $$('.qa', acc);
      items.forEach((qa) => {
        const btn = $('button', qa);
        if (btn.getAttribute('aria-expanded') === 'true') qa.classList.add('is-open');
        btn.addEventListener('click', () => {
          const wasOpen = btn.getAttribute('aria-expanded') === 'true';
          items.forEach((o) => { o.classList.remove('is-open'); $('button', o).setAttribute('aria-expanded', 'false'); });
          if (!wasOpen) {
            qa.classList.add('is-open');
            btn.setAttribute('aria-expanded', 'true');
            track('faq_open', { question: btn.textContent.trim().slice(0, 80) });
          }
        });
      });
    });
  });

  /* ---------- Horaires en direct (heure de Bruxelles) ---------- */
  const SCHEDULE = { 0: [630, 1020], 1: null, 2: [720, 1170], 3: [720, 1170], 4: [720, 1170], 5: [720, 1170], 6: [630, 1170] };
  const DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  const fmt = (m) => Math.floor(m / 60) + ' h' + (m % 60 ? ' ' + String(m % 60).padStart(2, '0') : '');
  function brusselsNow() {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Brussels', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
    const get = (t) => (parts.find((p) => p.type === t) || {}).value;
    const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
    return { day, minutes: Number(get('hour')) * 60 + Number(get('minute')) };
  }
  function hoursStatus() {
    const { day, minutes } = brusselsNow();
    const today = SCHEDULE[day];
    if (today && minutes >= today[0] && minutes < today[1]) {
      const left = today[1] - minutes;
      return { open: true, text: left <= 45 ? 'Ouvert · ferme bientôt (' + fmt(today[1]) + ')' : 'Ouvert maintenant · jusqu’à ' + fmt(today[1]) };
    }
    if (today && minutes < today[0]) return { open: false, text: 'Fermé · ouvre aujourd’hui à ' + fmt(today[0]) };
    for (let i = 1; i <= 7; i++) {
      const dd = (day + i) % 7;
      if (SCHEDULE[dd]) return { open: false, text: 'Fermé · ouvre ' + (i === 1 ? 'demain' : DAYS[dd]) + ' à ' + fmt(SCHEDULE[dd][0]) };
    }
    return { open: false, text: '' };
  }
  safe('hours', () => {
    const els = $$('[data-hours-status]');
    const lists = $$('[data-hours]');
    if (!els.length && !lists.length) return;
    const update = () => {
      const s = hoursStatus();
      els.forEach((el) => { el.textContent = s.text; el.classList.toggle('is-open', s.open); });
      const { day } = brusselsNow();
      lists.forEach((ul) => $$('li[data-day]', ul).forEach((li) => li.classList.toggle('is-today', li.dataset.day.split(',').includes(String(day)))));
    };
    update();
    setInterval(update, 60000);
  });

  /* ---------- Formulaire : devis (entreprise) ou commande (particulier) ---------- */
  safe('form', () => {
    const form = $('[data-form]');
    if (!form) return;
    const tabs = $('.tabs', form);
    const tabBtns = $$('[data-tab-btn]', form);
    const panels = $$('[data-panel]', form);
    const kind = form.elements.form;
    const errorBox = $('[data-form-error]', form);
    const success = $('[data-form-success]', form);
    const submit = $('[data-submit]', form);
    const chosen = $('[data-chosen]', form);
    const phoneStar = $('[data-phone-required]', form);
    const startedAt = Date.now();
    let active = 'pro';
    const PRODUCTS = { bouquets: 'Bouquet de saison', mariage: 'Fleurs de mariage', deuil: 'Gerbe ou couronne de deuil', sechees: 'Fleurs séchées', artificielles: 'Fleurs artificielles', plantes: 'Plantes & cactus', vases: 'Vases, cache-pots & bougies', livraison: 'Livraison d’un bouquet' };

    const setTab = (name, focus) => {
      active = name === 'perso' ? 'perso' : 'pro';
      tabBtns.forEach((b) => {
        const on = b.dataset.tabBtn === active;
        b.setAttribute('aria-selected', String(on));
        b.tabIndex = on ? 0 : -1;
        if (on && focus) b.focus();
      });
      panels.forEach((p) => { p.hidden = p.dataset.panel !== active; });
      tabs.dataset.active = active;
      kind.value = active === 'perso' ? 'commande' : 'devis';
      if (phoneStar) phoneStar.hidden = active !== 'perso';
      form.elements.email.placeholder = active === 'perso' ? 'vous@exemple.be' : 'vous@entreprise.be';
      clearErrors();
    };
    tabBtns.forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tabBtn)));
    tabs.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'Home' && e.key !== 'End') return;
      e.preventDefault();
      setTab(active === 'pro' ? 'perso' : 'pro', true);
    });

    const setProduct = (key) => {
      form.elements.produit.value = PRODUCTS[key] ? key : '';
      if (!chosen) return;
      chosen.hidden = !PRODUCTS[key];
      if (PRODUCTS[key]) $('[data-chosen-label]', chosen).textContent = 'Votre choix : ' + PRODUCTS[key];
    };
    if (chosen) $('[data-chosen-clear]', chosen).addEventListener('click', () => setProduct(''));
    const check = (name, value) => { const r = form.querySelector('input[name="' + name + '"][value="' + value + '"]'); if (r) { r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); } };
    formApi.preset = (data) => {
      if (form.classList.contains('is-sent')) reset();
      if (data.tab) setTab(data.tab);
      if (data.need) check('besoin', data.need);
      if (data.occasion) check('occasion', data.occasion);
      if (data.tab === 'perso') setProduct(data.product || '');
    };

    // Adresse demandée seulement pour une livraison
    const syncMode = () => {
      const delivery = (form.querySelector('input[name="mode"]:checked') || {}).value !== 'retrait';
      $$('[data-when="livraison"]', form).forEach((el) => { el.hidden = !delivery; });
    };
    form.addEventListener('change', (e) => { if (e.target.name === 'mode') syncMode(); });
    syncMode();

    // Date : pas avant aujourd’hui
    const dateInput = form.elements.date;
    if (dateInput) {
      const now = new Date();
      dateInput.min = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    }

    const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[a-z]{2,}$/i;
    const PHONE_RE = /^\+?[0-9 ()./-]{8,20}$/;
    const TYPOS = { 'gmial.com': 'gmail.com', 'gmal.com': 'gmail.com', 'gmail.co': 'gmail.com', 'gmail.fr': 'gmail.com', 'gamil.com': 'gmail.com', 'hotmial.com': 'hotmail.com', 'hotmal.com': 'hotmail.com', 'hotmail.co': 'hotmail.com', 'outlok.com': 'outlook.com', 'outlook.co': 'outlook.com', 'yahoo.co': 'yahoo.com', 'skynet.b': 'skynet.be', 'telenet.b': 'telenet.be' };
    const val = (n) => (form.elements[n] ? String(form.elements[n].value || '').trim() : '');
    const radio = (n) => (form.querySelector('input[name="' + n + '"]:checked') || {}).value || '';

    function clearErrors() {
      $$('[aria-invalid="true"]', form).forEach((el) => el.removeAttribute('aria-invalid'));
      $$('.field__error', form).forEach((el) => { el.textContent = ''; });
      if (errorBox) errorBox.textContent = '';
    }
    function showError(name, message, html) {
      const input = form.elements[name];
      const box = $('#err-' + name, form);
      if (input && input.setAttribute) input.setAttribute('aria-invalid', 'true');
      if (box) { if (html) box.innerHTML = html; else box.textContent = message; }
    }
    form.addEventListener('input', (e) => {
      const n = e.target.name;
      if (!n || e.target.getAttribute('aria-invalid') !== 'true') return;
      e.target.removeAttribute('aria-invalid');
      const box = $('#err-' + n, form);
      if (box) box.textContent = '';
    });

    function collect() {
      const data = { form: kind.value, name: val('name'), email: val('email'), phone: val('phone'), message: val('message'), website: val('website'), elapsed: Date.now() - startedAt };
      if (active === 'pro') Object.assign(data, { besoin: radio('besoin'), societe: val('societe'), quand: val('quand') });
      else Object.assign(data, { occasion: radio('occasion'), mode: radio('mode'), budget: val('budget').replace(/[^\d.,]/g, '').replace(',', '.'), date: val('date'), adresse: radio('mode') === 'retrait' ? '' : val('adresse'), style: val('style'), produit: val('produit') });
      return data;
    }
    function validate(data) {
      const errors = {};
      if (data.name.length < 2) errors.name = 'Indiquez votre nom.';
      if (!data.email) errors.email = 'Indiquez votre adresse e-mail.';
      else if (!EMAIL_RE.test(data.email)) errors.email = 'Cette adresse e-mail ne semble pas valide.';
      if (data.phone && !PHONE_RE.test(data.phone)) errors.phone = 'Ce numéro ne semble pas valide.';
      if ((data.message.match(/https?:\/\/|www\./gi) || []).length > 1) errors.message = 'Un seul lien maximum dans le message, s’il vous plaît.';
      if (data.form === 'commande') {
        if (!data.phone) errors.phone = 'Indiquez un numéro : Sophie confirme chaque commande.';
        const budget = Number(data.budget);
        if (!data.budget || !isFinite(budget) || budget <= 0) errors.budget = 'Indiquez un budget en euros (ex. 60).';
        else if (budget > 5000) errors.budget = 'Pour un budget plus important, demandez plutôt un devis.';
        if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date)) errors.date = 'Choisissez une date.';
        else {
          const dt = new Date(data.date + 'T12:00:00');
          if (dateInput && dateInput.min && data.date < dateInput.min) errors.date = 'Cette date est déjà passée.';
          else if (data.mode !== 'retrait' && dt.getDay() === 1) errors.date = 'Pas de livraison le lundi : la boutique est fermée.';
        }
        if (data.mode !== 'retrait' && data.adresse.length < 6) errors.adresse = 'Indiquez l’adresse de livraison.';
      }
      return errors;
    }
    function typoHint(email) {
      const at = email.lastIndexOf('@');
      if (at < 1) return '';
      const domain = email.slice(at + 1).toLowerCase();
      return TYPOS[domain] ? email.slice(0, at + 1) + TYPOS[domain] : '';
    }

    const LABELS = { besoin: { accueil: 'Fleurs d’accueil', evenement: 'Événement', cadeaux: 'Cadeaux d’affaires', decor: 'Décor durable' }, occasion: { anniversaire: 'Anniversaire', amour: 'Amour', naissance: 'Naissance', merci: 'Merci', deuil: 'Deuil', plaisir: 'Pour le plaisir' }, mode: { livraison: 'Livraison (15 €)', retrait: 'Retrait en boutique' } };
    function mailto(data) {
      const lines = [];
      if (data.form === 'devis') {
        lines.push('Demande de devis — ' + (LABELS.besoin[data.besoin] || ''));
        if (data.societe) lines.push('Société : ' + data.societe);
        if (data.quand) lines.push('Pour quand : ' + data.quand);
      } else {
        lines.push('Commande de bouquet — ' + (LABELS.occasion[data.occasion] || ''));
        if (data.produit && PRODUCTS[data.produit]) lines.push('Choix : ' + PRODUCTS[data.produit]);
        lines.push('Réception : ' + (LABELS.mode[data.mode] || ''));
        lines.push('Budget : ' + data.budget + ' €');
        lines.push('Date souhaitée : ' + data.date.split('-').reverse().join('/'));
        if (data.adresse) lines.push('Adresse de livraison : ' + data.adresse);
        if (data.style) lines.push('Style et couleurs : ' + data.style);
      }
      lines.push('', 'Nom : ' + data.name, 'E-mail : ' + data.email);
      if (data.phone) lines.push('Téléphone : ' + data.phone);
      if (data.message) lines.push('', data.message);
      const subject = (data.form === 'devis' ? 'Demande de devis' : 'Commande de fleurs') + ' — ' + data.name + (data.societe ? ' (' + data.societe + ')' : '');
      return 'mailto:' + SHOP_EMAIL + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(lines.join('\n'));
    }

    function showSuccess(data, viaMail) {
      const first = data.name.split(' ')[0];
      $('[data-success-name]', success).textContent = first ? ' ' + first : '';
      $('[data-success-text]', success).textContent = viaMail
        ? 'Votre messagerie s’est ouverte avec la demande prête à envoyer. Sophie vous répond dès réception.'
        : (data.form === 'devis' ? 'Sophie revient vers vous très vite avec une première proposition.' : 'Sophie vous contacte pour confirmer le bouquet et la livraison.');
      form.classList.add('is-sent');
      success.hidden = false;
      success.focus({ preventScroll: true });
      try { localStorage.setItem('rn_last_submit', String(Date.now())); } catch (e) { /* rien */ }
      track('generate_lead', { form_type: data.form, need: data.besoin || data.occasion || '', method: viaMail ? 'mailto' : 'api' });
    }
    function reset() {
      form.reset();
      form.classList.remove('is-sent');
      success.hidden = true;
      setProduct('');
      syncMode();
      clearErrors();
      setTab(active);
    }
    $('[data-form-reset]', form).addEventListener('click', () => { reset(); form.elements.name.focus(); });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearErrors();
      const data = collect();
      // Anti-spam 1 : champ piège rempli par un robot → on fait comme si tout allait bien
      if (data.website) { showSuccess(data, false); return; }
      const errors = validate(data);
      const keys = Object.keys(errors);
      if (keys.length) {
        keys.forEach((k) => showError(k, errors[k]));
        if (errorBox) errorBox.textContent = keys.length > 1 ? 'Merci de corriger les ' + keys.length + ' champs indiqués.' : 'Merci de corriger le champ indiqué.';
        const firstBad = form.elements[keys[0]];
        if (firstBad && firstBad.focus) firstBad.focus();
        track('form_error', { form_type: data.form, fields: keys.join(',') });
        return;
      }
      const hint = typoHint(data.email);
      if (hint && !form.dataset.typoChecked) {
        form.dataset.typoChecked = '1';
        showError('email', '', 'Vouliez-vous dire <button type="button" data-fix-email>' + hint.replace(/[<>&"]/g, '') + '</button>&nbsp;?');
        const fix = $('[data-fix-email]', form);
        if (fix) fix.addEventListener('click', () => { form.elements.email.value = hint; form.elements.email.removeAttribute('aria-invalid'); $('#err-email', form).textContent = ''; });
        return;
      }
      // Anti-spam 2 : envoi trop rapide pour un humain
      if (data.elapsed < 3000) { if (errorBox) errorBox.textContent = 'Un instant… réessayez dans quelques secondes.'; return; }
      // Anti-spam 3 : une demande par minute depuis ce navigateur
      let last = 0;
      try { last = Number(localStorage.getItem('rn_last_submit') || 0); } catch (err) { last = 0; }
      if (Date.now() - last < 60000) { if (errorBox) errorBox.textContent = 'Votre demande vient d’être envoyée. Patientez une minute avant d’en envoyer une autre.'; return; }

      const api = (d.dataset.api || '').trim().replace(/\/$/, '');
      if (!api) {
        // Sans API (maquette, hébergement statique) : la messagerie du visiteur prend le relais
        window.location.href = mailto(data);
        showSuccess(data, true);
        return;
      }
      submit.classList.add('is-busy');
      submit.setAttribute('aria-busy', 'true');
      const controller = 'AbortController' in window ? new AbortController() : null;
      const timer = setTimeout(() => controller && controller.abort(), 12000);
      try {
        const res = await fetch(api + '/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(data),
          signal: controller ? controller.signal : undefined
        });
        const json = await res.json().catch(() => ({}));
        if (res.ok && json.ok) { showSuccess(data, false); return; }
        if (json.fields) Object.keys(json.fields).forEach((k) => showError(k, json.fields[k]));
        if (errorBox) errorBox.textContent = json.error || 'Envoi impossible pour le moment.';
      } catch (err) {
        if (errorBox) errorBox.innerHTML = 'Connexion impossible. <a href="' + mailto(data).replace(/"/g, '&quot;') + '">Envoyer la demande par e-mail</a> ou appelez le +32&nbsp;475&nbsp;61&nbsp;44&nbsp;58.';
      } finally {
        clearTimeout(timer);
        submit.classList.remove('is-busy');
        submit.removeAttribute('aria-busy');
      }
    });
    setTab('pro');
  });

  /* ---------- Section contact : révélation ---------- */
  safe('contact', () => {
    const c = $('#contact');
    if (!c) return;
    if (!('IntersectionObserver' in window)) { c.classList.add('is-visible'); return; }
    new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) c.classList.add('is-visible'); }), { threshold: 0.18 }).observe(c);
  });

  /* ---------- Curseur réticule (souris uniquement) ---------- */
  safe('cursor', () => {
    const cur = $('.cursor');
    if (!cur || !fine || reduced) return;
    d.classList.add('has-cursor');
    const label = $('.cursor__label', cur);
    let x = -100, y = -100, rx = -100, ry = -100, running = false, hoverLabel = '', text = '';
    const stageEl = $('#stage');
    const loop = () => {
      rx += (x - rx) * 0.2;
      ry += (y - ry) * 0.2;
      cur.style.setProperty('--rx', rx.toFixed(1) + 'px');
      cur.style.setProperty('--ry', ry.toFixed(1) + 'px');
      let t = hoverLabel;
      if (!t && stageEl && window.__rnStage && window.scrollY < stageEl.offsetHeight - window.innerHeight * 0.5) {
        t = String(Math.round(window.__rnStage.progress * 100)).padStart(3, '0');
      }
      if (t !== text) { label.textContent = t; text = t; }
      if (Math.abs(x - rx) > 0.3 || Math.abs(y - ry) > 0.3 || (window.__rnStage && t && !hoverLabel)) requestAnimationFrame(loop);
      else running = false;
    };
    const kick = () => { if (!running) { running = true; requestAnimationFrame(loop); } };
    window.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      x = e.clientX; y = e.clientY;
      cur.style.setProperty('--x', x + 'px');
      cur.style.setProperty('--y', y + 'px');
      cur.classList.remove('is-out');
      kick();
    }, { passive: true });
    window.addEventListener('scroll', kick, { passive: true });
    document.addEventListener('pointerover', (e) => {
      const t = e.target instanceof Element ? e.target : null;
      const interactive = t && t.closest('a, button, label, [data-cursor], .pill');
      const field = t && t.closest('input:not([type="radio"]):not([type="checkbox"]), textarea');
      cur.classList.toggle('is-hover', !!interactive && !field);
      cur.classList.toggle('is-text', !!field);
      const tagged = t && t.closest('[data-cursor]');
      hoverLabel = tagged ? tagged.dataset.cursor : (t && t.closest('.product') ? 'Voir' : (t && t.closest('.collection.is-pinned .collection__viewport') ? 'Défiler' : ''));
      kick();
    });
    document.documentElement.addEventListener('mouseleave', () => cur.classList.add('is-out'));
  });

  /* ---------- Animations : réduire / réactiver ---------- */
  safe('motion', () => {
    $$('[data-motion-toggle]').forEach((b) => {
      b.textContent = reduced ? 'Réactiver les animations' : 'Réduire les animations';
      b.addEventListener('click', () => {
        try { localStorage.setItem('rn_motion', reduced ? 'full' : 'reduce'); } catch (e) { /* rien */ }
        const url = new URL(location.href);
        url.searchParams.delete('motion');
        location.replace(url.toString());
      });
    });
  });

  /* ---------- Page 404 : retrouver la bonne page depuis l’ancienne adresse ---------- */
  safe('404', () => {
    if (PAGE !== '404') return;
    track('page_404', { path: location.pathname });
    const path = decodeURIComponent(location.pathname.toLowerCase());
    const guesses = [
      [/livraison|delivery|bezorg/, '#collection', 'La livraison à Bruxelles'],
      [/mariage|bruid|wedding/, '#collection', 'Les fleurs de mariage'],
      [/gerbe|deuil|couronne|krans|rouw/, '#collection', 'Le deuil : gerbes et couronnes'],
      [/sech|gedroog/, '#collection', 'Les fleurs séchées'],
      [/artificiel|kunst/, '#collection', 'Les fleurs artificielles'],
      [/cactus|plante|plant/, '#collection', 'Les plantes et cactus'],
      [/vase|vaas/, '#collection', 'Les vases et cache-pots'],
      [/anniversaire|verjaardag|bouquet|boeket/, '#collection', 'Les bouquets de saison'],
      [/evenement|event|entreprise|corporate/, '#entreprises', 'Les offres pour les entreprises'],
      [/contact/, '#contact', 'Le formulaire de contact'],
      [/propos|over-ons|about/, '#atelier', 'L’atelier de Sophie'],
      [/realisation|realisatie|galerie/, '#atelier', 'Les réalisations'],
      [/confidentialit|privacy|rgpd|cookie/, '', 'La politique de confidentialité', '/confidentialite.html'],
      [/cgu|mention|condition|legal/, '', 'Les conditions et mentions légales', '/cgu.html'],
      [/fleuriste|bloemist|ixelles|elsene|bruxelles|brussel|uccle|ukkel|saint-gilles|forest|vorst|dimanche/, '', 'L’accueil de Rose Noire']
    ];
    const hit = guesses.find((g) => g[0].test(path));
    const box = $('[data-guess]');
    if (hit && box) {
      const a = $('a', box);
      a.href = BASE + (hit[3] || '/') + (hit[1] || '');
      $('[data-guess-label]', box).textContent = hit[2];
      box.hidden = false;
    }
  });

  d.classList.add('js-ready');
  requestTick();
})();
