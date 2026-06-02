/**
 * app/api/cron/refresh-meta-token/route.ts
 *
 * Cron che auto-rinnova il Long-Lived Token Meta prima della scadenza.
 * Strategia rolling: ogni volta che scambi un LLT ottieni altri 60 giorni.
 * Girando ogni 50 giorni, il token non scade MAI.
 *
 * Schedulato: ogni 50 giorni (vercel.json)
 */

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const maxDuration = 30

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return await refreshMetaToken()
}

// Esportata così può essere chiamata anche da altri punti (es. webhook se 401)
export async function refreshMetaToken() {
  const supabase = getSupabaseAdmin()
  const appSecret = process.env.META_APP_SECRET

  if (!appSecret) {
    return NextResponse.json({ error: 'META_APP_SECRET not configured' }, { status: 500 })
  }

  // Recupera tutte le connessioni Meta attive
  const { data: connections } = await supabase
    .from('connections')
    .select('id, organization_id, credentials')
    .eq('provider', 'meta_ads')
    .eq('status', 'active')

  if (!connections?.length) {
    return NextResponse.json({ message: 'No active Meta connections' })
  }

  const results = []

  for (const conn of connections) {
    const currentToken = conn.credentials?.access_token
    if (!currentToken) {
      results.push({ id: conn.id, status: 'skipped', reason: 'no token' })
      continue
    }

    // Recupera app_id dal token
    const debugRes = await fetch(
      `https://graph.facebook.com/v21.0/debug_token?input_token=${currentToken}&access_token=${currentToken}`
    )
    const debugData = await debugRes.json()

    if (debugData.error) {
      console.error(`[RefreshMetaToken] Token invalid for conn ${conn.id}:`, debugData.error.message)
      results.push({ id: conn.id, status: 'error', reason: 'token_invalid: ' + debugData.error.message })
      continue
    }

    const appId = debugData.data?.app_id
    const expiresAt = debugData.data?.data_access_expires_at
      ? new Date(debugData.data.data_access_expires_at * 1000)
      : null

    // Scambia per un nuovo Long-Lived Token (rolling refresh)
    const exchangeRes = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${currentToken}`
    )
    const exchangeData = await exchangeRes.json()

    if (exchangeData.error) {
      console.error(`[RefreshMetaToken] Exchange failed for conn ${conn.id}:`, exchangeData.error.message)
      results.push({ id: conn.id, status: 'error', reason: 'exchange_failed: ' + exchangeData.error.message })
      continue
    }

    const newToken = exchangeData.access_token
    const newExpiresAt = new Date(Date.now() + (exchangeData.expires_in || 5183944) * 1000).toISOString()

    await supabase
      .from('connections')
      .update({
        credentials: {
          ...conn.credentials,
          access_token: newToken,
          token_expires_at: newExpiresAt,
          token_updated_at: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', conn.id)

    console.log(`[RefreshMetaToken] Token refreshed for conn ${conn.id}. Expires: ${newExpiresAt}`)
    results.push({ id: conn.id, status: 'refreshed', expires_at: newExpiresAt })
  }

  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    results,
  })
}
