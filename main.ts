import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";
import { create, verify } from "https://deno.land/x/djwt@v3.0.2/mod.ts";
import { DB } from "https://deno.land/x/sqlite@v3.9.1/mod.ts";
import { application, Router } from "npm:express@5.1.0";

// =============================================================================
// TYPES AND SCHEMAS
// =============================================================================

const LoginSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(6).max(100),
});

const RegisterSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(6).max(100),
  email: z.string().email(),
});

type LoginRequest = z.infer<typeof LoginSchema>;
type RegisterRequest = z.infer<typeof RegisterSchema>;

interface User {
  id: number;
  username: string;
  email: string;
  password_hash: string;
  created_at: string;
}

interface Session {
  id: string;
  user_id: number;
  created_at: string;
  expires_at: string;
}

// =============================================================================
// DATABASE ABSTRACTION
// =============================================================================

interface DatabaseAdapter<T = any> {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  createUser(
    username: string,
    email: string,
    passwordHash: string,
  ): Promise<User>;
  getUserByUsername(username: string): Promise<User | null>;
  getUserById(id: number): Promise<User | null>;
  createSession(
    userId: number,
    sessionId: string,
    expiresAt: Date,
  ): Promise<void>;
  getSession(sessionId: string): Promise<Session | null>;
  deleteSession(sessionId: string): Promise<void>;
  deleteExpiredSessions(): Promise<void>;
}

class SqliteAdapter implements DatabaseAdapter<DB> {
  private db: DB;

  constructor(private dbPath: string = ":memory:") {
    this.db = new DB(this.dbPath);
  }

