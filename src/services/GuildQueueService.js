// src/services/GuildQueueService.js
// Mirrors GuildQueueService.cs — a per-guild registry of active queues.

/**
 * Represents the playback state for a single guild.
 * Mirrors GuildQueue.cs.
 */
export class GuildQueue {
  /** @param {string} guildId */
  constructor(guildId) {
    /** @type {string} */
    this.guildId = guildId;
    /** @type {import('../services/YoutubeService.js').Song[]} */
    this.songs = [];
    /** @type {boolean} */
    this.playing = false;
    /** @type {boolean} */
    this.loop = false;
    /** @type {import('@discordjs/voice').VoiceConnection | null} */
    this.connection = null;
    /** @type {import('@discordjs/voice').AudioPlayer | null} */
    this.audioPlayer = null;
    /** @type {AbortController | null} */
    this.abortController = null;
  }
}

export class GuildQueueService {
  constructor() {
    /** @type {Map<string, GuildQueue>} */
    this._queues = new Map();
  }

  /** @param {string} guildId */
  getOrCreate(guildId) {
    if (!this._queues.has(guildId)) {
      this._queues.set(guildId, new GuildQueue(guildId));
    }
    return this._queues.get(guildId);
  }

  /** @param {string} guildId */
  get(guildId) {
    return this._queues.get(guildId) ?? null;
  }

  /** @param {string} guildId */
  remove(guildId) {
    this._queues.delete(guildId);
  }
}
