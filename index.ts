import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import dotenv from "dotenv";
import path from "path";
import { safeErrorMessage } from "./lib/safeErrorMessage";

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

console.log('Environment:', {
  NODE_ENV: process.env.NODE_ENV,
  DATABASE_URL: process.env.DATABASE_URL ? '[set]' : '[missing]',
  GMAIL_USER: process.env.GMAIL_USER ? '[set]' : '[missing]'
});

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    // Register API routes first
    const server = await registerRoutes(app);

    // Setup Vite in development or serve static files in production after API routes
    if (process.env.NODE_ENV === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    // Enhanced error handling
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      log(`Error: ${status} - ${message} - ${err.stack || 'No stack trace'}`);

      res.status(status).json({ message });
      // Avoid throwing in production to prevent server crashes
      if (process.env.NODE_ENV !== 'production') {
        throw err;
      }
    });

    // Serve on port 5000
    const port = 5000;
    server.listen(port, '127.0.0.1', () => {
      log(`serving on http://localhost:${port}`);
    });
  } catch (err) {
    log(`Startup error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    process.exit(1);
  }
})();

