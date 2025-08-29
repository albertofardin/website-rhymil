// app.js (includi con: <script type="module" src="./app.js"></script>)
import PhotoSwipeLightbox from '/photoswipe/photoswipe-lightbox.esm.js';
import PhotoSwipeDynamicCaption from '/photoswipe/photoswipe-caption-plugin.esm.min.js';


/* -------------------- Service Worker (opzionale) -------------------- */
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(console.error);
}

/* ----------------------- PWA install: bottone ----------------------- */
const installBtn = document.getElementById('installBtn');
const version = document.getElementById('version'); // se lo usi in pagina

function isStandalone(){
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}
function isMobileUA(){
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}
if (installBtn) {
  const shouldShow = !isStandalone() && isMobileUA();
  installBtn.hidden = !shouldShow;
  if (version) version.style.display = shouldShow ? 'none' : '';
  window.addEventListener('appinstalled', () => {
    installBtn.hidden = true;
    if (version) version.style.display = '';
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

function openSheet(){ sheet.classList.add('is-open'); sheet.setAttribute('aria-hidden','false'); document.documentElement.style.overflow='hidden'; setTimeout(()=>panel.focus({preventScroll:true}),0); }
function closeSheet(){ sheet.classList.remove('is-open'); sheet.setAttribute('aria-hidden','true'); document.documentElement.style.overflow=''; }
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


/* ----------------------- PhotoSwipe Lightbox ------------------------ */

/* Inizializza una sola istanza, funziona anche su gallery nascoste (sono nel DOM) */
const lightbox = new PhotoSwipeLightbox({
  gallery: '.pswp-gallery',
  children: 'a',
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
