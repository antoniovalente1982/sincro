import { NextResponse } from 'next/server';
import { hermesClient } from '@/lib/hermes-client';

export async function GET() {
  try {
    const isOnline = await hermesClient.checkHealth();
    
    if (isOnline) {
      return NextResponse.json({ status: 'online', message: 'Hermes Agent Ecosystem is fully operational' });
    } else {
      return NextResponse.json({ status: 'offline', message: 'Hermes VPS is unreachable. Connection failed.' }, { status: 503 });
    }
  } catch (error) {
    console.error("Health check error:", error);
    return NextResponse.json({ status: 'error', message: 'Failed to verify Hermes status' }, { status: 500 });
  }
}
