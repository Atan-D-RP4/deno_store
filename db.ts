// =============================================================================
// DATABASE ABSTRACTION
// =============================================================================
import sqlite, { ISqlite, open } from "sqlite";
import sqlite3 from "sqlite3";

import { Order, Product, Session, User } from "./schema.ts";

// Minimal transaction wrapper for the `sqlite` + `sqlite3` combo.
// The sqlite package doesn't expose a typed transaction interface, so we provide
// a tiny helper that:
// - Starts a transaction immediately (BEGIN IMMEDIATE)
// - Ensures writes go through the transaction
// - Commits or rolls back safely
class Transaction {
  private active = false;
  constructor(
    private db: sqlite.Database<sqlite3.Database, sqlite3.Statement>,
  ) {}

  get in_transaction(): boolean {
    return this.active;
  }

  async begin(): Promise<void> {
    if (this.active) throw new Error("Transaction already started");
    // IMMEDIATE acquires a RESERVED lock right away, avoiding later busy errors
    await this.db.exec("BEGIN IMMEDIATE");
    this.active = true;
  }

  async run(sql: string, params?: any[]): Promise<ISqlite.RunResult> {
    if (!this.active) {
      throw new Error("Cannot run SQL command outside of a transaction");
    }
    return this.db.run(sql, params);
  }

  async commit(): Promise<void> {
    if (!this.active) throw new Error("No transaction to commit");
    console.log("Committing transaction");
    await this.db.exec("COMMIT");
    this.active = false;
  }

  async rollback(): Promise<void> {
    if (!this.active) return; // no-op if not active
    await this.db.exec("ROLLBACK");
    this.active = false;
  }
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
    const tx = new Transaction(this.db);
    await tx.begin();
    return tx;
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
      [new Date().toISOString()],
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
    const transaction = await this.transaction();
    try {
      const { lastID: orderId } = await transaction.run(
        `INSERT INTO orders (user_id, total_amount, status) VALUES (?, ?, ?)`,
        [userId, 0, "pending"],
      );
      if (!orderId) throw new Error("Failed to create order");
      let totalAmount = 0;
      for (const item of items) {
        // Reads will still occur under the same connection/transaction
        const product = await this.getProductById(item.productId);
        if (!product) throw new Error(`Product ${item.productId} not found`);
        const price = product.price;
        totalAmount += price * item.quantity;
        await transaction.run(
          `INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)`,
          [orderId, item.productId, item.quantity, price],
        );
      }
      await transaction.run(
        `UPDATE orders SET total_amount = ? WHERE id = ?`,
        [totalAmount, orderId],
      );
      await transaction.commit();
      const order = await this.getOrderById(orderId);
      return order!;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
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
