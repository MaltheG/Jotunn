// src/commands/music.js
// Mirrors MusicModule.cs — the /music slash command group.

import {
  SlashCommandBuilder,
  EmbedBuilder,
  Colors,
} from 'discord.js';
import {
  joinVoiceChannel,
  getVoiceConnection,
  VoiceConnectionStatus,
  entersState,
} from '@discordjs/voice';

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildSongEmbed(song, title, requests, plays) {
  return new EmbedBuilder()
    .setColor(Colors.Red)
    .setTitle(song.title)
    .setURL(song.url)
    .setAuthor({ name: title })
    .addFields(
      { name: 'Total requests', value: String(requests), inline: true },
      { name: 'Total plays',    value: String(plays),    inline: true },
      { name: 'Added by',       value: `<@${song.authorId}>` },
      { name: 'Position in queue', value: String(song.position), inline: true },
      { name: 'Duration',       value: song.duration,            inline: true },
    )
    .setImage(song.thumbnail)
    .setTimestamp();
}

/**
 * Joins a voice channel and stores the connection on the queue.
 * @param {import('discord.js').VoiceBasedChannel} voiceChannel
 * @param {import('../services/GuildQueueService.js').GuildQueue} queue
 */
async function joinChannel(voiceChannel, queue) {
  const connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId:   voiceChannel.guild.id,
    adapterCreator: voiceChannel.guild.voiceAdapterCreator,
  });

  connection.on('error', (e) => console.error('[Voice] error:', e?.message ?? e));

  // Recover from transient disconnects (Discord moves the session, or a stale
  // session from a previous run) instead of dying: race a possible reconnect
  // against a full teardown.
  connection.on(VoiceConnectionStatus.Disconnected, async () => {
    try {
      await Promise.race([
        entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
        entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
      ]);
      // Reconnecting — let it ride.
    } catch {
      connection.destroy();
    }
  });

  // Wait for the connection to become Ready (mirrors the PCM stream wait in C#)
  try {
    await entersState(connection, VoiceConnectionStatus.Ready, 30_000);
  } catch (err) {
    console.error(`[Voice] Failed to become Ready (last status: ${connection.state.status})`);
    connection.destroy();
    throw err;
  }

  queue.connection = connection;

  // If a player already exists (e.g. rejoining), resubscribe it
  if (queue.audioPlayer) {
    connection.subscribe(queue.audioPlayer);
  }
}

// ── Command definition ────────────────────────────────────────────────────────

const data = new SlashCommandBuilder()
  .setName('music')
  .setDescription('Music playback commands')
  .addSubcommand(sub => sub
    .setName('play')
    .setDescription('Play a song or playlist from YouTube')
    .addStringOption(opt => opt.setName('query').setDescription('YouTube URL or search terms').setRequired(true)))
  .addSubcommand(sub => sub.setName('skip').setDescription('Skip the current song'))
  .addSubcommand(sub => sub.setName('pause').setDescription('Pause playback'))
  .addSubcommand(sub => sub.setName('unpause').setDescription('Resume playback'))
  .addSubcommand(sub => sub.setName('loop').setDescription('Toggle looping of the current song'))
  .addSubcommand(sub => sub.setName('queue').setDescription('Show the current queue'))
  .addSubcommand(sub => sub.setName('clear').setDescription('Clear the queue (keeps current song)'))
  .addSubcommand(sub => sub
    .setName('remove')
    .setDescription('Remove a song from the queue by position (1 = next up)')
    .addIntegerOption(opt => opt.setName('position').setDescription('Position in queue (1 = next up)').setRequired(true)))
  .addSubcommand(sub => sub
    .setName('playnext')
    .setDescription('Queue a song to play after the current one')
    .addStringOption(opt => opt.setName('query').setDescription('YouTube URL or search terms').setRequired(true)))
  .addSubcommand(sub => sub.setName('nowplaying').setDescription('Show the currently playing song'))
  .addSubcommand(sub => sub.setName('join').setDescription('Join your voice channel'))
  .addSubcommand(sub => sub.setName('disconnect').setDescription('Disconnect from the voice channel'));

