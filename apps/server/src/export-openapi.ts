import { testAuthDependencies, testDependencies } from "@datadrive/application";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { buildApp } from "./app.js";

/** Writes the OpenAPI document of the running route definitions. Usage: node dist/export-openapi.js <file> */
async function exportOpenApi(target: string): Promise<void> {
  const deps = testDependencies();
  const app = await buildApp({ deps, auth: testAuthDependencies(deps) });
  await app.ready();
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify(app.swagger(), null, 2)}\n`);
  await app.close();
}

const target = process.argv[2];
if (target === undefined) throw new Error("Usage: export-openapi <output file>");
await exportOpenApi(target);
