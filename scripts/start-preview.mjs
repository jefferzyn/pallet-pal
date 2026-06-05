import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const port = process.env.PORT || "4173";
const wrangler = require.resolve("wrangler/bin/wrangler.js");

const child = spawn(
  process.execPath,
  [wrangler, "dev", "--config", "dist/server/wrangler.json", "--ip", "0.0.0.0", "--port", port],
  {
    stdio: "inherit",
    shell: false,
  },
);

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
