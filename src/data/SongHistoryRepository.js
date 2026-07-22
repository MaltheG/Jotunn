// src/data/SongHistoryRepository.js
// Mirrors SongHistoryRepository.cs

export class SongHistoryRepository {
  /** @param {import('./DbPool.js').DbPool} pool */
  constructor(pool) {
    this.pool = pool;
  }

  /** @param {import('../services/YoutubeService.js').Song} song */
  async addSongRequest(song) {
    await this.pool.execute(
      `INSERT INTO songHistory (songName, songUrl, songID, guildID, userID, requests, plays)
       VALUES (?, ?, ?, ?, ?, 1, 0)
       ON DUPLICATE KEY UPDATE requests = songHistory.requests + 1`,
      [song.title, song.url, song.id, song.guildId, song.authorId],
    );
  }

  /** @param {import('../services/YoutubeService.js').Song} song */
  async addSongPlay(song) {
    await this.pool.execute(
      'UPDATE songHistory SET plays = plays + 1 WHERE songID = ? AND guildID = ? AND userID = ?',
      [song.id, song.guildId, song.authorId],
    );
  }

  /**
   * @param {string} songId
   * @param {string} guildId
   * @returns {Promise<{requests: number, plays: number}>}
   */
  async getSongStats(songId, guildId) {
    const row = await this.pool.queryFirst(
      'SELECT SUM(requests) AS requests, SUM(plays) AS plays FROM songHistory WHERE songID = ? AND guildID = ?',
      [songId, guildId],
    );
    return { requests: Number(row?.requests ?? 0), plays: Number(row?.plays ?? 0) };
  }

  /**
   * @param {string} guildId
   * @param {string} userId
   * @param {number} [limit]
   */
  async getUserHistory(guildId, userId, limit = 10) {
    return this.pool.query(
      `SELECT songName, songUrl, requests, plays
       FROM songHistory WHERE guildID = ? AND userID = ?
       ORDER BY requests DESC LIMIT ?`,
      [guildId, userId, limit],
    );
  }

  /**
   * @param {string} guildId
   * @param {number} [limit]
   */
  async getGuildHistory(guildId, limit = 10) {
    return this.pool.query(
      `SELECT songName, songUrl, SUM(requests) AS requests, SUM(plays) AS plays
       FROM songHistory WHERE guildID = ?
       GROUP BY songName, songUrl
       ORDER BY requests DESC LIMIT ?`,
      [guildId, limit],
    );
  }
}
