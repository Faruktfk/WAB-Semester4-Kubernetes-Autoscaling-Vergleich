import express from "express";
import client from "prom-client";

const app = express();
const register = new client.Registry();

// Default Node.js & process metrics (CPU, memory, GC, etc.)
client.collectDefaultMetrics({ register });

// Simple request counter & latency histogram
const httpRequests = new client.Counter({
  name: "app_http_requests_total",
  help: "Total HTTP requests",
  labelNames: ["route"]
});

const httpLatency = new client.Histogram({
  name: "app_http_request_duration_seconds",
  help: "Request duration seconds",
  labelNames: ["route"],
  buckets: [0.01, 0.05, 0.1, 0.3, 1, 3, 10]
});
register.registerMetric(httpRequests);
register.registerMetric(httpLatency);

// /cpu?ms=200 -> busy loop to burn CPU for N milliseconds
app.get("/cpu", (req, res) => {
  const ms = Math.max(0, parseInt(req.query.ms || "200", 10));
  const start = Date.now();
  while (Date.now() - start < ms) {
    // burn CPU
    Math.sqrt(Math.random() * Math.random());
  }
  httpRequests.inc({ route: "cpu" });
  httpLatency.observe({ route: "cpu" }, (Date.now() - start) / 1000);
  res.json({ ok: true, burned_ms: ms });
});

// /mem?mb=100&holdSec=15 -> allocate Buffer and hold it for N seconds
const holds = [];
app.get("/mem", (req, res) => {
  const mb = Math.max(1, parseInt(req.query.mb || "100", 10));
  const holdSec = Math.max(1, parseInt(req.query.holdSec || "15", 10));
  const size = mb * 1024 * 1024;
  const payload = Buffer.alloc(size, 1); // allocate
  const releaseAt = Date.now() + holdSec * 1000;
  holds.push({ payload, releaseAt });

  httpRequests.inc({ route: "mem" });
  httpLatency.observe({ route: "mem" }, 0);

  res.json({ ok: true, allocated_mb: mb, will_release_in_sec: holdSec });
});

// background releaser
setInterval(() => {
  const now = Date.now();
  for (let i = holds.length - 1; i >= 0; i--) {
    if (holds[i].releaseAt <= now) holds.splice(i, 1);
  }
}, 2000);

// Prometheus endpoint
app.get("/metrics", async (_req, res) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`server listening on ${PORT}`));