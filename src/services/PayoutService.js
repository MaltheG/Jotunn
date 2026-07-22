// src/services/PayoutService.js
// Mirrors PayoutService.cs — every 10 minutes pays 10 TOPS to every unmuted
// member in the configured voice channels.

const PAYOUT_AMOUNT  = 10;
const INTERVAL_MS    = 10 * 60 * 1000; // 10 minutes

// Guild → voice channel IDs that qualify for passive payout.
// Mirrors the CasinoGuilds dictionary in PayoutService.cs.
const CASINO_GUILDS = new Map([
  ['446227876652515339', ['446227876652515343']],
  ['504272240095920137', ['504940170961879043', '504272240599105538', '504940143409364998', '504940194399649802', '545603191585243138']],
]);

export class PayoutService {
  /**
   * @param {import('discord.js').Client} client
   * @param {import('../data/CasinoRepository.js').CasinoRepository} casinoRepo
   */
  constructor(client, casinoRepo) {
    this.client = client;
    this.casinoRepo = casinoRepo;
  }

  start() {
    setInterval(() => this._runPayout(), INTERVAL_MS);
    console.log('[Payout] Passive income timer started.');
  }

  async _runPayout() {
    console.log('[Payout] Payout time!');

    for (const [guildId, channelIds] of CASINO_GUILDS) {
      const guild = this.client.guilds.cache.get(guildId);
      if (!guild) continue;

      for (const channelId of channelIds) {
        const channel = guild.channels.cache.get(channelId);
        if (!channel?.isVoiceBased()) continue;

        for (const [, member] of channel.members) {
          if (member.voice.selfMute) continue;

          try {
            await this.casinoRepo.payMember(guildId, member.id, PAYOUT_AMOUNT);
          } catch (err) {
            console.error(`[Payout] Failed to pay ${member.id}:`, err);
          }
        }
      }
    }
  }
}
