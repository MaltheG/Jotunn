// src/data/DbSetup.js
// Mirrors DbSetup.cs — creates all required tables if they don't exist.

export class DbSetup {
  /** @param {import('./DbPool.js').DbPool} pool */
  constructor(pool) {
    this.pool = pool;
  }

  async initialize() {
    await this.pool.execute(`
      CREATE TABLE IF NOT EXISTS history (
        namer     VARCHAR(255),
        nickname  VARCHAR(255),
        time      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        userid    VARCHAR(255)
      )
    `);

    await this.pool.execute(`
      CREATE TABLE IF NOT EXISTS songHistory (
        songName  VARCHAR(255),
        songUrl   VARCHAR(1023),
        songID    VARCHAR(255) NOT NULL,
        guildID   VARCHAR(255) NOT NULL,
        userID    VARCHAR(255) NOT NULL,
        requests  INT DEFAULT 0,
        plays     INT DEFAULT 0,
        CONSTRAINT PK_SongRequest PRIMARY KEY (songID, guildID, userID)
      )
    `);

    await this.pool.execute(`
      CREATE TABLE IF NOT EXISTS commands (
        command   VARCHAR(255) NOT NULL,
        guildID   VARCHAR(255) NOT NULL,
        userID    VARCHAR(255),
        location  VARCHAR(1023),
        CONSTRAINT PK_GuildCommand PRIMARY KEY (command, guildID)
      )
    `);

    await this.pool.execute(`
      CREATE TABLE IF NOT EXISTS casino (
        guildID   VARCHAR(255) NOT NULL,
        userID    VARCHAR(255) NOT NULL,
        balance   INT DEFAULT 0,
        loss      INT DEFAULT 0,
        win       INT DEFAULT 0,
        gifted    INT DEFAULT 0,
        received  INT DEFAULT 0,
        CONSTRAINT PK_GuildUser PRIMARY KEY (guildID, userID)
      )
    `);

    console.log('[DB] Tables initialized.');
  }
}