  async connect(): Promise<void> {
    // Create tables
    this.db.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    this.db.execute(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      )
    `);

    // Create indexes
    this.db.execute(
      `CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at)`,
    );
    this.db.execute(
      `CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)`,
    );
  }

  async disconnect(): Promise<void> {
    this.db.close();
  }

  async createUser(
    username: string,
    email: string,
    passwordHash: string,
  ): Promise<User> {
    const result = this.db.query(
      `INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?) RETURNING *`,
      [username, email, passwordHash],
    );

    if (result.length === 0) {
      throw new Error("Failed to create user");
    }

    const [id, un, em, ph, created_at] = result[0];
    return {
      id: id as number,
      username: un as string,
      email: em as string,
      password_hash: ph as string,
      created_at: created_at as string,
    };
  }

  async getUserByUsername(username: string): Promise<User | null> {
    const result = this.db.query(
      `SELECT * FROM users WHERE username = ?`,
      [username],
    );

    if (result.length === 0) return null;

    const [id, un, email, password_hash, created_at] = result[0];
    return {
      id: id as number,
      username: un as string,
      email: email as string,
      password_hash: password_hash as string,
      created_at: created_at as string,
    };
  }

  async getUserById(id: number): Promise<User | null> {
    const result = this.db.query(
      `SELECT * FROM users WHERE id = ?`,
      [id],
    );

    if (result.length === 0) return null;

    const [userId, username, email, password_hash, created_at] = result[0];
    return {
      id: userId as number,
      username: username as string,
      email: email as string,
      password_hash: password_hash as string,
      created_at: created_at as string,
    };
  }

  async createSession(
    userId: number,
    sessionId: string,
    expiresAt: Date,
  ): Promise<void> {
    this.db.query(
      `INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)`,
      [sessionId, userId, expiresAt.toISOString()],
    );
  }

  async getSession(sessionId: string): Promise<Session | null> {
    console.log("Fetching session:", sessionId);
    const result = this.db.query(
      `SELECT * FROM sessions WHERE id = ? AND expires_at > datetime('now')`,
      [sessionId],
    );

    if (result.length === 0) return null;

    const [id, user_id, created_at, expires_at] = result[0];
    return {
      id: id as string,
      user_id: user_id as number,
      created_at: created_at as string,
      expires_at: expires_at as string,
    };
  }

  async deleteSession(sessionId: string): Promise<void> {
    this.db.query(`DELETE FROM sessions WHERE id = ?`, [sessionId]);
  }

  async deleteExpiredSessions(): Promise<void> {
    this.db.query(`DELETE FROM sessions WHERE expires_at <= datetime('now')`);
  }
}

// =============================================================================
// JWT UTILITIES
// =============================================================================

const JWT_SECRET = await crypto.subtle.importKey(
  "raw",
  new TextEncoder().encode(
    "your-super-secret-jwt-key-change-this-in-production",
  ),
  { name: "HMAC", hash: "SHA-256" },
  false,
  ["sign", "verify"],
);

interface JWTPayload {
  sub: string; // user id
  iat: number;
  exp: number;
}

async function createJWT(userId: number): Promise<string> {
  const payload: JWTPayload = {
    sub: userId.toString(),
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 hours
  };

  return await create({ alg: "HS256", typ: "JWT" }, payload, JWT_SECRET);
}

async function verifyJWT(token: string): Promise<JWTPayload | null> {
  try {
    const payload = await verify(token, JWT_SECRET);
    return payload as JWTPayload;
  } catch {
    return null;
  }
}

// =============================================================================
// SESSION MANAGEMENT
// =============================================================================

class SessionManager {
  constructor(private db: DatabaseAdapter) {}

  generateSessionId(): string {
    return crypto.randomUUID();
  }

  async createSession(userId: number): Promise<string> {
    const sessionId = this.generateSessionId();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await this.db.createSession(userId, sessionId, expiresAt);
    return sessionId;
  }

  async validateSession(sessionId: string): Promise<User | null> {
    console.log("Validating session:", sessionId);
    const session = await this.db.getSession(sessionId);
    if (!session) return null;

    const user = await this.db.getUserById(session.user_id);
    return user;
  }

  async destroySession(sessionId: string): Promise<void> {
    await this.db.deleteSession(sessionId);
  }

  async cleanupExpiredSessions(): Promise<void> {
    await this.db.deleteExpiredSessions();
  }
}

// =============================================================================
// AUTHENTICATION SERVICE
// =============================================================================

class AuthService {
  constructor(
    private db: DatabaseAdapter,
    private sessionManager: SessionManager,
  ) {}

  async register(
    data: RegisterRequest,
  ): Promise<{ user: Omit<User, "password_hash">; token: string }> {
    // Check if user exists
    const existingUser = await this.db.getUserByUsername(data.username);
    if (existingUser) {
      throw new Error("Username already exists");
    }

    // Hash password
    const passwordHash = await bcrypt.hash(data.password);

    // Create user
    const user = await this.db.createUser(
      data.username,
      data.email,
      passwordHash,
    );

    // Create JWT token
    const token = await createJWT(user.id);

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        created_at: user.created_at,
      },
      token,
    };
  }

  async login(
    data: LoginRequest,
  ): Promise<
    { user: Omit<User, "password_hash">; token: string; sessionId: string }
  > {
    // Get user
    const user = await this.db.getUserByUsername(data.username);
    if (!user) {
      throw new Error("Invalid credentials");
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(
      data.password,
      user.password_hash,
    );
    if (!isValidPassword) {
      throw new Error("Invalid credentials");
    }

    // Create session
    const sessionId = await this.sessionManager.createSession(user.id);

    // Create JWT token
    const token = await createJWT(user.id);

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        created_at: user.created_at,
      },
      token,
      sessionId,
    };
  }

  async logout(sessionId: string): Promise<void> {
    await this.sessionManager.destroySession(sessionId);
  }

  async validateSession(sessionId: string): Promise<User | null> {
    console.log("Validating session in AuthService:", sessionId);
    return await this.sessionManager.validateSession(sessionId);
  }
}

// =============================================================================
// MIDDLEWARE
// =============================================================================

interface AuthContext {
  user?: User;
  sessionId?: string;
}

function authMiddleware(authService: AuthService) {
  return async (ctx: any, next: any) => {
    const sessionId = await ctx.cookies.get("session_id");

    if (sessionId) {
      const user = await authService.validateSession(sessionId);
      if (user) {
        ctx.state.user = user;
        ctx.state.sessionId = sessionId;
      }
    }

    await next();
  };
}

function requireAuth(ctx: any, next: any) {
  if (!ctx.state.user) {
    ctx.response.redirect("/login.html");
    return;
  }
  return next();
}

// =============================================================================
// SERVER SETUP
// =============================================================================

async function createServer() {
  // Initialize database
  const db = new SqliteAdapter("./auth.db");
  await db.connect();

  // Initialize services
  const sessionManager = new SessionManager(db);
  const authService = new AuthService(db, sessionManager);

  // Setup periodic cleanup
  setInterval(() => {
    sessionManager.cleanupExpiredSessions().catch(console.error);
  }, 60 * 60 * 1000); // Every hour

  const app = application;
  app.init();
  const router = Router();

  // Add auth middleware
  app.use(authMiddleware(authService));

  // API Routes
  router.post("/api/register", async (req, res) => {
    try {
      console.log("Register endpoint hit", ctx.request);
      const body = await ctx.request.stream;
      const data = RegisterSchema.parse(body);

      const result = await authService.register(data);

      ctx.response.status = 201;
      ctx.response.body = { success: true, data: result };
    } catch (error) {
      ctx.response.status = 400;
      ctx.response.body = { success: false, error: error.message };
      console.error("Registration error:", error);
    }
  });

  router.post("/api/login", async (ctx) => {
    try {
      const body = await ctx.request.body().value;
      const data = LoginSchema.parse(body);

      const result = await authService.login(data);

      // Set session cookie
      ctx.cookies.set("session_id", result.sessionId, {
        httpOnly: true,
        secure: false, // Set to true in production with HTTPS
        sameSite: "strict",
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      });

      ctx.response.status = 200;
      ctx.response.body = {
        success: true,
        data: { user: result.user, token: result.token },
      };
    } catch (error) {
      ctx.response.status = 401;
      ctx.response.body = { success: false, error: error.message };
    }
  });

  router.post("/api/logout", async (ctx) => {
    const sessionId = ctx.state.sessionId;
    if (sessionId) {
      await authService.logout(sessionId);
    }

    ctx.cookies.delete("session_id");
    ctx.response.body = { success: true };
  });

  router.get("/api/me", requireAuth, async (ctx) => {
    const user = ctx.state.user;
    ctx.response.body = {
      success: true,
      data: {
        id: user.id,
        username: user.username,
        email: user.email,
        created_at: user.created_at,
      },
    };
  });

  // Static file serving with auth protection
  router.get("/", requireAuth, async (ctx) => {
    ctx.response.redirect("/index.html");
  });

  router.get("/index.html", requireAuth, async (ctx) => {
    try {
      const content = await Deno.readTextFile("./index.html");
      ctx.response.headers.set("Content-Type", "text/html");
      ctx.response.body = content;
    } catch (error) {
      ctx.response.status = 404;
      ctx.response.body = "File not found";
    }
  });

  router.get("/login.html", async (ctx) => {
    // Redirect to index if already authenticated
    if (ctx.state.user) {
      ctx.response.redirect("/index.html");
      return;
    }

    try {
      const content = await Deno.readTextFile("./login.html");
      ctx.response.headers.set("Content-Type", "text/html");
      ctx.response.body = content;
    } catch (error) {
      ctx.response.status = 404;
      ctx.response.body = "File not found";
    }
  });

  app.use(router.routes());
  app.use(router.allowedMethods());

  return app;
}

// =============================================================================
// MAIN
// =============================================================================

if (import.meta.main) {
  const app = await createServer();

  console.log("🚀 Authentication server starting on http://localhost:8000");
  console.log("📝 Login page: http://localhost:8000/login.html");
  console.log("🏠 Protected index: http://localhost:8000/index.html");

  await app.listen({ port: 8000 });
}

