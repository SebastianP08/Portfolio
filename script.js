const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
// The plugin must be registered before renderCards() creates its first tweens.
if (window.gsap && window.ScrollTrigger) gsap.registerPlugin(ScrollTrigger);

const panelsRow = document.getElementById("panels-row");
const cardsEl = document.getElementById("cards");
const filtersEl = document.getElementById("filters");
const skillsGrid = document.getElementById("skills-grid");

// Filled by loadProjects() from mis-proyectos.json.
let projects = [];

// esc() and getProjects() come from store.js.
async function loadJson(file) {
  const response = await fetch(file);
  if (!response.ok) throw new Error(`HTTP ${response.status} loading ${file}`);
  return response.json();
}

// fetch() is blocked on file:// pages, so explain how to run it instead of
// leaving a section silently empty.
const SERVER_HINT = `Abre la página con un servidor local (extensión Live Server de VS Code o <code>python -m http.server</code> dentro de esta carpeta) en vez de abrir el archivo directamente.`;

// Panels show only the projects marked "destacado" in mis-proyectos.json
// (all 8 are too crowded); the cards below still list everything. If none
// is marked, the first 5 are used.
function renderPanels() {
  const featured = projects.filter((p) => p.destacado);
  panelsRow.innerHTML = (featured.length ? featured : projects.slice(0, 5))
    .map((p) => {
      const href = p.enlace ? esc(p.enlace) : "#projects";
      const external = p.enlace ? ' target="_blank" rel="noopener"' : "";
      // Optional "posicionPanel" (e.g. "68% 50%") frames the subject inside the narrow panel.
      const pos = p.posicionPanel ? `;--pos:${esc(p.posicionPanel)}` : "";
      return `
      <a class="panel" href="${href}"${external} style="--img:url('${esc(p.imagen)}')${pos}" aria-label="${esc(p.nombre)}">
        <div class="panel__img" aria-hidden="true"></div>
        <div class="panel__label"><strong>${esc(p.nombre)}</strong><span>${esc(p.categoria)}</span></div>
      </a>`;
    })
    .join("");
}

function cardHtml(p) {
  return `
      <article class="card">
        <div class="card__media"><img class="card__img" src="${esc(p.imagen)}" alt="${esc(p.nombre)}" loading="lazy" /></div>
        <div class="card__body">
          ${p.enProceso ? '<span class="badge">En proceso</span>' : ""}
          <h3>${esc(p.nombre)}</h3>
          <p class="card__meta">${esc(p.categoria)} · ${esc(p.herramienta)}</p>
          <p class="card__desc">${esc(p.descripcion)}</p>
          ${p.enlace ? `<a class="card__link" href="${esc(p.enlace)}" target="_blank" rel="noopener">Ver proyecto</a>` : ""}
        </div>
      </article>`;
}

// Every project of the current filter is shown at once; the small/small/big
// row pattern comes from the card's position in the grid (style.css).
function renderCards(category) {
  const filtered = category === "Todos" ? projects : projects.filter((p) => p.categoria === category);
  cardsEl.innerHTML = filtered.map(cardHtml).join("");
  revealCards();
}

function renderFilters() {
  const categories = ["Todos", ...new Set(projects.map((p) => p.categoria))];
  filtersEl.innerHTML = categories
    .map((c, i) => `<button type="button" data-category="${esc(c)}" aria-pressed="${i === 0}">${esc(c)}</button>`)
    .join("");
  filtersEl.onclick = (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    filtersEl.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", b === btn));
    renderCards(btn.dataset.category);
  };
}

function showProjectsError(error) {
  console.error("Could not load mis-proyectos.json:", error);
  cardsEl.innerHTML = `<p class="projects__error">No se pudieron cargar los proyectos. ${SERVER_HINT}</p>`;
  panelsRow.innerHTML = "";
}

async function initProjects() {
  try {
    projects = await getProjects();
  } catch (error) {
    showProjectsError(error);
    return;
  }
  renderPanels();
  renderFilters();
  renderCards("Todos");
}

// Text from info.json: escaped, then *word* becomes <em>word</em>.
function withEmphasis(text) {
  return esc(text).replace(/\*(.+?)\*/g, "<em>$1</em>");
}

