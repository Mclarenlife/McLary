import "./style.css";
import gsap from "gsap";
import { PortfolioScene } from "./scene.js";
import { profile, projects } from "./content.js";
import { GalleryMotion } from "./gallery-motion.js";
import { places, photographs } from "./photography.js";
import { arrowDown, arrowUp, asterisk, orbitIcon } from "./icons.js";

let scene;
let sceneUnavailable = false;
let entered = false;
let experienceReady = false;
let menuOpen = false;
let activeFilter = "All";
let soundOn = false;
let galleryMotion;
let workSurface;
let galleryParking;
const projectCardPool = new Map();
const galleryEntry = { value: 0 };
let navigation;
const app = document.querySelector("#app");
const icon = `<span class="arrow" aria-hidden="true">${arrowDown}</span>`;
const pages = {
  "/": "index",
  "/work/": "work",
  "/about/": "contact",
  "/playground/": "gallery",
  "/gallery/": "gallery",
  "/projects/": "work",
  "/contact/": "contact",
  "/world/": "gallery",
};
const normalize = (p) => (p === "/" ? p : p.replace(/\/$/, "") + "/");
function page() {
  return pages[normalize(location.pathname)] || "404";
}
function brand() {
  return `<a class="brand" href="/" aria-label="McLary home">Mc<em>Lary</em><sup>${asterisk}</sup></a>`;
}
function shell() {
  app.innerHTML = `<header>${brand()}<nav class="nav" aria-label="Main"><a href="/">Index</a><a href="/work/">Work</a><a href="/contact/">Contact</a><button class="menu-toggle" aria-label="Open menu" aria-expanded="false"><span class="menu-dots"><i></i><i></i></span></button></nav></header><div class="menu" inert><nav aria-label="Explore"><a href="/"><small>01</small>Index</a><a href="/work/"><small>02</small>Work</a><a href="/contact/"><small>03</small>Contact</a><a href="/gallery/"><small>04</small>Gallery</a></nav><div class="menu-meta">${profile.name}<br>${profile.title}<p>${profile.introduction}</p></div></div><main class="page" id="content"></main><footer class="bottom"><div class="bottom-left"><button class="sound" aria-label="Enable ambient sound" aria-pressed="false"><i></i><i></i><i></i><i></i><i></i></button><span class="edition">PORTFOLIO — 2026</span></div><a href="/gallery/" class="play-link"><span>Enter</span><span class="globe" aria-hidden="true">${orbitIcon}</span><span>Gallery</span></a><span class="copyright">© ${new Date().getFullYear()} McLary</span></footer><dialog class="dialog" aria-labelledby="detail-title"></dialog>`;
  document
    .querySelector(".menu-toggle")
    .addEventListener("click", () => toggleMenu());
  document
    .querySelector(".sound")
    .addEventListener("click", () => toggleSound());
}
function showPage(updateScene = true) {
  if (workSurface) {
    galleryMotion?.setActive(false);
    workSurface
      .querySelectorAll(".work-mask,.work-backdrop")
      .forEach((layer) => {
        layer.style.transform = "";
        layer.style.transformOrigin = "";
      });
    const canvas = workSurface.querySelector(".gallery-canvas");
    if (canvas) canvas.style.clipPath = "";
    galleryParking.append(workSurface);
  }
  window.scrollTo(0, 0);
  const route = page();
  const main = document.querySelector("main");
  main.className = "page " + route;
  document.body.classList.toggle("work-view", route === "work");
  document.body.classList.toggle("gallery-view", route === "gallery");
  document.documentElement.classList.toggle("work-view", route === "work");
  document.body.classList.toggle(
    "dark-header",
    route === "gallery" || route === "work",
  );
  document
    .querySelectorAll(".nav>a")
    .forEach((a) =>
      a.setAttribute(
        "aria-current",
        pages[normalize(a.pathname)] === route ? "page" : "false",
      ),
    );
  if (route === "index")
    main.innerHTML = `<section class="hero"><p class="eyebrow">${profile.disciplines}</p><h1><em>${profile.hero[0]}</em><span>${profile.hero[1]}</span></h1><a class="pill" href="/work/">Explore my work ${icon}</a></section>`;
  else if (route === "work") renderWork(main);
  else if (route === "contact") {
    main.innerHTML =
      '<section class="contact-copy"><div class="contact-heading"><p class="eyebrow">A NOTE ACROSS THE SEA</p><h1>Let’s make waves.</h1></div><a class="sail-email-link" href="' +
      (profile.email ? "mailto:" + profile.email : "#") +
      '" aria-label="' +
      (profile.email
        ? "Email " + profile.email
        : "Contact details coming soon") +
      '"><span>' +
      (profile.email || "Contact details coming soon") +
      '</span></a><div class="contact-actions">' +
      (profile.email
        ? `<button class="pill outline" id="copy-email">Copy email ${arrowUp}</button>`
        : "") +
      `<a class="contact-back" href="/">Back to Index ${arrowUp}</a></div></section>`;
    if (!scene || sceneUnavailable) main.classList.add("contact-fallback");
  } else if (route === "gallery") {
    main.innerHTML = `<div class="play-title"><p class="eyebrow">PHOTOGRAPHY</p><h1>Photo gallery.</h1></div><div class="play-controls"><p class="place-status" role="status">中国 · 从这里开始</p><div class="filters" aria-label="拍摄地点">${places.map((p) => `<button data-place="${p.id}" aria-pressed="${p.id === "all"}">${p.name}</button>`).join("")}</div></div><div class="photo-access" aria-label="摄影相框">${photographs.map((p) => `<button data-photo="${p.id}">${p.title}</button>`).join("")}</div>`;
    main.querySelectorAll("[data-place]").forEach(
      (b) =>
        (b.onclick = () => {
          main
            .querySelectorAll("[data-place]")
            .forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
          const p = places.find((p) => p.id === b.dataset.place);
          main.querySelector(".place-status").textContent =
            p.id === "all" ? "中国 · 从这里开始" : p.name + " · " + p.english;
          main
            .querySelectorAll("[data-photo]")
            .forEach(
              (button) =>
                (button.hidden =
                  p.id !== "all" &&
                  photographs.find((photo) => photo.id === button.dataset.photo)
                    .place !== p.id),
            );
          scene?.setPlace(p.id);
        }),
    );
    main.querySelectorAll("[data-photo]").forEach((b) => {
      b.onclick = () => openPhoto(b.dataset.photo);
      b.onfocus = () => scene?.photoGallery.focusPhoto(b.dataset.photo);
      b.onblur = () => scene?.photoGallery.focusPhoto(null);
    });
    if (sceneUnavailable) main.classList.add("gallery-fallback");
  } else
    main.innerHTML = `<div class="not-found"><h1>This path is still unwritten.</h1><a class="pill" href="/">Back to the beginning ${arrowUp}</a></div>`;
  if (updateScene) scene?.setPage(route);
  window.scrollTo(0, 0);
  document.title = `McLary — ${{ index: "A world of possibility", work: "Selected work", contact: "Contact", gallery: "Gallery" }[route] || "Page not found"}`;
}

