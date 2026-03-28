const fs = require('fs');

let code = fs.readFileSync('remotion/SincroVideoTemplate.tsx', 'utf8');

// 1. Add interpolate to imports
code = code.replace("import { AbsoluteFill, useVideoConfig, useCurrentFrame, spring, Audio, staticFile } from 'remotion';", 
"import { AbsoluteFill, useVideoConfig, useCurrentFrame, spring, Audio, staticFile, interpolate } from 'remotion';");

// 2. Extend VisualAsset interface
code = code.replace(
    "imageUrl?: string;",
    "imageUrl?: string;\n    scale?: number;\n    xOffset?: number;\n    yOffset?: number;\n    inAnim?: 'none' | 'fade-in' | 'slide-up' | 'zoom-in' | 'bounce';\n    outAnim?: 'none' | 'fade-out' | 'slide-right' | 'zoom-out';\n    idleAnim?: 'none' | 'float' | 'pulse' | 'wiggle';\n    layerOrder?: 'front' | 'back';"
);

// 3. Update getTransformStyle signature
code = code.replace(
    "const getTransformStyle = (asset: any): React.CSSProperties => {\n        const scale = asset.scale !== undefined ? asset.scale : 1;\n        const xOffset = asset.xOffset || 0;\n        const yOffset = asset.yOffset || 0;\n        return {\n            width: '100%', height: '100%', position: 'absolute' as const,\n            transform: `translate(${xOffset}px, ${yOffset}px) scale(${scale})`,\n            transformOrigin: 'center center'\n        };\n    };",
`    const getTransformStyle = (asset: any): React.CSSProperties => {
        const scaleConfig = asset.scale !== undefined ? asset.scale : 1;
        const xOffset = asset.xOffset || 0;
        const yOffset = asset.yOffset || 0;
        
        let finalOpacity = 1;
        let finalScale = scaleConfig;
        let finalX = xOffset;
        let finalY = yOffset;
        let finalRotate = 0;

        const startFrame = Math.round((asset.startMs / 1000) * fps);
        const endFrame = Math.round((asset.endMs / 1000) * fps);

        if (asset.inAnim === 'fade-in') {
            finalOpacity = interpolate(frame, [startFrame, startFrame + 15], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });
        } else if (asset.inAnim === 'slide-up') {
            finalY = interpolate(frame, [startFrame, startFrame + 15], [yOffset + 500, yOffset], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });
            finalOpacity = interpolate(frame, [startFrame, startFrame + 5], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });
        } else if (asset.inAnim === 'zoom-in') {
            finalScale = interpolate(frame, [startFrame, startFrame + 15], [0, scaleConfig], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });
        } else if (asset.inAnim === 'bounce') {
            const bounceSpring = spring({ frame: frame - startFrame, fps, config: { damping: 10, mass: 0.5, stiffness: 100 } });
            finalScale = scaleConfig * bounceSpring;
        }

        if (asset.idleAnim === 'float') {
            finalY += Math.sin(frame / 15) * 30;
        } else if (asset.idleAnim === 'pulse') {
            finalScale += Math.sin(frame / 10) * 0.05;
        } else if (asset.idleAnim === 'wiggle') {
            finalRotate = Math.sin(frame / 5) * 5;
        }

        if (asset.outAnim === 'fade-out') {
            const outOp = interpolate(frame, [endFrame - 15, endFrame], [1, 0], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });
            finalOpacity = Math.min(finalOpacity, outOp);
        } else if (asset.outAnim === 'slide-right') {
            const outX = interpolate(frame, [endFrame - 15, endFrame], [finalX, finalX + 1080], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });
            finalX = outX;
        } else if (asset.outAnim === 'zoom-out') {
            const outScale = interpolate(frame, [endFrame - 15, endFrame], [finalScale, 0], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });
            finalScale = outScale;
        }

        return {
            width: '100%', height: '100%', position: 'absolute' as const,
            opacity: finalOpacity,
            transform: \`translate(\${finalX}px, \${finalY}px) scale(\${finalScale}) rotate(\${finalRotate}deg)\`,
            transformOrigin: 'center center'
        };
    };`
);

// 4. Wrap rendering loops to respect layerOrder.
// We will simply render front objects and back objects manually by creating a helper
code = code.replace(
    "                {/* ═══ Z-50: AVATAR SPEAKER ═══ */}",
    "                {/* ═══ Z-40: ASSET BACKGROUND ═══ */}\n                <AbsoluteFill style={{zIndex: 40}}>\n                   {visualAssets.filter(a => a.layerOrder === 'back').map((asset, i) => (\n                       <div key={'back-'+i} style={getTransformStyle(asset)}>\n                           {asset.type === 'giant-text' && <GiantImpactText line1={asset.query} line2={asset.line2} highlightWord={asset.highlightWord} textStyle={(asset.textStyle as any) || 'impact'} highlightColor={asset.color || '#EAB308'} startFrame={Math.ceil((asset.startMs/1000)*fps)} endFrame={Math.ceil((asset.endMs/1000)*fps)} />}\n                           {asset.type === 'newspaper' && <FakeNewspaper headline={asset.query} endFrame={Math.ceil((asset.endMs/1000)*fps)} startFrame={Math.ceil((asset.startMs/1000)*fps)} />}\n                           {asset.type === 'b-roll' && <DynamicCard3D imageUrl={asset.imageUrl || ((asset.query || '').includes('http') ? asset.query : fallbackImages[i % fallbackImages.length])} startFrame={Math.ceil((asset.startMs/1000)*fps)} endFrame={Math.ceil((asset.endMs/1000)*fps)} variant={asset.variant as any || 'slide-right'} position={asset.position as any || 'center'} />}\n                       </div>\n                   ))}\n                </AbsoluteFill>\n\n                {/* ═══ Z-50: AVATAR SPEAKER ═══ */}"
);

// Now change the zIndex: 100/200/250 loops to filter out 'back'
code = code.replace("brollAssets.map((asset, i)", "brollAssets.filter(a => a.layerOrder !== 'back').map((asset, i)");
code = code.replace("newspaperAssets.map((asset, i)", "newspaperAssets.filter(a => a.layerOrder !== 'back').map((asset, i)");
code = code.replace("swipeCardAssets.map((asset, i)", "swipeCardAssets.filter(a => a.layerOrder !== 'back').map((asset, i)");
code = code.replace("giantTextAssets.map((asset, i)", "giantTextAssets.filter(a => a.layerOrder !== 'back').map((asset, i)");
code = code.replace("ctaAssets.map((asset, i)", "ctaAssets.filter(a => a.layerOrder !== 'back').map((asset, i)");

fs.writeFileSync('remotion/SincroVideoTemplate.tsx', code);
console.log("Template updated successfully");
