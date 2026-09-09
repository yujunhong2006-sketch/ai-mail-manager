// Static production UI and same-origin API proxy for the one-click workbench.
import { resolve, extname, sep } from "node:path";
const root = resolve(import.meta.dir, "../../packages/web/dist");
const apiPort = Number(process.env.API_PORT ?? 5531);
const webPort = Number(process.env.WEB_PORT ?? 5230);
const sockets = new Set<WebSocket>();
const server = Bun.serve<{ upstream: WebSocket; queue: string[] }>({
  hostname: "127.0.0.1", port: webPort,
  async fetch(req, self) {
    const url = new URL(req.url);
    if (!["localhost:" + webPort, "127.0.0.1:" + webPort].includes(url.host)) return new Response("Forbidden host", { status: 403 });
    if (url.pathname === "/local-health") return Response.json({ app: "ai-mail-manager-local", ok: true });
    if (url.pathname === "/local-stop" && req.method === "POST") {
      if (req.headers.get("authorization") !== "Bearer " + process.env.API_SECRET) return new Response("Unauthorized", { status: 401 });
      setTimeout(() => { server.stop(true); process.exit(0); }, 150);
      return Response.json({ ok: true });
    }
    if (url.pathname.startsWith("/api/")) {
      const target = "http://127.0.0.1:" + apiPort + url.pathname.slice(4) + url.search;
      if (req.headers.get("upgrade") === "websocket") {
        const upstream = new WebSocket(target.replace("http:", "ws:"));
        const ok = self.upgrade(req, { data: { upstream, queue: [] } });
        if (!ok) upstream.close();
        return ok ? undefined : new Response("Upgrade failed", { status: 400 });
      }
      const headers = new Headers(req.headers); headers.delete("host");
      try { return await fetch(target, { method: req.method, headers, body: ["GET", "HEAD"].includes(req.method) ? undefined : await req.arrayBuffer(), redirect: "manual" }); }
      catch { return Response.json({ error: "后台尚未启动，请稍后刷新。" }, { status: 503 }); }
    }
    if (url.pathname === "/setup") {
      const page = await Bun.file(resolve(import.meta.dir, "setup.html")).text();
      return new Response(page.replace("__LOCAL_API_TOKEN__", JSON.stringify(process.env.API_SECRET ?? "")), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Frame-Options": "DENY" } });
    }
    if (url.pathname === "/health") return Response.json({ app: "ai-mail-manager-local", ok: true });
    if (url.pathname === "/") return Response.redirect("/app/manager", 302);
    if (!url.pathname.startsWith("/app")) return new Response("Not found", { status: 404 });
    const relative = decodeURIComponent(url.pathname.replace(/^\/app\/?/, ""));
    if (relative.split(/[\\/]/).some(p => p === "..")) return new Response("Forbidden", { status: 403 });
    const candidate = resolve(root, relative);
    if (candidate !== root && !candidate.startsWith(root + sep)) return new Response("Forbidden", { status: 403 });
    const file = Bun.file(candidate);
    const content = extname(relative) ? file : Bun.file(resolve(root, "index.html"));
    if (!(await content.exists())) return new Response("Not found", { status: 404 });
    return new Response(content, { headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" } });
  },
  websocket: {
    open(ws) {
      const upstream = ws.data.upstream; sockets.add(upstream);
      upstream.onopen = () => { for (const msg of ws.data.queue) upstream.send(msg); ws.data.queue = []; };
      upstream.onmessage = (event) => ws.send(String(event.data));
      upstream.onclose = () => ws.close(); upstream.onerror = () => ws.close();
    },
    message(ws, raw) { const text = String(raw); if (ws.data.upstream.readyState === WebSocket.OPEN) ws.data.upstream.send(text); else ws.data.queue.push(text); },
    close(ws) { sockets.delete(ws.data.upstream); ws.data.upstream.close(); },
  },
});
console.log("Mail workbench: http://localhost:" + server.port + "/app/manager");
