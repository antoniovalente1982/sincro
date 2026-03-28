"use client";

import { Player } from '@remotion/player';
import { SincroVideoTemplate } from '@/remotion/SincroVideoTemplate';

interface VideoPlayerClientProps {
    headline: string;
}

export default function VideoPlayerClient({ headline }: VideoPlayerClientProps) {
    return (
        <Player
            component={SincroVideoTemplate}
            inputProps={{ headline }}
            durationInFrames={300}
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
