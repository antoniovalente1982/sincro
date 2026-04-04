import { NextResponse } from 'next/server';
import { hermesClient } from '@/lib/hermes-client';

export async function GET() {
  try {
    const logs = await hermesClient.getLogs(50);
    return NextResponse.json({ logs });
  } catch (error) {
    console.error("Logs fetch error:", error);
    return NextResponse.json({ logs: [] }, { status: 500 });
  }
}
