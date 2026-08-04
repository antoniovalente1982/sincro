#!/usr/bin/env python3
"""
Generatore e scrittore delle email del lancio 24 agosto 2026 su ActiveCampaign.

Il copy sorgente e il razionale stanno in docs/lancio-agosto-2026/sequenza-email-completa.md.
Qui c'e' la versione impaginata, pronta da scrivere nell'account.

NOTA IMPORTANTE — l'HTML si scrive via API.
Usa PUT /api/3/messages/{id}. NON usare campaign/message: aggiorna solo i metadati
e ignora il campo html senza restituire errore. Un documento precedente sosteneva
che l'HTML non fosse scrivibile: e' falso, verificato il 4 agosto 2026.

Le automazioni invece NON si creano via API (POST /automations -> 405).
Lo scheletro va costruito nell'editor; poi questo script riempie gli slot.

Uso:
  export $(grep -E '^ACTIVECAMPAIGN' .env.local | xargs)

  python3 scripts/ac_write_emails.py --list              # elenca le email disponibili
  python3 scripts/ac_write_emails.py --export out/       # esporta tutti gli HTML su file
  python3 scripts/ac_write_emails.py --write A1=18 A2=19 # scrive e verifica rileggendo
"""

import argparse
import html as htmllib
import json
import os
import re
import sys
import urllib.error
import urllib.request

BASE = os.environ.get('ACTIVECAMPAIGN_BASE_URL', '')
KEY = os.environ.get('ACTIVECAMPAIGN_API_KEY', '')

LANDING = 'https://landing.metodosincro.com/webinar-agosto/'
ZOOM = '[LINK ZOOM]'
WHATSAPP = '[LINK GRUPPO WHATSAPP]'
REPLAY = '[LINK REPLAY]'
CANDIDATURA = '[LINK PAGINA CANDIDATURA]'
PAGINA_SI = '[LINK PAGINA SI]'
PAGINA_NO = '[LINK PAGINA NO]'

# ─────────────────────────────── palette ───────────────────────────────
NAVY, GOLD, INK, MUTE, PAPER, WASH = '#0d1b2a', '#c9a84c', '#1a1a1a', '#6b6b6b', '#ffffff', '#f6f4ef'
SANS = 'Helvetica,Arial,sans-serif'


# ─────────────────────────────── blocchi ───────────────────────────────
def p(t):
    return (f'<p style="margin:0 0 18px;font-family:{SANS};font-size:17px;'
            f'line-height:1.65;color:{INK};">{t}</p>')


def small(t):
    return (f'<p style="margin:0 0 18px;font-family:{SANS};font-size:15px;'
            f'line-height:1.6;color:{MUTE};">{t}</p>')


def h2(t):
    return (f'<p style="margin:26px 0 14px;font-family:{SANS};font-size:20px;'
            f'line-height:1.35;color:{NAVY};font-weight:bold;">{t}</p>')


def quote(t, who=None):
    attrib = f'<span style="display:block;margin-top:10px;font-size:14px;color:{MUTE};">&mdash; {who}</span>' if who else ''
    return (f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px;">'
            f'<tr><td style="border-left:3px solid {GOLD};padding:4px 0 4px 18px;">'
            f'<span style="font-family:Georgia,serif;font-size:18px;line-height:1.6;color:{INK};'
            f'font-style:italic;">{t}</span>{attrib}</td></tr></table>')


def highlight(t):
    return (f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px;">'
            f'<tr><td style="background:{WASH};border-radius:6px;padding:20px 22px;">'
            f'<span style="font-family:{SANS};font-size:18px;line-height:1.55;color:{NAVY};'
            f'font-weight:bold;">{t}</span></td></tr></table>')


def stats():
    cells = [('+1.100', 'ATLETI SEGUITI'), ('+8.880', 'ORE DI LAVORO'), ('4,9&#9733;', '356 RECENSIONI')]
    tds = ''.join(
        f'<td width="33%" align="center" style="padding:14px 6px;">'
        f'<div style="font-family:{SANS};font-size:24px;font-weight:bold;color:{GOLD};">{v}</div>'
        f'<div style="font-family:{SANS};font-size:10px;letter-spacing:1.4px;color:{MUTE};'
        f'margin-top:4px;">{l}</div></td>' for v, l in cells)
    return (f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
            f'style="margin:6px 0 24px;border-top:1px solid #e6e2d8;border-bottom:1px solid #e6e2d8;">'
            f'<tr>{tds}</tr></table>')


