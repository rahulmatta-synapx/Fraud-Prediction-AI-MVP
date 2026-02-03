import express, { type Request, Response, NextFunction } from "express";
import { serveStatic } from "./static";
import { createServer } from "http";
import { spawn, ChildProcess } from "child_process";
import { createProxyMiddleware } from "http-proxy-middleware";

const app = express();
const httpServer = createServer(app);

let pythonProcess: ChildProcess | null = null;

function startPythonBackend(): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log("Starting Python backend on port 8000...");
    
    pythonProcess = spawn("python", [
      "-m", "uvicorn",
      "backend.app.main:app",
      "--host", "0.0.0.0",
      "--port", "8000",
      "--reload"
    ], {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env }
    });

    pythonProcess.stdout?.on("data", (data) => {
      const message = data.toString().trim();
      if (message) console.log(`[python] ${message}`);
      if (message.includes("Uvicorn running") || message.includes("Application startup complete")) {
        resolve();
      }
    });

    pythonProcess.stderr?.on("data", (data) => {
      const message = data.toString().trim();
      if (message) console.log(`[python] ${message}`);
      if (message.includes("Uvicorn running") || message.includes("Application startup complete")) {
        resolve();
      }
    });

    pythonProcess.on("error", (err) => {
      console.error("Failed to start Python backend:", err);
      reject(err);
    });

    pythonProcess.on("exit", (code) => {
      console.log(`Python backend exited with code ${code}`);
    });

    setTimeout(() => resolve(), 5000);
  });
}

process.on("exit", () => {
  if (pythonProcess) {
    pythonProcess.kill();
  }
});

process.on("SIGINT", () => {
  if (pythonProcess) {
    pythonProcess.kill();
  }
  process.exit();
});

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

(async () => {
  // Start the Python backend first
  try {
    await startPythonBackend();
    log("Python backend started successfully");
  } catch (error) {
    console.error("Warning: Python backend may not have started:", error);
  }

  // Create proxy middleware for API routes - add /api prefix back
  const apiProxy = createProxyMiddleware({
    target: "http://localhost:8000",
    changeOrigin: true,
    pathRewrite: (path) => `/api${path}`,  // Add /api prefix
  });

  // Create proxy middleware for auth routes - add /auth prefix back
  const authProxy = createProxyMiddleware({
    target: "http://localhost:8000",
    changeOrigin: true,
    pathRewrite: (path) => `/auth${path}`,  // Add /auth prefix
  });

  // Create proxy middleware for health routes
  const healthProxy = createProxyMiddleware({
    target: "http://localhost:8000",
    changeOrigin: true,
    pathRewrite: (path) => `/health${path}`,  // Add /health prefix
  });

  // Mount proxies
  app.use("/api", apiProxy);
  app.use("/auth", authProxy);
  app.use("/health", healthProxy);

  // Error handler
  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
