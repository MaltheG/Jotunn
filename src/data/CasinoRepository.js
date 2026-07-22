// src/data/CasinoRepository.js
// Mirrors CasinoRepository.cs

export class CasinoRepository {
  /** @param {import('./DbPool.js').DbPool} pool */
  constructor(pool) {
    this.pool = pool;
  }

  /**
   * @param {string} guildId
   * @param {string} userId
   * @returns {Promise<number | null>}
   */
  async getBalance(guildId, userId) {
    const row = await this.pool.queryFirst(
      'SELECT balance FROM casino WHERE guildID = ? AND userID = ?',
      [guildId, userId],
    );
    return row ? row.balance : null;
  }

  /**
   * @param {string} guildId
   * @param {string} userId
   * @param {number} amount  net profit (winnings minus original bet)
   */
  async addWin(guildId, userId, amount) {
    await this.pool.execute(
      `INSERT INTO casino (guildID, userID, balance, win)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE balance = casino.balance + ?, win = casino.win + ?`,
      [guildId, userId, amount, amount, amount, amount],
    );
  }

  /**
   * @param {string} guildId
   * @param {string} userId
   * @param {number} amount  absolute loss (positive number)
   */
  async addLoss(guildId, userId, amount) {
    const abs = Math.abs(amount);
    await this.pool.execute(
      `INSERT INTO casino (guildID, userID, balance, loss)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE balance = casino.balance - ?, loss = casino.loss + ?`,
      [guildId, userId, -abs, abs, abs, abs],
    );
  }

  /**
   * @param {string} guildId
   * @param {string} giverId
   * @param {string} receiverId
   * @param {number} amount
   */
  async transfer(guildId, giverId, receiverId, amount) {
    await this.pool.transaction(async (conn) => {
      await conn.execute(
        `INSERT INTO casino (guildID, userID, balance, gifted)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE balance = casino.balance - ?, gifted = casino.gifted + ?`,
        [guildId, giverId, -amount, amount, amount, amount],
      );
      await conn.execute(
        `INSERT INTO casino (guildID, userID, balance, received)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE balance = casino.balance + ?, received = casino.received + ?`,
        [guildId, receiverId, amount, amount, amount, amount],
      );
    });
  }

  /**
   * @param {string} guildId
   * @param {string} userId
   * @param {number} amount
   */
  async payMember(guildId, userId, amount) {
    await this.pool.execute(
      `INSERT INTO casino (guildID, userID, balance)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE balance = casino.balance + ?`,
      [guildId, userId, amount, amount],
    );
  }

  /**
   * @param {string} guildId
   * @returns {Promise<Array<{userId: string, balance: number}>>}
   */
  async getLeaderboard(guildId) {
    const rows = await this.pool.query(
      'SELECT userID AS userId, balance FROM casino WHERE guildID = ? ORDER BY balance DESC',
      [guildId],
    );
    return rows;
  }
}