function renderInfo(info) {
  const fullName = `${info.nombre} ${info.apellido}`;
  document.title = `${fullName} | Portafolio`;
  document.getElementById("nav-name").textContent = fullName.toUpperCase();
  document.getElementById("intro-name").dataset.text = fullName.toUpperCase();
  document.getElementById("hero-title").innerHTML =
    `${esc(info.nombre)} <span class="hero__surname">${esc(info.apellido)}</span>`;
  document.getElementById("footer-text").textContent =
    `© ${new Date().getFullYear()} ${fullName} · ${info.universidad}`;

  document.getElementById("about-title").textContent = info.about.titulo;
  document.getElementById("about-body").innerHTML = info.about.parrafos
    .map((p) => `<p>${withEmphasis(p)}</p>`)
    .join("");
  // Optional "foto" in info.json replaces the gradient placeholder.
  if (info.about.foto) {
    const media = document.getElementById("about-media");
    media.removeAttribute("role");
    media.removeAttribute("aria-label");
    media.classList.add("about__media--photo");
    media.innerHTML = `<img src="${esc(info.about.foto)}" alt="Foto de ${esc(fullName)}" />`;
  }

  document.getElementById("skills-title").textContent = info.skills.titulo;
  // Optional intro sentence: add "frase" to skills in info.json to show it.
  const lead = document.getElementById("skills-lead");
  lead.textContent = info.skills.frase ?? "";
  lead.hidden = !info.skills.frase;
  // Each skill can have an optional "imagen" in info.json (and "posicion" to
  // pick the visible part); until then a gradient placeholder fills the hover background.
  skillsGrid.innerHTML = info.skills.items
    .map((s, i) => {
      const pos = s.posicion ? `;--pos:${esc(s.posicion)}` : "";
      const media = s.imagen
        ? `<div class="skill__img" style="--img:url('${esc(s.imagen)}')${pos}"></div>`
        : `<div class="skill__img skill__img--placeholder"></div>`;
      return `
      <article class="skill" tabindex="0">
        <div class="skill__bg" aria-hidden="true">${media}</div>
        <span class="skill__num" aria-hidden="true">${String(i + 1).padStart(2, "0")}</span>
        <h3>${esc(s.titulo)}</h3>
        <p>${esc(s.texto)}</p>
      </article>`;
    })
    .join("");

  const c = info.contacto;
  const phone = String(c.telefono ?? "").replace(/\D/g, "");
  const links = [];
  if (c.email) links.push(`<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>`);
  if (phone) links.push(`<a href="tel:+57${phone}">${esc(c.telefono)}</a>`);
  (c.redes ?? []).forEach((r) =>
    links.push(`<a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.nombre)}</a>`)
  );
  document.getElementById("contact-links").innerHTML = links.join(" · ");
  const phrase = document.getElementById("contact-title");
  phrase.textContent = c.frase;
  phrase.dataset.text = c.frase;
}

async function initInfo() {
  try {
    renderInfo(await loadJson("info.json"));
  } catch (error) {
    console.error("Could not load info.json:", error);
    document.getElementById("about-body").innerHTML =
      `<p class="projects__error">No se pudo cargar la información del perfil. ${SERVER_HINT}</p>`;
  }
}

// Contact phrase: text "decrypts" from random characters.
function decryptText(el) {
  const final = el.dataset.text;
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ#$%&*";
  const state = { progress: 0 };
  gsap.to(state, {
    progress: final.length,
    duration: 1.4,
    ease: "none",
    onUpdate() {
      const done = Math.floor(state.progress);
      el.textContent = final
        .split("")
        .map((c, i) => (i < done || c === " " ? c : chars[Math.floor(Math.random() * chars.length)]))
        .join("");
    },
    onComplete() { el.textContent = final; },
  });
}

