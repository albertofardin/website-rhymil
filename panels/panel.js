(function(){
  const sheet  = document.getElementById('uiPanelSheet');
  const panel  = sheet.querySelector('.panel-panel');
  const title  = sheet.querySelector('.panel-title');
  const desc   = sheet.querySelector('.panel-desc');
  const content= sheet.querySelector('.panel-content');

  // Apri da qualsiasi elemento con [data-panel-open]
  document.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-panel-open]');
    if (!t) return;

    e.preventDefault();

    // Titolo e descrizione
    title.textContent = t.getAttribute('data-panel-title') || '';
    const d = t.getAttribute('data-panel-desc') || '';
    desc.textContent = d;
    desc.style.display = d ? '' : 'none';

    // Sorgente contenuti
    const src = t.getAttribute('data-panel-src');
    const tplId = t.getAttribute('data-panel-template');
    const html = t.getAttribute('data-panel-html');

    try {
      if (src) {
        // carica parziale via fetch (stessa origine o CORS abilitato)
        const res = await fetch(src, { credentials: 'same-origin' });
        content.innerHTML = await res.text();
      } else if (tplId) {
        const tpl = document.getElementById(tplId);
        content.innerHTML = tpl ? tpl.innerHTML : '<p>Template non trovato.</p>';
      } else if (html) {
        content.innerHTML = html;
      } else {
        content.innerHTML = '<p>Contenuto non disponibile.</p>';
      }
    } catch (err) {
      content.innerHTML = '<p>Impossibile caricare il contenuto.</p>';
      console.error(err);
    }

    openSheet(t);
  });

  // Apertura, chiusura, ESC
  function openSheet(triggerEl){
    sheet.classList.add('is-open');
    sheet.setAttribute('aria-hidden', 'false');
    document.documentElement.style.overflow = 'hidden';
    // focus non invasivo
    setTimeout(() => panel.focus({ preventScroll: true }), 0);

    // salva il trigger per restituire il focus alla chiusura
    sheet._lastTrigger = triggerEl;
  }

  function closeSheet(){
    sheet.classList.remove('is-open');
    sheet.setAttribute('aria-hidden', 'true');
    document.documentElement.style.overflow = '';
    sheet._lastTrigger?.focus?.();
  }

  sheet.addEventListener('click', (e) => {
    if (e.target.closest('[data-panel-close]')) closeSheet();
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sheet.classList.contains('is-open')) closeSheet();
  });

///////////////
// Gestione tab per *qualsiasi* contenuto caricato nel pannello
document.addEventListener("click", (e) => {
  const tab = e.target.closest(".panel-content .tabs .tab");
  if (!tab) return;

  const guide  = tab.closest(".guide") || document;
  const target = tab.getAttribute("data-tab");
  const tabs   = guide.querySelectorAll(".tabs .tab");
  const panels = guide.querySelectorAll(".panel");

  tabs.forEach(t => {
    const active = t === tab;
    t.classList.toggle("is-active", active);
    t.setAttribute("aria-selected", active ? "true" : "false");
  });

  panels.forEach(p => {
    const match = p.getAttribute("data-panel") === target;
    p.hidden = !match;
    p.classList.toggle("is-active", match);
  });
});

})();