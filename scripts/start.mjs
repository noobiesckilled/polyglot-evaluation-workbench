import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { createGateway } from "../gateway/server.mjs";
import { resolve } from "node:path";

const token = process.env.WORKBENCH_TOKEN || randomBytes(24).toString("hex");
const apiPort = process.env.API_PORT || "8011";
const port = Number(process.env.PORT || 4173);
const child = spawn(
  process.env.PYTHON || (process.platform === "win32" ? "python" : "python3"),
  ["-m", "backend.server"],
  {
    cwd: resolve("."),
    env: {
      ...process.env,
      WORKBENCH_TOKEN: token,
      API_PORT: apiPort,
      API_HOST: "127.0.0.1",
    },
    stdio: ["ignore", "inherit", "inherit"],
  },
);
let gateway;
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  gateway?.close();
  child.kill();
  process.exitCode = code;
}
process.on("SIGTERM", () => stop());
process.on("SIGINT", () => stop());
child.on("error", (error) => {
  console.error("Python could not start:", error.message);
  stop(1);
});
child.on("exit", (code) => {
  if (code) console.error("The API process stopped.");
  stop(code || 0);
});
let ready = false;
for (let attempt = 0; attempt < 50; attempt++) {
  if (stopping) break;
  try {
    ready = (await fetch(`http://127.0.0.1:${apiPort}/api/health`)).ok;
  } catch {
    /* API still starting. */
  }
  if (ready) break;
  await new Promise((done) => setTimeout(done, 100));
}
if (!ready || stopping) {
  console.error("API startup failed");
  stop(1);
} else {
  gateway = createGateway({ backend: `http://127.0.0.1:${apiPort}` });
  gateway.on("error", (error) => {
    console.error("Gateway startup failed:", error.message);
    stop(1);
  });
  gateway.listen(port, process.env.HOST || "127.0.0.1", () => {
    console.log(`Workbench: http://localhost:${port}`);
    if (!process.env.WORKBENCH_TOKEN)
      console.log(`Local access token: ${token}`);
  });
}