def button(label, url):
    return (f'<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 26px;">'
            f'<tr><td align="center" bgcolor="{GOLD}" style="border-radius:4px;">'
            f'<a href="{url}" style="display:inline-block;padding:16px 36px;font-family:{SANS};'
            f'font-size:15px;font-weight:bold;letter-spacing:0.5px;color:{NAVY};'
            f'text-decoration:none;">{label}</a></td></tr></table>')


def eventbox(lines):
    rows = ''.join(f'<div style="font-family:{SANS};font-size:17px;line-height:1.9;color:{PAPER};">{l}</div>'
                   for l in lines)
    return (f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">'
            f'<tr><td style="background:{NAVY};border-radius:6px;padding:22px 24px;">{rows}</td></tr></table>')


def sign(role=True):
    r = (f'<div style="font-family:{SANS};font-size:13px;color:{MUTE};margin-top:3px;">'
         f'Fondatore, Metodo Sincro&reg;</div>') if role else ''
    return (f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:30px;">'
            f'<tr><td style="border-top:1px solid #e6e2d8;padding-top:20px;">'
            f'<div style="font-family:{SANS};font-size:16px;color:{INK};">Antonio Valente</div>{r}'
            f'</td></tr></table>')


def wrap(preheader, blocks):
    body = ''.join(blocks)
    return f"""<!DOCTYPE html>
<html lang="it"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:{WASH};">
<div style="display:none;font-size:1px;color:{WASH};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">{preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{WASH};">
<tr><td align="center" style="padding:26px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:{PAPER};border-radius:8px;overflow:hidden;">
  <tr><td style="background:{NAVY};padding:20px 32px;">
    <span style="font-family:{SANS};font-size:13px;letter-spacing:3.5px;color:{GOLD};font-weight:bold;">METODO SINCRO&reg;</span>
  </td></tr>
  <tr><td style="padding:34px 32px 26px;">{body}</td></tr>
  <tr><td style="background:{WASH};padding:22px 32px;">
    <div style="font-family:{SANS};font-size:11px;line-height:1.6;color:{MUTE};">
      %SENDER-INFO-SINGLELINE%<br>
      Non vuoi pi&ugrave; ricevere queste email? <a href="%UNSUBSCRIBELINK%" style="color:{MUTE};">Disiscriviti qui</a>.
    </div>
  </td></tr>
</table></td></tr></table></body></html>"""


# ─────────────────────────────── le email ───────────────────────────────
EMAILS = {}


def E(key, subject, preheader, blocks, marker):
    EMAILS[key] = dict(subject=subject, preheader=preheader,
                       html=wrap(preheader, blocks), marker=marker)


# ── FASE 1 · Flusso A — Caldi e Tiepidi ──
E('A1', 'Tuo figlio ci sta già pensando (anche se non te lo dice)',
  'Il primo allenamento è già cominciato — nella sua testa.', [
      p('Ciao,'),
      p('mancano poche settimane al primo allenamento.'),
      p("Per te è una data sul calendario. Per tuo figlio è una domanda che si porta dietro da giugno: "
        "<strong>quest'anno andrà meglio?</strong>"),
      p("Non te lo dirà. I ragazzi non lo dicono quasi mai. Lo tengono lì sotto, e lo trasformano in "
        "silenzio in macchina, in &laquo;tutto bene&raquo; quando gli chiedi come va, in una partita giocata "
        "al sessanta per cento &mdash; perché l'altro quaranta è impegnato a pensare a cosa succede se sbaglia."),
      p('In questi anni ho seguito più di 1.100 ragazzi. La frase che sento più spesso dai genitori '
        'è sempre la stessa:'),
      highlight('&laquo;In allenamento è un altro. In partita sparisce.&raquo;'),
      p("Non è un problema tecnico. Nessun ragazzo perde la tecnica il sabato mattina. Perde l'<em>accesso</em> "
        'alla tecnica, perché la testa è occupata altrove.'),
      stats(),
      p('Nelle prossime settimane ti scrivo qualcosa su questo. Non teoria: le cose concrete che separano un '
        'ragazzo che parte bene a settembre da uno che si trascina fino a Natale.'),
      p('Se oggi non è più un tema per te &mdash; ha smesso, è cresciuto, va tutto bene &mdash; '
        'in fondo trovi il link per uscire. Nessun problema, davvero.'),
      p("Se invece quella frase l'hai pensata anche tu, resta. La prossima arriva venerdì."),
      sign(),
  ], 'In allenamento è un altro')

