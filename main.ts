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
  const PORT = process.env.PORT || 8000;

  const app = express();
  const apiRoutes = express.Router();
  const pageRoutes = express.Router();

  app.use(express.json());
  app.use(cookieParser());
  app.use(authMiddleware(authService));
  app.use(express.static(path.join(__dirname, "public")));

  // API Routes
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
      const userId = req.user.id;
      try {
        const order = await db.createOrder(userId, items);
        res.status(201).json({ success: true, data: order });
      } catch (error) {
        res.status(400).json({ success: false, error: error.message });
      }
    },
  );

  apiRoutes.get("/orders", requireAuth, async (req: Request, res: Response) => {
    const userId = req.user.id;
    const orders = await db.getOrdersByUserId(userId);
    res.json({ success: true, data: orders });
  });

  // Static file serving
  pageRoutes.get("/", requireAuth, (req: Request, res: Response) => {
    res.redirect("/index.html");
  });

  pageRoutes.get("/index.html", requireAuth, (req: Request, res: Response) => {
    res.sendFile(path.join(__dirname, "index.html"));
    console.log("User accessed index.html");
  });

  pageRoutes.get("/login.html", (req: Request, res: Response) => {
    if (req.user) {
      res.redirect("/index.html");
      return;
    }
    res.sendFile(path.join(__dirname, "login.html"));
  });

  pageRoutes.get("/products.html", (req: Request, res: Response) => {
    res.sendFile(path.join(__dirname, "products.html"));
  });

  pageRoutes.get("/product.html", (req: Request, res: Response) => {
    res.sendFile(path.join(__dirname, "product.html"));
  });

  pageRoutes.get("/cart.html", (req: Request, res: Response) => {
    res.sendFile(path.join(__dirname, "cart.html"));
  });

  pageRoutes.get("/orders.html", requireAuth, (req: Request, res: Response) => {
    res.sendFile(path.join(__dirname, "orders.html"));
  });

  app.use("/", pageRoutes);
  app.use("/api", apiRoutes);

  app.listen(8000, () => {
    console.log("🚀 Authentication server starting on http://localhost:8000");
    console.log("📝 Login page: http://localhost:8000/login.html");
    console.log("🏠 Protected index: http://localhost:8000/index.html");
  });
}

// Start the server
startServer().catch(console.error);
