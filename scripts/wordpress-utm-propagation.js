/**
 * ══════════════════════════════════════════════════════════════
 * METODO SINCRO — UTM & fbclid Propagation Script per WordPress
 * ══════════════════════════════════════════════════════════════
 * 
 * Questo script va aggiunto al sito WordPress metodosincro.it.
 * 
 * PROBLEMA: Quando Meta Ads porta traffico su metodosincro.it/video-gratuito,
 * i parametri UTM e fbclid sono nell'URL. Ma il CTA (bottone "Prenota consulenza")
 * punta a un URL hardcoded su landing.metodosincro.com SENZA passare questi parametri.
 * Risultato: Meta perde l'attribuzione della conversione.
 * 
 * SOLUZIONE: Questo script intercetta tutti i click sui link verso 
 * landing.metodosincro.com e propaga automaticamente:
 *   - fbclid (necessario per attribuzione Meta Ads)
 *   - utm_source, utm_medium, utm_campaign, utm_content, utm_term
 *   - fbadid (ID dell'ad)
 * 
 * COME INSTALLARLO:
 * 
 * Opzione 1 — Plugin "Insert Headers and Footers" (consigliato):
 *   1. Vai su WordPress → Plugin → Aggiungi nuovo → cerca "WPCode"
 *   2. Installa e attiva "WPCode – Insert Headers and Footers"
 *   3. Vai su Code Snippets → Header & Footer
 *   4. Incolla questo script nel campo "Footer" (prima di </body>)
 *   5. Salva
 * 
 * Opzione 2 — Direttamente nel tema:
 *   1. Vai su Aspetto → Editor del tema → footer.php
 *   2. Incolla prima di </body>
 * 
 * Opzione 3 — PixelYourSite (già installato):
 *   Se hai già PixelYourSite attivo, puoi aggiungerlo come 
 *   "Custom Code" nel footer tramite le sue impostazioni.
 * 
 * ══════════════════════════════════════════════════════════════
 */

(function() {
  'use strict';

  // Parametri da propagare dal URL corrente ai link di destinazione
  var PARAMS_TO_PROPAGATE = [
    'fbclid',      // Meta Ads click ID — CRITICO per attribuzione
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_content',
    'utm_term',
    'fbadid',      // Facebook Ad ID (custom)
  ];

  // Domini di destinazione su cui propagare i parametri
  var TARGET_DOMAINS = [
    'landing.metodosincro.com',
  ];

  // Leggi i parametri dalla URL corrente
  var currentParams = new URLSearchParams(window.location.search);

  // Controlla se ci sono parametri da propagare
  var hasParams = false;
  for (var i = 0; i < PARAMS_TO_PROPAGATE.length; i++) {
    if (currentParams.get(PARAMS_TO_PROPAGATE[i])) {
      hasParams = true;
      break;
    }
  }

  // Se non ci sono parametri, salva quelli dal referrer Meta (fallback)
  // e controlla sessionStorage
  if (!hasParams) {
    try {
      var stored = sessionStorage.getItem('_ms_utm_propagation');
      if (stored) {
        var storedParams = JSON.parse(stored);
        for (var key in storedParams) {
          if (storedParams.hasOwnProperty(key) && storedParams[key]) {
            currentParams.set(key, storedParams[key]);
            hasParams = true;
          }
        }
      }
    } catch(e) {}
  } else {
    // Salva in sessionStorage per pagine successive
    try {
      var toStore = {};
      for (var j = 0; j < PARAMS_TO_PROPAGATE.length; j++) {
        var val = currentParams.get(PARAMS_TO_PROPAGATE[j]);
        if (val) toStore[PARAMS_TO_PROPAGATE[j]] = val;
      }
      sessionStorage.setItem('_ms_utm_propagation', JSON.stringify(toStore));
    } catch(e) {}
  }

  // Se ancora non ci sono parametri, non serve fare nulla
  if (!hasParams) return;

  // Funzione per verificare se un URL punta a un dominio target
  function isTargetDomain(href) {
    try {
      var url = new URL(href, window.location.origin);
      for (var k = 0; k < TARGET_DOMAINS.length; k++) {
        if (url.hostname === TARGET_DOMAINS[k] || url.hostname.endsWith('.' + TARGET_DOMAINS[k])) {
          return true;
        }
      }
    } catch(e) {}
    return false;
  }

  // Funzione per arricchire un URL con i parametri
  function enrichUrl(href) {
    try {
      var url = new URL(href);
      for (var m = 0; m < PARAMS_TO_PROPAGATE.length; m++) {
        var paramName = PARAMS_TO_PROPAGATE[m];
        var paramValue = currentParams.get(paramName);
        // Aggiungi solo se il parametro non è già presente nel link di destinazione
        if (paramValue && !url.searchParams.has(paramName)) {
          url.searchParams.set(paramName, paramValue);
        }
      }
      return url.toString();
    } catch(e) {
      return href;
    }
  }

  // Metodo 1: Modifica i link al caricamento della pagina
  function enrichAllLinks() {
    var links = document.querySelectorAll('a[href]');
    for (var n = 0; n < links.length; n++) {
      var link = links[n];
      if (isTargetDomain(link.href)) {
        link.href = enrichUrl(link.href);
      }
    }
  }

  // Metodo 2: Intercetta i click (per link aggiunti dinamicamente)
  document.addEventListener('click', function(e) {
    var target = e.target;
    // Risali il DOM per trovare il link
    while (target && target !== document) {
      if (target.tagName === 'A' && target.href && isTargetDomain(target.href)) {
        target.href = enrichUrl(target.href);
        break;
      }
      target = target.parentElement;
    }
  }, true); // useCapture = true per intercettare prima di altri handler

  // Esegui al DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', enrichAllLinks);
  } else {
    enrichAllLinks();
  }

  // Esegui anche dopo un breve delay (per contenuti caricati via AJAX/Elementor)
  setTimeout(enrichAllLinks, 1500);
  setTimeout(enrichAllLinks, 3000);

  // Console log per debug
  var propagated = [];
  for (var p = 0; p < PARAMS_TO_PROPAGATE.length; p++) {
    var v = currentParams.get(PARAMS_TO_PROPAGATE[p]);
    if (v) propagated.push(PARAMS_TO_PROPAGATE[p] + '=' + v.substring(0, 12) + '...');
  }
  if (propagated.length > 0) {
    console.log('[MetodoSincro UTM Propagation] Active — propagating:', propagated.join(', '));
  }
})();