// ── Subcommand handlers ───────────────────────────────────────────────────────

async function handlePlay(interaction, { queues, youtube, player, songHistory }) {
  await interaction.deferReply();

  const voiceChannel = interaction.member?.voice?.channel;
  if (!voiceChannel) {
    return interaction.followUp({ content: 'You need to be in a voice channel.', ephemeral: true });
  }

  const queue = queues.getOrCreate(interaction.guildId);

  // Join unless we already have a healthy (Ready) connection. Any connection
  // that is stuck (signalling/connecting) or left over from a previous session
  // is torn down first so we always rejoin cleanly.
  const existingConn = getVoiceConnection(interaction.guildId);
  if (!existingConn || existingConn.state.status !== VoiceConnectionStatus.Ready) {
    existingConn?.destroy();
    try {
      await joinChannel(voiceChannel, queue);
    } catch (err) {
      return interaction.followUp(`Could not join voice channel: ${err.message}`);
    }
  }

  const query = interaction.options.getString('query', true);

  // Reject non-YouTube URLs
  if (query.startsWith('https://') && !query.includes('youtube.com') && !query.includes('youtu.be')) {
    return interaction.followUp(':(');
  }

  let result;
  try {
    result = await youtube.resolve(query, interaction.guildId, interaction.user.id);
  } catch (err) {
    return interaction.followUp(`Something went wrong: ${err.message}`);
  }

  let basePosition = queue.songs.length;
  for (const song of result.songs) {
    const positioned = { ...song, position: basePosition++ };
    queue.songs.push(positioned);
    await songHistory.addSongRequest(positioned).catch(() => {});
  }

  if (result.songs.length > 1) {
    await interaction.followUp(`${result.songs.length} songs added to queue.`);
  } else {
    const song = queue.songs.find(s => s.url === result.songs[0].url) ?? result.songs[0];
    const stats = await songHistory.getSongStats(song.id, interaction.guildId);
    const embed = buildSongEmbed(song, queue.playing ? 'Song added:' : 'Now playing:', stats.requests, stats.plays);
    await interaction.followUp({ embeds: [embed] });
  }

  if (!queue.playing) {
    await player.playNext(interaction.guildId);
  }
}

async function handleSkip(interaction, { queues, player }) {
  const queue = queues.get(interaction.guildId);
  if (!queue || queue.songs.length === 0) {
    return interaction.reply({ content: 'Nothing is playing.', ephemeral: true });
  }

  const skipped = queue.songs[0].title;
  player.skip(interaction.guildId);
  await interaction.reply(`Skipped: **${skipped}**`);
}

async function handlePause(interaction, { queues, player }) {
  const queue = queues.get(interaction.guildId);
  if (!queue || !queue.playing) {
    return interaction.reply({ content: 'Nothing is playing.', ephemeral: true });
  }

  player.pause(interaction.guildId);
  await interaction.reply('Paused.');
}

async function handleUnpause(interaction, { queues, player }) {
  const queue = queues.get(interaction.guildId);
  if (!queue || queue.songs.length === 0) {
    return interaction.reply({ content: 'Nothing in queue.', ephemeral: true });
  }

  player.unpause(interaction.guildId);
  await interaction.reply('Resumed.');
}

async function handleLoop(interaction, { queues }) {
  const queue = queues.get(interaction.guildId);
  if (!queue) {
    return interaction.reply({ content: 'Nothing is playing.', ephemeral: true });
  }

  queue.loop = !queue.loop;
  await interaction.reply(queue.loop ? 'Loop enabled.' : 'Loop disabled.');
}

