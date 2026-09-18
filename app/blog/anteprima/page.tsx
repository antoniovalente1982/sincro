import { BlogArchive } from '../BlogViews'
import { samplePost } from './sample'
export default function Preview() { return <BlogArchive posts={[samplePost]} legacy={[]} preview /> }
