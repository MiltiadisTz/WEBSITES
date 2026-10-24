/* Tzes Tattoo v3: scroll scenes, preloader, cursor and small interactions. No libraries. */
(() => {
  const doc = document.documentElement;
  const rm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const mobile = matchMedia('(max-width: 767px)');
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const ease = (t) => 1 - Math.pow(1 - t, 3);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  /* ---------- preloader ---------- */
  const loader = document.querySelector('[data-loader]');
  const loaderDone = new Promise((resolve) => {
    let seen = false;
    try { seen = sessionStorage.getItem('tz-seen') === '1'; } catch (e) { /* storage blocked */ }
    if (!loader || rm || seen) { loader && loader.classList.add('is-gone'); resolve(); return; }
    const count = loader.querySelector('[data-loader-count]');
    const fill = loader.querySelector('[data-loader-fill]');
    const start = performance.now();
    let loaded = document.readyState === 'complete';
    addEventListener('load', () => { loaded = true; });
    const tick = (now) => {
      const t = now - start;
      // runs to 85% on its own, the rest waits for the page (max 3.2s)
      const target = loaded || t > 3200 ? 1 : 0.85;
      const v = Math.min(target, ease(clamp(t / 1300)) * target);
      count.textContent = Math.round(v * 100);
      fill.style.transform = `scaleX(${v})`;
      if (v >= 1) {
        loader.classList.add('is-done');
        try { sessionStorage.setItem('tz-seen', '1'); } catch (e) { /* storage blocked */ }
        setTimeout(() => { loader.classList.add('is-gone'); }, 1000);
        resolve();
      } else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  /* ---------- split headings into words ---------- */
  $$('[data-split]').forEach((el) => {
    let i = 0;
    const walk = (node) => {
      Array.from(node.childNodes).forEach((n) => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
            const w = document.createElement('span');
            w.className = 'tz-w';
            const inner = document.createElement('span');
            inner.className = 'tz-w__i';
            inner.style.setProperty('--wi', i++);
            inner.textContent = part;
            w.appendChild(inner);
            frag.appendChild(w);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1) walk(n);
      });
    };
    walk(el);
  });

  /* ---------- scramble text for the mono tags ---------- */
  const glyphs = 'ΑΒΓΔΕΖΗΘΛΞΠΣΦΨΩ#/+01';
  const scramble = (el) => {
    if (rm || el.dataset.busy) return;
    const text = el.dataset.text || (el.dataset.text = el.textContent);
    el.dataset.busy = '1';
    let f = 0;
    const total = 18;
    const step = () => {
      const k = f / total;
      el.textContent = text.split('').map((c, i) => (c === ' ' || i / text.length < k ? c : glyphs[(Math.random() * glyphs.length) | 0])).join('');
      if (f++ < total) requestAnimationFrame(step);
      else { el.textContent = text; delete el.dataset.busy; }
    };
    step();
  };
  $$('[data-scramble]').forEach((el) => el.addEventListener('pointerenter', () => scramble(el)));

  /* ---------- reveal on view ---------- */
  $$('.tz-steps__list, .tz-faq__list').forEach((list) => Array.from(list.children).forEach((c, i) => c.style.setProperty('--ri', i)));
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add('is-in');
      $$('[data-scramble]', e.target).forEach(scramble);
      io.unobserve(e.target);
    });
  }, { rootMargin: '0px 0px -12% 0px' });
  loaderDone.then(() => {
    $$('[data-split], [data-reveal]').forEach((el) => io.observe(el));
    $$('.tz-hero [data-scramble]').forEach((el, i) => setTimeout(() => scramble(el), 300 + i * 120));
  });

  /* ---------- videos: play only while visible ---------- */
  const vids = $$('video[data-autoplay]');
  if (!rm) {
    const vio = new IntersectionObserver((entries) => entries.forEach((e) => {
      const v = e.target;
      if (e.isIntersecting) { v.preload = 'auto'; const p = v.play(); if (p) p.catch(() => {}); } else v.pause();
    }), { threshold: 0.2 });
    vids.forEach((v) => vio.observe(v));
  }

  /* ---------- header and menu ---------- */
  const header = document.querySelector('[data-header]');
  const darks = $$('[data-theme="dark"]');
  const menu = document.querySelector('[data-menu]');
  const openBtn = document.querySelector('[data-menu-open]');
  const closeBtn = document.querySelector('[data-menu-close]');
  const setMenu = (open) => {
    if (open) { menu.hidden = false; requestAnimationFrame(() => menu.classList.add('is-open')); closeBtn.focus(); }
    else { menu.classList.remove('is-open'); setTimeout(() => { menu.hidden = true; }, rm ? 0 : 700); openBtn.focus(); }
    openBtn.setAttribute('aria-expanded', String(open));
    doc.style.overflow = open ? 'hidden' : '';
  };
  openBtn && openBtn.addEventListener('click', () => setMenu(true));
  closeBtn && closeBtn.addEventListener('click', () => setMenu(false));
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && menu && !menu.hidden) setMenu(false); });

  /* ---------- pointer: cursor, magnetic buttons, parallax ---------- */
  const pointer = { x: innerWidth / 2, y: innerHeight / 2, nx: 0, ny: 0 };
  addEventListener('pointermove', (e) => {
    pointer.x = e.clientX; pointer.y = e.clientY;
    pointer.nx = (e.clientX / innerWidth) * 2 - 1;
    pointer.ny = (e.clientY / innerHeight) * 2 - 1;
  }, { passive: true });

  const cursor = document.querySelector('[data-cursor-el]');
  const cursorLabel = document.querySelector('[data-cursor-label]');
  const cur = { x: -100, y: -100, rx: 0, ry: 0 };
  if (cursor && fine && !rm) {
    document.addEventListener('pointerover', (e) => {
      const lab = e.target.closest('[data-cursor]');
      const link = e.target.closest('a, button, summary');
      cursor.classList.toggle('is-label', !!lab);
      cursor.classList.toggle('is-link', !lab && !!link);
      if (lab) cursorLabel.textContent = lab.dataset.cursor;
    });
  }
  if (fine && !rm) {
    $$('[data-magnetic]').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        el.style.setProperty('--mx', ((e.clientX - r.left - r.width / 2) * 0.22).toFixed(1) + 'px');
        el.style.setProperty('--my', ((e.clientY - r.top - r.height / 2) * 0.3).toFixed(1) + 'px');
      });
      el.addEventListener('pointerleave', () => { el.style.setProperty('--mx', '0px'); el.style.setProperty('--my', '0px'); });
    });
  }

  /* ---------- scenes ---------- */
  const scenes = $$('[data-scene]').map((el) => ({ el, name: el.dataset.scene, p: 0, target: 0, mx: 0, my: 0 }));
  const byName = (n) => scenes.find((s) => s.name === n);

  // sideways gallery: the section is as tall as the track is wide
  const works = byName('works');
  const track = document.querySelector('[data-works-track]');
  let worksDist = 0;
  const sizeWorks = () => {
    if (!works || !track) return;
    if (mobile.matches) { works.el.style.removeProperty('--works-h'); track.style.removeProperty('--x'); worksDist = 0; return; }
    worksDist = Math.max(0, track.scrollWidth - innerWidth);
    works.el.style.setProperty('--works-h', `${worksDist + innerHeight * 1.15}px`);
  };

  // stages: a frame sequence drawn on a canvas
  const stages = byName('stages');
  const canvas = document.querySelector('.tz-stages__canvas');
  const ctx = canvas && canvas.getContext('2d');
  const tabs = $$('[data-stage]');
  let frames = [], frameSet = '', lastFrame = -1, lastStage = -1;
  const loadFrames = () => {
    if (!canvas) return;
    const set = mobile.matches ? 'm' : 'd';
    if (set === frameSet) return;
    frameSet = set;
    const n = +canvas.dataset.count;
    frames = Array.from({ length: n }, (_, i) => {
      const img = new Image();
      img.decoding = 'async';
      img.src = `${canvas.dataset.frames}${set}/s-${String(i).padStart(2, '0')}.webp`;
      img.onload = () => { if (i === lastFrame || i === 0) { lastFrame = -1; } };
      return img;
    });
    lastFrame = -1;
  };
  const sizeCanvas = () => {
    if (!canvas) return;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(canvas.clientWidth * dpr);
    canvas.height = Math.round(canvas.clientHeight * dpr);
    lastFrame = -1;
  };
  const drawFrame = (i) => {
    // fall back to the nearest frame that has loaded
    let img = frames[i], k = i;
    while (k >= 0 && !(frames[k] && frames[k].complete && frames[k].naturalWidth)) k--;
    if (k < 0) return;
    img = frames[k];
    const cw = canvas.width, ch = canvas.height;
    const s = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
    const w = img.naturalWidth * s, h = img.naturalHeight * s;
    ctx.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h);
  };
  tabs.forEach((tab) => tab.addEventListener('click', () => {
    const i = +tab.dataset.stage;
    const el = stages.el;
    const range = el.offsetHeight - innerHeight;
    const top = el.getBoundingClientRect().top + scrollY;
    scrollTo({ top: top + range * clamp(0.02 + ((i + 0.96) / 4) * 0.92), behavior: rm ? 'auto' : 'smooth' });
  }));

  // tickers drift on their own and speed up with scrolling
  const tickers = $$('[data-ticker]').map((el, i) => ({ el, x: 0, dir: i % 2 ? -1 : 1 }));
  let lastY = scrollY, vel = 0;

  const measure = () => { sizeWorks(); loadFrames(); sizeCanvas(); };
  measure();
  addEventListener('resize', measure);
  mobile.addEventListener && mobile.addEventListener('change', measure);

  const frame = () => {
    const vh = innerHeight;
    const y = scrollY;
    vel += ((y - lastY) - vel) * 0.2;
    lastY = y;

    // header state
    if (header) {
      header.classList.toggle('is-scrolled', y > 20);
      const mid = header.offsetHeight / 2;
      header.classList.toggle('is-dark', darks.some((d) => { const r = d.getBoundingClientRect(); return r.top <= mid && r.bottom >= mid; }));
    }

    // cursor follows with a small lag
    if (cursor && fine && !rm) {
      cur.x += (pointer.x - cur.x) * 0.35; cur.y += (pointer.y - cur.y) * 0.35;
      cursor.style.setProperty('--cx', cur.x.toFixed(1) + 'px');
      cursor.style.setProperty('--cy', cur.y.toFixed(1) + 'px');
    }

    scenes.forEach((s) => {
      const r = s.el.getBoundingClientRect();
      if (r.bottom < -vh || r.top > vh * 2) return;
      if (s.name === 'outro') s.target = clamp((vh - r.top) / (vh * 0.85));
      else {
        const range = s.el.offsetHeight - vh;
        s.target = range > 0 ? clamp(-r.top / range) : clamp((vh - r.top) / (vh + r.height));
      }
      s.p += (s.target - s.p) * (rm ? 1 : 0.14);
      if (Math.abs(s.target - s.p) < 0.0005) s.p = s.target;
      s.el.style.setProperty('--p', s.p.toFixed(4));
      if (!rm && fine && (s.name === 'hero' || s.name === 'apart' || s.name === 'intro')) {
        s.mx += (pointer.nx - s.mx) * 0.06; s.my += (pointer.ny - s.my) * 0.06;
        s.el.style.setProperty('--mx', s.mx.toFixed(3));
        s.el.style.setProperty('--my', s.my.toFixed(3));
      }
      if (s.name === 'apart') s.el.style.setProperty('--e', rm ? 1 : ease(clamp((s.p - 0.06) / 0.6)).toFixed(4));
      if (s.name === 'works' && track && worksDist) track.style.setProperty('--x', (-s.p * worksDist).toFixed(1) + 'px');
      if (s.name === 'stages' && canvas && frames.length) {
        const q = clamp((s.p - 0.02) / 0.92);
        const n = frames.length;
        const idx = Math.round(q * (n - 1));
        if (idx !== lastFrame) { drawFrame(idx); lastFrame = idx; }
        const st = Math.min(3, Math.floor(q * 4));
        if (st !== lastStage) {
          s.el.dataset.active = st;
          tabs.forEach((t, i) => t.setAttribute('aria-pressed', String(i === st)));
          lastStage = st;
        }
        tabs.forEach((t, i) => t.style.setProperty('--tp', clamp(q * 4 - i).toFixed(3)));
      }
    });

    if (!rm) tickers.forEach((t) => {
      const w = t.el.scrollWidth / 3;
      t.x -= t.dir * (0.6 + Math.min(Math.abs(vel) * 0.35, 14));
      if (t.x <= -w) t.x += w;
      if (t.x > 0) t.x -= w;
      t.el.style.setProperty('--tx', t.x.toFixed(1) + 'px');
    });

    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  /* ---------- hero: the tattoo film plays once when it is in view, a tap plays it again ---------- */
  const film = document.querySelector('[data-film] video');
  if (film && !rm) {
    // when the browser blocks autoplay (low power mode), show the finished tattoo instead of the first dark frame
    const still = () => { if (film.readyState >= 1) film.currentTime = film.duration; else film.addEventListener('loadedmetadata', still, { once: true }); };
    const play = () => { film.play().catch(still); };
    let played = false;
    new IntersectionObserver((es) => {
      es.forEach((e) => { if (e.isIntersecting && !played) { played = true; play(); } });
    }, { threshold: 0.3 }).observe(film);
    film.addEventListener('click', () => { film.currentTime = 0; play(); });
  }

  /* ---------- gallery: style filter, viewer, tilt ---------- */
  const grid = document.querySelector('[data-gallery]');
  if (grid) {
    const chips = $$('[data-filter]');
    const items = $$('.tz-gal__item', grid);
    const setFilter = (f) => {
      if (!chips.some((c) => c.dataset.filter === f)) f = 'all';
      chips.forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.filter === f)));
      items.forEach((it) => { it.hidden = f !== 'all' && it.dataset.style !== f; });
    };
    chips.forEach((c) => c.addEventListener('click', () => {
      setFilter(c.dataset.filter);
      try { history.replaceState(null, '', c.dataset.filter === 'all' ? location.pathname : `#${c.dataset.filter}`); } catch (e) { /* not allowed here */ }
    }));
    if (location.hash) setFilter(location.hash.slice(1));

    const viewer = document.querySelector('[data-viewer]');
    const vImg = viewer.querySelector('[data-viewer-img]');
    const vName = viewer.querySelector('[data-viewer-name]');
    const vStyle = viewer.querySelector('[data-viewer-style]');
    const vCount = viewer.querySelector('[data-viewer-count]');
    let list = [], at = 0, opener = null;
    const show = (i) => {
      at = (i + list.length) % list.length;
      const card = list[at];
      vImg.src = card.dataset.full;
      vImg.alt = card.querySelector('img').alt;
      vName.textContent = card.dataset.name;
      vStyle.textContent = card.dataset.label;
      vCount.textContent = `${at + 1} / ${list.length}`;
    };
    grid.addEventListener('click', (e) => {
      const card = e.target.closest('[data-open]');
      if (!card) return;
      list = items.filter((it) => !it.hidden).map((it) => it.querySelector('[data-open]'));
      opener = card;
      show(list.indexOf(card));
      viewer.showModal();
    });
    viewer.querySelector('[data-viewer-prev]').addEventListener('click', () => show(at - 1));
    viewer.querySelector('[data-viewer-next]').addEventListener('click', () => show(at + 1));
    viewer.querySelector('[data-viewer-close]').addEventListener('click', () => viewer.close());
    viewer.addEventListener('click', (e) => { if (e.target === viewer) viewer.close(); });
    viewer.addEventListener('close', () => opener && opener.focus());
    viewer.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') show(at - 1);
      if (e.key === 'ArrowRight') show(at + 1);
    });
    let touchX = null;
    viewer.addEventListener('touchstart', (e) => { touchX = e.touches[0].clientX; }, { passive: true });
    viewer.addEventListener('touchend', (e) => {
      if (touchX === null) return;
      const dx = e.changedTouches[0].clientX - touchX;
      if (Math.abs(dx) > 40) show(at + (dx < 0 ? 1 : -1));
      touchX = null;
    });
  }
  if (fine && !rm) {
    $$('[data-tilt]').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        el.style.setProperty('--ry', (((e.clientX - r.left) / r.width - 0.5) * 10).toFixed(2) + 'deg');
        el.style.setProperty('--rx', (((e.clientY - r.top) / r.height - 0.5) * -10).toFixed(2) + 'deg');
      });
      el.addEventListener('pointerleave', () => { el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg'); });
    });
  }

  /* ---------- contact form: check fields, then show the thank-you note ---------- */
  const form = document.querySelector('[data-form]');
  if (form) {
    const checks = {
      name: (v) => v.trim().length > 1,
      email: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()),
      phone: (v) => v.replace(/\D/g, '').length >= 10,
      message: (v) => v.trim().length > 4,
      consent: (v, el) => el.checked,
    };
    const check = (el) => {
      const ok = checks[el.name](el.value, el);
      const err = document.getElementById(`${el.id}-err`);
      el.setAttribute('aria-invalid', String(!ok));
      err.textContent = ok ? '' : err.dataset.err;
      return ok;
    };
    const fields = Object.keys(checks).map((n) => form.elements[n]);
    fields.forEach((el) => el.addEventListener(el.type === 'checkbox' ? 'change' : 'blur', () => { if (el.value || el.checked || el.hasAttribute('aria-invalid')) check(el); }));
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const bad = fields.filter((el) => !check(el));
      if (bad.length) { bad[0].focus(); return; }
      // no mail endpoint yet: the real site sends this to the studio (see MANIFEST)
      const done = document.querySelector('[data-form-done]');
      form.hidden = true;
      done.hidden = false;
      done.focus();
    });
  }
})();
