## rhymil-photoalbum

Questo sito raccoglie le illustrazioni dei personaggi della campagna LARP **Rhymil**, per avere sempre a portata di mano volti e nomi tra un evento e l’altro. Non è il sito ufficiale della campagna (che fornisce ambientazione e regolamento), ma serve da supporto visivo per i partecipanti.:contentReference[oaicite:0]{index=0}

---

## Caratteristiche principali

- Completamente realizzato con **HTML**, **CSS** e **JavaScript**, senza framework esterni.
- L’**index.html** si popola dinamicamente tramite file **JSON** presenti nella cartella `rhymil`.
- Include uno script (`generateRhymil.js`) che genera l’index a partire dai JSON.

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
