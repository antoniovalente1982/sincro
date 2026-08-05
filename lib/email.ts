import { Resend } from 'resend'

const FROM = process.env.RESEND_FROM_EMAIL || 'noreply@resend.dev'

// Il client si crea alla prima chiamata, non all'import: senza RESEND_API_KEY
// il costruttore lancia, e un modulo che lancia all'import fa cadere l'intera
// route che lo importa (es. /api/candidatura, dove perdere una submission non
// è accettabile). Senza chiave le funzioni qui sotto fanno no-op e basta.
let client: Resend | null = null

function getResend(): Resend | null {
    if (!process.env.RESEND_API_KEY) return null
    if (!client) client = new Resend(process.env.RESEND_API_KEY)
    return client
}

interface BookingConfirmation {
    to: string
    leadName: string
    closerName: string
    date: string // formatted: "Lunedì 14 Aprile 2026"
    time: string // "10:00 — 10:45"
    phone?: string
    notes?: string
}

export async function sendBookingConfirmation(data: BookingConfirmation) {
    if (!process.env.RESEND_API_KEY) {
        console.warn('[Email] RESEND_API_KEY not configured, skipping email')
        return null
    }

    try {
        const resend = getResend()
        if (!resend) return null

        const { data: result, error } = await resend.emails.send({
            from: `Metodo Sincro <${FROM}>`,
            to: data.to,
            subject: `✅ Appuntamento confermato — ${data.date} alle ${data.time.split(' — ')[0]}`,
            html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:520px;margin:0 auto;padding:40px 20px;">
    <!-- Header -->
    <div style="text-align:center;margin-bottom:32px;">
      <div style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:16px;padding:12px 16px;margin-bottom:16px;">
        <span style="font-size:28px;">📅</span>
      </div>
      <h1 style="color:#fff;font-size:22px;margin:0;">Appuntamento Confermato</h1>
      <p style="color:#a5b4fc;font-size:13px;margin:8px 0 0;">Metodo Sincro</p>
    </div>

    <!-- Card -->
    <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:28px;margin-bottom:24px;">
      <p style="color:#e5e5e5;font-size:14px;margin:0 0 20px;">
        Ciao <strong style="color:#fff">${data.leadName}</strong>,<br>
        il tuo appuntamento è stato confermato.
      </p>
      
      <div style="background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.15);border-radius:12px;padding:20px;margin-bottom:16px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:6px 0;color:#a5b4fc;font-size:12px;font-weight:600;">📆 DATA</td>
            <td style="padding:6px 0;color:#fff;font-size:14px;font-weight:700;text-align:right;">${data.date}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#a5b4fc;font-size:12px;font-weight:600;">🕐 ORARIO</td>
            <td style="padding:6px 0;color:#fff;font-size:14px;font-weight:700;text-align:right;">${data.time}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#a5b4fc;font-size:12px;font-weight:600;">👤 CONSULENTE</td>
            <td style="padding:6px 0;color:#fff;font-size:14px;font-weight:700;text-align:right;">${data.closerName}</td>
          </tr>
          ${data.phone ? `<tr>
            <td style="padding:6px 0;color:#a5b4fc;font-size:12px;font-weight:600;">📞 TELEFONO</td>
            <td style="padding:6px 0;color:#fff;font-size:14px;text-align:right;">${data.phone}</td>
          </tr>` : ''}
        </table>
      </div>

      ${data.notes ? `<p style="color:#999;font-size:12px;margin:0;"><em>Note: ${data.notes}</em></p>` : ''}
    </div>

    <!-- CTA -->
    <div style="text-align:center;margin-bottom:32px;">
      <p style="color:#999;font-size:12px;margin:0 0 16px;">
        Per qualsiasi variazione contattaci rispondendo a questa email.
      </p>
    </div>

    <!-- Footer -->
    <div style="text-align:center;padding-top:20px;border-top:1px solid rgba(255,255,255,0.05);">
      <p style="color:#555;font-size:10px;margin:0;">
        © ${new Date().getFullYear()} Metodo Sincro — Tutti i diritti riservati
      </p>
    </div>
  </div>
</body>
</html>`,
        })

        if (error) {
            console.error('[Email] Send failed:', error)
            return null
        }

        console.log('[Email] Booking confirmation sent to:', data.to, 'ID:', result?.id)
        return result
    } catch (err) {
        console.error('[Email] Exception:', err)
        return null
    }
}

interface CandidaturaNotification {
    tipo: 'candidatura' | 'lista-attesa'
    nome: string
    email: string
    telefono: string
    etaFiglio: string
    livello: string
    difficolta: string
    fonte: string
    acOk: boolean
    acMotivo?: string
}

/**
 * Notifica interna ad Antonio per ogni candidatura alla chiamata gratuita
 * (pagina /candidatura, lancio agosto 2026).
 *
 * Contiene TUTTI i dati della submission, non un semplice avviso: se
 * ActiveCampaign non risponde, questa email resta la copia recuperabile.
 */
export async function sendCandidaturaNotification(data: CandidaturaNotification) {
    if (!process.env.RESEND_API_KEY) {
        console.warn('[Email] RESEND_API_KEY non configurata, notifica candidatura saltata')
        return null
    }

    const to = process.env.CANDIDATURA_NOTIFY_EMAIL || 'valenteantonio1982@gmail.com'
    const esc = (s: string) =>
        String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

    const isAttesa = data.tipo === 'lista-attesa'
    const subject = isAttesa
        ? `📋 Lista d'attesa — ${data.email}`
        : `🔥 Nuova candidatura — ${data.nome} · figlio ${data.etaFiglio} anni`

    const riga = (label: string, valore: string) =>
        valore
            ? `<tr>
                 <td style="padding:8px 0;color:#6b6b6b;font-size:13px;width:150px;vertical-align:top;">${label}</td>
                 <td style="padding:8px 0;color:#0d1b2a;font-size:15px;font-weight:700;">${esc(valore)}</td>
               </tr>`
            : ''

    try {
        const resend = getResend()
        if (!resend) return null

        const { data: result, error } = await resend.emails.send({
            from: `Metodo Sincro <${FROM}>`,
            to,
            replyTo: data.email || undefined,
            subject,
            html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f6f4ef;font-family:Helvetica,Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:24px 16px;">
    <div style="background:#0d1b2a;padding:18px 24px;border-radius:8px 8px 0 0;">
      <span style="color:#c9a84c;font-size:13px;font-weight:bold;letter-spacing:3.5px;">METODO SINCRO&reg;</span>
    </div>
    <div style="background:#ffffff;padding:28px 24px;border-radius:0 0 8px 8px;">
      <h1 style="color:#0d1b2a;font-size:20px;margin:0 0 20px;">
        ${isAttesa ? "Nuova iscrizione alla lista d'attesa" : 'Nuova candidatura alla chiamata'}
      </h1>

      <table style="width:100%;border-collapse:collapse;">
        ${riga('Genitore', data.nome)}
        ${riga('Email', data.email)}
        ${riga('WhatsApp', data.telefono)}
        ${riga('Età del figlio', data.etaFiglio ? `${data.etaFiglio} anni` : '')}
        ${riga('Livello', data.livello)}
        ${riga('Fonte', data.fonte)}
      </table>

      ${data.difficolta ? `
      <div style="background:#f6f4ef;border-left:3px solid #c9a84c;padding:16px 18px;margin-top:20px;border-radius:4px;">
        <p style="color:#6b6b6b;font-size:12px;margin:0 0 8px;letter-spacing:1px;">DIFFICOLTÀ PRINCIPALE</p>
        <p style="color:#1a1a1a;font-size:15px;line-height:1.6;margin:0;">${esc(data.difficolta)}</p>
      </div>` : ''}

      <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e8e4da;">
        <p style="font-size:13px;margin:0;color:${data.acOk ? '#4a7c59' : '#a33'};">
          ${data.acOk
                    ? '✅ ActiveCampaign: contatto sincronizzato e taggato'
                    : `⚠️ ActiveCampaign: sync fallita (${esc(data.acMotivo || 'motivo sconosciuto')}) — va aggiunto a mano`}
        </p>
      </div>
    </div>
  </div>
</body>
</html>`,
        })

        if (error) { console.error('[Email] Notifica candidatura fallita:', error); return null }
        console.log('[Email] Notifica candidatura inviata a:', to)
        return result
    } catch (err) {
        console.error('[Email] Exception notifica candidatura:', err)
        return null
    }
}

interface BookingNotificationToCloser {
    to: string
    closerName: string
    leadName: string
    leadPhone?: string
    leadEmail?: string
    date: string
    time: string
    setterName?: string
}

export async function sendBookingNotificationToCloser(data: BookingNotificationToCloser) {
    if (!process.env.RESEND_API_KEY) return null

    try {
        const resend = getResend()
        if (!resend) return null

        const { data: result, error } = await resend.emails.send({
            from: `Metodo Sincro <${FROM}>`,
            to: data.to,
            subject: `🔔 Nuovo appuntamento — ${data.leadName} · ${data.date} ${data.time.split(' — ')[0]}`,
            html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:520px;margin:0 auto;padding:40px 20px;">
    <div style="text-align:center;margin-bottom:24px;">
      <h1 style="color:#fff;font-size:20px;margin:0;">🔔 Nuovo Appuntamento</h1>
    </div>
    <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:24px;">
      <p style="color:#e5e5e5;font-size:14px;margin:0 0 16px;">
        Ciao <strong style="color:#fff">${data.closerName}</strong>,<br>
        ${data.setterName ? `<strong>${data.setterName}</strong> ha` : 'È stato'} prenotato un nuovo appuntamento per te.
      </p>
      <div style="background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.15);border-radius:12px;padding:16px;">
        <p style="color:#22c55e;font-size:12px;font-weight:700;margin:0 0 8px;">DETTAGLI</p>
        <p style="color:#fff;font-size:14px;margin:4px 0;"><strong>Lead:</strong> ${data.leadName}</p>
        ${data.leadPhone ? `<p style="color:#fff;font-size:14px;margin:4px 0;"><strong>Tel:</strong> ${data.leadPhone}</p>` : ''}
        ${data.leadEmail ? `<p style="color:#fff;font-size:14px;margin:4px 0;"><strong>Email:</strong> ${data.leadEmail}</p>` : ''}
        <p style="color:#fff;font-size:14px;margin:4px 0;"><strong>Data:</strong> ${data.date}</p>
        <p style="color:#fff;font-size:14px;margin:4px 0;"><strong>Ora:</strong> ${data.time}</p>
      </div>
    </div>
    <div style="text-align:center;padding-top:20px;">
      <p style="color:#555;font-size:10px;margin:0;">© ${new Date().getFullYear()} Metodo Sincro</p>
    </div>
  </div>
</body>
</html>`,
        })

        if (error) { console.error('[Email] Closer notification failed:', error); return null }
        console.log('[Email] Closer notification sent to:', data.to)
        return result
    } catch (err) {
        console.error('[Email] Exception:', err)
        return null
    }
}