// Scroll-linked reveal: starts faint and lower, rises and becomes opaque as
// the element scrolls into view (and reverses when scrolling back up).
function revealOnScroll(targets) {
  if (reduceMotion || !window.gsap || !window.ScrollTrigger) return [];
  return gsap.utils.toArray(targets).map((el) =>
    gsap.fromTo(
      el,
      { opacity: 0.1, y: 80 },
      {
        opacity: 1, y: 0, ease: "none",
        scrollTrigger: { trigger: el, start: "top 92%", end: "top 55%", scrub: true },
      }
    )
  );
}

// Splits el's text into word/char spans, keeping inline children like <em>.
// Words are inline-block so they never break mid-line. Screen readers get the
// original text from a visually-hidden copy; the split spans are aria-hidden.
function splitChars(el) {
  const original = el.textContent;
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode);

  textNodes.forEach((node) => {
    const frag = document.createDocumentFragment();
    node.textContent.split(/(\s+)/).forEach((part) => {
      if (!part) return;
      if (/^\s+$/.test(part)) {
        frag.append(" ");
        return;
      }
      const word = document.createElement("span");
      word.className = "word";
      word.setAttribute("aria-hidden", "true");
      word.innerHTML = [...part].map((c) => `<span class="char">${c}</span>`).join("");
      frag.append(word);
    });
    node.replaceWith(frag);
  });

  const srText = document.createElement("span");
  srText.className = "visually-hidden";
  srText.textContent = original;
  el.append(srText);
  return el.querySelectorAll(".char");
}

// Letters fade-in: each char goes from blurred and faint to sharp, in cascade,
// scrubbed with the scroll (reverses when scrolling back up).
function lettersFadeIn(targets) {
  if (reduceMotion || !window.gsap || !window.ScrollTrigger) return;
  gsap.utils.toArray(targets).forEach((el) => {
    gsap.fromTo(
      splitChars(el),
      { opacity: 0.15, filter: "blur(8px)" },
      {
        opacity: 1, filter: "blur(0px)", ease: "none", stagger: 0.05,
        scrollTrigger: { trigger: el, start: "top 85%", end: "bottom 55%", scrub: true },
      }
    );
  });
}

// Cards reveal: the image is uncovered from the top-left corner while it
// zooms out, then the text comes in (CSS transitions toggled by .is-in).
// Cards are re-created on every filter, so their old triggers are killed first.
const animateCards = !reduceMotion && window.gsap && window.ScrollTrigger;
if (animateCards) cardsEl.classList.add("js-reveal");

let cardTriggers = [];
function revealCards() {
  if (!animateCards) return;
  cardTriggers.forEach((t) => t.kill());
  // Only cards not yet revealed: ones already on screen must not be re-batched.
  cardTriggers = ScrollTrigger.batch(".card:not(.is-in)", {
    start: "top 88%",
    once: true,
    onEnter: (batch) =>
      batch.forEach((card, i) => {
        card.style.setProperty("--d", i * 0.12 + "s");
        card.classList.add("is-in");
        // Drop the cascade delay once revealed so hover reacts instantly.
        setTimeout(() => card.style.removeProperty("--d"), 2000);
      }),
  });
  ScrollTrigger.refresh();
}

// Intro: the name animates in letter by letter, then the overlay lifts away.
// Click or any key skips it. Skipped entirely with reduced motion or no GSAP.
function playIntro() {
  const intro = document.getElementById("intro");
  const nameEl = intro.querySelector(".intro__name");
  const line = intro.querySelector(".intro__line");

  if (reduceMotion || !window.gsap || !nameEl.dataset.text) return;

  nameEl.innerHTML = nameEl.dataset.text
    .split("")
    .map((c) => `<span>${c === " " ? "&nbsp;" : c}</span>`)
    .join("");
  intro.classList.add("is-active");
  document.body.classList.add("is-locked");
  // Each word of the title acts as a mask; its letters wait below it.
  const heroChars = splitChars(document.querySelector(".hero__title"));
  gsap.set(heroChars, { yPercent: 110 });

  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    intro.removeEventListener("click", skip);
    document.removeEventListener("keydown", skip);
    tl.kill();
    gsap.to(intro, {
      yPercent: -100, duration: 0.7, ease: "power3.inOut",
      onComplete() {
        intro.classList.remove("is-active");
        document.body.classList.remove("is-locked");
        window.ScrollTrigger?.refresh();
      },
    });
    gsap.to(heroChars, { yPercent: 0, duration: 1, ease: "power3.out", stagger: 0.04, delay: 0.3 });
  };
  const skip = () => finish();

  const tl = gsap.timeline({ onComplete: finish });
  tl.from(nameEl.children, { opacity: 0, y: 30, duration: 0.5, ease: "power2.out", stagger: 0.06 })
    .from(line, { scaleX: 0, duration: 0.8, ease: "power2.inOut" }, "-=0.4")
    .to({}, { duration: 0.5 });

  intro.addEventListener("click", skip);
  document.addEventListener("keydown", skip);
}

