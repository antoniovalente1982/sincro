'use client'

import Script from 'next/script'
import { useMetaTracking } from '@/lib/useMetaTracking'

export interface AdvertorialTrackingProps {
    funnelId: string
    orgId: string
    pixelId?: string
    disabled?: boolean
}

export default function AdvertorialTracking(props: AdvertorialTrackingProps) {
    useMetaTracking({ ...props, abVariant: 'A' })
    const pixel = props.pixelId && /^\d{5,25}$/.test(props.pixelId) ? props.pixelId : null
    if (props.disabled || !pixel) return null
    return <Script id="advertorial-meta-pixel" strategy="afterInteractive">{
        `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${pixel}');`
    }</Script>
}
