import { createClient } from '@supabase/supabase-js'

async function main() {
    console.log("Starting test")
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const { data: orgs } = await supabase.from('organizations').select('id, name').ilike('name', '%sincro%').limit(1).single()
    const { data: pipelines } = await supabase.from('pipelines').select('id, name').eq('organization_id', orgs.id).eq('is_default', true).limit(1).single()
    const { data: stages } = await supabase.from('pipeline_stages').select('id').eq('pipeline_id', pipelines.id).order('sort_order', { ascending: true })

    const res = await supabase.from('leads').insert({
        organization_id: orgs.id,
        email: 'test_insert@test.com',
        name: 'Test Insert',
        phone: '12345',
        stage_id: stages[0].id,
        meta_data: { source: 'google_sheets_sync' }
    }).select('id').single()
    
    console.log("INSERT RES:", res.error?.message || "SUCCESS", res.data)
}
main()
