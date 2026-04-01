/**
 * METODO SINCRO® — UTM Attribution Forwarder per WordPress
 * Versione: 1.1
 *
 * ════════════════════════════════════════════════════════════════
 * PROBLEMA CHE RISOLVE:
 *
 * Quando Meta Ads manda traffico su metodosincro.it?utm_campaign=X,
 * il visitatore legge la pagina WordPress e poi clicca il bottone CTA
 * che va su landing.metodosincro.com/f/form-metodosincro-it
 *
 * SENZA questo script:
 *   CTA href = landing.metodosincro.com/f/form-metodosincro-it
 *              → lead arriva SENZA utm_campaign → attributione persa ❌
 *
 * CON questo script:
 *   CTA href = landing.metodosincro.com/f/form-metodosincro-it?utm_campaign=X&utm_content=Y
 *              → lead arriva CON attributione completa ✅
 *
 * ════════════════════════════════════════════════════════════════
 * INSTALLAZIONE (fare su TUTTI E 3 i siti WordPress):
 *
 * MODO A — Plugin "Insert Headers and Footers":
 *   1. WP Admin → Plugin → Installa "Insert Headers and Footers"
 *   2. Impostazioni → "Scripts in Footer" → incolla questo script
 *   3. Salva
 *
 * MODO B — functions.php (tema):
 *   function sincro_utm() {
 *     wp_enqueue_script('sincro-utm',
 *       'https://landing.metodosincro.com/wp-utm-forwarder.js',
 *       [], null, true);
 *   }
 *   add_action('wp_enqueue_scripts', 'sincro_utm');
 *
 * ════════════════════════════════════════════════════════════════
 */
(function () {
    'use strict';

    // ── Domini e path della Sincro landing ──────────────────────────────────
    // Lo script aggiorna automaticamente tutti i link che puntano a questi domini
    var SINCRO_DOMAINS = [
        'landing.metodosincro.com',
        'adpilotik.com',
    ];

    // ── Parametri da catturare e forwardare ─────────────────────────────────
    var UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid'];

    // ── Leggi parametri dall'URL corrente della pagina WP ──────────────────
    var params = new URLSearchParams(window.location.search);
    var utms = {};
    UTM_KEYS.forEach(function (key) {
        var val = params.get(key);
        if (val) utms[key] = val;
    });

    // Se non abbiamo UTM dall'URL, non c'è niente da forwardare
    if (Object.keys(utms).length === 0) return;

    console.log('[Sincro UTM] Parametri rilevati:', utms);

    // ── Funzione: aggiunge UTM a un href che punta alla Sincro landing ──────
    function appendUtmsToHref(href) {
        if (!href) return href;
        try {
            var url;
            if (href.startsWith('http://') || href.startsWith('https://')) {
                url = new URL(href);
            } else if (href.startsWith('/')) {
                // Link relativo come /f/form-metodosincro-it
                url = new URL(href, window.location.origin);
            } else {
                return href; // mailto:, tel:, #anchor — non toccare
            }

            // Aggiungi ogni UTM solo se NON già presente nell'URL di destinazione
            Object.keys(utms).forEach(function (key) {
                if (!url.searchParams.has(key)) {
                    url.searchParams.set(key, utms[key]);
                }
            });

            return url.toString();
        } catch (e) {
            return href;
        }
    }

    // ── Verifica se un href punta alla Sincro landing ──────────────────────
    function isSincroHref(href) {
        if (!href) return false;
        // Link relativi /f/...
        if (href.startsWith('/f/')) return true;
        // Link assoluti verso i domini Sincro
        return SINCRO_DOMAINS.some(function (domain) {
            return href.indexOf(domain) !== -1;
        });
    }

    // ── Aggiorna tutti i link CTA nella pagina ─────────────────────────────
    function updateAllCtaLinks() {
        var links = document.querySelectorAll('a[href]');
        var count = 0;
        for (var i = 0; i < links.length; i++) {
            var link = links[i];
            var href = link.getAttribute('href');
            if (isSincroHref(href)) {
                var updatedHref = appendUtmsToHref(href);
                if (updatedHref !== href) {
                    link.setAttribute('href', updatedHref);
                    count++;
                }
            }
        }
        if (count > 0) {
            console.log('[Sincro UTM] ' + count + ' link CTA aggiornati con UTM params');
        }
    }

    // ── Esegui al caricamento della pagina ─────────────────────────────────
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', updateAllCtaLinks);
    } else {
        updateAllCtaLinks();
    }

    // ── Observer per link aggiunti da JS (popup, slider, sticky bar, ecc.) ─
    if (window.MutationObserver) {
        var observer = new MutationObserver(function (mutations) {
            var hasNewNodes = mutations.some(function (m) {
                return m.addedNodes && m.addedNodes.length > 0;
            });
            if (hasNewNodes) updateAllCtaLinks();
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

})();
