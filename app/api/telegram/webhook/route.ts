import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { updateBudget } from '@/lib/meta-api';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

/**
 * Funzione per inviare la notifica ad Antonio su Telegram con i pulsanti In-line
 */
export async function sendApprovalRequest(
    chatId: string, 
    decision: any, 
    experimentId: string,
    currentCac: number
) {
    if (!TELEGRAM_BOT_TOKEN) return;

    const message = `⚠️ *AdPilotik Agent Action Required*\n\n` +
                    `L'AI ha deciso di **${decision.action_type.toUpperCase()}** l'angolo "${decision.angle || 'N/A'}".\n\n` +
                    `🔹 **Motivazione**: ${decision.hypothesis || 'Ottimizzazione KPI'}\n` +
                    `🔹 **CAC Reale Attuale**: €${currentCac.toFixed(2)}\n\n` +
                    `Vuoi approvare la modifica sui server Meta?`;

    // Pulsanti interattivi
    const keyboard = {
        inline_keyboard: [
            [
                { text: "✅ Approva Ora", callback_data: `approve_${experimentId}` },
                { text: "❌ Rifiuta (Uccidi Idea)", callback_data: `reject_${experimentId}` }
            ],
            [
                { text: "🧠 Modifica Regola", callback_data: `edit_rule_${experimentId}` }
            ]
        ]
    };

    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: chatId,
            text: message,
            parse_mode: 'Markdown',
            reply_markup: keyboard
        })
    });
}

/**
 * Webhook che riceve i click sui bottoni di Telegram
 */
export async function POST(req: Request) {
    try {
        const body = await req.json();
        
        // Risposta a un callback query (click sul bottone)
        if (body.callback_query) {
            const queryId = body.callback_query.id;
            const data = body.callback_query.data;
            const chatId = body.callback_query.message.chat.id;
            const messageId = body.callback_query.message.message_id;

            let replyText = "Azione completata.";

            if (data.startsWith("approve_")) {
                const experimentId = data.replace("approve_", "");
                
                // 1. Leggi l'esperimento dal DB
                const { data: exp } = await getSupabaseAdmin()
                    .from('ai_experiments')
                    .select('*')
                    .eq('id', experimentId)
                    .single();

                if (exp && exp.outcome === 'pending') {
                    // 2. Fai eseguire l'operazione su Meta
                    // await updateBudget('META_TOKEN', exp.action_details.adset_id, exp.action_details.new_budget, 'adset');

                    // 3. Mark come attivo
                    await getSupabaseAdmin()
                        .from('ai_experiments')
                        .update({ outcome: 'active' })
                        .eq('id', experimentId);

                    replyText = "✅ Approvato! L'operazione è stata inviata a Meta Ads.";
                } else {
                    replyText = "⚠️ Esperimento già processato o non trovato.";
                }

            } else if (data.startsWith("reject_")) {
                const experimentId = data.replace("reject_", "");
                await getSupabaseAdmin()
                    .from('ai_experiments')
                    .update({ outcome: 'rejected_by_human' })
                    .eq('id', experimentId);

                replyText = "❌ Disapprovato. L'AI imparerà a non proporlo di nuovo in futuro.";
            }

            // Elimina la tastiera dal vecchio messaggio
            await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageReplyMarkup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    message_id: messageId,
                    reply_markup: { inline_keyboard: [] }
                })
            });

            // Manda l'alert di risposta
            await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    callback_query_id: queryId,
                    text: replyText,
                    show_alert: true
                })
            });

            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ success: true });
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: "Webhook Error" }, { status: 500 });
    }
}
