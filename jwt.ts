import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import { User } from "./schema.ts";
import { DatabaseAdapter } from "./db.ts";

// =============================================================================
// JWT SERVICE
// =============================================================================
export interface JWTPayload {
  userId: number;
  username: string;
  roles?: "user" | "admin" | "guest"; // Optional roles for authorization
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
        roles: user.role || "guest",
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
    await this.db.revokeToken(jti, new Date(Date.now()));
  }
}