async function handleQueue(interaction, { queues }) {
  const queue = queues.get(interaction.guildId);
  if (!queue || queue.songs.length === 0) {
    return interaction.reply({ content: 'The queue is empty.', ephemeral: true });
  }

  const display = queue.songs.slice(0, 20);
  const positions = display.map((_, i) => (i === 0 ? '▶ Now' : String(i))).join('\n');
  const titles    = display.map(s => s.title.length > 50 ? s.title.slice(0, 50) + '…' : s.title).join('\n');
  const authors   = display.map(s => `<@${s.authorId}>`).join('\n');

  const embed = new EmbedBuilder()
    .setColor(Colors.Red)
    .setAuthor({ name: 'Queue:' })
    .addFields(
      { name: 'Pos',          value: positions, inline: true },
      { name: 'Track',        value: titles,    inline: true },
      { name: 'Requested by', value: authors,   inline: true },
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

async function handleClear(interaction, { queues }) {
  const queue = queues.get(interaction.guildId);
  if (!queue || queue.songs.length <= 1) {
    return interaction.reply({ content: 'Nothing to clear.', ephemeral: true });
  }

  const count = queue.songs.length - 1;
  queue.songs.splice(1);
  await interaction.reply(`Cleared ${count} song(s) from the queue.`);
}

async function handleRemove(interaction, { queues }) {
  const position = interaction.options.getInteger('position', true);
  const queue = queues.get(interaction.guildId);
  // position 1 means index 1 (next up after the currently playing index 0)
  if (!queue || position < 1 || position >= queue.songs.length) {
    return interaction.reply({ content: 'Invalid position.', ephemeral: true });
  }

  const removed = queue.songs.splice(position, 1)[0];
  await interaction.reply(`Removed: **${removed.title}**`);
}

async function handlePlayNext(interaction, { queues, youtube, songHistory }) {
  await interaction.deferReply();

  const queue = queues.get(interaction.guildId);
  if (!queue || !queue.connection) {
    return interaction.followUp({ content: 'Not connected to a voice channel. Use /music play first.', ephemeral: true });
  }

  const query = interaction.options.getString('query', true);

  let result;
  try {
    result = await youtube.resolve(query, interaction.guildId, interaction.user.id);
  } catch (err) {
    return interaction.followUp(`Something went wrong: ${err.message}`);
  }

  const insertAt = Math.min(1, queue.songs.length);
  result.songs.forEach((song, i) => {
    const positioned = { ...song, position: insertAt + i };
    queue.songs.splice(insertAt + i, 0, positioned);
    songHistory.addSongRequest(positioned).catch(() => {});
  });

  await interaction.followUp(`**${result.songs[0].title}** will play next.`);
}

async function handleNowPlaying(interaction, { queues, songHistory }) {
  const queue = queues.get(interaction.guildId);
  if (!queue || queue.songs.length === 0) {
    return interaction.reply({ content: 'Nothing is playing.', ephemeral: true });
  }

  const song  = queue.songs[0];
  const stats = await songHistory.getSongStats(song.id, interaction.guildId);
  await interaction.reply({ embeds: [buildSongEmbed(song, 'Now playing:', stats.requests, stats.plays)] });
}

async function handleJoin(interaction, { queues }) {
  const voiceChannel = interaction.member?.voice?.channel;
  if (!voiceChannel) {
    return interaction.reply({ content: 'You need to be in a voice channel.', ephemeral: true });
  }

  const queue = queues.getOrCreate(interaction.guildId);
  await joinChannel(voiceChannel, queue);
  await interaction.reply(`Joined **${voiceChannel.name}**.`);
}

async function handleDisconnect(interaction, { queues }) {
  const queue = queues.get(interaction.guildId);
  if (!queue?.connection) {
    return interaction.reply({ content: 'Not connected.', ephemeral: true });
  }

  queue.abortController?.abort();
  queue.audioPlayer?.stop(true);
  queue.connection.destroy();
  queues.remove(interaction.guildId);

  await interaction.reply('Disconnected.');
}

// ── Router ────────────────────────────────────────────────────────────────────

const HANDLERS = {
  play:       handlePlay,
  skip:       handleSkip,
  pause:      handlePause,
  unpause:    handleUnpause,
  loop:       handleLoop,
  queue:      handleQueue,
  clear:      handleClear,
  remove:     handleRemove,
  playnext:   handlePlayNext,
  nowplaying: handleNowPlaying,
  join:       handleJoin,
  disconnect: handleDisconnect,
};

export default {
  data,
  async execute(interaction, services) {
    const sub = interaction.options.getSubcommand();
    const handler = HANDLERS[sub];
    if (handler) await handler(interaction, services);
  },
};
