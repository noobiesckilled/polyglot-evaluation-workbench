import http from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { pathToFileURL } from "node:url";

const MAX_BODY = 32_768;
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
};

export function createGateway({
  backend = "http://127.0.0.1:8011",
  dist = resolve("dist"),
  rateLimit = 120,
} = {}) {
  const clients = new Map();
  const server = http.createServer(async (request, response) => {
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("X-Frame-Options", "DENY");
    response.setHeader("Referrer-Policy", "no-referrer");
    response.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    );
    const fail = (status, error) => {
      if (!response.headersSent) {
        response.writeHead(status, {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        });
        response.end(JSON.stringify({ error }));
      }
    };
    try {
      if (request.headers.origin) {
        let origin;
        try {
          origin = new URL(request.headers.origin);
        } catch {
          return fail(403, "Origin denied");
        }
        if (
          origin.host !== request.headers.host ||
          !["http:", "https:"].includes(origin.protocol)
        )
          return fail(403, "Origin denied");
      }
      const url = new URL(request.url, "http://localhost");
      if (url.pathname.startsWith("/api/")) {
        if (url.pathname !== "/api/health") {
          const now = Date.now();
          const key = request.socket.remoteAddress;
          for (const [address, entry] of clients)
            if (entry.reset <= now) clients.delete(address);
          const entry = clients.get(key) || { count: 0, reset: now + 60_000 };
          if (clients.size >= 1000 && !clients.has(key))
            return fail(429, "Gateway request capacity reached");
          clients.set(key, entry);
          if (++entry.count > rateLimit) {
            response.setHeader(
              "Retry-After",
              String(Math.ceil((entry.reset - now) / 1000)),
            );
            return fail(
              429,
              "Too many requests; retry after the rate-limit window",
            );
          }
        }
        if (!["GET", "POST", "PATCH"].includes(request.method))
          return fail(405, "Method not allowed");
        if (
          !/^\/api\/(health|catalog|runs(?:\/[a-f0-9]{32}(?:\/review)?)?)$/.test(
            url.pathname,
          ) ||
          url.search
        )
          return fail(404, "Route not found");
        const parts = [];
        let size = 0;
        for await (const chunk of request) {
          size += chunk.length;
          if (size > MAX_BODY) {
            fail(413, "Request body too large");
            request.resume();
            return;
          }
          parts.push(chunk);
        }
        const upstream = await fetch(backend + url.pathname, {
          method: request.method,
          headers: {
            Authorization: request.headers.authorization || "",
            "Content-Type": request.headers["content-type"] || "",
          },
          body: request.method === "GET" ? undefined : Buffer.concat(parts),
          signal: AbortSignal.timeout(40_000),
          redirect: "error",
        });
        response.writeHead(upstream.status, {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store",
          "X-Request-ID": upstream.headers.get("X-Request-ID") || "",
        });
        response.end(await upstream.text());
        return;
      }
      if (!["GET", "HEAD"].includes(request.method))
        return fail(405, "Method not allowed");
      const pathname = decodeURIComponent(url.pathname);
      const filename = pathname === "/" ? "index.html" : pathname.slice(1);
      const fullPath = resolve(dist, filename);
      if (
        !fullPath.startsWith(resolve(dist) + sep) ||
        filename.includes("\\") ||
        filename.includes("\0")
      )
        return fail(403, "Path denied");
      let contents;
      try {
        contents = await readFile(fullPath);
      } catch {
        return fail(404, "File not found");
      }
      response.writeHead(200, {
        "Content-Type": MIME[extname(fullPath)] || "application/octet-stream",
        "Cache-Control": filename.startsWith("assets/")
          ? "public, max-age=31536000, immutable"
          : "no-cache",
      });
      response.end(request.method === "HEAD" ? undefined : contents);
    } catch (error) {
      if (error instanceof URIError) return fail(400, "Malformed request path");
      fail(
        error.name === "TimeoutError" ? 504 : 502,
        "The evaluation service is unavailable. Please retry.",
      );
    }
  });
  server.requestTimeout = 45_000;
  server.headersTimeout = 10_000;
  return server;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const server = createGateway({
    backend: process.env.API_URL,
    dist: process.env.DIST_PATH || resolve("dist"),
  });
  server.requestTimeout = 45_000;
  server.headersTimeout = 10_000;
  server.listen(
    Number(process.env.PORT || 4173),
    process.env.HOST || "127.0.0.1",
    () => console.log("Workbench gateway ready"),
  );
}
