import { Composition } from 'remotion';
import { SincroVideoTemplate } from './SincroVideoTemplate';
import React from 'react';

export const RemotionRoot: React.FC = () => {
    return (
        <>
            <Composition
                id="SincroVideoAd"
                component={(props: any) => (
                    <div style={{ transform: 'scale(2)', transformOrigin: 'top left', width: 1080, height: 1920, position: 'absolute' }}>
                        <SincroVideoTemplate {...props} />
                    </div>
                )}
                durationInFrames={600} // 10 secondi a 60fps
                fps={60}
                width={2160}
                height={3840}
                defaultProps={{
                    headline: 'LA TESTA. NON LE GAMBE.',
                    audioBase64: null,
                    words: [],
                }}
            />
        </>
    );
};
