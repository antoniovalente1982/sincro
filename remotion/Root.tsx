import { Composition } from 'remotion';
import { SincroVideoTemplate } from './SincroVideoTemplate';
import React from 'react';

export const RemotionRoot: React.FC = () => {
    return (
        <>
            <Composition
                id="SincroVideoAd"
                component={SincroVideoTemplate}
                durationInFrames={300} // 10 secondi a 30fps
                fps={30}
                width={1080}
                height={1920}
                defaultProps={{
                    headline: 'LA TESTA. NON LE GAMBE.',
                }}
            />
        </>
    );
};