E('A2', '«Stai tranquillo» è la frase che gli fa più male',
  "L'intenzione è perfetta. L'effetto no.", [
      p('Ciao,'),
      p('sabato mattina, in macchina. Lui guarda fuori dal finestrino e non parla.'),
      p('E tu dici la cosa più naturale del mondo:'),
      quote('Stai tranquillo, divertiti.'),
      p("L'intenzione è perfetta. L'effetto no."),
      p("Perché nella sua testa quella frase diventa un'altra: <strong>&laquo;quindi c'è qualcosa per cui "
        'non essere tranquillo. E se me lo dice, vuol dire che si vede.&raquo;</strong>'),
      p('Non è colpa tua. Nessuno ti ha dato il manuale. Il problema è che la rassicurazione, in quel '
        'momento, nomina la paura invece di sciogliere la tensione.'),
      p('Prova a sostituirla con una domanda:'),
      highlight('&laquo;Qual è la prima cosa che vuoi fare quando tocchi il primo pallone?&raquo;'),
      p('Sembra poco. Fa tre cose insieme:'),
      p('&mdash; gli dà un compito <strong>eseguibile</strong>, invece di uno stato d’animo da raggiungere<br>'
        '&mdash; sposta l’attenzione dal risultato (che non controlla) alla prima azione (che controlla)<br>'
        '&mdash; gli fa dire una frase ad alta voce, e una frase detta è un impegno che il corpo ricorda'),
      p('Provala sabato prossimo. Non aspettarti un discorso: aspettati che risponda con tre parole e torni a '
        'guardare fuori dal finestrino. Va benissimo così. Il lavoro l’ha già fatto.'),
      p('Questa è una delle prime cose che i nostri coach insegnano ai genitori, non ai ragazzi. Perché '
        'un ragazzo non esiste da solo: esistono i genitori, le aspettative, la pressione del sabato mattina.'),
      p("Lunedì ti scrivo l'ultima di questa serie. E ti anticipo una cosa che sto preparando per fine agosto."),
      sign(),
  ], 'Qual è la prima cosa che vuoi fare')

E('A3', '1.100 ragazzi. Nessuno di loro era «quello dotato».',
  'E cosa succede lunedì 24 agosto alle 21:00.', [
      p('Ciao,'),
      p('356 recensioni su Trustpilot. Le ho lette tutte.'),
      p("C'è una cosa che mi ha colpito: <strong>quasi nessun genitore scrive &laquo;mio figlio gioca "
        'meglio&raquo;.</strong>'),
      p('Scrivono altro.'),
      quote('Nostro figlio ha abbattuto diversi muri &mdash; non solo in campo, ma come persona. Un cambiamento '
            'che non pensavamo possibile in così poco tempo.', 'genitore'),
      quote('Sono partita insicura e ansiosa. Ho trovato fin da subito quel feeling necessario per aprirmi.',
            'Aurora, atleta'),
      p('Nessuno parla di tecnica. Tutti parlano di <strong>come il ragazzo si vede</strong>.'),
      p('Ed è esattamente il punto. In 1.100 percorsi non ho mai incontrato un ragazzo che avesse bisogno di '
        'più talento. Ho incontrato ragazzi pieni di talento che non riuscivano ad accedervi quando contava.'),
      p('Il talento non manca quasi mai. Manca la capacità di esprimerlo sotto pressione. E quella si allena, '
        'come si allena il tiro.'),
      highlight('Lunedì 24 agosto, ore 21:00: un webinar gratuito in diretta.'),
      p("Un'ora su come si imposta la stagione di tuo figlio nelle prime tre settimane: cosa fare a casa, cosa "
        'dire (e cosa smettere di dire), e come dare a scout e osservatori qualcosa da notare.'),
      p('Non ti chiedo niente adesso. Le iscrizioni le apro <strong>martedì 18 agosto</strong> e ti scrivo io.'),
      p('Per ora segnati la data: <strong>lunedì 24 agosto, ore 21:00</strong>.'),
      p('Adesso mi fermo una settimana &mdash; Ferragosto vale anche per me. Ci risentiamo il 18.'),
      sign(),
  ], 'Lunedì 24 agosto, ore 21:00')

# ── FASE 1 · Flusso B — Freddi ──
E('B1', 'Tuo figlio gioca ancora?', 'Rispondi con un click. Ci metti tre secondi.', [
    p('Ciao,'),
    p('sarò diretto, perché non ti scrivo da troppo tempo.'),
    highlight('Tuo figlio gioca ancora a calcio?'),
    p("Se sì, ho preparato delle cose per l'inizio di questa stagione che credo ti servano davvero. "
      'Se no, tolgo il disturbo oggi stesso e ti ringrazio comunque.'),
    p('Un click e sistemiamo tutto:'),
    button('SÌ, GIOCA ANCORA', PAGINA_SI),
    small(f'Non gioca più? <a href="{PAGINA_NO}" style="color:{MUTE};">Puoi togliermi dalla lista</a>.'),
    sign(),
], 'Tuo figlio gioca ancora a calcio')

