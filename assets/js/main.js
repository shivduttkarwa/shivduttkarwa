(() => {
  const root = document.documentElement;
  const body = document.body;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(pointer: fine)').matches;
  const hasGSAP = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
  const animate = hasGSAP && !reduceMotion;

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const debounce = (fn, wait) => {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), wait);
    };
  };

  let lenis = null;
  let menuOpen = false;

  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);

  if (hasGSAP) {
    gsap.registerPlugin(ScrollTrigger);
    ScrollTrigger.config({ ignoreMobileResize: true });
  }

  function splitChars(el) {
    const text = el.textContent;
    el.textContent = '';
    return Array.from(text).map((ch) => {
      const span = document.createElement('span');
      span.className = 'char';
      span.setAttribute('aria-hidden', 'true');
      span.textContent = ch === ' ' ? ' ' : ch;
      el.appendChild(span);
      return span;
    });
  }

  function wrapWords(el, build) {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    const targets = [];
    nodes.forEach((node) => {
      const frag = document.createDocumentFragment();
      node.textContent.split(/(\s+)/).forEach((part) => {
        if (!part) return;
        if (/^\s+$/.test(part)) {
          frag.appendChild(document.createTextNode(part));
          return;
        }
        const { outer, target } = build(part);
        frag.appendChild(outer);
        targets.push(target);
      });
      node.parentNode.replaceChild(frag, node);
    });
    return targets;
  }

  const splitWords = (el) =>
    wrapWords(el, (word) => {
      const span = document.createElement('span');
      span.className = 'word';
      span.textContent = word;
      return { outer: span, target: span };
    });

  const splitMasked = (el) =>
    wrapWords(el, (word) => {
      const outer = document.createElement('span');
      const inner = document.createElement('span');
      outer.className = 'mw';
      inner.className = 'mw__i';
      inner.textContent = word;
      outer.appendChild(inner);
      return { outer, target: inner };
    });

  function fitText() {
    $$('[data-fit]').forEach((el) => {
      el.style.fontSize = '100px';
      const width = el.scrollWidth;
      if (!width) return;
      el.style.fontSize = `${((100 * el.parentElement.clientWidth) / width) * 0.995}px`;
    });
  }

  function initLenis() {
    if (reduceMotion || typeof window.Lenis === 'undefined') return;
    lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
    if (hasGSAP) {
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add((time) => lenis.raf(time * 1000));
      gsap.ticker.lagSmoothing(0);
    } else {
      const raf = (time) => {
        lenis.raf(time);
        requestAnimationFrame(raf);
      };
      requestAnimationFrame(raf);
    }
  }

  function scrollToTarget(target) {
    if (lenis) {
      lenis.scrollTo(target, { duration: 1.6, easing: (t) => 1 - Math.pow(1 - t, 4) });
      return;
    }
    const top = target === 0 ? 0 : target.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top, behavior: reduceMotion ? 'auto' : 'smooth' });
  }

  function initAnchors() {
    document.addEventListener('click', (e) => {
      const link = e.target.closest('a[href^="#"]');
      if (!link || link.classList.contains('skip')) return;
      const href = link.getAttribute('href');
      if (href === '#') {
        e.preventDefault();
        return;
      }
      const target = href === '#top' ? 0 : document.querySelector(href);
      if (target === null) return;
      e.preventDefault();
      if (menuOpen) setMenu(false);
      scrollToTarget(target);
    });
    $('[data-scroll-top]')?.addEventListener('click', () => scrollToTarget(0));
  }

  function setMenu(open) {
    const toggle = $('.nav__toggle');
    const menu = $('#menu');
    if (!toggle || !menu) return;
    menuOpen = open;
    menu.classList.toggle('is-open', open);
    menu.toggleAttribute('inert', !open);
    body.classList.toggle('menu-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    $('[data-nav]')?.classList.remove('is-hidden');
    if (lenis) open ? lenis.stop() : lenis.start();
  }

  function initMenu() {
    const toggle = $('.nav__toggle');
    if (!toggle) return;
    toggle.addEventListener('click', () => setMenu(!menuOpen));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && menuOpen) {
        setMenu(false);
        toggle.focus();
      }
    });
    window.matchMedia('(min-width: 992px)').addEventListener('change', (e) => {
      if (e.matches && menuOpen) setMenu(false);
    });
  }

  function initNav() {
    const nav = $('[data-nav]');
    const progress = $('.progress');
    if (!nav) return;
    let lastY = window.scrollY;
    let ticking = false;

    const update = () => {
      ticking = false;
      const y = window.scrollY;
      const max = root.scrollHeight - window.innerHeight;
      nav.classList.toggle('is-scrolled', y > 40);
      if (!menuOpen) {
        if (y > lastY + 3 && y > 240) nav.classList.add('is-hidden');
        else if (y < lastY - 3 || y <= 240) nav.classList.remove('is-hidden');
      }
      if (progress) progress.style.transform = `scaleX(${max > 0 ? Math.min(y / max, 1) : 0})`;
      lastY = y;
    };

    window.addEventListener(
      'scroll',
      () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(update);
      },
      { passive: true }
    );
    nav.addEventListener('focusin', () => nav.classList.remove('is-hidden'));
    update();
  }

  function initNavLinks() {
    $$('.nav__links a').forEach((link) => {
      const section = $(link.getAttribute('href'));
      if (!section) return;
      ScrollTrigger.create({
        trigger: section,
        start: 'top 45%',
        end: 'bottom 45%',
        onToggle: (self) => link.classList.toggle('is-active', self.isActive),
      });
    });
  }

  function setTheme(dark) {
    if (body.classList.contains('theme-dark') === dark) return;
    body.classList.toggle('theme-dark', dark);
    $('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0d0d0c' : '#f3f2ee');
  }

  function initThemeZones() {
    const active = new Set();
    $$('[data-theme-zone="dark"]').forEach((zone) => {
      ScrollTrigger.create({
        trigger: zone,
        start: 'top 55%',
        end: 'bottom 55%',
        onToggle: (self) => {
          self.isActive ? active.add(zone) : active.delete(zone);
          setTheme(active.size > 0);
        },
      });
    });
  }

  function initThemeZonesFallback() {
    if (!('IntersectionObserver' in window)) return;
    const active = new Set();
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => (entry.isIntersecting ? active.add(entry.target) : active.delete(entry.target)));
        setTheme(active.size > 0);
      },
      { rootMargin: '-55% 0px -45% 0px' }
    );
    $$('[data-theme-zone="dark"]').forEach((zone) => io.observe(zone));
  }

  function initMarquee() {
    const rows = $$('[data-marquee]').map((el) => ({ el, dir: Number(el.dataset.marquee) || -1, x: 0, half: 0 }));
    const section = $('.marquee');
    if (!rows.length || !section || reduceMotion) return;

    const measure = () => rows.forEach((row) => (row.half = row.el.scrollWidth / 2));
    measure();
    window.addEventListener('resize', debounce(measure, 150));
    document.fonts?.ready.then(measure);

    let visible = true;
    let boost = 0;
    let scrollDir = 1;
    let lastY = window.scrollY;

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([entry]) => (visible = entry.isIntersecting)).observe(section);
    }

    window.addEventListener(
      'scroll',
      () => {
        const y = window.scrollY;
        const delta = y - lastY;
        if (delta) scrollDir = delta > 0 ? 1 : -1;
        boost = Math.min(boost + Math.abs(delta) * 0.05, 8);
        lastY = y;
      },
      { passive: true }
    );

    const tick = (dt) => {
      boost *= 0.92;
      if (!visible) return;
      rows.forEach((row) => {
        if (!row.half) return;
        const dir = row.dir * scrollDir;
        row.x += (0.6 + boost) * dir * dt;
        if (row.x <= -row.half) row.x += row.half;
        else if (row.x > 0) row.x -= row.half;
        row.el.style.transform = `translate3d(${row.x}px,0,0) skewX(${(-dir * boost * 0.3).toFixed(2)}deg)`;
      });
    };

    if (hasGSAP) {
      gsap.ticker.add((time, delta) => tick(Math.min(delta, 50) / 16.667));
    } else {
      let last = performance.now();
      const loop = (now) => {
        tick(Math.min(now - last, 50) / 16.667);
        last = now;
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    }
  }

  function buildHero() {
    const chars = [];
    $$('[data-hero-chars]').forEach((el) => chars.push(...splitChars(el)));

    return gsap
      .timeline({ paused: true, defaults: { ease: 'expo.out' } })
      .from(chars, { yPercent: 118, duration: 1.5, stagger: 0.045 }, 0)
      .from('.hero__orb', { autoAlpha: 0, scale: 0.4, duration: 2.4, ease: 'power2.out', stagger: 0.15 }, 0)
      .from('.hero__grid', { autoAlpha: 0, duration: 1.8, ease: 'power1.out' }, 0.1)
      .from('.hero__badge', { scale: 0, rotate: -140, duration: 1.6 }, 0.45)
      .from('[data-hero-fade]', { y: 30, autoAlpha: 0, duration: 1.3, stagger: 0.08 }, 0.5)
      .from('.code-card', { y: 80, autoAlpha: 0, rotate: 3, duration: 1.5 }, 0.65)
      .from('.code-card .ln', { autoAlpha: 0, x: -12, duration: 0.7, stagger: 0.07, ease: 'power3.out' }, 0.95);
  }

  function initHeroScroll() {
    const hero = $('.hero');
    if (!hero) return;
    const st = () => ({ trigger: hero, start: 'top top', end: 'bottom top', scrub: true });
    gsap.to('.hero__title', { yPercent: 22, ease: 'none', scrollTrigger: st() });
    gsap.to('.hero__card-wrap', { y: -90, ease: 'none', scrollTrigger: st() });
    gsap.to('.hero__bg', { yPercent: 30, ease: 'none', scrollTrigger: st() });

    if (!finePointer) return;
    const orbA = $('.hero__orb--a');
    const orbB = $('.hero__orb--b');
    const ax = gsap.quickTo(orbA, 'x', { duration: 2.2, ease: 'power3' });
    const ay = gsap.quickTo(orbA, 'y', { duration: 2.2, ease: 'power3' });
    const bx = gsap.quickTo(orbB, 'x', { duration: 2.6, ease: 'power3' });
    const by = gsap.quickTo(orbB, 'y', { duration: 2.6, ease: 'power3' });
    hero.addEventListener('pointermove', (e) => {
      const nx = e.clientX / window.innerWidth - 0.5;
      const ny = e.clientY / window.innerHeight - 0.5;
      ax(nx * 180);
      ay(ny * 140);
      bx(nx * -120);
      by(ny * -90);
    });
  }

  function runPreloader(onReveal) {
    const pre = $('.preloader');
    if (!pre) {
      root.classList.add('is-loaded');
      onReveal();
      return;
    }
    const count = $('[data-preloader-count]', pre);
    const bar = $('.preloader__bar span', pre);
    const state = { v: 0 };
    lenis?.stop();

    const tl = gsap
      .timeline({ paused: true })
      .from('.pl-line > span', { yPercent: 110, duration: 0.9, ease: 'expo.out', stagger: 0.08 }, 0)
      .to(state, { v: 100, duration: 1.5, ease: 'power3.inOut', onUpdate: () => (count.textContent = Math.round(state.v)) }, 0)
      .to(bar, { scaleX: 1, duration: 1.5, ease: 'power3.inOut' }, 0)
      .to('.pl-line > span', { yPercent: -110, duration: 0.6, ease: 'power3.in', stagger: 0.05 }, 1.55)
      .to('.preloader__foot', { autoAlpha: 0, y: -16, duration: 0.5, ease: 'power3.in' }, 1.55)
      .fromTo(pre, { clipPath: 'inset(0% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 100% 0%)', duration: 1.1, ease: 'expo.inOut' }, 1.95)
      .add(() => {
        lenis?.start();
        onReveal();
      }, 2.45)
      .add(() => root.classList.add('is-loaded'));

    const fontsReady = document.fonts ? document.fonts.ready : Promise.resolve();
    Promise.race([fontsReady, new Promise((r) => setTimeout(r, 2000))]).then(() => tl.play());
  }

  function initReveals() {
    $$('[data-split]').forEach((el) => {
      const words = splitMasked(el);
      gsap.from(words, {
        yPercent: 120,
        duration: 1.2,
        ease: 'expo.out',
        stagger: 0.06,
        scrollTrigger: { trigger: el, start: 'top 86%', once: true },
      });
    });

    const items = $$('[data-reveal]');
    gsap.set(items, { y: 48, autoAlpha: 0 });
    ScrollTrigger.batch(items, {
      start: 'top 90%',
      once: true,
      onEnter: (batch) =>
        gsap.to(batch, { y: 0, autoAlpha: 1, duration: 1.2, ease: 'expo.out', stagger: 0.09, overwrite: true }),
    });
  }

  function initScrubText() {
    $$('[data-scrub-words]').forEach((el) => {
      const words = splitWords(el);
      gsap.fromTo(
        words,
        { opacity: 0.12 },
        {
          opacity: 1,
          ease: 'none',
          stagger: 0.12,
          scrollTrigger: { trigger: el, start: 'top 78%', end: 'bottom 42%', scrub: 0.6 },
        }
      );
    });
  }

  function initCounters() {
    $$('[data-count]').forEach((el) => {
      const end = Number(el.dataset.count) || 0;
      const state = { v: 0 };
      el.textContent = '0';
      ScrollTrigger.create({
        trigger: el,
        start: 'top 92%',
        once: true,
        onEnter: () =>
          gsap.to(state, {
            v: end,
            duration: 2.2,
            delay: 0.2,
            ease: 'power3.out',
            onUpdate: () => (el.textContent = Math.round(state.v)),
          }),
      });
    });
  }

  function initServices(mm) {
    mm.add('(min-width: 768px)', () => {
      const cards = $$('.service');
      const navH = () => parseFloat(getComputedStyle(root).getPropertyValue('--nav-h')) || 76;
      cards.forEach((card, i) => {
        const next = cards[i + 1];
        if (!next) return;
        gsap.to(card, {
          scale: 0.92,
          '--dim': 0.55,
          ease: 'none',
          scrollTrigger: {
            trigger: next,
            start: 'top bottom',
            end: () => `top ${navH() + 12 + (i + 1) * 18}px`,
            scrub: true,
            invalidateOnRefresh: true,
          },
        });
      });
    });
  }

  function initWork(mm) {
    const section = $('[data-work]');
    const track = $('.work__track');
    const bar = $('.work__progress-bar');
    if (!section || !track) return;

    mm.add('(min-width: 992px)', () => {
      root.classList.add('has-hscroll');
      const distance = () => Math.max(0, track.scrollWidth - window.innerWidth);

      const tween = gsap.to(track, {
        x: () => -distance(),
        ease: 'none',
        onUpdate() {
          if (bar) bar.style.transform = `scaleX(${this.progress()})`;
        },
      });

      ScrollTrigger.create({
        trigger: section,
        start: 'top top',
        end: () => `+=${distance()}`,
        pin: true,
        scrub: 0.8,
        animation: tween,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        refreshPriority: 1,
      });

      $$('.project__parallax', track).forEach((el) => {
        gsap.fromTo(
          el,
          { xPercent: 5 },
          {
            xPercent: -5,
            ease: 'none',
            scrollTrigger: {
              trigger: el.closest('.project'),
              containerAnimation: tween,
              start: 'left right',
              end: 'right left',
              scrub: true,
            },
          }
        );
      });

      return () => {
        root.classList.remove('has-hscroll');
        if (bar) bar.style.transform = '';
      };
    });
  }

  function initTimeline() {
    const wrap = $('.timeline-wrap');
    if (!wrap) return;
    gsap.fromTo(
      '.timeline__fill',
      { scaleY: 0 },
      { scaleY: 1, ease: 'none', scrollTrigger: { trigger: wrap, start: 'top 65%', end: 'bottom 65%', scrub: 0.5 } }
    );
    $$('.tl-item').forEach((item) => {
      ScrollTrigger.create({
        trigger: item,
        start: 'top 65%',
        onEnter: () => item.classList.add('is-active'),
        onLeaveBack: () => item.classList.remove('is-active'),
      });
    });
  }

  function initFooter() {
    const el = $('[data-footer-chars]');
    if (!el) return;
    const chars = splitChars(el);
    fitText();
    gsap.from(chars, {
      yPercent: 110,
      duration: 1.3,
      ease: 'expo.out',
      stagger: 0.035,
      scrollTrigger: { trigger: '.footer__mark', start: 'top 98%', once: true },
    });
  }

  function initCursor() {
    const cursor = $('.cursor');
    if (!cursor || !finePointer) return;
    const xTo = gsap.quickTo(cursor, 'x', { duration: 0.45, ease: 'power3' });
    const yTo = gsap.quickTo(cursor, 'y', { duration: 0.45, ease: 'power3' });

    window.addEventListener(
      'pointermove',
      (e) => {
        xTo(e.clientX);
        yTo(e.clientY);
        cursor.classList.add('is-visible');
      },
      { passive: true }
    );
    root.addEventListener('mouseleave', () => cursor.classList.remove('is-visible'));
    document.addEventListener('pointerover', (e) => {
      const view = e.target.closest('[data-cursor="view"]');
      const hover = !view && e.target.closest('a, button, label, input, textarea, .chips li');
      cursor.classList.toggle('is-view', Boolean(view));
      cursor.classList.toggle('is-hover', Boolean(hover));
    });
  }

  function initMagnetic() {
    if (!finePointer) return;
    $$('[data-magnetic]').forEach((el) => {
      const xTo = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'power3' });
      const yTo = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'power3' });
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        xTo((e.clientX - r.left - r.width / 2) * 0.3);
        yTo((e.clientY - r.top - r.height / 2) * 0.4);
      });
      el.addEventListener('pointerleave', () => {
        xTo(0);
        yTo(0);
      });
    });
  }

  function initCopy() {
    $$('[data-copy]').forEach((btn) => {
      const label = $('[data-copy-label]', btn);
      let timer;
      btn.addEventListener('click', async () => {
        let ok = true;
        try {
          await navigator.clipboard.writeText(btn.dataset.copy);
        } catch (err) {
          ok = false;
        }
        btn.classList.toggle('is-done', ok);
        if (label) label.textContent = ok ? 'Copied' : 'Copy failed';
        clearTimeout(timer);
        timer = setTimeout(() => {
          btn.classList.remove('is-done');
          if (label) label.textContent = 'Copy';
        }, 2200);
      });
    });
  }

  function initForm() {
    const form = $('[data-form]');
    if (!form) return;
    const status = $('.form__status', form);
    const to = form.dataset.email;

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const data = new FormData(form);
      const name = String(data.get('name') || '').trim();
      const from = String(data.get('email') || '').trim();
      const message = String(data.get('message') || '').trim();
      const type = String(data.get('type') || 'General');

      const checks = [
        ['name', name.length > 0],
        ['email', /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(from)],
        ['message', message.length > 0],
      ];
      let firstInvalid = null;
      checks.forEach(([field, valid]) => {
        const input = form.elements[field];
        if (valid) input.removeAttribute('aria-invalid');
        else {
          input.setAttribute('aria-invalid', 'true');
          firstInvalid = firstInvalid || input;
        }
      });

      if (firstInvalid) {
        status.dataset.state = 'error';
        status.textContent = 'Please add your name, a valid email and a short message.';
        firstInvalid.focus();
        return;
      }

      const subject = `${type} enquiry from ${name}`;
      const bodyText = `${message}\n\n— ${name}\n${from}`;
      window.location.href = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText)}`;
      status.dataset.state = 'ok';
      status.textContent = 'Opening your email app. Thanks for reaching out!';
    });

    form.addEventListener('input', (e) => {
      if (e.target.getAttribute('aria-invalid') === 'true') e.target.removeAttribute('aria-invalid');
    });
  }

  function init() {
    initLenis();
    initAnchors();
    initMenu();
    initNav();
    initCopy();
    initForm();
    initMarquee();

    if (!animate) {
      fitText();
      window.addEventListener('resize', debounce(fitText, 150));
      document.fonts?.ready.then(fitText);
      initThemeZonesFallback();
      root.classList.add('is-loaded');
      return;
    }

    const heroIntro = buildHero();
    initHeroScroll();
    initReveals();
    initScrubText();
    initCounters();

    const mm = gsap.matchMedia();
    initServices(mm);
    initWork(mm);

    initTimeline();
    initFooter();
    initNavLinks();
    initThemeZones();
    initCursor();
    initMagnetic();

    ScrollTrigger.addEventListener('refreshInit', fitText);
    document.fonts?.ready.then(() => ScrollTrigger.refresh());

    runPreloader(() => heroIntro.play());
  }

  init();
})();
