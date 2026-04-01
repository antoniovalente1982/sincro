/**
 * METODO SINCRO® — UTM Attribution Forwarder per WordPress
 * 
 * INSTALLAZIONE:
 * 1. Vai su WordPress Admin → Aspetto → Editor del tema (o usa plugin "Insert Headers and Footers")
 * 2. Incolla questo script nel campo "Scripts in Footer" (o prima di </body>)
 * 3. Installa su TUTTI E 3 i siti: valenteantonio.it, metodosincro.it, protocollo27.it
 * 
 * COSA FA:
 * - Legge i parametri URL quando l'utente atterra dalla Meta Ad
 *   (es: metodosincro.it?utm_campaign=MS-Lead&utm_content=AD_ID&fbclid=...)
 * - Salva questi parametri in sessionStorage e localStorage (30 giorni)
 * - Aggiorna AUTOMATICAMENTE tutti i link CTA che puntano alla landing Sincro
 *   appendendo i parametri utm_* all'URL di destinazione
 * - In questo modo quando l'utente clicca "Prenota Consulenza Gratuita" su WordPress
 *   viene portato a /f/metodo-sincro?utm_campaign=X&utm_content=Y (TRACCIATO)
 *   invece di /f/metodo-sincro (NON TRACCIATO)
 */
(function () {
    'use strict';

    // ── Configurazione ──────────────────────────────────────────────────────
    // URL base della Sincro landing — aggiorna se cambia
    var SINCRO_DOMAINS = [
        'adpilotik.com',
        'metodosincro.it', // se il funnel è su questo dominio
    ];
    // Path della landing principale (aggiorna se il funnel cambia slug)
    var SINCRO_LANDING_PATH = '/f/metodo-sincro';

    // ── Storage keys (devono essere identici a useMetaTracking.ts) ──────────
    var UTM_STORAGE_KEY = '_sincro_utms';
    var UTM_TS_KEY = '_sincro_utms_ts';
    var UTM_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 giorni

    // ── Leggi parametri dall'URL corrente ──────────────────────────────────
    var params = new URLSearchParams(window.location.search);
    var UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid'];

    var utms = {};
    UTM_KEYS.forEach(function (key) {
        var val = params.get(key);
        if (val) utms[key] = val;
    });

    // Se abbiamo UTM dalla URL, salvali (autoritative)
    if (Object.keys(utms).length > 0) {
        try {
            var payload = JSON.stringify(utms);
            sessionStorage.setItem(UTM_STORAGE_KEY, payload);
            localStorage.setItem(UTM_STORAGE_KEY, payload);
            localStorage.setItem(UTM_TS_KEY, String(Date.now()));
            console.log('[Sincro Tracking] UTM salvati:', utms);
        } catch (e) { /* storage bloccato */ }
    } else {
        // Fallback: leggi da sessionStorage o localStorage
        try {
            var ss = sessionStorage.getItem(UTM_STORAGE_KEY);
            if (ss) {
                utms = JSON.parse(ss);
            } else {
                var ts = parseInt(localStorage.getItem(UTM_TS_KEY) || '0', 10);
                if (Date.now() - ts < UTM_TTL_MS) {
                    var ls = localStorage.getItem(UTM_STORAGE_KEY);
                    if (ls) utms = JSON.parse(ls);
                }
            }
        } catch (e) { /* parse error */ }
    }

    // ── Funzione: aggiorna un href con i parametri UTM ──────────────────────
    function appendUtmsToUrl(href, utmData) {
        if (!href || !utmData || Object.keys(utmData).length === 0) return href;
        try {
            // Costruisci URL assoluta se necessario
            var url;
            if (href.startsWith('http')) {
                url = new URL(href);
            } else if (href.startsWith('/')) {
                url = new URL(href, window.location.origin);
            } else {
                return href; // mailto:, tel:, # ecc.
            }
            // Aggiungi ogni UTM param solo se non già presente nell'URL
            Object.keys(utmData).forEach(function (key) {
                if (!url.searchParams.has(key)) {
                    url.searchParams.set(key, utmData[key]);
                }
            });
            return url.toString();
        } catch (e) {
            return href;
        }
    }

    // ── Funzione: determina se un link punta alla Sincro landing ───────────
    function isSincroLink(href) {
        if (!href) return false;
        // Link relativi che puntano al funnel
        if (href.startsWith('/f/') || href.includes(SINCRO_LANDING_PATH)) return true;
        // Link assoluti verso i domini Sincro
        return SINCRO_DOMAINS.some(function (domain) {
            return href.includes(domain);
        });
    }

    // ── Aggiorna tutti i link CTA nella pagina ───────────────────────────────
    function updateCtaLinks() {
        if (Object.keys(utms).length === 0) return;

        var links = document.querySelectorAll('a[href]');
        var updated = 0;
        links.forEach(function (link) {
            var href = link.getAttribute('href');
            if (isSincroLink(href)) {
                var newHref = appendUtmsToUrl(href, utms);
                if (newHref !== href) {
                    link.setAttribute('href', newHref);
                    updated++;
                }
            }
        });
        if (updated > 0) {
            console.log('[Sincro Tracking] Aggiornati ' + updated + ' link CTA con UTM params');
        }
    }

    // ── Esegui subito e poi osserva eventuali link aggiunti dinamicamente ───
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', updateCtaLinks);
    } else {
        updateCtaLinks();
    }

    // Observer per link aggiunti dopo il caricamento (popup, sticky bars, ecc.)
    if (window.MutationObserver) {
        var observer = new MutationObserver(function () {
            updateCtaLinks();
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    // ── Intercetta anche i click sui bottoni (non solo link) ────────────────
    // Alcuni temi WordPress usano <button> o <div> con onclick per i CTA
    document.addEventListener('click', function (e) {
        var el = e.target;
        // Risali l'albero DOM per trovare un elemento con data-href o onclick sincro
        while (el && el !== document.body) {
            var dataHref = el.getAttribute && el.getAttribute('data-href');
            if (dataHref && isSincroLink(dataHref)) {
                e.preventDefault();
                var newUrl = appendUtmsToUrl(dataHref, utms);
                window.location.href = newUrl;
                return;
            }
            el = el.parentElement;
        }
    }, true);

})();
