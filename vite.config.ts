import path from "path";
import { VitePWA } from 'vite-plugin-pwa'; 
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  return {
    base: "/tutorial/",
    define: {
      "process.env.API_KEY": JSON.stringify(env.GEMINI_API_KEY),
      "process.env.GEMINI_API_KEY": JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "."),
      },
    },
    plugins: [
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: [
          "robots.txt",
          "favicon.png",
          "apple-touch-icon.webp",
          "pwa-192x192.webp",
          "pwa-512x512.webp",
        ],
        manifest: {
          name: "Tutorial",
          short_name: "Tutorial",
          start_url: "/tutorial/",
          scope: "/tutorial/",
          display: "standalone",
          background_color: "#ffffff",
          theme_color: "#ffffff",
          icons: [
            {
              src: "/tutorial/pwa-192x192.png",
              sizes: "192x192",
              type: "image/webp",
            },
            {
              src: "/tutorial/pwa-512x512.png",
              sizes: "512x512",
              type: "image/webp",
            },
            {
              src: "/tutorial/pwa-512x512.png",
              sizes: "512x512",
              type: "image/webp",
              purpose: "any maskable",
            },
          ],
        },
      }),
    ],
  };
});
