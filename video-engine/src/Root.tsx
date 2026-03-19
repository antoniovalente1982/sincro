import { Composition, staticFile } from "remotion";
import { MetodoSincroAd } from "./compositions/MetodoSincroAd";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="MetodoSincroAd"
        component={MetodoSincroAd}
        durationInFrames={30 * 32} // 32 seconds at 30fps
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          videoSrc: staticFile("video.mp4"),
        }}
      />
    </>
  );
};