function navigate(path) {
  if (navigation?.isActive()) return;
  if (normalize(path) === normalize(location.pathname)) return;
  if (menuOpen) toggleMenu(false);
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced || !entered) {
    history.pushState({}, "", path);
    galleryEntry.value = 0;
    showPage();
    return;
  }
  const main = document.querySelector("main");
  const nextPage = pages[normalize(path)] || "404";
  if (
    scene &&
    ["index", "contact"].includes(page()) &&
    ["index", "contact"].includes(nextPage)
  ) {
    navigateOcean(path, nextPage, main);
    return;
  }
  const outgoing = main.querySelectorAll(
    ".hero,.work-heading,.contact-copy,.play-title,.play-controls",
  );
  main.style.pointerEvents = "none";
  const direction = nextPage === "index" ? -1 : 1;
  scene?.beginTransition(direction, nextPage);
  let switched = false;
  navigation = gsap.timeline({
    onUpdate: () => {
      const push = scene?.waterMotion.push;
      if (!push?.pass.enabled) return;
      const progress = push.progress;
      const height = Math.max(0.001, switched ? progress : 1 - progress);
      const top = switched
        ? direction > 0
          ? 1 - progress
          : 0
        : direction > 0
          ? 0
          : progress;
      // The mask belongs to the work background during the push, then returns
      // to its fixed viewport position. It never participates in page scrolling.
      main.querySelectorAll(".work-mask,.work-backdrop").forEach((layer) => {
        layer.style.transformOrigin = "top center";
        layer.style.transform = `translateY(${top * innerHeight}px) scaleY(${height})`;
      });
      const canvas = main.querySelector(".gallery-canvas");
      if (canvas)
        canvas.style.clipPath = `inset(${Math.max(0, top) * 100}% 0 ${Math.max(0, 1 - top - height) * 100}% 0)`;
    },
    onComplete: () => {
      document.querySelector("main").style.pointerEvents = "";
      main.querySelectorAll(".work-mask,.work-backdrop").forEach((layer) => {
        layer.style.transform = "";
        layer.style.transformOrigin = "";
      });
      const canvas = main.querySelector(".gallery-canvas");
      if (canvas) canvas.style.clipPath = "";
    },
  });
  navigation.to(
    outgoing,
    {
      y: direction * 24,
      scaleY: 0.94,
      rotationX: direction * 3,
      duration: 0.38,
      ease: "power2.inOut",
    },
    0,
  );
  navigation.to(
    galleryEntry,
    { value: direction * 0.055, duration: 0.38, ease: "power2.inOut" },
    0,
  );
  navigation.to(
    outgoing,
    {
      y: -direction * innerHeight * 1.15,
      skewY: -direction * 4,
      scaleY: 1.14,
      duration: 0.56,
      ease: "power3.in",
    },
    0.38,
  );
  navigation.to(
    galleryEntry,
    { value: -direction * 1.1, duration: 0.56, ease: "power3.in" },
    0.38,
  );
  navigation.call(
    () => {
      history.pushState({}, "", path);
      galleryEntry.value = direction;
      showPage();
      switched = true;
      const incoming = main.querySelectorAll(
        ".hero,.work-heading,.contact-copy,.play-title,.play-controls",
      );
      gsap.fromTo(
        incoming,
        {
          y: direction * innerHeight * 0.95,
          rotationX: -direction * 18,
          skewY: direction * 3,
          transformPerspective: 1200,
        },
        {
          y: 0,
          rotationX: 0,
          skewY: 0,
          scaleY: 1,
          duration: 2.25,
          ease: "elastic.out(1,0.58)",
          clearProps: "transform",
        },
      );
    },
    [],
    0.94,
  );
  navigation.to(
    galleryEntry,
    { value: 0, duration: 2.3, ease: "elastic.out(1,0.58)" },
    0.94,
  );
}
function navigateOcean(path, nextPage, main) {
  main.style.pointerEvents = "none";
  const outgoing = main.querySelector(".hero,.contact-copy");
  scene.setPage(nextPage);
  navigation = gsap.timeline({
    onComplete: () => {
      main.style.pointerEvents = "";
    },
  });
  navigation.to(
    outgoing,
    {
      opacity: 0,
      y: nextPage === "contact" ? -18 : 18,
      duration: 0.35,
      ease: "power2.inOut",
    },
    0,
  );
  navigation.call(
    () => {
      history.pushState({}, "", path);
      galleryEntry.value = 0;
      showPage(false);
      const incoming = main.querySelector(".hero,.contact-copy");
      gsap.fromTo(
        incoming,
        { opacity: 0 },
        { opacity: 1, duration: 1, delay: 0.8, clearProps: "opacity" },
      );
    },
    [],
    0.35,
  );
  navigation.to({}, { duration: 2.65 }, 0);
}
function prepareWork() {
  if (workSurface) return galleryMotion.preparation;
  galleryParking = document.createElement("div");
  galleryParking.className = "gallery-preload";
  galleryParking.inert = true;
  galleryParking.setAttribute("aria-hidden", "true");
  document.body.append(galleryParking);
  workSurface = document.createElement("div");
  workSurface.className = "work-surface";
  galleryParking.append(workSurface);
  const main = workSurface;
  activeFilter = "All";
  main.innerHTML = `<div class="work-backdrop"></div><div class="work-mask" aria-hidden="true"></div><div class="work-head"><div class="work-heading"><h1 class="page-title">Selected work</h1><div class="filters" aria-label="Filter projects">${["All", "Design", "Digital", "Motion"].map((f) => `<button data-filter="${f}" aria-pressed="${f === activeFilter}">${f}<sup>${projects.filter((p) => f === "All" || p.category === f).length}</sup></button>`).join("")}</div></div></div><div class="work-stage"><div class="project-grid"></div><p class="sample-note" style="text-align:center">A collection of concept studies</p></div>`;
  main.querySelectorAll("[data-filter]").forEach(
    (b) =>
      (b.onclick = () => {
        if (activeFilter === b.dataset.filter) return;
        activeFilter = b.dataset.filter;
        main
          .querySelectorAll("[data-filter]")
          .forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
        galleryMotion.switchCards(() => renderCards());
      }),
  );
  renderCards();
  return galleryMotion.preparation;
}
function renderWork(main) {
  prepareWork();
  activeFilter = "All";
  workSurface
    .querySelectorAll("[data-filter]")
    .forEach((button) =>
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.filter === "All"),
      ),
    );
  renderCards();
  main.replaceChildren(workSurface);
  galleryMotion.setActive(true);
}
function renderCards() {
  const grid = workSurface.querySelector(".project-grid");
  if (!projectCardPool.size) {
    const template = document.createElement("template");
    template.innerHTML = projects
      .map(
        (p) =>
          `<button class="project-card" data-project="${p.id}" aria-label="View ${p.title}"><div class="project-cover" style="--project-color:${p.color}">${p.image ? `<img src="${p.image}" alt="${p.title} — original 3D concept study"/>` : ""}</div><div class="project-info"><div><h2>${p.title}</h2><p>${p.subtitle}</p></div><span aria-hidden="true">${arrowUp}</span></div></button>`,
      )
      .join("");
    template.content.querySelectorAll("[data-project]").forEach((card) => {
      card.onclick = () => openProject(card.dataset.project);
      projectCardPool.set(card.dataset.project, card);
    });
  }
  grid.replaceChildren(
    ...projects
      .filter((p) => activeFilter === "All" || p.category === activeFilter)
      .map((p) => projectCardPool.get(p.id)),
  );
  if (galleryMotion) galleryMotion.setCards();
  else
    galleryMotion = new GalleryMotion(
      grid,
      openProject,
      galleryEntry,
      updateGalleryProgress,
    );
}
function updateGalleryProgress(value, label) {
  const progress = document.querySelector(".intro-progress");
  if (!progress) return;
  const progressValue = experienceReady ? 1 : value * 0.92;
  const percent = Math.round(progressValue * 100);
  progress.style.setProperty("--progress", progressValue);
  progress.setAttribute("aria-valuenow", String(percent));
  document.querySelector(".intro-status").textContent =
    `${value === 1 && !experienceReady ? "Preparing your sea" : label} · ${percent}%`;
}
function openProject(id) {
  const p = projects.find((p) => p.id === id),
    d = document.querySelector(".dialog");
  d.innerHTML = `<button class="dialog-close" aria-label="Close project">×</button>${p.image ? `<img src="${p.image}" alt="${p.title}"/>` : ""}<div class="dialog-content"><p class="eyebrow">${p.category.toUpperCase()} · CONCEPT STUDY ${p.year}</p><h2 id="detail-title">${p.title}</h2><p>${p.description}</p></div>`;
  d.querySelector("button").onclick = () => d.close();
  d.showModal();
}
function openPhoto(id) {
  const p = photographs.find((p) => p.id === id);
  if (!p) return;
  const d = document.querySelector(".dialog");
  d.innerHTML = `<button class="dialog-close" aria-label="Close photograph">×</button>${p.image ? `<img src="${p.image}" alt="${p.title}" style="object-fit:contain"/>` : ""}<div class="dialog-content"><p class="eyebrow">PHOTOGRAPHY</p><h2 id="detail-title">${p.title}</h2>${p.image ? `<p>${p.credit || "McLary"}</p>` : ""}</div>`;
  d.querySelector("button").onclick = () => d.close();
  d.showModal();
}
function toggleMenu(force) {
  menuOpen = force ?? !menuOpen;
  const m = document.querySelector(".menu"),
    b = document.querySelector(".menu-toggle");
  m.inert = !menuOpen;
  document.querySelector("main").inert = menuOpen;
  document.querySelector("footer").inert = menuOpen;
  document.body.style.overflow = menuOpen ? "hidden" : "";
  document.body.classList.toggle("menu-open", menuOpen);
  b.setAttribute("aria-expanded", String(menuOpen));
  b.setAttribute("aria-label", menuOpen ? "Close menu" : "Open menu");
  b.innerHTML = menuOpen
    ? "✕"
    : '<span class="menu-dots"><i></i><i></i></span>';
  gsap.to(m, { autoAlpha: menuOpen ? 1 : 0, duration: 0.45 });
  if (menuOpen) m.querySelector("a").focus();
}
let audio;
function toggleSound(enabled = !soundOn) {
  soundOn = enabled;
  try {
    if (!audio && soundOn) {
      audio = new AudioContext();
      const gain = audio.createGain();
      gain.gain.value = 0.018;
      gain.connect(audio.destination);
      [130.81, 196, 261.63].forEach((freq, i) => {
        const osc = audio.createOscillator(),
          g = audio.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        g.gain.value = 1 / (i + 2);
        osc.connect(g);
        g.connect(gain);
        osc.start();
      });
    }
    if (audio) {
      if (soundOn) audio.resume();
      else audio.suspend();
    }
  } catch {
    soundOn = false;
  }
  const button = document.querySelector(".sound");
  button.setAttribute("aria-pressed", String(soundOn));
  button.setAttribute(
    "aria-label",
    soundOn ? "Mute ambient sound" : "Enable ambient sound",
  );
}
function enter(withSound = false) {
  if (entered) return;
  entered = true;
  if (scene) scene.entered = true;
  if (withSound) toggleSound(true);
  const intro = document.querySelector(".intro");
  gsap.to(intro, {
    opacity: 0,
    duration: 0.8,
    onComplete: () => intro.remove(),
  });
  const heroParts = document.querySelectorAll(".hero>*");
  if (heroParts.length)
    gsap.fromTo(
      heroParts,
      { opacity: 0, y: 24 },
      {
        opacity: 1,
        y: 0,
        duration: 1,
        stagger: 0.13,
        delay: 0.4,
        clearProps: "transform",
      },
    );
  document.querySelector("main").inert = false;
  document.querySelector("header").inert = false;
  document.querySelector("footer").inert = false;
}
shell();
showPage();
document.querySelector("main").inert = true;
document.querySelector("header").inert = true;
document.querySelector("footer").inert = true;
const intro = document.createElement("section");
intro.className = "intro";
intro.dataset.loading = "true";
intro.setAttribute("aria-label", "Welcome to McLary");
intro.innerHTML = `<div class="intro-inner"><div class="intro-symbol" aria-hidden="true">M.</div><h2>MCLARY</h2><p>${profile.introduction}</p><button class="pill" id="enter" disabled>Preparing your space</button><div class="intro-progress" role="progressbar" aria-label="Loading portfolio" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"></div><p class="intro-status" role="status">Loading your projects · 0%</p></div><button class="muted-entry" disabled>ENTER WITHOUT AUDIO</button>`;
document.body.append(intro);
async function start() {
  const galleryPrepared = prepareWork();
  try {
    scene = new PortfolioScene(document.querySelector("#scene"));
    document.querySelector("main").classList.remove("contact-fallback");
    scene.setPage(page());
    scene.onPhotoSelect = openPhoto;
    scene.onContactFrame = (bounds, reveal) => {
      const link = document.querySelector(".sail-email-link");
      if (!link) return;
      link.style.transform = `translate3d(${bounds.x}px,${bounds.y}px,0)`;
      link.style.width = `${bounds.width}px`;
      link.style.height = `${bounds.height}px`;
      link.style.pointerEvents = reveal > 0.85 ? "auto" : "none";
    };
    if (
      import.meta.env.DEV &&
      new URLSearchParams(location.search).has("render-studies")
    ) {
      const { renderStudies } = await import("./artworks.js");
      renderStudies(projects);
      if (page() === "work") renderCards();
    }
  } catch (e) {
    sceneUnavailable = true;
    console.error("Scene unavailable:", e);
    const notice = document.createElement("p");
    notice.className = "scene-status";
    notice.textContent = "3D unavailable. You can still explore the portfolio.";
    document.body.append(notice);
    if (page() === "contact")
      document.querySelector("main").classList.add("contact-fallback");
  }
  await Promise.all([
    document.fonts.ready,
    galleryPrepared,
    scene
      ?.prepare()
      .catch((error) => console.warn("Scene preparation unavailable", error)),
  ]);
  experienceReady = true;
  updateGalleryProgress(1, "Your space is ready");
  intro.dataset.loading = "false";
  document.querySelector("#enter").disabled = false;
  document.querySelector("#enter").innerHTML = "Enter " + icon;
  document.querySelector(".muted-entry").disabled = false;
  document.querySelector("#enter").onclick = () => enter(true);
  document.querySelector(".muted-entry").onclick = () => enter(false);
}
start();
document.addEventListener("click", (e) => {
  const a = e.target.closest("a");
  if (
    !a ||
    a.origin !== location.origin ||
    e.metaKey ||
    e.ctrlKey ||
    e.shiftKey
  )
    return;
  e.preventDefault();
  navigate(a.pathname);
});
document.addEventListener("click", async (e) => {
  if (e.target.id === "copy-email" && profile.email) {
    try {
      await navigator.clipboard.writeText(profile.email);
      e.target.textContent = "Copied";
    } catch {
      e.target.textContent = "Select the email to copy";
    }
  }
});
document.querySelector(".dialog").addEventListener("click", (e) => {
  if (e.target === e.currentTarget) {
    const rect = e.currentTarget.getBoundingClientRect();
    if (
      e.clientX < rect.left ||
      e.clientX > rect.right ||
      e.clientY < rect.top ||
      e.clientY > rect.bottom
    )
      e.currentTarget.close();
  }
});
addEventListener("scene-unavailable", () => {
  sceneUnavailable = true;
  document.querySelector("main").classList.add("contact-fallback");
});
addEventListener("popstate", () => {
  navigation?.kill();
  scene?.cancelTransition();
  galleryEntry.value = 0;
  document.querySelector("main").style.pointerEvents = "";
  if (menuOpen) toggleMenu(false);
  showPage();
});
addEventListener("keydown", (e) => {
  if (e.key === "Escape" && menuOpen) {
    toggleMenu(false);
    document.querySelector(".menu-toggle").focus();
  }
  if (e.key === "Tab" && menuOpen) {
    const stops = [
      ...document.querySelectorAll("header a,header button,.menu a"),
    ].filter((n) => n.getClientRects().length);
    const first = stops[0],
      last = stops.at(-1);
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
});
