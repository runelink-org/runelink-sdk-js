import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const root = fileURLToPath(new URL("../", import.meta.url));
const tsc = fileURLToPath(
  new URL("../node_modules/typescript/bin/tsc", import.meta.url)
);
const execute = promisify(execFile);
const allowedFiles = new Set(["LICENSE", "README.md", "package.json"]);
const requiredFiles = [
  "LICENSE",
  "dist/index.js",
  "dist/index.cjs",
  "dist/types/esm/index.d.ts",
  "dist/types/commonjs/index.d.ts",
  "dist/types/commonjs/package.json",
];

const typeCheck = `import { RunelinkConnection, WsRequestSchema } from "@runelink/sdk";
import type { WsRequest } from "@runelink/sdk";

const request: WsRequest = WsRequestSchema.parse({ type: "ping" });
const connection: RunelinkConnection = new RunelinkConnection("localhost");
void request;
void connection;
`;

async function run(command, args, cwd) {
  const { stdout } = await execute(command, args, { cwd });
  return stdout;
}

async function checkPackage(directory) {
  await run(process.execPath, ["scripts/build.mjs"], root);
  // npm 11 prints an array; npm 12 keys the result by package name.
  const [pack] = Object.values(
    JSON.parse(
      await run(
        "npm",
        ["pack", "--json", "--ignore-scripts", "--pack-destination", directory],
        root
      )
    )
  );
  const files = pack.files.map(function (file) {
    return file.path;
  });
  const unexpected = files.filter(function (file) {
    return !allowedFiles.has(file) && !file.startsWith("dist/");
  });
  const missing = requiredFiles.filter(function (file) {
    return !files.includes(file);
  });
  if (unexpected.length > 0 || missing.length > 0) {
    throw new Error(
      `Unexpected packed files: ${unexpected.join(", ") || "none"}. ` +
        `Missing packed files: ${missing.join(", ") || "none"}.`
    );
  }

  const consumer = path.join(directory, "consumer");
  await mkdir(consumer);
  await writeFile(
    path.join(consumer, "package.json"),
    '{"name":"consumer","private":true,"type":"module"}\n'
  );
  await run(
    "npm",
    [
      "install",
      "--no-audit",
      "--no-fund",
      "--ignore-scripts",
      path.join(directory, pack.filename),
    ],
    consumer
  );

  await writeFile(
    path.join(consumer, "esm.mjs"),
    'import { RunelinkConnection } from "@runelink/sdk";\n' +
      'if (typeof RunelinkConnection !== "function") throw new Error("ESM import failed");\n'
  );
  await writeFile(
    path.join(consumer, "commonjs.cjs"),
    'const { RunelinkConnection } = require("@runelink/sdk");\n' +
      'if (typeof RunelinkConnection !== "function") throw new Error("CommonJS require failed");\n'
  );
  await run(process.execPath, ["esm.mjs"], consumer);
  await run(process.execPath, ["commonjs.cjs"], consumer);

  // Check both the ESM and CommonJS declaration entry points.
  await writeFile(path.join(consumer, "esm.mts"), typeCheck);
  await writeFile(path.join(consumer, "commonjs.cts"), typeCheck);
  await writeFile(
    path.join(consumer, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        module: "nodenext",
        moduleResolution: "nodenext",
        target: "es2022",
        strict: true,
        noEmit: true,
        types: [],
      },
      files: ["esm.mts", "commonjs.cts"],
    })
  );
  await run(process.execPath, [tsc, "--project", "tsconfig.json"], consumer);

  console.log(`Checked ${pack.filename} (${files.length} files).`);
}

const directory = await mkdtemp(path.join(tmpdir(), "runelink-sdk-package-"));
try {
  await checkPackage(directory);
} catch (error) {
  console.error(error.stderr || error.stdout || error);
  process.exitCode = 1;
} finally {
  await rm(directory, { recursive: true, force: true });
}
