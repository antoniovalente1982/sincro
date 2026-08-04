import json, os, re, html, urllib.request, urllib.error

base = os.environ['ACTIVECAMPAIGN_BASE_URL']
key = os.environ['ACTIVECAMPAIGN_API_KEY']

def req(method, path, payload=None):
    data = json.dumps(payload).encode() if payload else None
    r = urllib.request.Request(base + path, data=data, method=method,
                               headers={'Api-Token': key, 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(r) as resp:
            return resp.status, json.load(resp)
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:400]

NAVY = '#0d1b2a'
GOLD = '#c9a84c'
INK  = '#1a1a1a'
MUTE = '#6b6b6b'
PAPER= '#ffffff'
WASH = '#f6f4ef'

def p(t):
    return (f'<p style="margin:0 0 18px;font-family:Helvetica,Arial,sans-serif;'
            f'font-size:17px;line-height:1.65;color:{INK};">{t}</p>')

def quote(t, who=None):
    attrib = (f'<span style="display:block;margin-top:10px;font-size:14px;color:{MUTE};">— {who}</span>') if who else ''
    return (f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px;">'
            f'<tr><td style="border-left:3px solid {GOLD};padding:4px 0 4px 18px;">'
            f'<span style="font-family:Georgia,serif;font-size:18px;line-height:1.6;color:{INK};font-style:italic;">{t}</span>'
            f'{attrib}</td></tr></table>')

def highlight(t):
    return (f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px;">'
            f'<tr><td style="background:{WASH};border-radius:6px;padding:20px 22px;">'
            f'<span style="font-family:Helvetica,Arial,sans-serif;font-size:18px;line-height:1.55;'
            f'color:{NAVY};font-weight:bold;">{t}</span></td></tr></table>')

def stats():
    cells = [('+1.100', 'ATLETI SEGUITI'), ('+8.880', 'ORE DI LAVORO'), ('4,9★', '356 RECENSIONI')]
    tds = ''.join(
        f'<td width="33%" align="center" style="padding:14px 6px;">'
        f'<div style="font-family:Helvetica,Arial,sans-serif;font-size:24px;font-weight:bold;color:{GOLD};">{v}</div>'
        f'<div style="font-family:Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:1.4px;color:{MUTE};'
        f'margin-top:4px;">{l}</div></td>' for v, l in cells)
    return (f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
            f'style="margin:6px 0 24px;border-top:1px solid #e6e2d8;border-bottom:1px solid #e6e2d8;">'
            f'<tr>{tds}</tr></table>')

def button(label, url):
    return (f'<table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 26px;">'
            f'<tr><td align="center" bgcolor="{GOLD}" style="border-radius:4px;">'
            f'<a href="{url}" style="display:inline-block;padding:15px 34px;font-family:Helvetica,Arial,sans-serif;'
            f'font-size:15px;font-weight:bold;letter-spacing:0.5px;color:{NAVY};text-decoration:none;">'
            f'{label}</a></td></tr></table>')

def sign(extra=''):
    return (f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:30px;">'
            f'<tr><td style="border-top:1px solid #e6e2d8;padding-top:20px;">'
            f'<div style="font-family:Helvetica,Arial,sans-serif;font-size:16px;color:{INK};">Antonio Valente</div>'
            f'<div style="font-family:Helvetica,Arial,sans-serif;font-size:13px;color:{MUTE};margin-top:3px;">'
            f'Fondatore, Metodo Sincro®{extra}</div></td></tr></table>')

def wrap(preheader, blocks):
    body = ''.join(blocks)
    return f"""<!DOCTYPE html>
<html lang="it"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:{WASH};">
<div style="display:none;font-size:1px;color:{WASH};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">{preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{WASH};">
<tr><td align="center" style="padding:26px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:{PAPER};border-radius:8px;overflow:hidden;">
  <tr><td style="background:{NAVY};padding:20px 32px;">
    <span style="font-family:Helvetica,Arial,sans-serif;font-size:13px;letter-spacing:3.5px;color:{GOLD};font-weight:bold;">METODO SINCRO®</span>
  </td></tr>
  <tr><td style="padding:34px 32px 26px;">{body}</td></tr>
  <tr><td style="background:{WASH};padding:22px 32px;">
    <div style="font-family:Helvetica,Arial,sans-serif;font-size:11px;line-height:1.6;color:{MUTE};">
      %SENDER-INFO-SINGLELINE%<br>
      Non vuoi più ricevere queste email? <a href="%UNSUBSCRIBELINK%" style="color:{MUTE};">Disiscriviti qui</a>.
    </div>
  </td></tr>
</table>
</td></tr></table>
</body></html>"""

# ─────────────────────────── EMAIL 1 ───────────────────────────
e1 = wrap("Il primo allenamento è già cominciato — nella sua testa.", [
    p("Ciao,"),
    p("mancano poche settimane al primo allenamento."),
    p("Per te è una data sul calendario. Per tuo figlio è una domanda che si porta dietro da giugno: "
      "<strong>quest'anno andrà meglio?</strong>"),
    p("Non te lo dirà. I ragazzi non lo dicono quasi mai. Lo tengono lì sotto, e lo trasformano in silenzio "
      "in macchina, in &laquo;tutto bene&raquo; quando gli chiedi come va, in una partita giocata al sessanta "
      "per cento &mdash; perché l'altro quaranta è impegnato a pensare a cosa succede se sbaglia."),
    p("In questi anni ho seguito più di 1.100 ragazzi. La frase che sento più spesso dai genitori è sempre la stessa:"),
    highlight("&laquo;In allenamento è un altro. In partita sparisce.&raquo;"),
    p("Non è un problema tecnico. Nessun ragazzo perde la tecnica il sabato mattina. Perde l'<em>accesso</em> "
      "alla tecnica, perché la testa è occupata altrove."),
    stats(),
    p("Nelle prossime settimane ti scrivo qualcosa su questo. Non teoria: le cose concrete che separano un "
      "ragazzo che parte bene a settembre da uno che si trascina fino a Natale."),
    p("Se oggi non è più un tema per te &mdash; ha smesso, è cresciuto, va tutto bene &mdash; in fondo trovi "
      "il link per uscire. Nessun problema, davvero."),
    p("Se invece quella frase l'hai pensata anche tu, resta. La prossima arriva venerdì."),
    sign(),
])

# ─────────────────────────── EMAIL 2 ───────────────────────────
e2 = wrap("L'intenzione è perfetta. L'effetto no.", [
    p("Ciao,"),
    p("sabato mattina, in macchina. Lui guarda fuori dal finestrino e non parla."),
    p("E tu dici la cosa più naturale del mondo:"),
    quote("Stai tranquillo, divertiti."),
    p("L'intenzione è perfetta. L'effetto no."),
    p("Perché nella sua testa quella frase diventa un'altra: <strong>&laquo;quindi c'è qualcosa per cui non "
      "essere tranquillo. E se me lo dice, vuol dire che si vede.&raquo;</strong>"),
    p("Non è colpa tua. Nessuno ti ha dato il manuale. Il problema è che la rassicurazione, in quel momento, "
      "nomina la paura invece di sciogliere la tensione."),
    p("Prova a sostituirla con una domanda:"),
    highlight("&laquo;Qual è la prima cosa che vuoi fare quando tocchi il primo pallone?&raquo;"),
    p("Sembra poco. Fa tre cose insieme:"),
    p("&mdash; gli dà un compito <strong>eseguibile</strong>, invece di uno stato d'animo da raggiungere<br>"
      "&mdash; sposta l'attenzione dal risultato (che non controlla) alla prima azione (che controlla)<br>"
      "&mdash; gli fa dire una frase ad alta voce, e una frase detta è un impegno che il corpo ricorda"),
    p("Provala sabato prossimo. Non aspettarti un discorso: aspettati che risponda con tre parole e torni a "
      "guardare fuori dal finestrino. Va benissimo così. Il lavoro l'ha già fatto."),
    p("Questa è una delle prime cose che i nostri coach insegnano ai genitori, non ai ragazzi. Perché un "
      "ragazzo non esiste da solo: esistono i genitori, le aspettative, la pressione del sabato mattina."),
    p("Lunedì ti scrivo l'ultima di questa serie. E ti anticipo una cosa che sto preparando per fine agosto."),
    sign(),
])

# ─────────────────────────── EMAIL 3 ───────────────────────────
e3 = wrap("E cosa succede lunedì 24 agosto alle 21:00.", [
    p("Ciao,"),
    p("356 recensioni su Trustpilot. Le ho lette tutte."),
    p("C'è una cosa che mi ha colpito: <strong>quasi nessun genitore scrive &laquo;mio figlio gioca meglio&raquo;.</strong>"),
    p("Scrivono altro."),
    quote("Nostro figlio ha abbattuto diversi muri — non solo in campo, ma come persona. Un cambiamento che non pensavamo possibile in così poco tempo.", "genitore"),
    quote("Sono partita insicura e ansiosa. Ho trovato fin da subito quel feeling necessario per aprirmi.", "Aurora, atleta"),
    p("Nessuno parla di tecnica. Tutti parlano di <strong>come il ragazzo si vede</strong>."),
    p("Ed è esattamente il punto. In 1.100 percorsi non ho mai incontrato un ragazzo che avesse bisogno di più "
      "talento. Ho incontrato ragazzi pieni di talento che non riuscivano ad accedervi quando contava."),
    p("Il talento non manca quasi mai. Manca la capacità di esprimerlo sotto pressione. E quella si allena, "
      "come si allena il tiro."),
    highlight("Lunedì 24 agosto, ore 21:00: un webinar gratuito in diretta."),
    p("Un'ora su come si imposta la stagione di tuo figlio nelle prime tre settimane: cosa fare a casa, cosa "
      "dire (e cosa smettere di dire), e come dare a scout e osservatori qualcosa da notare."),
    p("Non ti chiedo niente adesso. Le iscrizioni le apro <strong>martedì 18 agosto</strong> e ti scrivo io."),
    p("Per ora segnati la data: <strong>lunedì 24 agosto, ore 21:00</strong>."),
    p("Adesso mi fermo una settimana &mdash; Ferragosto vale anche per me. Ci risentiamo il 18."),
    sign(),
])

EMAILS = [
    (18, "Tuo figlio ci sta già pensando (anche se non te lo dice)",
         "Il primo allenamento è già cominciato — nella sua testa.", e1, "In allenamento è un altro"),
    (19, "«Stai tranquillo» è la frase che gli fa più male",
         "L'intenzione è perfetta. L'effetto no.", e2, "Qual è la prima cosa che vuoi fare"),
    (20, "1.100 ragazzi. Nessuno di loro era «quello dotato».",
         "E cosa succede lunedì 24 agosto alle 21:00.", e3, "Lunedì 24 agosto, ore 21:00"),
]

def visible(h):
    h = re.sub(r'<(style|script|head)[^>]*>.*?</\1>', '', h, flags=re.S | re.I)
    h = re.sub(r'<!--.*?-->', '', h, flags=re.S)
    return html.unescape(re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', h))).strip()

print("═══ SCRITTURA ═══")
for mid, subj, pre, body, _ in EMAILS:
    code, res = req('PUT', f'/messages/{mid}',
                    {'message': {'subject': subj, 'preheader_text': pre, 'html': body}})
    print(f"  msg {mid}: HTTP {code}")

print("\n═══ VERIFICA (rilettura dall'API) ═══")
ok = True
for mid, subj, pre, body, marker in EMAILS:
    c, m = req('GET', f'/messages/{mid}')
    m = m['message']
    got = visible(m.get('html') or '')
    s_ok = m.get('subject') == subj
    p_ok = (m.get('preheader_text') or '') == pre
    b_ok = marker in got
    t_ok = 'Progetta qui la tua email' not in got
    ok &= s_ok and p_ok and b_ok and t_ok
    print(f"  msg {mid}: oggetto {'✅' if s_ok else '❌'} | preheader {'✅' if p_ok else '❌'} | "
          f"corpo {'✅' if b_ok else '❌'} | template rimosso {'✅' if t_ok else '❌'} | {len(got)} car. di testo")
print("\nESITO:", "✅ tutte e tre scritte e verificate" if ok else "❌ qualcosa non è andato")
