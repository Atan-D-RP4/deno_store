// @ts-types="npm:@types/node"
import {
  Application,
  Context,
  Middleware,
  Router,
} from "https://deno.land/x/oak@v17.1.0/mod.ts";
import {
  create,
  getNumericDate,
  verify,
} from "https://deno.land/x/djwt@v3.0.2/mod.ts";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { DB } from "https://deno.land/x/sqlite@v3.9.1/mod.ts";

// =============================================================================
// SCHEMAS & TYPES
// =============================================================================

const LoginSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(6).max(100),
});

const RegisterSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email(),
  password: z.string().min(6).max(100),
});

const UserSchema = z.object({
  id: z.number(),
  username: z.string(),
  email: z.string(),
  password_hash: z.string(),
  created_at: z.date(),
});

type LoginRequest = z.infer<typeof LoginSchema>;
type RegisterRequest = z.infer<typeof RegisterSchema>;
type User = z.infer<typeof UserSchema>;
type UserWithoutPassword = Omit<User, "password_hash">;

interface JWTPayload {
  userId: number;
  username: string;
  iat?: number;
  exp?: number;
}

// =============================================================================
// DATABASE ABSTRACTION
// =============================================================================

interface DatabaseConnection {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  createUser(
    username: string,
    email: string,
    passwordHash: string,
  ): Promise<User>;
  getUserByUsername(username: string): Promise<User | null>;
  getUserById(id: number): Promise<User | null>;
  initTables(): Promise<void>;
}

class SQLiteConnection implements DatabaseConnection {
  private db: DB | null = null;

  async connect(): Promise<void> {
    this.db = new DB(":memory:");
  }

  async disconnect(): Promise<void> {
    if (this.db) {
      this.db.close();
    }
  }

