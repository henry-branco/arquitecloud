import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { fontData, experimental_getFontFileURL } from "astro:assets";
import satori from "satori";
import sharp from "sharp";
import { getFontPathByWeight } from "@/utils/getFontPathByWeight";
import { fetchFontData } from "@/utils/fetchFontData";
import { getPostSlug } from "@/utils/getPostPaths";
import config from "@/config";

const AWS_NAVY = "#232F3E";
const AWS_ORANGE = "#FF9900";

export async function getStaticPaths() {
  if (!config.features.dynamicOgImage) {
    return [];
  }

  const posts = await getCollection("posts").then(p =>
    p.filter(({ data }) => !data.draft && !data.ogImage)
  );

  return posts.map(post => ({
    params: { slug: getPostSlug(post.id, post.filePath) },
    props: post,
  }));
}

export const GET: APIRoute = async ({ props, url }) => {
  if (!config.features.dynamicOgImage) {
    return new Response(null, { status: 404, statusText: "Not found" });
  }

  const fonts = fontData["--font-google-sans-code"];
  const regularFontPath = getFontPathByWeight(fonts, 400);
  const boldFontPath = getFontPathByWeight(fonts, 700);

  if (regularFontPath === undefined || boldFontPath === undefined) {
    throw new Error("Cannot find the font path.");
  }

  const [regularData, boldData] = await Promise.all([
    fetchFontData(experimental_getFontFileURL(regularFontPath, url)),
    fetchFontData(experimental_getFontFileURL(boldFontPath, url)),
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
                  type: "p",
                  props: {
                    style: {
                      fontSize: 64,
                      fontWeight: "bold",
                      color: "#FFFFFF",
                      margin: 0,
                      lineHeight: 1.2,
                      maxHeight: "380px",
                      overflow: "hidden",
                    },
                    children: props.data.title,
                  },
                },
                {
                  type: "div",
                  props: {
                    style: {
                      display: "flex",
                      justifyContent: "space-between",
                      width: "100%",
                    },
                    children: [
                      {
                        type: "span",
                        props: {
                          style: {
                            fontSize: 26,
                            fontWeight: "bold",
                            color: AWS_ORANGE,
                          },
                          children: `by ${props.data.author}`,
                        },
                      },
                      {
                        type: "span",
                        props: {
                          style: {
                            fontSize: 26,
                            fontWeight: "bold",
                            color: AWS_ORANGE,
                          },
                          children: config.site.title,
                        },
                      },
                    ],
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