E('B2', 'Chiudo', 'Nessun rancore. Basta un click per restare.', [
    p('Ciao,'),
    p("questa è l'ultima email che ricevi da me."),
    p('Non hai aperto le ultime che ti ho mandato, e ci sta: le caselle sono piene e il tempo è quello che '
      "è. Non voglio essere il rumore di fondo nella tua."),
    p('Quindi chiudo qui. Ma se ti fa piacere restare &mdash; anche solo per curiosità, anche solo per '
      'leggere una volta ogni tanto &mdash; basta questo:'),
    button('RESTO IN LISTA', PAGINA_SI),
    p('Se non clicchi, non ti scrivo più. In bocca al lupo a tuo figlio per la stagione che comincia '
      '&mdash; quello vale in ogni caso.'),
    sign(role=False),
], "l'ultima email che ricevi da me")

# ── FASE 2 · Invito al webinar ──
E('W1', 'Lunedì 24, ore 21:00 — come si imposta la stagione',
  'Un’ora in diretta. Gratis. Poi non lo rifaccio prima di gennaio.', [
      p('Ciao,'),
      p('eccomi, come promesso.'),
      eventbox(['<strong>Lunedì 24 agosto 2026</strong>', 'Ore 21:00 &middot; in diretta su Zoom',
                'Mentalità Vincente per una Stagione Vincente']),
      p('Ti dico esattamente cosa ci facciamo dentro:'),
      p('<strong>1. Le prime tre settimane.</strong> Perché la stagione di tuo figlio si decide tra il primo '
        'allenamento e la terza partita, e cosa succede nella sua testa in quei giorni.'),
      p('<strong>2. Cosa dire e cosa smettere di dire.</strong> Le frasi che come genitore usi in buona fede e '
        'che aumentano la pressione invece di toglierla. Con le alternative pronte.'),
      p('<strong>3. Farsi notare.</strong> Cosa guardano davvero scout e osservatori quando vedono un ragazzo '
        'per la prima volta &mdash; e non è il piede.'),
      p('<strong>4. Domande.</strong> Resto in diretta finché ci sono domande. Rispondo a tutte.'),
      p('Non è una masterclass registrata. È in diretta, siamo io e te, e si può fare solo con un '
        'numero limitato di persone: <strong>47 posti</strong>.'),
      p("Un'ultima cosa: chi si iscrive entra anche nel <strong>gruppo WhatsApp riservato ai partecipanti</strong>. "
        "Ci scrivo solo io, nessuno vede il numero di nessuno, e da qui a lunedì 24 ci lascio tre cose che "
        "non dirò da nessun'altra parte."),
      button('RISERVA IL TUO POSTO GRATIS', LANDING),
      sign(),
  ], '47 posti')

E('W2', 'Le prime tre settimane decidono i nove mesi dopo',
  'Lunedì sera ti spiego come si imposta. Ci sono ancora posti.', [
      p('Ciao,'),
      p("c'è un motivo se questo webinar lo faccio adesso e non a ottobre."),
      p('Nelle prime tre settimane di stagione succede una cosa precisa: <strong>tuo figlio si assegna un '
        'ruolo</strong>. Non glielo assegna il mister &mdash; se lo assegna da solo, guardando come vanno i '
        'primi allenamenti.'),
      quote('Sono uno dei titolari.<br>Sono quello che entra nel secondo tempo.<br>'
            "Quest'anno mi tocca stare dietro a quello nuovo."),
      p("E una volta che quell'etichetta si è attaccata, condiziona tutto quello che viene dopo: quanto "
        'rischia in campo, quanto chiede palla, come reagisce al primo errore. A novembre non stai più '
        "correggendo una prestazione. Stai provando a smontare un'identità."),
      highlight('Per questo tre settimane a settembre valgono più di tre mesi in inverno.'),
      p('Lunedì sera ti mostro cosa fare in quella finestra. Ed è una cosa che riguarda te quanto lui: '
        'i ragazzi cambiano quando cambia il contesto intorno a loro.'),
      button('PRENDI IL TUO POSTO', LANDING),
      p('Lunedì 24 agosto, ore 21:00, in diretta su Zoom.'),
      sign(),
  ], 'si assegna un ruolo')

