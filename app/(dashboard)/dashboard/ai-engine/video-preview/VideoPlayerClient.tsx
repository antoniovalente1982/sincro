"use client";

import { Player, PlayerRef } from '@remotion/player';
import { SincroVideoTemplate } from '@/remotion/SincroVideoTemplate';
import React, { forwardRef } from 'react';

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
    subtitleStyle?: 'tiktok' | 'impact' | 'karaoke' | 'hormozi' | 'neon-word' | 'minimal-word' | 'none';
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
    // Usa duration genitore o calcola fallback
    const computedDurationMls = words && words.length > 0 ? words[words.length - 1].endMs + 2000 : 10000;
    const durationInFrames = parentDuration || Math.max(600, Math.ceil((computedDurationMls / 1000) * parentFps));

    // Memoizzato per evitare ricreazioni a nastro su Remotion Player e lag mortali
    const memoizedInputProps = React.useMemo(() => ({
        headline, 
        audioBase64: audioBase64 || '', 
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
        headline, audioBase64, words, visualAssets, useMoney, avatarVideoUrl, messageText, backgroundMood,
        subtitleStyle, customBackgroundUrl, enable3DParallax, enableAutoBackgroundRemoval,
        lightKeyAngle, lightKeyIntensity, lightKeyColor, lightFillIntensity, lightFillColor,
        lightRimIntensity, lightRimColor, videoFormat
    ]);

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

    const compWidth = baseWidth * 2;
    const compHeight = baseHeight * 2;

    return (
        <Player
            ref={ref}
            component={(props: any) => (
                <div style={{ transform: 'scale(2)', transformOrigin: 'top left', width: baseWidth, height: baseHeight, position: 'absolute' }}>
                    <SincroVideoTemplate {...props} />
                </div>
            )}
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
            controls
            loop
        />
    );
});

VideoPlayerClient.displayName = "VideoPlayerClient";

export default VideoPlayerClient;
