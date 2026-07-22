// src/data/DbPool.js
// Mirrors DbConnectionFactory.cs — wraps mysql2's connection pool.
// Supports both mysql:// URI format and plain connection strings.

import mysql from 'mysql2/promise';

/**
 * Parses a mysql:// URI into a mysql2 config object.
 * @param {string} url
 */
function parseMysqlUri(url) {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: u.port ? parseInt(u.port) : 3306,
    database: u.pathname.replace(/^\//, ''),
    user: u.username,
    password: u.password,
  };
}

export class DbPool {
  /** @param {string} databaseUrl */
  constructor(databaseUrl) {
    const config = databaseUrl.startsWith('mysql://')
      ? parseMysqlUri(databaseUrl)
      : { uri: databaseUrl };

    this.pool = mysql.createPool({
      ...config,
      waitForConnections: true,
      connectionLimit: 10,
    });
  }

  /**
   * Executes a query and returns all rows.
   * @param {string} sql
   * @param {any[]} [params]
   */
  async query(sql, params = []) {
    const [rows] = await this.pool.execute(sql, params);
    return rows;
  }

  /**
   * Executes a query and returns the first row (or null).
   * @param {string} sql
   * @param {any[]} [params]
   */
  async queryFirst(sql, params = []) {
    const rows = await this.query(sql, params);
    return rows[0] ?? null;
  }

  /**
   * Executes a statement (INSERT/UPDATE/DELETE).
   * @param {string} sql
   * @param {any[]} [params]
   */
  async execute(sql, params = []) {
    await this.pool.execute(sql, params);
  }

  /**
   * Runs a callback inside a transaction.
   * @param {(conn: import('mysql2/promise').Connection) => Promise<void>} fn
   */
  async transaction(fn) {
    const conn = await this.pool.getConnection();
    await conn.beginTransaction();
    try {
      await fn(conn);
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }
}
