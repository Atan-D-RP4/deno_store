// =============================================================================
// DATABASE ABSTRACTION
// =============================================================================
import sqlite, { ISqlite, open } from "sqlite";
import sqlite3 from "sqlite3";

import { Order, Product, Session, User } from "./schema.ts";

interface Transaction {
  run: (sql: string, params?: any[]) => Promise<ISqlite.RunResult>; // Run a SQL command
  begin: () => Promise<void>;
  commit: () => Promise<void>;
  rollback: () => Promise<void>;
}

export interface DatabaseAdapter {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  transaction(): Promise<Transaction>;
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
  isTokenRevoked(jti: string): Promise<boolean>;
  revokeToken(jti: string, expiresAt: Date): Promise<void>;
  cleanupExpiredTokens(): Promise<void>;
  getAllProducts(): Promise<Product[]>;
  getProductById(id: number): Promise<Product | null | undefined>;
  createOrder(
    userId: number,
    items: { productId: number; quantity: number }[],
  ): Promise<Order>;
  getOrdersByUserId(userId: number): Promise<Order[]>;
}

export class SqliteAdapter implements DatabaseAdapter {
  private db: sqlite.Database<sqlite3.Database, sqlite3.Statement>;

  constructor(private dbPath: string = "./auth.db") {
    this.db = {} as sqlite.Database<sqlite3.Database, sqlite3.Statement>;
  }

  async connect(): Promise<void> {
    this.db = await open({ filename: this.dbPath, driver: sqlite3.Database });

    this.db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      )
    `);

    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS revoked_tokens (
        jti TEXT PRIMARY KEY,
        revoked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME NOT NULL
      );
    `);

    this.db.run(
      `CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at)`,
    );

    this.db.run(
      `CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)`,
    );

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_revoked_tokens_expires ON revoked_tokens(expires_at);
    `);

    await this.db.run(`
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        price REAL NOT NULL,
        stock_quantity INTEGER NOT NULL,
        image_url TEXT
      );
    `);
    await this.db.run(`
      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        total_amount REAL NOT NULL,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      );
    `);
    await this.db.run(`
      CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL,
        price REAL NOT NULL,
        FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products (id)
      );
    `);

    const count = await this.db.get(`SELECT COUNT(*) as count FROM products`);
    if (count.count === 0) {
      await this.db.run(
        `INSERT INTO products (name, description, price, stock_quantity, image_url) VALUES (?, ?, ?, ?, ?)`,
        ["Laptop", "High-performance laptop", 999.99, 10, null],
      );
      await this.db.run(
        `INSERT INTO products (name, description, price, stock_quantity, image_url) VALUES (?, ?, ?, ?, ?)`,
        ["Smartphone", "Latest model smartphone", 699.99, 20, null],
      );
      await this.db.run(
        `INSERT INTO products (name, description, price, stock_quantity, image_url) VALUES (?, ?, ?, ?, ?)`,
        ["Headphones", "Wireless headphones", 99.99, 50, null],
      );
    }
    console.log("Connected to SQLite database:", this.db);
  }

  async disconnect(): Promise<void> {
    await this.db.close();
  }

  async transaction(): Promise<Transaction> {
    const transaction: Transaction = {
      run: (sql, params) => this.db.run(sql, params),
      begin: () => this.db.exec("BEGIN TRANSACTION"),
      commit: () => this.db.exec("COMMIT"),
      rollback: () => this.db.exec("ROLLBACK"),
    };
    return transaction;
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

  async isTokenRevoked(jti: string): Promise<boolean> {
    const row = await this.db.get(
      `SELECT 1 FROM revoked_tokens WHERE jti = ? AND expires_at > datetime('now')`,
      [jti],
    );
    return !!row;
  }

  async revokeToken(jti: string, expiresAt: Date): Promise<void> {
    await this.db.run(
      `INSERT OR REPLACE INTO revoked_tokens (jti, expires_at) VALUES (?, ?)`,
      [jti, expiresAt.toISOString()],
    );
  }

  async cleanupExpiredTokens(): Promise<void> {
    await this.db.run(
      "DELETE FROM revoked_tokens WHERE expires_at < ?",
      [new Date()],
    );
  }

  async getAllProducts(): Promise<Product[]> {
    return await this.db.all(`SELECT * FROM products`);
  }

  async getProductById(id: number): Promise<Product | null | undefined> {
    return await this.db.get(`SELECT * FROM products WHERE id = ?`, [id]);
  }

  async createOrder(
    userId: number,
    items: { productId: number; quantity: number }[],
  ): Promise<Order> {
    // TODO: Implement order creation logic
    throw new Error("Method not implemented.");
  }

  async getOrderById(id: number): Promise<Order | null> {
    const order = await this.db.get(`SELECT * FROM orders WHERE id = ?`, [id]);
    if (!order) return null;
    const items = await this.db.all(
      `SELECT * FROM order_items WHERE order_id = ?`,
      [id],
    );
    return { ...order, items };
  }

  async getOrdersByUserId(userId: number): Promise<Order[]> {
    const orders = await this.db.all(`SELECT * FROM orders WHERE user_id = ?`, [
      userId,
    ]);
    for (const order of orders) {
      const items = await this.db.all(
        `SELECT * FROM order_items WHERE order_id = ?`,
        [order.id],
      );
      order.items = items;
    }
    return orders;
  }
}
