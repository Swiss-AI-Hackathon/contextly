import type { Handler } from "@netlify/functions";

const BASE = process.env.UBS_BACKEND_BASE || "http://74.242.217.219";

export const handler: Handler = async (event) => {
  try {
    const qs = event.queryStringParameters || {};
    const path = qs.path || "/";
    const targetUrl = new URL(path, BASE).toString();

    const init: RequestInit = { method: event.httpMethod };
    const headers: Record<string, string> = {};

    // Forward content-type if present
    if (event.headers && event.headers["content-type"]) {
      headers["Content-Type"] = event.headers["content-type"];
    }

    // Forward body
    if (event.body) {
      init.body = event.body;
    }

    init.headers = headers;

    const resp = await fetch(targetUrl, init as any);
    const text = await resp.text();

    // Mirror response content-type
    const contentType = resp.headers.get("content-type") || "application/json";

    return {
      statusCode: resp.status,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*",
        "Content-Type": contentType,
      },
      body: text,
    };
  } catch (err: any) {
    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ error: err?.message || String(err) }),
    };
  }
};
