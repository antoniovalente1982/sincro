import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = process.env.RESEND_FROM_EMAIL || 'noreply@resend.dev'

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
