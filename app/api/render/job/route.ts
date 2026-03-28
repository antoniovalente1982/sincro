import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
    try {
        const payload = await req.json();
        
        const { data, error } = await supabase
            .from('video_render_jobs')
            .insert({ payload, status: 'pending', error: 'In coda per il VPS...' })
            .select('*')
            .single();
            
        if (error) throw error;
        
        return NextResponse.json(data);
    } catch(err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');
        
        if (!id) return NextResponse.json({ error: 'Manca ID render' }, { status: 400 });
        
        const { data, error } = await supabase
            .from('video_render_jobs')
            .select('*')
            .eq('id', id)
            .single();
            
        if (error) throw error;
        
        return NextResponse.json(data);
    } catch(err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
