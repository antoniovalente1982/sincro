"use client";

import { Player } from '@remotion/player';
import { SincroVideoTemplate } from '@/remotion/SincroVideoTemplate';

interface VideoPlayerClientProps {
    headline: string;
    audioBase64?: string | null;
    words?: any[];
    // VFX Props
    visualAssets?: any[];
    useMoney?: boolean;
    avatarVideoUrl?: string;
    messageText?: string;
}

export default function VideoPlayerClient({ 
    headline, 
    audioBase64, 
    words,
    visualAssets,
    useMoney,
    avatarVideoUrl,
    messageText
}: VideoPlayerClientProps) {
    // If we have audio, use a longer duration, otherwise 300 frames default
    const durationMls = words && words.length > 0 ? words[words.length - 1].endMs + 2000 : 10000;
    const durationInFrames = Math.max(300, Math.ceil((durationMls / 1000) * 30));

    return (
        <Player
            component={SincroVideoTemplate}
            inputProps={{ 
                headline, 
                audioBase64: audioBase64 || '', 
                words: words || [],
                visualAssets: visualAssets || [],
                enableMoneyVFX: useMoney,
                avatarVideoUrl: avatarVideoUrl || null,
                iosMessageText: messageText || null
            }}
            durationInFrames={durationInFrames}
            fps={30}
            compositionWidth={1080}
            compositionHeight={1920}
            style={{
                width: '100%',
                maxWidth: '400px', // Responsive mobile view
                aspectRatio: '9 / 16',
            }}
            controls
            autoPlay
            loop
        />
    );
}