E('W3', '«Ma serve anche se gioca bene?»',
  'Rispondo prima di lunedì. Restano pochi posti.', [
      p('Ciao,'),
      p('da martedì mi sono arrivate parecchie domande. Le tre più frequenti, prima di lunedì.'),
      h2('&laquo;Serve anche se mio figlio gioca bene?&raquo;'),
      p('Soprattutto. I ragazzi in difficoltà hanno un problema visibile e qualcuno che se ne occupa. Quelli '
        'forti hanno un’aspettativa addosso e nessuno che gliela alleggerisca &mdash; e sono quelli che si '
        'bloccano peggio, perché il crollo arriva senza preavviso. Metà dei professionisti che seguo era '
        '&laquo;quello bravo&raquo; del settore giovanile.'),
      h2('&laquo;Ha solo 11 anni, è presto?&raquo;'),
      p('No, ma il linguaggio cambia. A 11 anni si lavora con il gioco e le immagini; a 17 con la pressione e le '
        'decisioni. Per questo i nostri coach sono assegnati per fascia d’età e non sono intercambiabili: '
        'parlare a un ragazzo di 10 anni è radicalmente diverso dal parlare a uno di 18. Lunedì sera parlo '
        'a tutte le fasce, e ti dico quale parte riguarda la tua.'),
      h2('&laquo;Non posso esserci lunedì alle 21.&raquo;'),
      p('Iscriviti lo stesso. Mando la registrazione a chi si è iscritto, e resta disponibile per pochi giorni. '
        'Chi si iscrive entra anche nel gruppo WhatsApp riservato, dove nei giorni prima del webinar rispondo alle '
        'domande &mdash; quindi qualcosa di utile lo porti a casa comunque. Ma se puoi esserci, esserci conviene: '
        'le domande dal vivo sono la parte migliore.'),
      button('ISCRIVITI ORA', LANDING),
      sign(),
  ], 'Serve anche se mio figlio gioca bene')

E('W4', 'Stasera alle 21:00', 'Dopo stasera non lo rifaccio prima di gennaio.', [
    p('Ciao,'),
    p('stasera alle 21:00 siamo in diretta.'),
    p("Un'ora su come impostare la stagione di tuo figlio nelle tre settimane che contano. Poi rispondo alle "
      'domande finché ce ne sono.'),
    p('Se non ti sei ancora iscritto, questo è l’ultimo momento utile: chiudo le iscrizioni '
      '<strong>oggi alle 18:00</strong>, perché il link va mandato in tempo a tutti.'),
    button("PRENDI L'ULTIMO POSTO", LANDING),
    p('Il prossimo in diretta non lo faccio prima di gennaio. A quel punto la stagione di tuo figlio sarà '
      'già a metà.'),
    p('Ci vediamo stasera,'),
    sign(role=False),
], 'chiudo le iscrizioni')

# ── FASE 3 · Registrati ──
E('R1', 'Sei dentro — manca un passaggio',
  'Il link per lunedì 24 è qui. E c’è una seconda cosa da fare adesso.', [
      p('Ciao,'),
      p('il tuo posto è confermato.'),
      eventbox(['<strong>Lunedì 24 agosto 2026</strong>', 'Ore 21:00 (Italia)',
                f'Su Zoom &mdash; <a href="{ZOOM}" style="color:{GOLD};">link di accesso</a>']),
      p('Salva questa email: il link di accesso è questo, non te ne mando di diversi.'),
      p('Ora la seconda cosa, e ci tengo più della prima.'),
      h2('Entra nel gruppo WhatsApp'),
      p("Da qui a lunedì mancano diversi giorni, e in mezzo c'è la ripresa degli allenamenti. Un'email di "
        'promemoria tra due settimane la leggi distrattamente, se la leggi.'),
      p('Per questo ho aperto un gruppo WhatsApp riservato a chi si è iscritto al webinar.'),
      button('ENTRA NEL GRUPPO', WHATSAPP),
      p('Come funziona, così sai a cosa vai incontro:'),
      p('&mdash; <strong>scrivo solo io.</strong> Non è una chat di gruppo, non ti si riempie il telefono di '
        'notifiche e non parte nessuna discussione tra genitori<br>'
        '&mdash; <strong>nessuno vede il tuo numero.</strong> Né io agli altri, né gli altri a te<br>'
        '&mdash; <strong>da qui a lunedì mando tre messaggi.</strong> Brevi. Uno mercoledì, uno '
        'venerdì, uno domenica sera<br>'
        '&mdash; <strong>il link Zoom lo rimando anche lì</strong>, così lunedì alle 20:58 non stai '
        'cercando questa email nella posta'),
      p('Se lunedì hai una domanda specifica su tuo figlio, portala: nell’ultima mezz’ora rispondo '
        'dal vivo, e le domande dei genitori sono sempre la parte migliore.'),
      sign(),
  ], 'Entra nel gruppo WhatsApp')

