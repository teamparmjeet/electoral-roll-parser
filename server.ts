import express, { Request, Response } from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { apiRouter } from "./server/routes";

const PORT = 3000;

async function startServer() {
  const app = express();

  app.use(express.json());

  // Mount API router
  app.use("/api", apiRouter);

  // Vite middleware in dev or static files in prod
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on port ${PORT}`);
  });

  const cleanup = () => {
    console.log("Shutting down server...");
    server.close();
    process.exit(0);
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
}

startServer();
