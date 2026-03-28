"use client";

import { Player, PlayerRef } from '@remotion/player';
import { SincroVideoTemplate } from '@/remotion/SincroVideoTemplate';
import { forwardRef } from 'react';

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
    subtitleStyle?: 'tiktok' | 'impact' | 'karaoke' | 'none';
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
}, ref) => {
    // If we have audio, use a longer duration, otherwise 600 frames default
    const durationMls = words && words.length > 0 ? words[words.length - 1].endMs + 2000 : 10000;
    const durationInFrames = Math.max(600, Math.ceil((durationMls / 1000) * 60));

    return (
        <Player
            ref={ref}
            component={(props: any) => (
                <div style={{ transform: 'scale(2)', transformOrigin: 'top left', width: 1080, height: 1920, position: 'absolute' }}>
                    <SincroVideoTemplate {...props} />
                </div>
            )}
            inputProps={{ 
                headline, 
                audioBase64: audioBase64 || '', 
                words: words || [],
                visualAssets: visualAssets || [],
                enableMoneyVFX: useMoney,
                avatarVideoUrl: avatarVideoUrl || null,
                iosMessageText: messageText || null,
                backgroundMood: (backgroundMood as any) || 'warm-studio',
                subtitleStyle: subtitleStyle,
            }}
            durationInFrames={durationInFrames}
            fps={60}
            compositionWidth={2160}
            compositionHeight={3840}
            style={{
                width: '100%',
                maxWidth: '400px',
                aspectRatio: '9 / 16',
            }}
            controls
            autoPlay
            loop
        />
    );
});

VideoPlayerClient.displayName = "VideoPlayerClient";

export default VideoPlayerClient;