  async initTables(): Promise<void> {
    if (!this.db) throw new Error("Database not connected");

    const sql = `
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    this.db.execute(sql);
  }

  async createUser(
    username: string,
    email: string,
    passwordHash: string,
  ): Promise<User> {
    if (!this.db) throw new Error("Database not connected");
    const sql =
      "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)";
    try {
      this.db.query(sql, [username, email, passwordHash]);
      const id = this.db.lastInsertRowId;
      const getUserSql =
        "SELECT id, username, email, password_hash, created_at FROM users WHERE id = ?";
      const rows = this.db.queryEntries(getUserSql, [id]);
      if (rows.length === 0) throw new Error("User not found after creation");
      const row = rows[0];
      return {
        id: row.id as number,
        username: row.username as string,
        email: row.email as string,
        password_hash: row.password_hash as string,
        created_at: new Date(row.created_at as string),
      };
    } catch (error) {
      throw new Error(
        "Failed to create user: " +
          (error instanceof Error ? error.message : "Unknown error"),
      );
    }
  }
  async getUserByUsername(username: string): Promise<User | null> {
    if (!this.db) throw new Error("Database not connected");

    const sql =
      "SELECT id, username, email, password_hash, created_at FROM users WHERE username = ?";
    const rows = this.db.queryEntries(sql, [username]);

    if (rows.length === 0) return null;

    const row = rows[0];
    return {
      id: row.id as number,
      username: row.username as string,
      email: row.email as string,
      password_hash: row.password_hash as string,
      created_at: new Date(row.created_at as string),
    };
  }

  async getUserById(id: number): Promise<User | null> {
    if (!this.db) throw new Error("Database not connected");

    const sql =
      "SELECT id, username, email, password_hash, created_at FROM users WHERE id = ?";
    const rows = this.db.queryEntries(sql, [id]);

    if (rows.length === 0) return null;

    const row = rows[0];
    return {
      id: row.id as number,
      username: row.username as string,
      email: row.email as string,
      password_hash: row.password_hash as string,
      created_at: new Date(row.created_at as string),
    };
  }
}

// Note: PostgreSQL and MySQL implementations would require different Deno modules
// For example: https://deno.land/x/postgres@v0.17.0/mod.ts for PostgreSQL
// and https://deno.land/x/mysql@v2.12.1/mod.ts for MySQL

// =============================================================================
// AUTHENTICATION SERVICE
// =============================================================================

class AuthService {
  private jwtSecret: string;

  constructor(
    private db: DatabaseConnection,
    jwtSecret: string = "your-super-secret-jwt-key-change-in-production",
  ) {
    this.jwtSecret = jwtSecret;
  }

  async hashPassword(password: string): Promise<string> {
    return await bcrypt.hash(password);
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return await bcrypt.compare(password, hash);
  }

  async generateToken(payload: JWTPayload): Promise<string> {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(this.jwtSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"],
    );

    return await create({ alg: "HS256", typ: "JWT" }, {
      ...payload,
      exp: getNumericDate(60 * 60 * 24), // 24 hours
    }, key);
  }

  async verifyToken(token: string): Promise<JWTPayload> {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(this.jwtSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"],
    );

    const payload = await verify(token, key);
    return payload as JWTPayload;
  }

  async register(
    data: RegisterRequest,
  ): Promise<{ user: UserWithoutPassword; token: string }> {
    // Validate input
    const validatedData = RegisterSchema.parse(data);

    // Check if user already exists
    const existingUser = await this.db.getUserByUsername(
      validatedData.username,
    );
    if (existingUser) {
      throw new Error("Username already exists");
    }

    // Hash password and create user
    const passwordHash = await this.hashPassword(validatedData.password);
    const user = await this.db.createUser(
      validatedData.username,
      validatedData.email,
      passwordHash,
    );

    // Generate token
    const tokenPayload: JWTPayload = {
      userId: user.id,
      username: user.username,
    };
    const token = await this.generateToken(tokenPayload);

    // Return user without password
    const { password_hash, ...userWithoutPassword } = user;
    return { user: userWithoutPassword, token };
  }

  async login(
    data: LoginRequest,
  ): Promise<{ user: UserWithoutPassword; token: string }> {
    // Validate input
    const validatedData = LoginSchema.parse(data);

    // Get user
    const user = await this.db.getUserByUsername(validatedData.username);
    if (!user) {
      throw new Error("Invalid credentials");
    }

    // Verify password
    const isValidPassword = await this.verifyPassword(
      validatedData.password,
      user.password_hash,
    );
    if (!isValidPassword) {
      throw new Error("Invalid credentials");
    }

    // Generate token
    const tokenPayload: JWTPayload = {
      userId: user.id,
      username: user.username,
    };
    const token = await this.generateToken(tokenPayload);

    // Return user without password
    const { password_hash, ...userWithoutPassword } = user;
    return { user: userWithoutPassword, token };
  }

  async validateToken(token: string): Promise<UserWithoutPassword> {
    try {
      const payload = await this.verifyToken(token);
      const user = await this.db.getUserById(payload.userId);

      if (!user) {
        throw new Error("User not found");
      }

      const { password_hash, ...userWithoutPassword } = user;
      return userWithoutPassword;
    } catch (error) {
      throw new Error("Invalid token");
    }
  }
}

// =============================================================================
// MIDDLEWARE
// =============================================================================

interface AuthenticatedContext extends Context {
  state: {
    user?: UserWithoutPassword;
  };
}

function createAuthMiddleware(authService: AuthService): Middleware {
  return async (ctx: AuthenticatedContext, next) => {
    try {
      const authHeader = ctx.request.headers.get("authorization");
      const cookieHeader = ctx.request.headers.get("cookie");

      let token = authHeader?.replace("Bearer ", "");

      // Try to get token from cookie if not in header
      if (!token && cookieHeader) {
        const cookies = cookieHeader.split(";").map((c) => c.trim());
        const authCookie = cookies.find((c) => c.startsWith("auth_token="));
        if (authCookie) {
          token = authCookie.split("=")[1];
        }
      }

      if (!token) {
        ctx.response.status = 401;
        ctx.response.body = { error: "No token provided" };
        return;
      }

      const user = await authService.validateToken(token);
      ctx.state.user = user;
      await next();
    } catch (error) {
      ctx.response.status = 401;
      ctx.response.body = { error: "Invalid token" };
    }
  };
}

function createValidationMiddleware<T extends z.ZodSchema>(
  schema: T,
): Middleware {
  return async (ctx: Context, next) => {
    try {
      const body = await ctx.request.body().value;
      ctx.request.body = () => ({ value: schema.parse(body) });
      await next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        ctx.response.status = 400;
        ctx.response.body = {
          error: "Validation failed",
          details: error.errors,
        };
      } else {
        ctx.response.status = 400;
        ctx.response.body = { error: "Invalid request data" };
      }
    }
  };
}

// =============================================================================
// APPLICATION SETUP
// =============================================================================

async function createApp(): Promise<Application> {
  const app = new Application();

  // Initialize database (using SQLite for this implementation)
  const db = new SQLiteConnection();
  await db.connect();
  await db.initTables();

  // Initialize auth service
  const authService = new AuthService(db);

  // Create auth middleware
  const authMiddleware = createAuthMiddleware(authService);

  // Router setup
  const router = new Router();

  // =============================================================================
  // ROUTES
  // =============================================================================

  // Serve login page for unauthenticated users
  router.get("/", async (ctx: AuthenticatedContext) => {
    const cookieHeader = ctx.request.headers.get("cookie");
    let hasToken = false;

    if (cookieHeader) {
      const cookies = cookieHeader.split(";").map((c) => c.trim());
      const authCookie = cookies.find((c) => c.startsWith("auth_token="));
      hasToken = !!authCookie;
    }

    if (!hasToken) {
      ctx.response.headers.set("content-type", "text/html");
      ctx.response.body = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Login</title>
            <style>
                body { font-family: Arial, sans-serif; max-width: 400px; margin: 100px auto; padding: 20px; }
                .form-group { margin-bottom: 15px; }
                label { display: block; margin-bottom: 5px; }
                input { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; }
                button { width: 100%; padding: 10px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; }
                button:hover { background: #0056b3; }
                .error { color: red; margin-top: 10px; }
                .tabs { margin-bottom: 20px; }
                .tab { display: inline-block; padding: 10px 20px; cursor: pointer; background: #f8f9fa; border: 1px solid #ddd; }
                .tab.active { background: #007bff; color: white; }
                .form { display: none; }
                .form.active { display: block; }
            </style>
        </head>
        <body>
            <div class="tabs">
                <div class="tab active" onclick="showForm('login')">Login</div>
                <div class="tab" onclick="showForm('register')">Register</div>
            </div>

            <form id="loginForm" class="form active" onsubmit="submitForm(event, 'login')">
                <h2>Login</h2>
                <div class="form-group">
                    <label>Username:</label>
                    <input type="text" name="username" required>
                </div>
                <div class="form-group">
                    <label>Password:</label>
                    <input type="password" name="password" required>
                </div>
                <button type="submit">Login</button>
                <div id="loginError" class="error"></div>
            </form>

            <form id="registerForm" class="form" onsubmit="submitForm(event, 'register')">
                <h2>Register</h2>
                <div class="form-group">
                    <label>Username:</label>
                    <input type="text" name="username" required>
                </div>
                <div class="form-group">
                    <label>Email:</label>
                    <input type="email" name="email" required>
                </div>
                <div class="form-group">
                    <label>Password:</label>
                    <input type="password" name="password" required>
                </div>
                <button type="submit">Register</button>
                <div id="registerError" class="error"></div>
            </form>

            <script>
                function showForm(type) {
                    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
                    document.querySelectorAll('.form').forEach(form => form.classList.remove('active'));

                    event.target.classList.add('active');
                    document.getElementById(type + 'Form').classList.add('active');
                }

                async function submitForm(event, type) {
                    event.preventDefault();
                    const form = event.target;
                    const formData = new FormData(form);
                    const data = Object.fromEntries(formData.entries());
					console.log("Submitting form data:", JSON.stringify(data));
					const request = new Request('/api/auth/' + type, {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify(data)
					});
					console.log("Request to server:", request);

                    try {
                        const response = await fetch(request);

                        const result = await response.json();
						console.log("Response from server:", result);

                        if (response.ok) {
                            document.cookie = 'auth_token=' + result.token + '; path=/; max-age=86400';
                            window.location.reload();
                        } else {
                            document.getElementById(type + 'Error').textContent = result.error || 'An error occurred';
                        }
                    } catch (error) {
                        document.getElementById(type + 'Error').textContent = 'Network error occurred';
                    }
                }
            </script>
        </body>
        </html>
      `;

      return;
    }

