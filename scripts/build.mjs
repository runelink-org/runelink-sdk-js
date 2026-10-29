import { execFile } from "node:child_process";
import { watch } from "node:fs";
import { cp, mkdtemp, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { build } from "esbuild";

const root = fileURLToPath(new URL("../", import.meta.url));
const tsc = fileURLToPath(
  new URL("../node_modules/typescript/bin/tsc", import.meta.url)
);
const execute = promisify(execFile);
const watchMode = process.argv.includes("--watch");

async function buildPackage() {
  const staging = await mkdtemp(path.join(root, "node_modules/.sdk-build-"));
  try {
    const esmTypes = path.join(staging, "types/esm");
    const commonjsTypes = path.join(staging, "types/commonjs");
    await execute(
      process.execPath,
      [tsc, "--project", "tsconfig.json", "--outDir", esmTypes],
      { cwd: root }
    );
    await cp(esmTypes, commonjsTypes, { recursive: true });
    await writeFile(
      path.join(commonjsTypes, "package.json"),
      '{"type":"commonjs"}\n'
    );
    await Promise.all(
      ["esm", "cjs"].map(function (format) {
        return build({
          absWorkingDir: root,
          entryPoints: ["src/index.ts"],
          outfile: path.join(
            staging,
            format === "esm" ? "index.js" : "index.cjs"
          ),
          bundle: true,
          packages: "external",
          platform: "neutral",
          target: "es2022",
          format,
          minify: true,
        });
      })
    );
    // Keep the last working package available until the new build succeeds.
    const dist = path.join(root, "dist");
    await rm(dist, { recursive: true, force: true });
    await rename(staging, dist);
    console.log("Built SDK JavaScript and declarations.");
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}

if (watchMode) {
  let timer;
  let building = false;
  let pending = false;

  async function rebuild() {
    pending = true;
    if (building) return;
    building = true;
    while (pending) {
      pending = false;
      try {
        await buildPackage();
      } catch (error) {
        console.error(error.stdout || error);
      }
    }
    building = false;
  }

  function scheduleBuild() {
    clearTimeout(timer);
    timer = setTimeout(rebuild, 75);
  }

  watch(new URL("../src", import.meta.url), { recursive: true }, scheduleBuild);
  watch(root, function (_event, filename) {
    if (filename === "tsconfig.json") scheduleBuild();
  });
  await rebuild();
} else {
  try {
    await buildPackage();
  } catch (error) {
    console.error(error.stdout || error);
    process.exitCode = 1;
  }
}
