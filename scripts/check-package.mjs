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

const typeCheck = `import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { RunelinkConnection, WsRequestSchema, validateHost } from "@runelink/sdk";
import type { WsRequest } from "@runelink/sdk";

const request: WsRequest = Schema.decodeUnknownSync(WsRequestSchema)({
  type: "ping",
});
const program = Effect.gen(function* () {
  const connection = yield* RunelinkConnection.RunelinkConnection;
  const reply = yield* connection.request({ type: "ping" });
  const pong: "pong" = reply.type;
  return pong;
});
const layer = RunelinkConnection.layer({ host: validateHost("localhost") });
`;

async function run(command, args, cwd) {
  const { stdout } = await execute(command, args, { cwd });
  return stdout;
}

async function checkPackage(directory) {
  await run(process.execPath, ["scripts/build.mjs"], root);
  // With npm 11, pack prints an array; npm 12 keys the result by package name.
  const output = await run(
    "npm",
    ["pack", "--json", "--ignore-scripts", "--pack-destination", directory],
    root
  );
  /** @type {{ filename: string, files: { path: string }[] }[]} */
  const [pack] = Object.values(JSON.parse(output));
  const files = pack.files.map((file) => file.path);
  const unexpected = files.filter(
    (file) => !allowedFiles.has(file) && !file.startsWith("dist/")
  );
  const missing = requiredFiles.filter((file) => !files.includes(file));
  if (unexpected.length > 0 || missing.length > 0) {
    throw new Error(
      `Unexpected packed files: ${unexpected.length === 0 ? "none" : unexpected.join(", ")}. ` +
        `Missing packed files: ${missing.length === 0 ? "none" : missing.join(", ")}.`
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
      'if (typeof RunelinkConnection.make !== "function") throw new Error("ESM import failed");\n'
  );
  await writeFile(
    path.join(consumer, "commonjs.cjs"),
    'const { RunelinkConnection } = require("@runelink/sdk");\n' +
      'if (typeof RunelinkConnection.make !== "function") throw new Error("CommonJS require failed");\n'
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

/** @param {unknown} error */
function reportPackageError(error) {
  if (typeof error === "object" && error !== null) {
    for (const key of ["stderr", "stdout"]) {
      const output = Reflect.get(error, key);
      if (typeof output === "string" && output.length > 0) {
        console.error(output);
        return;
      }
    }
  }
  console.error(error);
}

const directory = await mkdtemp(path.join(tmpdir(), "runelink-sdk-package-"));
try {
  await checkPackage(directory);
} catch (error) {
  reportPackageError(error);
  process.exitCode = 1;
} finally {
  await rm(directory, { recursive: true, force: true });
}
