import "dotenv/config";
import express from "express";
import cors from "cors";
import { handleDemo } from "./routes/demo";

export function createServer() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Example API routes
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });

  app.get("/api/demo", handleDemo);

  // Proxy route to UBS backend to avoid mixed-content/CORS issues in browser during dev
  app.all('/ubs-proxy', async (req, res) => {
    const UBS_BASE = process.env.UBS_BACKEND_BASE || 'http://74.242.217.219';
    try {
      const targetPath = req.query.path ? String(req.query.path) : req.path || '/';
      const targetUrl = new URL(targetPath, UBS_BASE).toString();

      const headers: Record<string, string> = {};
      for (const [k, v] of Object.entries(req.headers)) {
        if (!v) continue;
        if (k.toLowerCase() === 'host') continue;
        headers[k] = Array.isArray(v) ? v.join(',') : v as string;
      }

      const fetchOpts: any = { method: req.method, headers };
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        fetchOpts.body = JSON.stringify(req.body?.length ? req.body : req.body || undefined);
      }

      const resp = await fetch(targetUrl, fetchOpts);
      const contentType = resp.headers.get('content-type') || 'application/json';
      const text = await resp.text();
      res.setHeader('Content-Type', contentType);
      res.status(resp.status).send(text);
    } catch (e: any) {
      res.status(500).json({ error: e?.message || String(e) });
    }
  });

  return app;
}
