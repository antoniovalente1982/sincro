"use client";

import { Player, PlayerRef } from '@remotion/player';
import { SincroVideoTemplate } from '@/remotion/SincroVideoTemplate';
import React, { forwardRef, useMemo, useEffect, useState } from 'react';

interface VideoPlayerClientProps {
    headline: string;
    audioBase64?: string | null;
    words?: any[];
    // VFX Props
    visualAssets?: any[];
    useMoney?: boolean;
    avatarVideoUrl?: string;
    messageText?: string;
    backgroundMood?: string;
    subtitleStyle?: 'tiktok' | 'impact' | 'karaoke' | 'hormozi' | 'neon-word' | 'minimal-word' | 'cyber-scanline' | 'none';
    durationInFrames?: number;
    fps?: number;
    
    // 3D & Background
    customBackgroundUrl?: string;
    enable3DParallax?: boolean;
    enableAutoBackgroundRemoval?: string;

    // Lighting Studio
    lightKeyAngle?: number;
    lightKeyIntensity?: number;
    lightKeyColor?: string;
    lightFillIntensity?: number;
    lightFillColor?: string;
    lightRimIntensity?: number;
    lightRimColor?: string;
    
    // Format
    videoFormat?: '9:16' | '16:9' | '1:1';
}

/**
 * Converts a base64 audio string to a Blob URL for reliable browser playback.
 * Data URIs can silently fail on large audio files; Blob URLs bypass this.
 */
function base64ToBlobUrl(base64: string): string {
    // If it's already a usable URL, return as-is
    if (base64.startsWith('blob:') || base64.startsWith('http')) return base64;
    
    // Strip data URI prefix if present
    const raw = base64.startsWith('data:') 
        ? base64.split(',')[1] 
        : base64;
    
    try {
        const byteChars = atob(raw);
        const byteArray = new Uint8Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) {
            byteArray[i] = byteChars.charCodeAt(i);
        }
        const blob = new Blob([byteArray], { type: 'audio/mpeg' });
        return URL.createObjectURL(blob);
    } catch (e) {
        console.error('Failed to convert base64 to Blob URL:', e);
        // Fallback to data URI
        return `data:audio/mpeg;base64,${raw}`;
    }
}

const VideoPlayerClient = forwardRef<PlayerRef, VideoPlayerClientProps>(({ 
    headline, 
    audioBase64, 
    words,
    visualAssets,
    useMoney,
    avatarVideoUrl,
    messageText,
    backgroundMood,
    subtitleStyle = 'impact',
    durationInFrames: parentDuration,
    fps: parentFps = 60,
    customBackgroundUrl,
    enable3DParallax,
    enableAutoBackgroundRemoval,
    lightKeyAngle,
    lightKeyIntensity,
    lightKeyColor,
    lightFillIntensity,
    lightFillColor,
    lightRimIntensity,
    lightRimColor,
    videoFormat = '9:16',
}, ref) => {
    // ═══ CONVERT BASE64 → BLOB URL ═══
    // Data URIs silently fail on large audio payloads (>500KB).
    // Blob URLs are the recommended approach for Remotion audio.
    const [audioBlobUrl, setAudioBlobUrl] = useState<string | null>(null);

    useEffect(() => {
        if (audioBase64 && audioBase64.length > 0) {
            const url = base64ToBlobUrl(audioBase64);
            setAudioBlobUrl(url);
            // Cleanup: revoke old blob URL when audioBase64 changes
            return () => {
                if (url.startsWith('blob:')) {
                    URL.revokeObjectURL(url);
                }
            };
        } else {
            setAudioBlobUrl(null);
        }
    }, [audioBase64]);

    // Usa duration genitore o calcola fallback
    const computedDurationMls = words && words.length > 0 ? words[words.length - 1].endMs + 2000 : 10000;
    const durationInFrames = parentDuration || Math.max(600, Math.ceil((computedDurationMls / 1000) * parentFps));

    let baseWidth = 1080;
    let baseHeight = 1920;
    let aspectString = '9 / 16';
    if (videoFormat === '16:9') {
        baseWidth = 1920;
        baseHeight = 1080;
        aspectString = '16 / 9';
    } else if (videoFormat === '1:1') {
        baseWidth = 1080;
        baseHeight = 1080;
        aspectString = '1 / 1';
    }

    // Use base dimensions directly to avoid 4K massive WebGL canvas which freezes the browser!
    const compWidth = baseWidth;
    const compHeight = baseHeight;

    // Memoizzato per evitare ricreazioni a nastro su Remotion Player e lag mortali
    const memoizedInputProps = useMemo(() => ({
        headline, 
        // Pass the Blob URL instead of raw base64
        audioBase64: audioBlobUrl || '', 
        words: words || [],
        visualAssets: visualAssets || [],
        enableMoneyVFX: useMoney,
        avatarVideoUrl: avatarVideoUrl || null,
        iosMessageText: messageText || null,
        backgroundMood: (backgroundMood as any) || 'warm-studio',
        subtitleStyle: subtitleStyle,
        customBackgroundUrl,
        enable3DParallax,
        enableAutoBackgroundRemoval,
        lightKeyAngle,
        lightKeyIntensity,
        lightKeyColor,
        lightFillIntensity,
        lightFillColor,
        lightRimIntensity,
        lightRimColor,
    }), [
        headline, audioBlobUrl, words, visualAssets, useMoney, avatarVideoUrl, messageText, backgroundMood,
        subtitleStyle, customBackgroundUrl, enable3DParallax, enableAutoBackgroundRemoval,
        lightKeyAngle, lightKeyIntensity, lightKeyColor, lightFillIntensity, lightFillColor,
        lightRimIntensity, lightRimColor
    ]);

    return (
        <Player
            ref={ref}
            component={SincroVideoTemplate}
            inputProps={memoizedInputProps}
            durationInFrames={durationInFrames}
            fps={parentFps}
            compositionWidth={compWidth}
            compositionHeight={compHeight}
            style={{
                width: '100%',
                maxWidth: videoFormat === '16:9' ? '100%' : '400px',
                aspectRatio: aspectString,
                borderRadius: '0.75rem',
                overflow: 'hidden',
                backgroundColor: '#000'
            }}
            numberOfSharedAudioTags={5}
            controls
            loop
        />
    );
});

VideoPlayerClient.displayName = "VideoPlayerClient";

export default VideoPlayerClient;
