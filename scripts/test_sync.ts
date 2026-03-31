import { GET } from '../app/api/google-sheets/sync-incoming/route'
import { NextRequest } from 'next/server'

async function main() {
    try {
        const req = new NextRequest(new URL('http://localhost:3000/api/google-sheets/sync-incoming'))
        console.log("Calling GET...")
        const res = await GET(req)
        const data = await res.json()
        console.log(JSON.stringify(data, null, 2))
    } catch (e) { console.error(e) }
}
main()