E('R1bis', 'Ti sei perso il pezzo importante', 'Trenta secondi e sei a posto.', [
    p('Ciao,'),
    p('il posto per lunedì 24 ce l’hai, quello è a posto.'),
    p('Ma non ti ho ancora visto entrare nel gruppo WhatsApp &mdash; e ti scrivo perché chi resta fuori, il '
      'più delle volte, lunedì sera si dimentica.'),
    p("Non è colpa di nessuno. È che tra oggi e lunedì c'è la ripresa degli allenamenti, il "
      "lavoro, e un'email di due settimane fa finisce venti posizioni sotto nella casella."),
    button('ENTRA NEL GRUPPO', WHATSAPP),
    p('Scrivo solo io, nessuno vede il tuo numero, e da qui a lunedì sono tre messaggi in tutto.'),
    p('Se invece preferisci restare sulla mail va benissimo lo stesso &mdash; il link Zoom ce l’hai '
      "nell'email di conferma. Tienila a portata."),
    sign(role=False),
], 'non ti ho ancora visto entrare nel gruppo')

E('R2', 'Domani sera alle 21:00', 'Il link è qui dentro, così non lo cerchi.', [
    p('Ciao,'),
    p('promemoria: <strong>domani sera, lunedì 24, alle 21:00</strong>.'),
    button('IL TUO LINK DI ACCESSO', ZOOM),
    p('Ti anticipo cosa vediamo, così arrivi preparato:'),
    p('&mdash; cosa succede nella testa di tuo figlio nelle prime tre settimane di stagione<br>'
      '&mdash; le frasi da smettere di dire (e con cosa sostituirle)<br>'
      '&mdash; cosa guardano davvero scout e osservatori<br>'
      '&mdash; le tue domande, dal vivo'),
    p('Se hai già in mente la domanda che vuoi farmi, <strong>mandamela nel gruppo WhatsApp adesso</strong> '
      "&mdash; stasera preparo l'ultima parte del webinar sulle domande arrivate, e se me la scrivi ora ci "
      'finisce dentro.'),
    small(f'<a href="{WHATSAPP}" style="color:{MUTE};">Vai al gruppo WhatsApp</a>'),
    sign(role=False),
], 'domani sera, lunedì 24')

E('R3', 'Tra 3 ore', 'Ci vediamo alle 21:00.', [
    p('Ciao,'),
    p('ci siamo: <strong>stasera alle 21:00</strong>.'),
    button('ENTRA NEL WEBINAR', ZOOM),
    p('Collegati qualche minuto prima, così se Zoom deve aggiornarsi non ti perdi l’inizio. Parto puntuale.'),
    sign(role=False),
], 'stasera alle 21:00')

E('R4', 'Siamo live tra 15 minuti', 'Entra pure, la sala è aperta.', [
    p('Apro la sala adesso.'),
    button('ENTRA ORA', ZOOM),
    p('Ci vediamo tra pochi minuti.'),
    sign(role=False),
], 'Apro la sala adesso')

# ── FASE 4 · Post-webinar ──
E('P1', 'Ieri sera hai fatto una cosa che pochi genitori fanno',
  'Se vuoi capire cosa serve a tuo figlio, ci mettiamo 20 minuti.', [
      p('Ciao,'),
      p('grazie di ieri sera. Eravate tanti e le domande sono state ottime &mdash; quella sui provini l’hanno '
        'fatta in cinque, quindi ho toccato un nervo scoperto.'),
      p('Voglio dirti una cosa che ieri non ho detto.'),
      p('Sei rimasto un’ora, di lunedì sera, in una settimana d’agosto, per capire come aiutare tuo '
        'figlio. Non è normale. La maggior parte dei genitori si limita a sperare che quest’anno vada meglio.'),
      p('Il problema di un webinar è che parlo a tutti. E &laquo;tutti&raquo; non esiste: esiste tuo figlio, '
        'la sua squadra, il suo mister, il fatto che è tornato dal ritiro con quella faccia lì.'),
      highlight('Per questo facciamo una cosa: una chiamata di 20 minuti con uno dei nostri coach.'),
      p("Si guarda la situazione specifica di tuo figlio, si capisce se c'è un blocco e quale, e ti diciamo "
        'cosa faremmo noi. Se il Metodo Sincro non è la cosa giusta per lui, te lo diciamo &mdash; è '
        'successo, succederà ancora.'),
      p("È gratuita e non c'è nessun impegno. Ma i posti sono pochi: siamo venti coach e a settembre "
        'partono tutti i percorsi.'),
      button('CANDIDATI PER LA CHIAMATA', CANDIDATURA),
      sign(),
  ], 'chiamata di 20 minuti')

