// /home/panel.js
(function(){
  const sheet  = document.getElementById('uiPanelSheet');
  if (!sheet) return;

  const panel  = sheet.querySelector('.panel-panel');
  const title  = sheet.querySelector('.panel-title');
  const content= sheet.querySelector('.panel-content');

  // Apri da qualsiasi elemento con [data-panel-open]
  document.addEventListener('click', async (e) => {
    const trigger = e.target.closest('[data-panel-open]');
    if (!trigger) return;

    e.preventDefault();

    // Titolo e descrizione
    title.textContent = trigger.getAttribute('data-panel-title') || '';

    // Sorgente contenuti
   try {
  const src   = trigger.getAttribute('data-panel-src');
  const tplId = trigger.getAttribute('data-panel-template');
  const html  = trigger.getAttribute('data-panel-html');

  if (src) {
    // Prova PRIMA l’URL così com’è (relativo alla pagina),
    // poi in fallback prova a forzare quello ASSOLUTO dalla root.
    const rel = src;
    const abs = src.startsWith('/') ? src : '/' + src.replace(/^\.\//, '');

    let res = await fetch(rel, { credentials: 'same-origin' });
    if (!res.ok) {
      console.warn('[panel] retry with absolute URL:', abs, '→ got', res.status, res.statusText);
      res = await fetch(abs, { credentials: 'same-origin' });
    }
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText} for ${res.url || src}`);
    }

    content.innerHTML = await res.text();
  } else if (tplId) {
    const tpl = document.getElementById(tplId);
    content.innerHTML = tpl ? tpl.innerHTML : '<p>Template non trovato.</p>';
  } else if (html) {
    content.innerHTML = html;
  } else {
    content.innerHTML = '<p>Contenuto non disponibile.</p>';
  }

  // Rimuovi target _blank dai link di galleria (evita nuova scheda)
  content.querySelectorAll('.pswp-gallery a[target="_blank"]').forEach(a => a.removeAttribute('target'));

  // Notifica l’aggiornamento e registra subito eventuali gallerie nuove
  document.dispatchEvent(new CustomEvent('panel:content-updated', { detail: { container: content } }));

if (typeof window.__pswpRefresh === 'function') window.__pswpRefresh();

  if (typeof window.__pswpRegisterGalleries === 'function') {
    window.__pswpRegisterGalleries(content);
  }

} catch (err) {
  console.error('[panel] load error:', err);
  content.innerHTML = '<p>Impossibile caricare il contenuto.</p>';
}


    openSheet(trigger);
  });

  // Apertura, chiusura, ESC
  function openSheet(triggerEl){
    sheet.classList.add('is-open');
    sheet.setAttribute('aria-hidden', 'false');
    document.documentElement.style.overflow = 'hidden';
    setTimeout(() => panel.focus({ preventScroll: true }), 0);
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

  // Tabs generici (supporta .tabs/.panel e .install-tabs/.install-panel)
  document.addEventListener('click', (e) => {
    const tab = e.target.closest('.panel-content .tabs .tab, .panel-content .install-tabs .tab');
    if (!tab) return;

    const root   = tab.closest('.guide, [data-install-guide]') || content;
    const target = tab.getAttribute('data-tab');
    const tabs   = root.querySelectorAll('.tabs .tab, .install-tabs .tab');
    const panels = root.querySelectorAll('.panel, .install-panel');

    tabs.forEach(t => {
      const active = t === tab;
      t.classList.toggle('is-active', active);
      t.setAttribute('aria-selected', active ? 'true' : 'false');
    });

    panels.forEach(p => {
      const match = p.getAttribute('data-panel') === target;
      p.hidden = !match;
      p.classList.toggle('is-active', match);
    });
  });

  // Drag verso il basso per chiudere
  let startY = null, currentY = null, dragging = false;
  panel.addEventListener('touchstart', e => {
    dragging = true;
    startY = e.touches[0].clientY;
    currentY = startY;
    panel.style.transition = 'none';
  }, {passive:true});
  panel.addEventListener('touchmove', e => {
    if (!dragging) return;
    currentY = e.touches[0].clientY;
    const dy = Math.max(0, currentY - startY);
    panel.style.transform = `translateY(${dy}px)`;
  }, {passive:true});
  panel.addEventListener('touchend', () => {
    if (!dragging) return;
    const dy = Math.max(0, currentY - startY);
    panel.style.transition = '';
    panel.style.transform = '';
    dragging = false; startY = currentY = null;
    if (dy > 100) closeSheet();
  });

  /* --------- fallback ultimo miglio: apri forzatamente ---------- */
  document.addEventListener('click', (e) => {
    const a = e.target.closest('.panel-content .pswp-gallery a');
    if (!a) return;

    // se per qualche motivo non è registrata, blocca nav e apri
    if (window.__pswpLightbox && typeof window.__pswpLightbox.loadAndOpen === 'function') {
      e.preventDefault();
      const gallery = a.closest('.pswp-gallery');
      const items = Array.from(gallery.querySelectorAll('a'));
      const index = items.indexOf(a);
      if (typeof window.__pswpOpen === 'function') {
    // assicura che la lightbox sia aggiornata e poi apri
    window.__pswpRefresh?.();
    window.__pswpOpen(index, gallery);
  }
    }
  });

})();
