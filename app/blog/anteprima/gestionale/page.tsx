import BlogPanel from '@/app/(dashboard)/dashboard/blog/BlogPanel'
import { samplePost } from '../sample'
export default function PreviewDashboard() { return <BlogPanel initialPosts={[samplePost]} legacy={[{ id: 'legacy-demo', slug: 'pochi-minuti', title: 'Pochi minuti per dimostrare quanto vale', status: 'active', description: '' }]} demo /> }
