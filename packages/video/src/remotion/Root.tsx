import React from "react";
import { Composition, type CalculateMetadataFunction } from "remotion";
import { AD_FORMATS, FPS, adPropsSchema, type AdProps } from "../schema";
import { Ad } from "./Ad";

const defaultProps: AdProps = adPropsSchema.parse({
  format: "story",
  durationSeconds: 15,
  title: "Le trésor de la Capitaine Coquelicot",
  hook: "Une chasse au trésor prête en 20 minutes !",
  bullets: ["10 énigmes en 2 versions", "Une carte secrète en 10 morceaux", "PDF A4 à imprimer"],
  kitItems: [{ title: "Lettre de la Capitaine" }, { title: "10 cartes énigmes" }, { title: "Carte au trésor" }, { title: "Diplômes" }],
  priceCents: 990,
  url: "lamalleajeux.fr",
  heroImage: "https://placehold.co/1080x1920/FFD66B/293241.png?text=Illustration",
});

const metadata: CalculateMetadataFunction<AdProps> = ({ props }) => ({
  durationInFrames: Math.round(props.durationSeconds * FPS),
  props,
});

export const RemotionRoot: React.FC = () => (
  <>
    {(Object.keys(AD_FORMATS) as Array<keyof typeof AD_FORMATS>).map((format) => {
      const id = format === "story" ? "AdStory" : format === "square" ? "AdSquare" : "AdLandscape";
      return (
        <Composition
          key={id}
          id={id}
          component={Ad}
          fps={FPS}
          width={AD_FORMATS[format].width}
          height={AD_FORMATS[format].height}
          durationInFrames={Math.round(defaultProps.durationSeconds * FPS)}
          defaultProps={{ ...defaultProps, format }}
          calculateMetadata={metadata}
        />
      );
    })}
  </>
);
