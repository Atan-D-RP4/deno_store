// @ts-types = "npm:@types/node;;
import { randomUUID } from "node:crypto";

import { User } from "./schema.ts";
import { DatabaseAdapter } from "./db.ts";
import { JWTService } from "./jwt.ts";

// =============================================================================
// HYBRID SESSION MANAGER
// =============================================================================
export class SessionManager {
  constructor(
    private db: DatabaseAdapter,
    private jwtService: JWTService,
  ) {}

  async deleteExpiredSessions(): Promise<void> {
    await this.db.deleteExpiredSessions().catch((err) => {
      console.error("Failed to delete expired sessions:", err);
    });
  }

  // Traditional session creation
  async createSession(userId: number): Promise<string> {
    const sessionId = randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await this.db.createSession(userId, sessionId, expiresAt);
    return sessionId;
  }

  // JWT-based session
  createJWTSession(
    user: User,
  ): { accessToken: string; refreshToken: string } {
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