// Smooth scroll for in-page links (navbar, panels). Done in JS because CSS
// "scroll-behavior: smooth" breaks ScrollTrigger's pinned Skills section.
function setupAnchorScroll() {
  document.addEventListener("click", (e) => {
    const link = e.target.closest('a[href^="#"]');
    if (!link || link.getAttribute("href") === "#") return;
    const target = document.querySelector(link.getAttribute("href"));
    if (!target) return;
    e.preventDefault();
    const behavior = reduceMotion ? "auto" : "smooth";
    // Inside the horizontal track #skills has no vertical position of its own:
    // scroll to the point of the pin where the track has slid to it.
    if (target.id === "skills" && hscrollTrigger) {
      const offset = Math.min(target.offsetLeft, hscrollTrigger.end - hscrollTrigger.start);
      window.scrollTo({ top: hscrollTrigger.start + offset, behavior });
      return;
    }
    target.scrollIntoView({ behavior });
  });
}

// Back-to-top button: shown once the hero has been scrolled past.
function setupBackToTop() {
  const btn = document.getElementById("back-to-top");
  const update = () => { btn.hidden = window.scrollY < window.innerHeight * 0.6; };
  window.addEventListener("scroll", update, { passive: true });
  btn.addEventListener("click", () =>
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" })
  );
  update();
}

