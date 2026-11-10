import { fileURLToPath } from "node:url";
import { build } from "vite";

const pathFromRoot = (name) => fileURLToPath(new URL("../" + name, import.meta.url));
await build({
  root: pathFromRoot("deploy/vercel"),
  publicDir: pathFromRoot("public"),
  configFile: false,
  css: { postcss: { plugins: [] } },
  build: { outDir: pathFromRoot("dist-vercel"), emptyOutDir: true },
});
