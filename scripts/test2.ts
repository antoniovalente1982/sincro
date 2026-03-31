import { GET } from '../app/api/google-sheets/sync-incoming/route'
import { NextRequest } from 'next/server'

async function trySync() {
    try {
        const req = new NextRequest(new URL('http://localhost:3000/api/google-sheets/sync-incoming'))
        console.log("Starting sync...")
        const res = await GET(req)
        console.log("Status:", res.status)
        const data = await res.json()
        console.log("Result:", data)
    } catch(e) {
        console.error("FATAL ERROR:", e)
    }
}

trySync()
