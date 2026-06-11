<p align="center">
<img width="200" src="./images/avatar.png">
</p>

## website-rhymil

https://albertofardin.github.io/website-rhymil/

Questo sito raccoglie le illustrazioni dei personaggi della campagna LARP **Rhymil**, per avere sempre a portata di mano volti e nomi tra un evento e l’altro. Non è il sito ufficiale della campagna (che fornisce ambientazione e regolamento), ma serve da supporto visivo per i partecipanti.

---

## Caratteristiche principali

- Completamente realizzato con **HTML**, **CSS** e **JavaScript**, senza framework esterni.
- L’**index.html** si popola dinamicamente tramite file **JSON** presenti nella cartella `rhymil`.
- Include uno script (`generateRhymil.js`) che genera l’index a partire dai JSON.
- Include uno script (`generateImages.js`) che, partendo dagli originali in `rhymil_images/`, genera le versioni **WebP** servite dal sito: `rhymil_images/large/` (lightbox, max 1080px) e `rhymil_images/thumb/` (griglia, 360px).

---

## Istruzioni per l’uso in locale

1. Posizionati nella cartella del progetto.
2. Installa il server statico:
   ```bash
   npm install -g serve
   ```
3. Avvia il server:
   ```bash
   serve -l 8080
   ```
4. Apri il browser all’indirizzo:
   ```
   http://localhost:8080/
   ```
5. Genera l’index:
   ```bash
   node generateRhymil.js
   ```
6. Dopo il comando, l’**index.html** viene aggiornato automaticamente partendo dai JSON contenuti in `rhymil`.

## Aggiungere o aggiornare le illustrazioni

1. Metti l’immagine originale (PNG/JPG, idealmente 1080×1350) in `rhymil_images/`.
2. Installa le dipendenze (solo la prima volta):
   ```bash
   npm install
   ```
3. Genera le versioni WebP (è incrementale: converte solo i file nuovi o modificati):
   ```bash
   node generateImages.js
   ```
4. Aggiungi il personaggio al JSON della sua fazione in `rhymil/` e rigenera l’index con `node generateRhymil.js`.
