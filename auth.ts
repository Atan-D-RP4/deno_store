import { NextFunction, Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import { LoginRequest, RegisterRequest, User } from "./schema.ts";
import { DatabaseAdapter } from "./db.ts";

// =============================================================================
// JWT SERVICE
// =============================================================================
export interface JWTPayload {
  userId: number;
  username: string;
  roles?: "user" | "admin" | "guest"[]; // Optional roles for authorization
  iat: number;
  exp: number;
  jti?: string; // JWT ID for revocation
}

export class JWTService {
  constructor(
    private secretKey: string,
    private refreshSecretKey: string,
    private db: DatabaseAdapter,
  ) {}

  generateTokens(user: User): { accessToken: string; refreshToken: string } {
    const tokenId = randomUUID();

    // Short-lived access token (15 minutes)
    const accessToken = jwt.sign(
      {
        userId: user.id,
        username: user.username,
        roles: user.role || [],
        jti: tokenId,
      },
      this.secretKey,
      { expiresIn: "15m" },
    );

    // Long-lived refresh token (7 days)
    const refreshToken = jwt.sign(
      {
        userId: user.id,
        jti: tokenId,
      },
      this.refreshSecretKey,
      { expiresIn: "7d" },
    );

    return { accessToken, refreshToken };
  }

  verifyAccessToken(token: string): JWTPayload | null {
    try {
      return jwt.verify(token, this.secretKey) as JWTPayload;
    } catch {
      return null;
    }
  }

  verifyRefreshToken(token: string): { userId: number; jti: string } | null {
    try {
      return jwt.verify(token, this.refreshSecretKey) as {
        userId: number;
        jti: string;
      };
    } catch {
      return null;
    }
  }

  // For microservices - verify without database lookup
  verifyTokenStateless(token: string): JWTPayload | null {
    return this.verifyAccessToken(token);
  }

  // For high-security scenarios - check token revocation
  async verifyTokenWithRevocation(token: string): Promise<JWTPayload | null> {
    const payload = this.verifyAccessToken(token);
    if (!payload) return null;

    // Check if token is revoked (optional database lookup)
    if (payload.jti) {
      const isRevoked = await this.db.isTokenRevoked(payload.jti);
      if (isRevoked) return null;
    }

    return payload;
  }

  async revokeToken(jti: string): Promise<void> {
    await this.db.revokeToken(jti);
  }
}

// =============================================================================
// HYBRID SESSION MANAGER
// =============================================================================
export class HybridSessionManager {
  constructor(
    private db: DatabaseAdapter,
    private jwtService: JWTService,
  ) {}

  // Traditional session creation
  async createSession(userId: number): Promise<string> {
    const sessionId = randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await this.db.createSession(userId, sessionId, expiresAt);
    return sessionId;
  }

  // JWT-based session
  async createJWTSession(
    user: User,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    return this.jwtService.generateTokens(user);
  }

  async validateSession(sessionId: string): Promise<User | null> {
    const session = await this.db.getSession(sessionId);
    if (!session) return null;
    return await this.db.getUserById(session.user_id);
  }

  async validateJWTSession(
    token: string,
    requireDbCheck = false,
  ): Promise<User | null> {
    const payload = requireDbCheck
      ? await this.jwtService.verifyTokenWithRevocation(token)
      : this.jwtService.verifyTokenStateless(token);

    if (!payload) return null;

    // For microservices: return user data from token
    if (!requireDbCheck) {
      return {
        id: payload.userId,
        username: payload.username,
        email: "", // Not in token
        created_at: new Date().toDateString(),
        password_hash: "",
      } as User;
    }

    // For traditional apps: fetch fresh user data
    return await this.db.getUserById(payload.userId);
  }

  async refreshJWTTokens(
    refreshToken: string,
  ): Promise<{ accessToken: string; refreshToken: string } | null> {
    const payload = this.jwtService.verifyRefreshToken(refreshToken);
    if (!payload) return null;

    const user = await this.db.getUserById(payload.userId);
    if (!user) return null;

    // Revoke old token
    await this.jwtService.revokeToken(payload.jti);

    return this.jwtService.generateTokens(user);
  }

  async destroySession(sessionId: string): Promise<void> {
    await this.db.deleteSession(sessionId);
  }

  async destroyJWTSession(token: string): Promise<void> {
    const payload = this.jwtService.verifyAccessToken(token);
    if (payload?.jti) {
      await this.jwtService.revokeToken(payload.jti);
    }
  }
}

// =============================================================================
// ENHANCED AUTH SERVICE
// =============================================================================
export class AuthService {
  constructor(
    private db: DatabaseAdapter,
    private sessionManager: HybridSessionManager,
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
    const tokens = await this.sessionManager.createJWTSession(user);

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
export function hybridAuthMiddleware(
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
      role: payload.roles,
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
    // API request without valid token
    if (req.path.startsWith("/api/")) {
      return res.status(401).json({ error: "Authentication required" });
    }
    // Web request without session
    res.redirect("/login.html");
    return;
  }
  next();
}

