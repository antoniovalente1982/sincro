import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl!, supabaseKey!)

const MS_ORG_ID = 'a5dd4842-f0ea-4909-b4a3-be2cb1c6ffa5'

async function run() {
    console.log('Creating new funnel for Email Marketing...')
    
    // Check if it already exists
    const { data: existing } = await supabase.from('funnels')
        .select('*')
        .eq('name', 'Invito Esclusivo (Email Marketing)')
        .single()
        
    if (existing) {
        console.log('Funnel already exists with ID:', existing.id)
        return
    }

    // Duplicate settings from MetodoSincro master funnel
    const { data: masterFunnel } = await supabase.from('funnels')
        .select('meta_pixel_id, pipeline_id')
        .eq('id', '1539adea-4b2e-40ff-8f35-0eb1b89d13eb')
        .single()

    const { data: newFunnel, error } = await supabase.from('funnels')
        .insert({
            organization_id: MS_ORG_ID,
            name: 'Invito Esclusivo (Email Marketing)',
            slug: 'invito-esclusivo',
            status: 'active',
            meta_pixel_id: masterFunnel?.meta_pixel_id || null,
            pipeline_id: masterFunnel?.pipeline_id || null,
            objective: 'Lead',
            settings: { 
                created_from: 'ai_agent',
                traffic_source: 'Email Marketing'
            }
        })
        .select()
        .single()
        
    if (error) {
        console.error('Error creating funnel:', error)
    } else {
        console.log('Successfully created Funnel. ID:', newFunnel.id)
    }
}

run()
