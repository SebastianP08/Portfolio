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

function renderPanels() {
  panelsRow.innerHTML = projects
    .map((p) => {
      const href = p.enlace ? esc(p.enlace) : "#projects";
      const external = p.enlace ? ' target="_blank" rel="noopener"' : "";
      return `
      <a class="panel" href="${href}"${external} style="--img:url('${esc(p.imagen)}')" aria-label="${esc(p.nombre)}">
        <div class="panel__label"><strong>${esc(p.nombre)}</strong><span>${esc(p.categoria)}</span></div>
      </a>`;
    })
    .join("");
}

function renderCards(category) {
  const list = category === "Todos" ? projects : projects.filter((p) => p.categoria === category);
  cardsEl.innerHTML = list
    .map(
      (p) => `
      <article class="card">
        <img class="card__img" src="${esc(p.imagen)}" alt="${esc(p.nombre)}" loading="lazy" />
        <div class="card__body">
          ${p.enProceso ? '<span class="badge">En proceso</span>' : ""}
          <h3>${esc(p.nombre)}</h3>
          <p class="card__meta">${esc(p.categoria)} · ${esc(p.herramienta)}</p>
          <p class="card__desc">${esc(p.descripcion)}</p>
          ${p.enlace ? `<a class="card__link" href="${esc(p.enlace)}" target="_blank" rel="noopener">Ver proyecto</a>` : ""}
        </div>
      </article>`
    )
    .join("");
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

  document.getElementById("skills-title").textContent = info.skills.titulo;
  skillsGrid.innerHTML = info.skills.items
    .map((s) => `<div class="skill"><h3>${esc(s.titulo)}</h3><p>${esc(s.texto)}</p></div>`)
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

// Cards are re-created on every filter, so their old tweens are killed first.
let cardTweens = [];
function revealCards() {
  cardTweens.forEach((t) => {
    t.scrollTrigger?.kill();
    t.kill();
  });
  cardTweens = revealOnScroll(".card");
  window.ScrollTrigger?.refresh();
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
  gsap.set(".hero__title", { opacity: 0, y: 40 });

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
    gsap.to(".hero__title", { opacity: 1, y: 0, duration: 1, delay: 0.3 });
  };
  const skip = () => finish();

  const tl = gsap.timeline({ onComplete: finish });
  tl.from(nameEl.children, { opacity: 0, y: 30, duration: 0.5, ease: "power2.out", stagger: 0.06 })
    .from(line, { scaleX: 0, duration: 0.8, ease: "power2.inOut" }, "-=0.4")
    .to({}, { duration: 0.5 });

  intro.addEventListener("click", skip);
  document.addEventListener("keydown", skip);
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

// Content first, effects after: the letter-split and scroll effects need the
// text from info.json to already be in the DOM.
async function boot() {
  await Promise.all([initInfo(), initProjects()]);
  setupBackToTop();
  playIntro();

  if (!reduceMotion && window.gsap && window.ScrollTrigger) {
    revealOnScroll([".panels__row", ".about__media", ".filters", ".contact p"]);
    lettersFadeIn(".about h2, .about p, .projects h2, .skills h2, .skill h3, .skill p");
    ScrollTrigger.create({
      trigger: "#contact", start: "top 70%", once: true,
      onEnter: () => {
        const phrase = document.querySelector(".contact__phrase");
        if (phrase.dataset.text) decryptText(phrase);
      },
    });
  }
}

boot();
