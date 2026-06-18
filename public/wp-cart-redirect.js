/**
 * ══════════════════════════════════════════════════════════════
 * METODO SINCRO — WooCommerce Cart Redirection Script
 * ══════════════════════════════════════════════════════════════
 * 
 * Questo script risolve temporaneamente l'errore critico sulla pagina /carrello/
 * reindirizzando all'istante l'utente alla pagina di pagamento (/pagamento/)
 * che è funzionante.
 * 
 * COME INSTALLARLO:
 * 
 * Opzione 1 — Plugin "Insert Headers and Footers" (WPCode) (consigliato):
 *   1. Vai su WordPress → Code Snippets → Header & Footer.
 *   2. Incolla questo codice nel campo "Header" o "Footer".
 *   3. Salva le modifiche.
 * 
 * Opzione 2 — PixelYourSite:
 *   1. Aggiungi il codice come Custom Script nelle impostazioni di PixelYourSite.
 * 
 * ══════════════════════════════════════════════════════════════
 */

(function() {
  'use strict';
  
  // Lista dei percorsi del carrello da reindirizzare al checkout
  var cartPaths = [
    '/carrello/',
    '/cart/'
  ];
  
  var currentPath = window.location.pathname.toLowerCase();
  
  // Controlla se il percorso corrente corrisponde al carrello
  var isCart = cartPaths.some(function(path) {
    return currentPath === path || currentPath === path.replace(/\/$/, '');
  });
  
  if (isCart) {
    console.log('[Metodo Sincro Redirection] Rilevato carrello in errore. Reindirizzamento al checkout...');
    // Mantieni eventuali parametri di query (es. UTM, fbclid) durante la redirezione
    var queryParams = window.location.search || '';
    window.location.replace('/pagamento/' + queryParams);
  }
})();
