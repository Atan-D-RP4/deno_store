// =============================================================================
// DATABASE ABSTRACTION
// =============================================================================
import { open } from "sqlite";
import sqlite3 from "sqlite3";

import { Session, User } from "./schema.ts";

export interface DatabaseAdapter {
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

export class SqliteAdapter implements DatabaseAdapter {
  private db: any;

  constructor(private dbPath: string = "./auth.db") {}

  async connect(): Promise<void> {
    this.db = await open({ filename: this.dbPath, driver: sqlite3.Database });
    await this.db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await this.db.run(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      )
    `);
    await this.db.run(
      `CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at)`,
    );
    await this.db.run(
      `CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)`,
    );
  }

  async disconnect(): Promise<void> {
    await this.db.close();
  }

  async createUser(
    username: string,
    email: string,
    passwordHash: string,
  ): Promise<User> {
    const { lastID } = await this.db.run(
      `INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)`,
      [username, email, passwordHash],
    );
    const user = await this.db.get(`SELECT * FROM users WHERE id = ?`, [
      lastID,
    ]);
    return user as User;
  }

  async getUserByUsername(username: string): Promise<User | null> {
    const user = await this.db.get(`SELECT * FROM users WHERE username = ?`, [
      username,
    ]);
    return user || null;
  }

  async getUserById(id: number): Promise<User | null> {
    const user = await this.db.get(`SELECT * FROM users WHERE id = ?`, [id]);
    return user || null;
  }

  async createSession(
    userId: number,
    sessionId: string,
    expiresAt: Date,
  ): Promise<void> {
    await this.db.run(
      `INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)`,
      [sessionId, userId, expiresAt.toISOString()],
    );
  }

  async getSession(sessionId: string): Promise<Session | null> {
    const session = await this.db.get(
      `SELECT * FROM sessions WHERE id = ? AND expires_at > datetime('now')`,
      [sessionId],
    );
    return session || null;
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.db.run(`DELETE FROM sessions WHERE id = ?`, [sessionId]);
  }

  async deleteExpiredSessions(): Promise<void> {
    await this.db.run(
      `DELETE FROM sessions WHERE expires_at <= datetime('now')`,
    );
  }
}
