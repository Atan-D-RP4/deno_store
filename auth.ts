import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { randomUUID } from "node:crypto";

import { LoginRequest, RegisterRequest, User } from "./schema.ts";
import { DatabaseAdapter } from "./db.ts";

// =============================================================================
// JWT UTILITIES
// =============================================================================

const JWT_SECRET = "your-super-secret-jwt-key-change-this-in-production";

export interface JWTPayload {
  sub: string;
  iat: number;
  exp: number;
}

async function createJWT(userId: number): Promise<string> {
  const payload: JWTPayload = {
    sub: userId.toString(),
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60),
  };
  return jwt.sign(payload, JWT_SECRET);
}

async function verifyJWT(token: string): Promise<JWTPayload | null> {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as JWTPayload;
    return payload;
  } catch {
    return null;
  }
}

// =============================================================================
// SESSION MANAGEMENT
// =============================================================================

export class SessionManager {
  constructor(private db: DatabaseAdapter) {}

  generateSessionId(): string {
    return randomUUID();
  }

  async createSession(userId: number): Promise<string> {
    const sessionId = this.generateSessionId();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await this.db.createSession(userId, sessionId, expiresAt);
    return sessionId;
  }

  async validateSession(sessionId: string): Promise<User | null> {
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

export class AuthService {
  constructor(
    private db: DatabaseAdapter,
    private sessionManager: SessionManager,
  ) {}

  async register(
    data: RegisterRequest,
  ): Promise<{ user: Omit<User, "password_hash">; token: string }> {
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
    const sessionId = await this.sessionManager.createSession(user.id);
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
    return await this.sessionManager.validateSession(sessionId);
  }
}

// =============================================================================
// MIDDLEWARE
// =============================================================================

export function authMiddleware(authService: AuthService) {
  return async (req: any, res: any, next: any) => {
    const sessionId = req.cookies.session_id;
    if (sessionId) {
      const user = await authService.validateSession(sessionId);
      if (user) {
        req.user = user;
        req.sessionId = sessionId;
      }
    }
    next();
  };
}

export function requireAuth(req: any, res: any, next: any) {
  if (!req.user) {
    res.redirect("/login.html");
    return;
  }
  next();
}