    // User has token, validate it and serve main page
    try {
      const cookieHeader = ctx.request.headers.get("cookie");
      const cookies = cookieHeader?.split(";").map((c) => c.trim()) || [];
      const authCookie = cookies.find((c) => c.startsWith("auth_token="));
      const token = authCookie?.split("=")[1];

      if (token) {
        const user = await authService.validateToken(token);
        ctx.response.headers.set("content-type", "text/html");
        ctx.response.body = `
          <!DOCTYPE html>
          <html lang="en">
          <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Protected Dashboard</title>
              <style>
                  body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
                  .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
                  .logout-btn { padding: 10px 20px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer; }
                  .logout-btn:hover { background: #c82333; }
                  .welcome { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
                  .features { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; }
                  .feature { background: white; padding: 20px; border: 1px solid #ddd; border-radius: 8px; }
              </style>
          </head>
          <body>
              <div class="header">
                  <h1>🎉 Welcome to Your Protected Dashboard!</h1>
                  <button class="logout-btn" onclick="logout()">Logout</button>
              </div>

              <div class="welcome">
                  <h2>Hello, ${user.username}!</h2>
                  <p>You have successfully authenticated and can now access this protected content.</p>
                  <p><strong>User ID:</strong> ${user.id}</p>
                  <p><strong>Email:</strong> ${user.email}</p>
                  <p><strong>Member since:</strong> ${user.created_at}</p>
              </div>

              <div class="features">
                  <div class="feature">
                      <h3>🔒 Type-Safe Authentication</h3>
                      <p>Built with TypeScript, Zod validation, and JWT tokens for secure authentication.</p>
                  </div>
                  <div class="feature">
                      <h3>🗄️ Database Abstraction</h3>
                      <p>Generic database interface supporting SQLite, PostgreSQL, and MySQL.</p>
                  </div>
                  <div class="feature">
                      <h3>⚡ Deno + Oak Powered</h3>
                      <p>Fast, secure runtime with comprehensive middleware support.</p>
                  </div>
                  <div class="feature">
                      <h3>🛡️ Security First</h3>
                      <p>Password hashing with bcrypt, secure JWT handling, and modern crypto APIs.</p>
                  </div>
              </div>

              <script>
                  function logout() {
                      document.cookie = 'auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT';
                      window.location.reload();
                  }
              </script>
          </body>
          </html>
        `;
      }
    } catch (error) {
      // Token invalid, show login page
      ctx.response.redirect("/");
    }
  });

  // Authentication API routes
  router.post("/api/auth/register", async (ctx: Context) => {
    try {
	  console.log("Register endpoint hit", ctx.request);
	  const body = await ctx.request.body.value;
      const validatedData = RegisterSchema.parse(body);
      const result = await authService.register(validatedData);

      ctx.response.status = 200;
      ctx.response.body = {
        success: true,
        user: result.user,
        token: result.token,
      };
    } catch (error) {
      ctx.response.status = 400;
      ctx.response.body = {
        error: error instanceof Error ? error.message : "Registration failed",
      };
    }
  });

  router.post("/api/auth/login", async (ctx: Context) => {
    try {
      const body = await ctx.request.body().value;
      const validatedData = LoginSchema.parse(body);
      const result = await authService.login(validatedData);

      ctx.response.status = 200;
      ctx.response.body = {
        success: true,
        user: result.user,
        token: result.token,
      };
    } catch (error) {
      ctx.response.status = 401;
      ctx.response.body = {
        error: error instanceof Error ? error.message : "Login failed",
      };
    }
  });

  router.post("/api/auth/logout", (ctx: Context) => {
    ctx.response.status = 200;
    ctx.response.body = { success: true, message: "Logged out successfully" };
  });

  // Protected API routes
  router.get(
    "/api/user/profile",
    authMiddleware,
    (ctx: AuthenticatedContext) => {
      ctx.response.body = {
        success: true,
        user: ctx.state.user,
      };
    },
  );

  // Health check
  router.get("/api/health", (ctx: Context) => {
    ctx.response.body = { status: "OK", timestamp: new Date().toISOString() };
  });

  app.use(router.routes());
  app.use(router.allowedMethods());

  return app;
}

// =============================================================================
// SERVER STARTUP
// =============================================================================

async function startServer(): Promise<void> {
  try {
    const app = await createApp();
    const PORT = Number(Deno.env.get("PORT")) || 3000;

    console.log(`🚀 Deno server running on http://localhost:${PORT}`);
    console.log(`📋 Features:`);
    console.log(`   • Type-safe authentication with Zod validation`);
    console.log(`   • JWT-based session management`);
    console.log(
      `   • Generic database abstraction (SQLite, PostgreSQL, MySQL)`,
    );
    console.log(`   • Protected routes with middleware`);
    console.log(`   • bcrypt password hashing`);
    console.log(`   • Built-in login/register UI`);
    console.log(`   • Deno runtime with Oak framework`);

    await app.listen({ port: PORT });
  } catch (error) {
    console.error("Failed to start server:", error);
    Deno.exit(1);
  }
}

// Start the server if this file is run directly
if (import.meta.main) {
  startServer();
}

export {
  AuthService,
  createApp,
  type DatabaseConnection,
  type JWTPayload,
  type LoginRequest,
  type RegisterRequest,
  SQLiteConnection,
  type User,
  type UserWithoutPassword,
};
