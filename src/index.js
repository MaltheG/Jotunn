// src/index.js
// Entry point — mirrors BotService.cs and Program.cs

import {
  Client,
  GatewayIntentBits,
  Collection,
  Events,
} from 'discord.js';
import { getVoiceConnection, getVoiceConnections } from '@discordjs/voice';
import { loadConfig } from './config.js';
import { DbSetup } from './data/DbSetup.js';
import { DbPool } from './data/DbPool.js';
import { SongHistoryRepository } from './data/SongHistoryRepository.js';
import { NicknameHistoryRepository } from './data/NicknameHistoryRepository.js';
import { CasinoRepository } from './data/CasinoRepository.js';
import { GuildQueueService } from './services/GuildQueueService.js';
import { YoutubeService } from './services/YoutubeService.js';
import { AudioPlayerService } from './services/AudioPlayerService.js';
import { PayoutService } from './services/PayoutService.js';
import musicCommand from './commands/music.js';
import casinoCommand from './commands/casino.js';
import utilCommand from './commands/util.js';

// ── Bootstrap ────────────────────────────────────────────────────────────────

const config = loadConfig();

const pool = new DbPool(config.databaseUrl);
await new DbSetup(pool).initialize();

const songHistory = new SongHistoryRepository(pool);
const nicknameHistory = new NicknameHistoryRepository(pool);
const casinoRepo = new CasinoRepository(pool);
const queues = new GuildQueueService();
const youtube = new YoutubeService();
const player = new AudioPlayerService(queues, youtube, songHistory);

// ── Discord client ───────────────────────────────────────────────────────────

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates
  ],
});

// Build a command map keyed by top-level command name
/** @type {Collection<string, object>} */
const commands = new Collection();

for (const cmd of [musicCommand, casinoCommand, utilCommand]) {
  commands.set(cmd.data.name, cmd);
}

// ── Event: ready ─────────────────────────────────────────────────────────────

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`[Bot] Ready as ${readyClient.user.tag}`);

  // Register slash commands globally.
  // For faster iteration during development, use guild-scoped registration:
  //   await readyClient.guilds.cache.get(YOUR_GUILD_ID)?.commands.set(commandData);
  const commandData = [musicCommand, casinoCommand, utilCommand].map(c => c.data.toJSON());
  await readyClient.application.commands.set(commandData);
  console.log('[Bot] Slash commands registered globally.');

  // Start passive income timer
  new PayoutService(client, casinoRepo).start();
});

// ── Event: interactionCreate ──────────────────────────────────────────────────

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction, {
      queues,
      youtube,
      player,
      songHistory,
      nicknameHistory,
      casinoRepo,
      client,
    });
  } catch (err) {
    console.error(`[Bot] Interaction error (${interaction.commandName}):`, err);
    const msg = { content: 'Something went wrong.', ephemeral: true };
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(msg).catch(() => {});
    } else {
      await interaction.reply(msg).catch(() => {});
    }
  }
});

// ── Event: voiceStateUpdate ───────────────────────────────────────────────────
// Auto-disconnect if the bot is left alone in a voice channel for 5 seconds.
// Mirrors the original voiceStateUpdate handler in index.js (and BotService.cs).

client.on(Events.VoiceStateUpdate, (oldState, newState) => {
  // Only care about users leaving a channel (not joining)
  if (!oldState.channelId) return;

  // Ignore the bot itself
  if (oldState.member?.id === client.user?.id) return;

  // Is the bot in the same channel that was just left?
  const botMember = oldState.guild.members.me;
  if (!botMember?.voice?.channelId) return;
  if (oldState.channelId !== botMember.voice.channelId) return;

  const channel = oldState.channel;
  if (!channel) return;

  // Are there still humans in the channel?
  const humansRemaining = channel.members.filter(m => !m.user.bot).size;
  if (humansRemaining > 0) return;

  const guildId = oldState.guild.id;

  // Wait 5 s, then disconnect if still alone
  setTimeout(async () => {
    const stillAlone = (channel.members.filter(m => !m.user.bot).size) === 0;
    if (!stillAlone) return;

    console.log(`[Bot] Left alone in voice — disconnecting from guild ${guildId}`);

    const queue = queues.get(guildId);
    if (queue) {
      queue.abortController?.abort();
      const connection = getVoiceConnection(guildId);
      connection?.destroy();
      queues.remove(guildId);
    }
  }, 5_000);
});

// ── Graceful shutdown ─────────────────────────────────────────────────────────
// Destroy voice connections on exit so we don't leave "zombie" sessions that
// Discord keeps in the channel for minutes and that block clean rejoins.

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[Bot] Received ${signal} — cleaning up voice connections.`);
  for (const [, connection] of getVoiceConnections()) {
    connection.destroy();
  }
  client.destroy();
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// ── Login ────────────────────────────────────────────────────────────────────

await client.login(config.token);
