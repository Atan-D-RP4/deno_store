import express, { Request, Response } from "express";
import cookieParser from "cookie-parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

// Define __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

import { LoginSchema, RegisterSchema } from "./schema.ts";

import { SqliteAdapter } from "./db.ts";
import {
  authMiddleware,
  AuthService,
  requireAuth,
  SessionManager,
} from "./auth.ts";

// =============================================================================
// SERVER SETUP
// =============================================================================

async function startServer() {
  const db = new SqliteAdapter();
  await db.connect();

  const sessionManager = new SessionManager(db);
  const authService = new AuthService(db, sessionManager);

  setInterval(() => {
    sessionManager.cleanupExpiredSessions().catch(console.error);
  }, 60 * 60 * 1000);

  const app = express();
  const route = express.Router();
  app.use(express.json());
  app.use(cookieParser());
  app.use(authMiddleware(authService));

  // API Routes
  route.post("/register", async (req: Request, res: Response) => {
    try {
      const data = RegisterSchema.parse(req.body);
      const result = await authService.register(data);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  route.post("/login", async (req: Request, res: Response) => {
    try {
      const data = LoginSchema.parse(req.body);
      const result = await authService.login(data);
      res.cookie("session_id", result.sessionId, {
        httpOnly: true,
        secure: false,
        sameSite: "strict",
        maxAge: 24 * 60 * 60 * 1000,
      });
      res.status(200).json({
        success: true,
        data: { user: result.user, token: result.token },
      });
    } catch (error) {
      res.status(401).json({ success: false, error: error.message });
    }
  });

  route.post("/logout", (req: Request, res: Response) => {
    const sessionId = req.sessionId;
    if (sessionId) {
      authService.logout(sessionId);
    }
    res.clearCookie("session_id");
    res.json({ success: true });
  });

  route.get("/me", requireAuth, (req: Request, res: Response) => {
    const user = req.user;
    res.json({
      success: true,
      data: {
        id: user.id,
        username: user.username,
        email: user.email,
        created_at: user.created_at,
      },
    });
  });

  app.use('/api', route);
  // Static file serving
  app.get("/", requireAuth, (req: Request, res: Response) => {
    res.redirect("/index.html");
  });

  app.get("/index.html", requireAuth, (req: Request, res: Response) => {
    res.sendFile(path.join(__dirname, "index.html"));
    console.log("User accessed index.html");
  });

  app.get("/login.html", (req: Request, res: Response) => {
    if (req.user) {
      res.redirect("/index.html");
      return;
    }
    res.sendFile(path.join(__dirname, "login.html"));
  });

  app.listen(8000, () => {
    console.log("🚀 Authentication server starting on http://localhost:8000");
    console.log("📝 Login page: http://localhost:8000/login.html");
    console.log("🏠 Protected index: http://localhost:8000/index.html");
  });
}

// Start the server
startServer().catch(console.error);
