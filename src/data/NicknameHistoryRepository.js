// src/data/NicknameHistoryRepository.js
// Mirrors NicknameHistoryRepository.cs

export class NicknameHistoryRepository {
  /** @param {import('./DbPool.js').DbPool} pool */
  constructor(pool) {
    this.pool = pool;
  }

  /**
   * @param {string} userId
   * @param {string} nickname
   * @param {string} namerId
   */
  async add(userId, nickname, namerId) {
    await this.pool.execute(
      'INSERT INTO history (userID, nickname, namer) VALUES (?, ?, ?)',
      [userId, nickname, namerId],
    );
  }

  /**
   * @param {string} userId
   * @returns {Promise<Array<{nickname: string, namer: string, time: Date}>>}
   */
  async get(userId) {
    const rows = await this.pool.query(
      'SELECT nickname, namer, time FROM history WHERE userID = ? ORDER BY time ASC',
      [userId],
    );
    return rows;
  }
}
