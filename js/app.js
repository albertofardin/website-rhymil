// app.js (includi con: <script type="module" src="./app.js"></script>)
import PhotoSwipeLightbox from '/photoswipe/photoswipe-lightbox.esm.js';
import PhotoSwipeDynamicCaption from '/photoswipe/photoswipe-caption-plugin.esm.min.js';


/* -------------------- Service Worker (opzionale) -------------------- */
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('js/sw.js').catch(console.error);
}

/* ----------------------- PWA install: bottone ----------------------- */
const installBtn = document.getElementById('installBtn');

function isStandalone(){
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}
function isMobileUA(){
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}
if (installBtn) {
  const shouldShow = !isStandalone() && isMobileUA();
  installBtn.hidden = !shouldShow;
  window.addEventListener('appinstalled', () => {
    installBtn.hidden = true;
  });
}

/* ---------------------- Install modal handlers ---------------------- */
const installModal = document.getElementById('installModal');
if (installBtn && installModal) {
  const backdrop = installModal.querySelector('.install-backdrop');
  const closeEls = installModal.querySelectorAll('[data-close]');
  const tabs = Array.from(installModal.querySelectorAll('.install-tabs .tab'));
  const panels = Array.from(installModal.querySelectorAll('.install-panel'));

  function openInstall(){ installModal.classList.add('is-open'); document.documentElement.style.overflow='hidden'; }
  function closeInstall(){ installModal.classList.remove('is-open'); document.documentElement.style.overflow=''; }
  installBtn.addEventListener('click', (e)=>{ e.preventDefault(); openInstall(); });
  backdrop.addEventListener('click', closeInstall);
  closeEls.forEach(el => el.addEventListener('click', closeInstall));
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && installModal.classList.contains('is-open')) closeInstall(); });

  // tab switch
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.getAttribute('data-tab');
      tabs.forEach(t => { const on = t===tab; t.classList.toggle('is-active', on); t.setAttribute('aria-selected', on?'true':'false'); });
      panels.forEach(p => {
        const match = p.getAttribute('data-panel') === target;
        p.hidden = !match; p.classList.toggle('is-active', match);
      });
    });
  });
}

/* ------------------------ Panel riutilizzabile ---------------------- */
const sheet = document.getElementById('uiPanelSheet');
const panel = sheet.querySelector('.panel-panel');
const pContent = sheet.querySelector('.panel-content');

function openSheet(){ sheet.classList.add('is-open'); sheet.setAttribute('aria-hidden','false'); document.documentElement.style.overflow='hidden'; panel.scrollTop = 0; setTimeout(()=>panel.focus({preventScroll:true}),0); }
function closeSheet(){ sheet.classList.remove('is-open'); sheet.setAttribute('aria-hidden','true'); document.documentElement.style.overflow=''; panel.style.transform=''; }
sheet.addEventListener('click', e => { if (e.target.closest('[data-panel-close]')) closeSheet(); });
window.addEventListener('keydown', e => { if (e.key === 'Escape' && sheet.classList.contains('is-open')) closeSheet(); });

// trigger open
document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-panel-open]');
  if (!t) return;
  e.preventDefault();
  const targetSel = t.getAttribute('data-panel-target');

  // mostra la sezione richiesta (il contenuto è già nel DOM)
  const all = pContent.querySelectorAll('.panel-section');
  all.forEach(s => s.classList.remove('is-active'));
  if (targetSel) {
    const sec = pContent.querySelector(targetSel);
    if (sec) sec.classList.add('is-active');
  }
  openSheet();
});


/* ------------- Panel: trascina verso il basso per chiudere ---------- */
let dragStartY = null;
let dragDelta = 0;

panel.addEventListener('touchstart', (e) => {
  // solo su layout mobile (<800px il transform base è translateY puro)
  // e solo se il contenuto del panel è scrollato in cima
  if (window.innerWidth >= 800 || panel.scrollTop > 0) return;
  dragStartY = e.touches[0].clientY;
  dragDelta = 0;
}, { passive: true });

