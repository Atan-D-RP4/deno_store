// main.ts
import express, { Request, Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import process from "node:process";

// Define __dirname for ES modules
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

import { LoginSchema, RegisterSchema, User } from "./schema.ts";

import { SqliteAdapter } from "./db.ts";
import {
  apiAuthMiddleware,
  AuthMiddleware,
  AuthService,
  requireAuth,
} from "./auth.ts";

import { JWTService } from "./jwt.ts";
import { SessionManager } from "./session.ts";

// =============================================================================
// SERVER SETUP
// =============================================================================

declare global {
  namespace Express {
    interface Request {
      user?: User;
      sessionId?: string;
      accessToken?: string;
      authType?: "session" | "jwt";
      roles?: "user" | "admin" | "guest"; // Optional roles for authorization
    }
  }
}

async function startServer() {
  const db = new SqliteAdapter();
  await db.connect();

  // JWT configuration
  const JWT_SECRET = Deno.env.get("JWT_SECRET") ||
    "your-super-secret-jwt-key-change-in-production";
  const JWT_REFRESH_SECRET = Deno.env.get("JWT_REFRESH_SECRET") ||
    "your-super-secret-refresh-key-change-in-production";

  // Initialize services
  const jwtService = new JWTService(JWT_SECRET, JWT_REFRESH_SECRET, db);
  const sessionManager = new SessionManager(db, jwtService);
  const authService = new AuthService(db, sessionManager, jwtService);

  // Cleanup expired sessions
  setInterval(() => {
    sessionManager.deleteExpiredSessions().catch(console.error);
  }, 60 * 60 * 1000);

  const PORT = process.env.PORT || 8000;
  const UI_ORIGIN = Deno.env.get("UI_ORIGIN") || "http://localhost:3000"; // change in prod

  const app = express();
  const apiRoutes = express.Router();
  const mobileApiRoutes = express.Router();

  app.use(express.json());
  app.use(cookieParser());

  app.use(
    cors({
      origin: UI_ORIGIN, // must match the Next.js app origin exactly
      credentials: true, // allow cookies / Authorization headers
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    }),
  );

  // =============================================================================
  // WEB ROUTES (Cookie-based sessions)
  // =============================================================================

  // Attach auth middleware for web/API routes to populate req.user from cookie session
  apiRoutes.use(AuthMiddleware(authService, { preferJWT: false }));

  // Web API Routes (supports both sessions and JWT)
  apiRoutes.post("/register", async (req: Request, res: Response) => {
    try {
      const data = RegisterSchema.parse(req.body);
      const result = await authService.register(data);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      const err = error as Error;
      res.status(400).json({ success: false, error: err.message });
    }
  });

  apiRoutes.post("/login", async (req: Request, res: Response) => {
    try {
      const data = LoginSchema.parse(req.body);
      const result = await authService.loginWithSession(data);
      res.cookie("session_id", result.sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 24 * 60 * 60 * 1000,
      });
      res.status(200).json({
        success: true,
        data: { user: result.user },
      });
    } catch (error) {
      const err = error as Error;
      res.status(401).json({ success: false, error: err.message });
    }
  });

  apiRoutes.post("/logout", async (req: Request, res: Response) => {
    const sessionId = req.sessionId;
    if (sessionId) {
      await authService.logout(sessionId);
    }
    res.clearCookie("session_id");
    res.json({ success: true });
  });

  apiRoutes.get("/me", requireAuth, async (req: Request, res: Response) => {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }
    res.json({
      success: true,
      data: {
        id: user.id,
        username: user.username,
        email: user.email,
        created_at: user.created_at,
        role: user.role || "guest", // Default to guest if no role
      },
    });
  });

  apiRoutes.get("/products", async (req: Request, res: Response) => {
    const products = await db.getAllProducts();
    res.json({ success: true, data: products });
  });

  apiRoutes.get("/products/:id", async (req: Request, res: Response) => {
    const id = Number.parseInt(req.params.id);
    if (Number.isNaN(id) || Number.isFinite(id) === false || id <= 0) {
      return res.status(400).json({
        success: false,
        error: "Invalid product ID",
      });
    }
    const product = await db.getProductById(id);
    if (product) {
      res.json({ success: true, data: product });
    } else {
      res.status(404).json({ success: false, error: "Product not found" });
    }
  });

  apiRoutes.post(
    "/orders",
    requireAuth,
    async (req: Request, res: Response) => {
      const { items } = req.body; // Expect [{ productId, quantity }]
      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
          success: false,
          error: "Invalid order items",
        });
      }
      const user = req.user;
      if (!user) {
        return res.status(401).json({ success: false, error: "Unauthorized" });
      }
      try {
        const order = await db.createOrder(user.id, items);
        res.status(201).json({ success: true, data: order });
      } catch (error) {
        const err = error as Error;
        res.status(400).json({ success: false, error: err.message });
      }
    },
  );

  apiRoutes.get("/orders", requireAuth, async (req: Request, res: Response) => {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }
    const userId = user.id;
    const orders = await db.getOrdersByUserId(userId);
    res.json({ success: true, data: orders });
  });

  // =============================================================================
  // MOBILE/API ROUTES (JWT-based)
  // =============================================================================

  // Mobile API Routes (JWT only)
  mobileApiRoutes.post("/login", async (req: Request, res: Response) => {
    try {
      const data = LoginSchema.parse(req.body);
      const result = await authService.loginWithJWT(data);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      const err = error as Error;
      res.status(401).json({ success: false, error: err.message });
    }
  });

  mobileApiRoutes.post("/refresh", async (req: Request, res: Response) => {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken) {
        return res.status(400).json({
          success: false,
          error: "Refresh token required",
        });
      }

      const tokens = await authService.refreshTokens(refreshToken);
      if (!tokens) {
        return res.status(401).json({
          success: false,
          error: "Invalid refresh token",
        });
      }

      res.json({ success: true, data: tokens });
    } catch (error) {
      const err = error as Error;
      res.status(401).json({ success: false, error: err.message });
    }
  });

  // Apply JWT auth middleware to mobile API routes
  mobileApiRoutes.use(apiAuthMiddleware(authService));

  mobileApiRoutes.post("/logout", async (req: Request, res: Response) => {
    try {
      const token = req.accessToken;
      if (token) {
        await authService.logoutJWT(token);
      }
      res.json({ success: true });
    } catch (error) {
      const err = error as Error;
      res.status(500).json({ success: false, error: err.message });
    }
  });

  mobileApiRoutes.get("/me", (req: Request, res: Response) => {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }
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

  mobileApiRoutes.get("/products", async (req: Request, res: Response) => {
    const products = await db.getAllProducts();
    res.json({ success: true, data: products });
  });

  mobileApiRoutes.get("/products/:id", async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    const product = await db.getProductById(id);
    if (product) {
      res.json({ success: true, data: product });
    } else {
      res.status(404).json({ success: false, error: "Product not found" });
    }
  });

  mobileApiRoutes.post("/orders", async (req: Request, res: Response) => {
    const { items } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Invalid order items",
      });
    }
    const user = req.user;
    if (!user) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }
    try {
      const order = await db.createOrder(user.id, items);
      res.status(201).json({ success: true, data: order });
    } catch (error) {
      const err = error as Error;
      res.status(400).json({ success: false, error: err.message });
    }
  });

  mobileApiRoutes.get("/orders", async (req: Request, res: Response) => {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }
    const orders = await db.getOrdersByUserId(user.id);
    res.json({ success: true, data: orders });
  });

  app.use("/api", apiRoutes);
  app.use("/api/mobile", mobileApiRoutes); // JWT-only routes for mobile

  app.listen(PORT, () => {
    console.log(
      "🚀 Enhanced Authentication server starting on http://localhost:8000",
    );
    console.log("📝 Web Login page: http://localhost:8000/login.html");
    console.log("🏠 Protected index: http://localhost:8000/index.html");
    console.log("📱 Mobile API: http://localhost:8000/api/mobile/");
    console.log("🌐 Web API: http://localhost:8000/api/");
    console.log(
      "⚠️  Remember to set JWT_SECRET and JWT_REFRESH_SECRET in production!",
    );
  });
}

// Start the server
startServer().catch(console.error);
