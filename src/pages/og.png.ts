import type { APIRoute } from "astro";
import satori from "satori";
import sharp from "sharp";
import { fontData, experimental_getFontFileURL } from "astro:assets";
import { getFontPathByWeight } from "@/utils/getFontPathByWeight";
import { fetchFontData } from "@/utils/fetchFontData";
import config from "@/config";

const AWS_NAVY = "#232F3E";
const AWS_ORANGE = "#FF9900";
const TEXT_MUTED = "#9EAAB4";

export const GET: APIRoute = async context => {
  const fonts = fontData["--font-google-sans-code"];
  const regularFontPath = getFontPathByWeight(fonts, 400);
  const boldFontPath = getFontPathByWeight(fonts, 700);

  if (regularFontPath === undefined || boldFontPath === undefined) {
    throw new Error("Cannot find the font path.");
  }

  const [regularData, boldData] = await Promise.all([
    fetchFontData(experimental_getFontFileURL(regularFontPath, context.url)),
    fetchFontData(experimental_getFontFileURL(boldFontPath, context.url)),
  ]);

  const svg = await satori(
    {
      type: "div",
      props: {
        style: {
          background: AWS_NAVY,
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          fontFamily: "Google Sans Code",
        },
        children: [
          {
            type: "div",
            props: {
              style: {
                width: "100%",
                height: "12px",
                background: AWS_ORANGE,
                flexShrink: 0,
              },
            },
          },
          {
            type: "div",
            props: {
              style: {
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                flex: 1,
                padding: "60px 80px 50px",
              },
              children: [
                {
                  type: "div",
                  props: {
                    style: {
                      display: "flex",
                      flexDirection: "column",
                      gap: "20px",
                    },
                    children: [
                      {
                        type: "p",
                        props: {
                          style: {
                            fontSize: 80,
                            fontWeight: "bold",
                            color: "#FFFFFF",
                            margin: 0,
                            lineHeight: 1.1,
                          },
                          children: config.site.title,
                        },
                      },
                      {
                        type: "p",
                        props: {
                          style: {
                            fontSize: 30,
                            color: TEXT_MUTED,
                            margin: 0,
                          },
                          children: config.site.description,
                        },
                      },
                    ],
                  },
                },
                {
                  type: "p",
                  props: {
                    style: {
                      fontSize: 26,
                      fontWeight: "bold",
                      color: AWS_ORANGE,
                      margin: 0,
                      alignSelf: "flex-end",
                    },
                    children: new URL(config.site.url).hostname,
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      width: 1200,
      height: 630,
      embedFont: true,
      fonts: [
        {
          name: "Google Sans Code",
          data: regularData,
          weight: 400,
          style: "normal",
        },
        {
          name: "Google Sans Code",
          data: boldData,
          weight: 700,
          style: "normal",
        },
      ],
    }
  );

  const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer();

  return new Response(new Uint8Array(pngBuffer), {
    headers: { "Content-Type": "image/png" },
  });
};
