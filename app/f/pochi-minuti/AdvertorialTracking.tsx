'use client'

import EditorialTracking from '@/components/EditorialTracking'
export interface AdvertorialTrackingProps {
    funnelId: string
    orgId: string
    pixelId?: string
    disabled?: boolean
}
export default function AdvertorialTracking(props: AdvertorialTrackingProps) {
    return <EditorialTracking kind="advertorial" pixelId={props.pixelId} preview={props.disabled} />
}
