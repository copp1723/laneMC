import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config";
import { nanoid } from "nanoid";

const viteLogger = createLogger();

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  // In production, the built files should be in dist/public
  const distPath = path.resolve(process.cwd(), "dist", "public");
  const indexPath = path.resolve(distPath, "index.html");

  console.log(`🗂️  Static serving setup:`);
  console.log(`  - Working directory: ${process.cwd()}`);
  console.log(`  - Dist path: ${distPath}`);
  console.log(`  - Index path: ${indexPath}`);
  console.log(`  - Dist exists: ${fs.existsSync(distPath)}`);
  console.log(`  - Index exists: ${fs.existsSync(indexPath)}`);
  
  if (fs.existsSync(distPath)) {
    const files = fs.readdirSync(distPath);
    console.log(`  - Files in dist: ${files.join(', ')}`);
  }

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // Only serve index.html for non-API routes and non-static assets
  app.get("*", (req, res, next) => {
    // Skip API routes
    if (req.originalUrl.startsWith('/api/')) {
      return next();
    }

    // Skip static assets (js, css, images, fonts, etc.)
    if (req.originalUrl.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/)) {
      return next();
    }

    console.log(`📄 Serving index.html for: ${req.originalUrl}`);
    res.sendFile(indexPath);
  });
}
