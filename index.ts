import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import dotenv from "dotenv";
import path from "path";
import { safeErrorMessage } from "./lib/safeErrorMessage";

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

function devLog(...args: any[]) {
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.log(...args);
  }
}
function devError(...args: any[]) {
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.error(...args);
  }
}
function devWarn(...args: any[]) {
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.warn(...args);
  }
}

devLog('Environment:', {
  NODE_ENV: process.env.NODE_ENV,
  DATABASE_URL: process.env.DATABASE_URL ? '[set]' : '[missing]',
  GMAIL_USER: process.env.GMAIL_USER ? '[set]' : '[missing]'
});

const requiredEnv = [
  'DATABASE_URL',
  'GMAIL_USER',
  'GMAIL_PASS',
  'SESSION_SECRET',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'FRONTEND_URL',
  'ADMIN_CODE',
];
const missingEnv = requiredEnv.filter((key) => !process.env[key]);
if (missingEnv.length > 0) {
  devError('Missing required environment variables:', missingEnv.join(', '));
  process.exit(1);
}

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

    // Warn if not running behind HTTPS in production
    if (process.env.NODE_ENV === 'production' && process.env.FRONTEND_URL && !process.env.FRONTEND_URL.startsWith('https://')) {
      devWarn('WARNING: FRONTEND_URL does not use HTTPS. It is strongly recommended to use HTTPS in production.');
    }

    // Serve on port 5000
    const port = 5000;
    const host = process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1';
    server.listen(port, host, () => {
      log(`serving on http://${host}:${port}`);
    });
  } catch (err) {
    log(`Startup error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    process.exit(1);
  }
})();

