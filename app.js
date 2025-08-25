if ('serviceWorker' in navigator) {
  // registra il SW alla radice per avere scope su tutto il sito
  navigator.serviceWorker
    .register('/sw.js', { scope: '/' /* opzionale, il default coincide */ })
    .catch(console.error);
}

////////////////////////////////////////////////////////////

// Riferimenti
const btn = document.getElementById('installBtn');

function isInStandaloneMode() {
  return (window.matchMedia('(display-mode: standalone)').matches) || (window.navigator.standalone === true);
}
function isMobile() {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

// Mostra/Nascondi bottone installazione
if (!isInStandaloneMode() && isMobile()) {
  btn.hidden = false;
} else {
  btn.hidden = true;
}


// banner nativo (non disponibile su tutti i dispositivi)
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  if(isMobile()) btn.hidden = false; // assicurati che il bottone si veda
});