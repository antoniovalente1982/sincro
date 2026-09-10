/**
 * Costanti condivise fra il Pixel del browser e la Conversions API.
 *
 * Meta deduplica due eventi solo se coincidono event_name ed event_id, e in
 * caso di duplicato tiene quello arrivato per primo — di norma quello del
 * browser. Se i parametri economici stessero solo sul lato server, verrebbero
 * quindi scartati proprio nella maggior parte dei casi: per questo il valore
 * vive qui, e i due lati lo leggono dallo stesso posto.
 *
 * Nessuna direttiva 'use client': il file viene importato sia dai componenti
 * sia dalle route server.
 */

/**
 * Valore predittivo di un lead: vendita media (2.250 EUR) per tasso di
 * conversione osservato (~5%). Serve a Meta per ottimizzare sul valore e
 * risolve la diagnostica "missing price parameters".
 */
export const PREDICTIVE_LEAD_VALUE = 112

export const LEAD_CURRENCY = 'EUR'