panel.addEventListener('touchmove', (e) => {
  if (dragStartY === null) return;
  dragDelta = Math.max(0, e.touches[0].clientY - dragStartY);
  if (dragDelta === 0) return;
  panel.style.transition = 'none';
  panel.style.transform = `translateY(${dragDelta}px)`;
}, { passive: true });

panel.addEventListener('touchend', () => {
  if (dragStartY === null) return;
  panel.style.transition = '';
  if (dragDelta > 110) closeSheet();
  else panel.style.transform = '';
  dragStartY = null;
  dragDelta = 0;
});

/* ---------------------- Animazioni di entrata ----------------------- */
const io = 'IntersectionObserver' in window
  ? new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      });
    }, { threshold: 0.12 })
  : null;

document
  .querySelectorAll('#header .inner, #main > .actions, #main .factions')
  .forEach((group) => {
    Array.from(group.children).forEach((el, i) => {
      if (el.tagName === 'HR') return;
      el.classList.add('reveal');
      el.style.setProperty('--reveal-delay', `${Math.min(i, 10) * 70}ms`);
      if (io) io.observe(el);
      else el.classList.add('is-visible');
    });
  });

/* indice per l'entrata a cascata dei thumbnail (vedi CSS .panel-section.is-active) */
document.querySelectorAll('.pswp-gallery').forEach((gallery) => {
  gallery.querySelectorAll('a').forEach((a, i) => {
    a.style.setProperty('--i', Math.min(i, 14));
  });
});

/* ----------------------- PhotoSwipe Lightbox ------------------------ */

/* Inizializza una sola istanza, funziona anche su gallery nascoste (sono nel DOM) */
const lightbox = new PhotoSwipeLightbox({
  gallery: '.pswp-gallery',
  children: 'a:not(.thumb-add)', // la card "Aggiungi il tuo PG" non è una slide
  pswpModule: () => import('/photoswipe/photoswipe.esm.js')
});
lightbox.init();


lightbox.on('uiRegister', function() {
  lightbox.pswp.ui.registerElement({
    name: 'download-button',
    order: 8,
    isButton: true,
    tagName: 'a',

    // SVG with outline
    html: {
      isCustomSVG: true,
      inner: '<path d="M20.5 14.3 17.1 18V10h-2.2v7.9l-3.4-3.6L10 16l6 6.1 6-6.1ZM23 23H9v2h14Z" id="pswp__icn-download"/>',
      outlineID: 'pswp__icn-download'
    },

    // Or provide full svg:
    // html: '<svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true" class="pswp__icn"><path d="M20.5 14.3 17.1 18V10h-2.2v7.9l-3.4-3.6L10 16l6 6.1 6-6.1ZM23 23H9v2h14Z" /></svg>',

    // Or provide any other markup:
    // html: '<i class="fa-solid fa-download"></i>' 

    onInit: (el, pswp) => {
      el.setAttribute('download', '');
      el.setAttribute('target', '_blank');
      el.setAttribute('rel', 'noopener');

      pswp.on('change', () => {
        console.log('change');
        el.href = pswp.currSlide.data.src;
      });
    }
  });
});
new PhotoSwipeDynamicCaption(lightbox, {
  type: 'auto',
  captionContent: (slide) => {
    const el = slide.data.element;

    // 0) PRIMA: legge ciò che hai messo nell'anchor
    const inline = el?.querySelector('.pswp-caption-content');
    if (inline) return inline.innerHTML;

    // 1) figcaption vicino
    const figcap = el?.closest('figure')?.querySelector('figcaption');
    if (figcap) return figcap.innerHTML;

    // 2) attributo title dell'anchor
    const title = el?.getAttribute('title');
    if (title) return title;

    // 3) alt dell'immagine
    const alt = el?.querySelector('img')?.getAttribute('alt');
    if (alt) return alt;

    return '';
  }
});
