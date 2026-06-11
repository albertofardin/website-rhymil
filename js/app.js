// app.js (includi con: <script type="module" src="./app.js"></script>)

/* -------------------- Service Worker (opzionale) -------------------- */
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("js/sw.js").catch(console.error);
}

/* ----------------------- PWA install: bottone ----------------------- */
const installBtn = document.getElementById("installBtn");

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}
function isMobileUA() {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}
if (installBtn) {
  const shouldShow = !isStandalone() && isMobileUA();
  installBtn.hidden = !shouldShow;
  window.addEventListener("appinstalled", () => {
    installBtn.hidden = true;
  });
}

/* --------- Tasto "back" mobile: chiude i pannelli, non l'app -------- */
// pila dei pannelli aperti: il back di sistema chiude l'ultimo aperto
const panelStack = [];

function pushPanel(name, closeNow) {
  panelStack.push({ name, closeNow });
  history.pushState({ panel: name }, "");
}

// chiusura via UI: consuma l'entry di history, il popstate esegue la chiusura
function popPanel(name) {
  const i = panelStack.findIndex((p) => p.name === name);
  if (i === -1) return;
  if (i === panelStack.length - 1) history.back();
  else panelStack.splice(i, 1)[0].closeNow();
}

window.addEventListener("popstate", () => {
  const top = panelStack.pop();
  if (top) top.closeNow();
});

/* ---------------------- Install modal handlers ---------------------- */
const installModal = document.getElementById("installModal");
if (installBtn && installModal) {
  const backdrop = installModal.querySelector(".install-backdrop");
  const closeEls = installModal.querySelectorAll("[data-close]");
  const tabs = Array.from(installModal.querySelectorAll(".install-tabs .tab"));
  const panels = Array.from(installModal.querySelectorAll(".install-panel"));

  function openInstall() {
    if (installModal.classList.contains("is-open")) return;
    installModal.classList.add("is-open");
    document.documentElement.style.overflow = "hidden";
    pushPanel("install", closeInstallNow);
  }
  function closeInstallNow() {
    installModal.classList.remove("is-open");
    document.documentElement.style.overflow = "";
  }
  function closeInstall() {
    popPanel("install");
  }
  installBtn.addEventListener("click", (e) => {
    e.preventDefault();
    openInstall();
  });
  backdrop.addEventListener("click", closeInstall);
  closeEls.forEach((el) => el.addEventListener("click", closeInstall));
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && installModal.classList.contains("is-open"))
      closeInstall();
  });

  // tab switch
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const target = tab.getAttribute("data-tab");
      tabs.forEach((t) => {
        const on = t === tab;
        t.classList.toggle("is-active", on);
        t.setAttribute("aria-selected", on ? "true" : "false");
      });
      panels.forEach((p) => {
        const match = p.getAttribute("data-panel") === target;
        p.hidden = !match;
        p.classList.toggle("is-active", match);
      });
    });
  });
}

/* ------------------------ Panel riutilizzabile ---------------------- */
const sheet = document.getElementById("uiPanelSheet");
const panel = sheet.querySelector(".panel-panel");
const pContent = sheet.querySelector(".panel-content");

function openSheet() {
  if (sheet.classList.contains("is-open")) return;
  sheet.classList.add("is-open");
  sheet.setAttribute("aria-hidden", "false");
  document.documentElement.style.overflow = "hidden";
  panel.scrollTop = 0;
  setTimeout(() => panel.focus({ preventScroll: true }), 0);
  pushPanel("sheet", closeSheetNow);
}
function closeSheetNow() {
  sheet.classList.remove("is-open");
  sheet.setAttribute("aria-hidden", "true");
  document.documentElement.style.overflow = "";
  panel.style.transform = "";
}
function closeSheet() {
  popPanel("sheet");
}
sheet.addEventListener("click", (e) => {
  if (e.target.closest("[data-panel-close]")) closeSheet();
});
window.addEventListener("keydown", (e) => {
  // se la scheda personaggio è aperta, Escape chiude solo quella
  if (
    e.key === "Escape" &&
    sheet.classList.contains("is-open") &&
    !document.getElementById("charCard").classList.contains("is-open")
  )
    closeSheet();
});

// trigger open
document.addEventListener("click", (e) => {
  const t = e.target.closest("[data-panel-open]");
  if (!t) return;
  e.preventDefault();
  const targetSel = t.getAttribute("data-panel-target");

  // mostra la sezione richiesta (il contenuto è già nel DOM)
  const all = pContent.querySelectorAll(".panel-section");
  all.forEach((s) => s.classList.remove("is-active"));
  if (targetSel) {
    const sec = pContent.querySelector(targetSel);
    if (sec) sec.classList.add("is-active");
  }
  openSheet();
});

/* ------------- Panel: trascina verso il basso per chiudere ---------- */
let dragStartY = null;
let dragDelta = 0;

panel.addEventListener(
  "touchstart",
  (e) => {
    // solo su layout mobile (<800px il transform base è translateY puro)
    // e solo se il contenuto del panel è scrollato in cima
    if (window.innerWidth >= 800 || panel.scrollTop > 0) return;
    dragStartY = e.touches[0].clientY;
    dragDelta = 0;
  },
  { passive: true },
);

panel.addEventListener(
  "touchmove",
  (e) => {
    if (dragStartY === null) return;
    dragDelta = Math.max(0, e.touches[0].clientY - dragStartY);
    if (dragDelta === 0) return;
    panel.style.transition = "none";
    panel.style.transform = `translateY(${dragDelta}px)`;
  },
  { passive: true },
);