E('P2', 'Non c’eri ieri — ecco la registrazione',
  'Online per 48 ore, poi la tolgo.', [
      p('Ciao,'),
      p('ieri sera non c’eri. Capita: era lunedì, era agosto, la vita fa il suo.'),
      p('Ti lascio la registrazione.'),
      button('GUARDA LA REGISTRAZIONE', REPLAY),
      p('Due avvertenze oneste.'),
      p('<strong>La tolgo giovedì sera.</strong> Non è un trucco per metterti fretta: è che la parte '
        'finale sono domande di genitori su figli veri, e non voglio lasciarla online in eterno.'),
      p('<strong>Se hai poco tempo, parti dal minuto 18.</strong> Lì c’è la parte sulle frasi da '
        'smettere di dire il sabato mattina. È quella che ha generato più messaggi ieri sera, e la puoi '
        'applicare già dal prossimo weekend.'),
      sign(role=False),
  ], 'parti dal minuto 18')

E('P3', '«Ma il mio è timido, non si aprirà mai»',
  'Poi alla quarta è successa una cosa.', [
      p('Ciao,'),
      p("l'obiezione che mi arriva più spesso dopo un webinar non riguarda il costo. Riguarda questo:"),
      quote('Mio figlio è chiuso. Con me non parla. Figurati con uno sconosciuto.'),
      p('Allora ti racconto di un ragazzo di 15 anni. Prima seduta: risposte da tre parole. Seconda: uguale. '
        'Terza: uguale. Il coach chiama la mamma e le dice di avere pazienza.'),
      p('Quarta seduta. A un certo punto il coach gli chiede una cosa banale &mdash; cosa pensa nei dieci secondi '
        'prima di un calcio d’angolo. E lui parla per venti minuti di fila.'),
      p('Non era chiuso. Non aveva mai avuto <strong>un adulto che gli facesse una domanda senza aspettarsi una '
        "risposta giusta</strong>. Con il genitore c'è un giudizio implicito, sempre, anche quando non "
        "c'è. Con il mister c'è la formazione di domenica. Con il coach non c'è niente da difendere."),
      p('È la ragione per cui questo lavoro non lo può fare un genitore, per quanto bravo. Non è una '
        'questione di competenza: è una questione di ruolo.'),
      p('Se vuoi capire se questo vale anche per tuo figlio, la chiamata di 20 minuti serve a quello.'),
      button('CANDIDATI PER LA CHIAMATA', CANDIDATURA),
      sign(role=False),
  ], 'parla per venti minuti di fila')

E('P4', 'Tolgo la registrazione stasera', 'Dopo mezzanotte il link non funziona più.', [
    p('Ciao,'),
    p('stasera a mezzanotte tolgo la registrazione del webinar.'),
    p("Se non l'hai ancora guardata, hai qualche ora:"),
    button('GUARDALA ORA', REPLAY),
    p('E se l’hai guardata ma stai ancora pensando &laquo;sì, però…&raquo;, ti lascio una cosa '
      'a cui pensare.'),
    p('La stagione di tuo figlio comincia tra pochi giorni. Le tre settimane di cui ho parlato lunedì sono '
      'quelle. Non si ripetono a novembre.'),
    p('Puoi aspettare e vedere come va. È una scelta legittima: molti genitori la fanno, e qualche volta va '
      'bene da sola.'),
    p("Oppure puoi fare venti minuti di chiamata adesso, capire se c'è qualcosa da sistemare, e affrontare "
      'settembre sapendo cosa stai facendo invece di sperare.'),
    button('CANDIDATI PER LA CHIAMATA', CANDIDATURA),
    sign(role=False),
], 'Non si ripetono a novembre')

