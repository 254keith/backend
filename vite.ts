import express, { Express } from "express";
import path from "path";

export function serveStatic(app: Express) {
  // Serve static files from a 'public' directory (customize as needed)
  app.use(express.static(path.join(process.cwd(), 'public')));
}

export async function setupVite(app: Express, server: any) {
  // No-op in backend-only mode
}

export function log(message: string) {
  console.log(message);
}