panel.addEventListener("touchend", () => {
  if (dragStartY === null) return;
  panel.style.transition = "";
  if (dragDelta > 110) closeSheet();
  else panel.style.transform = "";
  dragStartY = null;
  dragDelta = 0;
});

/* ---------------------- Animazioni di entrata ----------------------- */
const io =
  "IntersectionObserver" in window
    ? new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          });
        },
        { threshold: 0.12 },
      )
    : null;

document
  .querySelectorAll("#header .inner, #main > .actions, #main .factions")
  .forEach((group) => {
    Array.from(group.children).forEach((el, i) => {
      if (el.tagName === "HR") return;
      el.classList.add("reveal");
      el.style.setProperty("--reveal-delay", `${Math.min(i, 10) * 70}ms`);
      if (io) io.observe(el);
      else el.classList.add("is-visible");
    });
  });

/* indice per l'entrata a cascata dei thumbnail (vedi CSS .panel-section.is-active) */
document.querySelectorAll(".char-gallery").forEach((gallery) => {
  gallery.querySelectorAll("a").forEach((a, i) => {
    a.style.setProperty("--i", Math.min(i, 14));
  });
});

/* ----------------------- Scheda personaggio ------------------------- */
const charCard = document.getElementById("charCard");
const charImg = charCard.querySelector(".char-media img");
const charName = charCard.querySelector(".char-name");
const charOwner = charCard.querySelector(".char-owner");
const charChips = charCard.querySelector(".char-chips");
const charQuote = charCard.querySelector(".char-quote");
const charDesc = charCard.querySelector(".char-desc");
const charOpen = charCard.querySelector(".char-open");
const charDownload = charCard.querySelector(".char-download");

let charList = [];
let charIndex = -1;

function fillChar(a) {
  const d = a.dataset;

  charImg.classList.add("is-loading");
  charImg.classList.toggle("is-dead", a.classList.contains("is-dead"));
  charImg.src = a.href;
  charImg.alt = d.name || "";

  charName.textContent = d.name || "";
  charOwner.textContent = d.owner ? `- ${d.owner}` : "";
  charOwner.hidden = !d.owner;

  // chip della fazione
  charChips.innerHTML = "";
  const gallery = a.closest(".char-gallery");
  if (gallery?.dataset.factionName) {
    const li = document.createElement("li");
    li.className = "char-chip-faction";
    li.textContent =
      `${gallery.dataset.factionIcon || ""} ${gallery.dataset.factionName}`.trim();
    charChips.appendChild(li);
  }

  charQuote.textContent = d.quote || "";
  charQuote.hidden = !d.quote;
  charDesc.textContent = d.desc || "";
  charDesc.hidden = !d.desc;
  charOpen.href = a.href;
  charDownload.href = a.href;
  charDownload.setAttribute(
    "download",
    `${(d.name || "personaggio").replace(/[^\w. -]/g, "")}.webp`,
  );

  // precarica i vicini per una navigazione fluida
  [1, -1].forEach((step) => {
    const n = charList[(charIndex + step + charList.length) % charList.length];
    if (n) new Image().src = n.href;
  });
}

charImg.addEventListener("load", () => charImg.classList.remove("is-loading"));

function openChar(a) {
  const gallery = a.closest(".char-gallery");
  charList = Array.from(gallery.querySelectorAll("a:not(.thumb-add)"));
  charIndex = charList.indexOf(a);
  fillChar(a);
  if (!charCard.classList.contains("is-open")) {
    charCard.classList.add("is-open");
    charCard.setAttribute("aria-hidden", "false");
    pushPanel("char", closeCharNow);
  }
}

function closeCharNow() {
  charCard.classList.remove("is-open");
  charCard.setAttribute("aria-hidden", "true");
}

function closeChar() {
  popPanel("char");
}

function navChar(step) {
  if (charList.length < 2) return;
  charIndex = (charIndex + step + charList.length) % charList.length;
  fillChar(charList[charIndex]);
}

document.addEventListener("click", (e) => {
  const a = e.target.closest(".char-gallery a");
  if (!a || a.classList.contains("thumb-add")) return;
  e.preventDefault();
  openChar(a);
});

charCard.addEventListener("click", (e) => {
  if (e.target.closest("[data-char-close]")) closeChar();
});
charCard
  .querySelector(".char-prev")
  .addEventListener("click", () => navChar(-1));
charCard
  .querySelector(".char-next")
  .addEventListener("click", () => navChar(1));

window.addEventListener("keydown", (e) => {
  if (!charCard.classList.contains("is-open")) return;
  if (e.key === "Escape") closeChar();
  if (e.key === "ArrowLeft") navChar(-1);
  if (e.key === "ArrowRight") navChar(1);
});

// swipe orizzontale sull'immagine per cambiare personaggio
let charTouchX = null;
charCard.querySelector(".char-media").addEventListener(
  "touchstart",
  (e) => {
    charTouchX = e.touches[0].clientX;
  },
  { passive: true },
);
charCard.querySelector(".char-media").addEventListener("touchend", (e) => {
  if (charTouchX === null) return;
  const dx = e.changedTouches[0].clientX - charTouchX;
  if (Math.abs(dx) > 40) navChar(dx > 0 ? -1 : 1);
  charTouchX = null;
});