E('P5', 'Chiudo le candidature per settembre', 'Poi i coach sono pieni fino a ottobre.', [
    p('Ciao,'),
    p('ultima email di questa serie, poi ti lascio in pace.'),
    p('Oggi chiudo le candidature per i percorsi che partono a settembre.'),
    p('Non è una scadenza di marketing, è aritmetica. Ogni coach segue un numero chiuso di ragazzi '
      'uno-a-uno, e i posti di settembre finiscono. Chi si candida dopo entra nella lista di ottobre, a stagione '
      'già cominciata &mdash; cioè fuori dalle tre settimane di cui ti parlavo lunedì.'),
    p("E c'è una cosa che vale la pena dirti, visto che sei arrivato fin qui."),
    p('Oltre ai percorsi con i coach, ogni anno ne seguo personalmente un piccolo gruppo. Si chiama '
      '<strong>Sincro Circle</strong> e sono dieci ragazzi. Non nove, non dodici: dieci, perché è il '
      'numero che riesco a seguire davvero senza che diventi una formalità.'),
    p('Non te lo sto proponendo &mdash; non funziona così, e non sarebbe serio farlo via email. Te lo dico '
      "perché esiste. Se in chiamata viene fuori che è la cosa giusta per tuo figlio, se ne parla lì."),
    button('CANDIDATI — ULTIMO GIORNO', CANDIDATURA),
    p('Grazie di avermi letto fin qui.'),
    sign(),
], 'Sincro Circle')


# ─────────────────────────────── API ───────────────────────────────
def req(method, path, payload=None):
    data = json.dumps(payload).encode() if payload else None
    r = urllib.request.Request(BASE + path, data=data, method=method,
                               headers={'Api-Token': KEY, 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(r) as resp:
            return resp.status, json.load(resp)
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:300]


def visible(h):
    h = re.sub(r'<(style|script|head)[^>]*>.*?</\1>', '', h, flags=re.S | re.I)
    h = re.sub(r'<!--.*?-->', '', h, flags=re.S)
    return htmllib.unescape(re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', h))).strip()


def cmd_list():
    print(f'{len(EMAILS)} email disponibili:\n')
    for k, e in EMAILS.items():
        print(f'  {k:<7} {e["subject"]}')


def cmd_export(outdir):
    os.makedirs(outdir, exist_ok=True)
    for k, e in EMAILS.items():
        path = os.path.join(outdir, f'{k}.html')
        with open(path, 'w', encoding='utf-8') as f:
            f.write(e['html'])
        print(f'  {path}  ({len(visible(e["html"]))} car. di testo)')


def cmd_write(pairs):
    if not BASE or not KEY:
        sys.exit("Mancano ACTIVECAMPAIGN_BASE_URL / ACTIVECAMPAIGN_API_KEY nell'ambiente.")
    targets = []
    for pair in pairs:
        if '=' not in pair:
            sys.exit(f'Formato atteso CHIAVE=ID, ricevuto: {pair}')
        k, mid = pair.split('=', 1)
        if k not in EMAILS:
            sys.exit(f'Email sconosciuta: {k}. Usa --list per vedere le chiavi.')
        targets.append((k, mid))

    print('═══ SCRITTURA ═══')
    for k, mid in targets:
        e = EMAILS[k]
        code, _ = req('PUT', f'/messages/{mid}',
                      {'message': {'subject': e['subject'], 'preheader_text': e['preheader'], 'html': e['html']}})
        print(f'  {k} → msg {mid}: HTTP {code}')

    print("\n═══ VERIFICA (rilettura dall'API) ═══")
    ok = True
    for k, mid in targets:
        e = EMAILS[k]
        code, m = req('GET', f'/messages/{mid}')
        if code != 200:
            print(f'  {k} → msg {mid}: rilettura fallita (HTTP {code})')
            ok = False
            continue
        m = m['message']
        got = visible(m.get('html') or '')
        checks = {
            'oggetto': m.get('subject') == e['subject'],
            'preheader': (m.get('preheader_text') or '') == e['preheader'],
            'corpo': e['marker'].lower() in got.lower(),
            'no-template': 'Progetta qui la tua email' not in got,
        }
        ok &= all(checks.values())
        flags = ' | '.join(f'{n} {"✅" if v else "❌"}' for n, v in checks.items())
        print(f'  {k} → msg {mid}: {flags} | {len(got)} car.')
    print('\nESITO:', '✅ tutto scritto e verificato' if ok else '❌ qualcosa non è andato')
    return 0 if ok else 1


if __name__ == '__main__':
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument('--list', action='store_true', help='elenca le email disponibili')
    g.add_argument('--export', metavar='DIR', help='esporta gli HTML su file')
    g.add_argument('--write', nargs='+', metavar='CHIAVE=MSGID', help='scrive su ActiveCampaign e verifica')
    a = ap.parse_args()
    if a.list:
        cmd_list()
    elif a.export:
        cmd_export(a.export)
    else:
        sys.exit(cmd_write(a.write))
