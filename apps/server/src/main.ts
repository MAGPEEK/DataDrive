import { InMemoryNodeRepository } from "@datadrive/application";
import { randomUUID } from "node:crypto";
import { buildApp } from "./app.js";

const port = Number(process.env.SERVER_PORT ?? 3000);

// Authentication arrives with the accounts feature; until then every API call is rejected.
const app = buildApp({
  deps: {
    nodes: new InMemoryNodeRepository(),
    clock: { now: () => new Date() },
    ids: { next: () => randomUUID() },
  },
  authenticate: () => null,
});

app.listen({ port, host: "0.0.0.0" }).catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