// Hero background: grey vertical lines that wave slowly and light up near the
// mouse. Drawn on a canvas; with reduced motion it is drawn once, static.
function setupHeroLines() {
  const hero = document.getElementById("hero");
  const canvas = document.createElement("canvas");
  canvas.className = "hero__lines";
  canvas.setAttribute("aria-hidden", "true");
  hero.prepend(canvas);
  const ctx = canvas.getContext("2d");

  const GAP = 18;          // px between lines
  const STEP = 12;         // px between points of each line
  const AMPLITUDE = 10;    // px of horizontal wave
  const GLOW_RADIUS = 140; // px around the mouse that lights up
  let width = 0, height = 0;
  // Smoothed mouse position and glow strength (0 = mouse away, 1 = over hero).
  const mouse = { x: 0, y: 0, targetX: 0, targetY: 0, glow: 0, targetGlow: 0 };

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = hero.clientWidth;
    height = hero.clientHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function linePath(baseX, i, t) {
    ctx.beginPath();
    for (let y = -STEP; y <= height + STEP; y += STEP) {
      const x = baseX + Math.sin(y * 0.006 + t + i * 0.18) * AMPLITUDE;
      y === -STEP ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
  }

  function draw(t) {
    ctx.clearRect(0, 0, width, height);
    ctx.lineWidth = 1;
    for (let i = 0, x = GAP / 2; x < width; i++, x += GAP) {
      linePath(x, i, t);
      ctx.strokeStyle = "rgb(140 140 150 / 0.18)";
      ctx.stroke();

      // Lit part: strength falls off with horizontal distance to the mouse,
      // and a vertical gradient keeps it bright only around the mouse height.
      const near = Math.exp(-(((x - mouse.x) / GLOW_RADIUS) ** 2)) * mouse.glow;
      if (near < 0.02) continue;
      const g = ctx.createLinearGradient(0, mouse.y - GLOW_RADIUS * 2, 0, mouse.y + GLOW_RADIUS * 2);
      g.addColorStop(0, "rgb(236 236 241 / 0)");
      g.addColorStop(0.5, `rgb(236 236 241 / ${0.85 * near})`);
      g.addColorStop(1, "rgb(236 236 241 / 0)");
      ctx.strokeStyle = g;
      ctx.lineWidth = 1 + near;
      ctx.stroke();
      ctx.lineWidth = 1;
    }
  }

  resize();
  window.addEventListener("resize", () => { resize(); if (reduceMotion) draw(0); });
  if (reduceMotion) { draw(0); return; }

  hero.addEventListener("pointermove", (e) => {
    const r = hero.getBoundingClientRect();
    mouse.targetX = e.clientX - r.left;
    mouse.targetY = e.clientY - r.top;
    mouse.targetGlow = 1;
  });
  hero.addEventListener("pointerleave", () => { mouse.targetGlow = 0; });

  // Only animate while the hero is on screen.
  let visible = true;
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }).observe(hero);

  function frame(now) {
    if (visible) {
      mouse.x += (mouse.targetX - mouse.x) * 0.12;
      mouse.y += (mouse.targetY - mouse.y) * 0.12;
      mouse.glow += (mouse.targetGlow - mouse.glow) * 0.08;
      draw(now * 0.0004);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

// Projects + Skills: on wide screens they sit side by side in one track.
// When the bottom of Projects reaches the bottom of the screen, the block is
// pinned and scrolling down slides the track left, so Skills comes in from
// the right with no vertical gap. Below 900px everything stays stacked.
// gsap.matchMedia() undoes everything it created when the breakpoint changes.
let hscrollTrigger = null; // used by setupAnchorScroll() to reach #skills

function setupHorizontalScroll() {
  const wrap = document.getElementById("hscroll");
  const track = document.getElementById("hscroll-track");
  const skills = document.getElementById("skills");
  const mm = gsap.matchMedia();

  mm.add("(min-width: 900px)", () => {
    wrap.classList.add("hscroll--on");
    skills.classList.add("skills--horizontal");
    const distance = () => track.scrollWidth - window.innerWidth;
    const slide = gsap.to(track, {
      x: () => -distance(),
      ease: "none",
      scrollTrigger: {
        trigger: wrap, start: "bottom bottom", end: () => "+=" + distance(),
        pin: true, scrub: 1, invalidateOnRefresh: true,
      },
    });
    hscrollTrigger = slide.scrollTrigger;

    // The Skills title and each column's content rise in as they enter from the right.
    const rise = (targets, trigger) =>
      gsap.from(targets, {
        opacity: 0, y: 40, duration: 0.8, ease: "power3.out", stagger: 0.08,
        scrollTrigger: {
          trigger, containerAnimation: slide, start: "left 85%",
          toggleActions: "play none none reverse",
        },
      });
    rise(skills.querySelectorAll(".skills__intro > *"), skills);
    gsap.utils.toArray(".skill").forEach((skill) => rise(skill.querySelectorAll(".skill__num, h3, p"), skill));

    return () => {
      hscrollTrigger = null;
      wrap.classList.remove("hscroll--on");
      skills.classList.remove("skills--horizontal");
    };
  });

  mm.add("(max-width: 899px)", () => {
    lettersFadeIn(".skills h2");
    revealOnScroll(".skill");
  });
}

// Content first, effects after: the letter-split and scroll effects need the
// text from info.json to already be in the DOM.
async function boot() {
  await Promise.all([initInfo(), initProjects()]);
  setupBackToTop();
  setupAnchorScroll();
  setupHeroLines();
  playIntro();

  if (!reduceMotion && window.gsap && window.ScrollTrigger) {
    revealOnScroll([".panels__row", ".about__media", ".filters", ".contact p"]);
    lettersFadeIn(".about h2, .about p, .projects h2");
    setupHorizontalScroll();
    ScrollTrigger.create({
      trigger: "#contact", start: "top 70%", once: true,
      onEnter: () => {
        const phrase = document.querySelector(".contact__phrase");
        if (phrase.dataset.text) decryptText(phrase);
      },
    });
    // Triggers below the pinned track were created before it: recompute them
    // in page order so they account for the pin's extra scroll length.
    ScrollTrigger.sort();
    ScrollTrigger.refresh();
  }
}

boot();
