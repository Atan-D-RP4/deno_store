import { NextFunction, Request, Response } from "express";
import bcrypt from "bcrypt";

import { LoginRequest, RegisterRequest, User } from "./schema.ts";
import { DatabaseAdapter } from "./db.ts";
import { JWTService } from "./jwt.ts";
import { SessionManager } from "./session.ts";
import process from "node:process";

// =============================================================================
// ENHANCED AUTH SERVICE
// =============================================================================
export class AuthService {
  constructor(
    private db: DatabaseAdapter,
    private sessionManager: SessionManager,
    private jwtService: JWTService,
  ) {}

  async register(
    data: RegisterRequest,
  ): Promise<{ user: Omit<User, "password_hash"> }> {
    const existingUser = await this.db.getUserByUsername(data.username);
    if (existingUser) {
      throw new Error("Username already exists");
    }
    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = await this.db.createUser(
      data.username,
      data.email,
      passwordHash,
    );

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        created_at: user.created_at,
        role: user.role || "user",
      },
    };
  }

  // Traditional session login
  async loginWithSession(data: LoginRequest): Promise<{
    user: Omit<User, "password_hash">;
    sessionId: string;
  }> {
    const user = await this.authenticateUser(data);
    const sessionId = await this.sessionManager.createSession(user.id);

    return {
      user: this.sanitizeUser(user),
      sessionId,
    };
  }

  // JWT login for APIs/mobile
  async loginWithJWT(data: LoginRequest): Promise<{
    user: Omit<User, "password_hash">;
    accessToken: string;
    refreshToken: string;
  }> {
    const user = await this.authenticateUser(data);
    const tokens = this.sessionManager.createJWTSession(user);

    return {
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  private async authenticateUser(data: LoginRequest): Promise<User> {
    const user = await this.db.getUserByUsername(data.username);
    if (!user) {
      throw new Error("Invalid credentials");
    }

    const isValidPassword = await bcrypt.compare(
      data.password,
      user.password_hash,
    );
    if (!isValidPassword) {
      throw new Error("Invalid credentials");
    }

    return user;
  }

  private sanitizeUser(user: User): Omit<User, "password_hash"> {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      created_at: user.created_at,
      role: user.role || "user",
    };
  }

  async logout(sessionId: string): Promise<void> {
    await this.sessionManager.destroySession(sessionId);
  }

  async logoutJWT(token: string): Promise<void> {
    await this.sessionManager.destroyJWTSession(token);
  }

  async validateSession(sessionId: string): Promise<User | null> {
    return await this.sessionManager.validateSession(sessionId);
  }

  async validateJWTSession(
    token: string,
    requireDbCheck = false,
  ): Promise<User | null> {
    return await this.sessionManager.validateJWTSession(token, requireDbCheck);
  }

  async refreshTokens(
    refreshToken: string,
  ): Promise<{ accessToken: string; refreshToken: string } | null> {
    return await this.sessionManager.refreshJWTTokens(refreshToken);
  }
}

// =============================================================================
// FLEXIBLE MIDDLEWARE
// =============================================================================
export function AuthMiddleware(
  authService: AuthService,
  options: {
    preferJWT?: boolean;
    requireDbCheck?: boolean;
  } = {},
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    let user: User | null = null;
    let sessionId: string | undefined;

    // Try JWT first (for API/mobile)
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      user = await authService.validateJWTSession(
        token,
        options.requireDbCheck,
      );
      req.authType = "jwt";
      req.accessToken = token;
    }

    // Fallback to cookie session (for web)
    if (!user && !options.preferJWT) {
      sessionId = req.cookies.session_id;
      if (sessionId) {
        user = await authService.validateSession(sessionId);
        req.authType = "session";
        req.sessionId = sessionId;
      }
    }

    if (user) {
      req.user = user;
    }

    next();
  };
}

// Middleware for microservices (JWT only, no DB checks)
export function microserviceAuthMiddleware(jwtService: JWTService) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No token provided" });
    }

    const token = authHeader.substring(7);
    const payload = jwtService.verifyTokenStateless(token);

    if (!payload) {
      return res.status(401).json({ error: "Invalid token" });
    }

    // Create user object from token data
    req.user = {
      id: payload.userId,
      username: payload.username,
      role: payload.roles || "user",
      email: "", // Not included in stateless token
      created_at: new Date().toDateString(),
      password_hash: "", // Not included in stateless token
    };

    next();
  };
}

// API-only middleware (JWT required)
export function apiAuthMiddleware(authService: AuthService) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Bearer token required" });
    }

    const token = authHeader.substring(7);
    const user = await authService.validateJWTSession(token);

    if (!user) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    req.user = user;
    req.accessToken = token;
    next();
  };
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    // Determine if this is an API call. When used inside a router (e.g. app.use('/api', router)),
    // req.path is relative (e.g. '/orders'), so use originalUrl/baseUrl checks instead.
    const originalUrl = req.originalUrl || "";
    const baseUrl = req.baseUrl || "";
    const acceptsJson = (req.headers.accept || "").includes("application/json");
    const isApi = originalUrl.startsWith("/api") ||
      baseUrl.startsWith("/api") || acceptsJson;

    if (isApi) {
      return res.status(401).json({
        success: false,
        error: "Authentication required",
      });
    }

    // Non-API browser request: redirect to your Next.js app's login page
    const nextBase = process.env.NEXT_BASE_URL || "http://localhost:3000"; // e.g. https://app.example.com
    return res.redirect(302, `${nextBase}/login`);
  }
  next();
}
