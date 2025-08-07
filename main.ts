// main.ts
import express, { Request, Response } from "express";
import cookieParser from "cookie-parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import process from "node:process";

// Define __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

import { LoginSchema, RegisterSchema, User } from "./schema.ts";

import { SqliteAdapter } from "./db.ts";
import {
  apiAuthMiddleware,
  AuthService,
  hybridAuthMiddleware,
  HybridSessionManager,
  JWTService,
  requireAuth,
} from "./auth.ts";

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
      roles?: "user" | "admin" | "guest"[]; // Optional roles for authorization
    }
  }
}

async function startServer() {
  const db = new SqliteAdapter();
  await db.connect();

  // JWT configuration
  const JWT_SECRET = process.env.JWT_SECRET ||
    "your-super-secret-jwt-key-change-in-production";
  const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ||
    "your-super-secret-refresh-key-change-in-production";

  // Initialize services
  const jwtService = new JWTService(JWT_SECRET, JWT_REFRESH_SECRET, db);
  const sessionManager = new HybridSessionManager(db, jwtService);
  const authService = new AuthService(db, sessionManager, jwtService);

  // Cleanup expired sessions
  setInterval(() => {
    sessionManager.cleanupExpiredSessions().catch(console.error);
  }, 60 * 60 * 1000);

  const PORT = process.env.PORT || 8000;

  const app = express();
  const apiRoutes = express.Router();
  const mobileApiRoutes = express.Router();
  const pageRoutes = express.Router();

  app.use(express.json());
  app.use(cookieParser());
  app.use(express.static(path.join(__dirname, "public")));

  // =============================================================================
  // WEB ROUTES (Cookie-based sessions)
  // =============================================================================

  // Web authentication middleware
  app.use(hybridAuthMiddleware(authService, { preferJWT: false }));

  // Web API Routes (supports both sessions and JWT)
  apiRoutes.post("/register", async (req: Request, res: Response) => {
    try {
      const data = RegisterSchema.parse(req.body);
      const result = await authService.register(data);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
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
      res.status(401).json({ success: false, error: error.message });
    }
  });

  apiRoutes.post("/logout", (req: Request, res: Response) => {
    const sessionId = req.sessionId;
    if (sessionId) {
      authService.logout(sessionId);
    }
    res.clearCookie("session_id");
    res.json({ success: true });
  });

  apiRoutes.get("/me", requireAuth, (req: Request, res: Response) => {
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
    const id = parseInt(req.params.id);
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
        res.status(400).json({ success: false, error: error.message });
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
  mobileApiRoutes.use(apiAuthMiddleware(authService));

  mobileApiRoutes.post("/login", async (req: Request, res: Response) => {
    try {
      const data = LoginSchema.parse(req.body);
      const result = await authService.loginWithJWT(data);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      res.status(401).json({ success: false, error: error.message });
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
      res.status(401).json({ success: false, error: error.message });
    }
  });

  mobileApiRoutes.post("/logout", async (req: Request, res: Response) => {
    try {
      const token = req.accessToken;
      if (token) {
        await authService.logoutJWT(token);
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
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
      res.status(400).json({ success: false, error: error.message });
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

 //  // =============================================================================
 //  // WEB PAGES (Session-based)
 //  // =============================================================================
 //
 //  // Static file serving
 //  pageRoutes.get("/", requireAuth, (req: Request, res: Response) => {
 //    res.redirect("/index.html");
 //  });
 //
 //  pageRoutes.get("/index.html", requireAuth, (req: Request, res: Response) => {
 //    res.sendFile(path.join(__dirname, "public", "html", "index.html"));
 //  });
 //
 //  pageRoutes.get("/login.html", (req: Request, res: Response) => {
 //    if (req.user) {
 //      res.redirect("/index.html");
 //      return;
 //    }
 //    res.sendFile(path.join(__dirname, "public", "html", "login.html"));
 //  });
 //
 //  pageRoutes.get("/products.html", (req: Request, res: Response) => {
 //    res.sendFile(path.join(__dirname, "public", "html", "products.html"));
 //  });
 //
 //  pageRoutes.get("/product.html", (req: Request, res: Response) => {
 //    res.sendFile(path.join(__dirname, "public", "html", "product.html"));
 //  });
 //
 //  pageRoutes.get("/cart.html", (req: Request, res: Response) => {
 //    res.sendFile(path.join(__dirname, "public", "html", "cart.html"));
 // });
 //
 //  pageRoutes.get("/orders.html", requireAuth, (req: Request, res: Response) => {
 //    res.sendFile(path.join(__dirname, "public", "html", "orders.html"));
 //  });
 //
  // Mount routes
  // app.use("/", pageRoutes);

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
