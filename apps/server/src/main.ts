import { buildApp } from "./app.js";

const port = Number(process.env.SERVER_PORT ?? 3000);

buildApp()
  .listen({ port, host: "0.0.0.0" })
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
