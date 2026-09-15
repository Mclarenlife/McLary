import { defineConfig } from "vite";
import fs from "node:fs/promises";
export default defineConfig({
  plugins: [
    {
      name: "local-study-export",
      configureServer(server) {
        server.middlewares.use("/__dev/save-study", async (req, res) => {
          if (
            req.method !== "POST" ||
            !/^http:\/\/127\.0\.0\.1:4173$/.test(req.headers.origin || "")
          ) {
            res.statusCode = 403;
            res.end();
            return;
          }
          try {
            const chunks = [];
            let bytes = 0;
            for await (const chunk of req) {
              bytes += chunk.length;
              if (bytes > 2000000) throw Error("Image too large");
              chunks.push(chunk);
            }
            const data = JSON.parse(Buffer.concat(chunks).toString());
            if (
              ![
                "quiet-spaces",
                "liquid-thoughts",
                "soft-structure",
                "another-orbit",
                "in-bloom",
                "between-worlds",
              ].includes(data.id) ||
              !data.image.startsWith("data:image/webp;base64,")
            )
              throw Error("Invalid artwork");
            await fs.mkdir("public/studies", { recursive: true });
            await fs.writeFile(
              `public/studies/${data.id}.webp`,
              Buffer.from(data.image.split(",")[1], "base64"),
            );
            res.statusCode = 204;
            res.end();
          } catch {
            res.statusCode = 400;
            res.end();
          }
        });
      },
    },
  ],
  build: {
    outDir: "build",
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("/three/")) return "three";
          if (id.includes("/gsap/")) return "motion";
        },
      },
    },
  },
  server: { host: "127.0.0.1", port: 4173, strictPort: true },
});
