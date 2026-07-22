// src/commands/util.js
// Mirrors UtilityModule.cs — the /util slash command group.

import { SlashCommandBuilder, EmbedBuilder, Colors } from 'discord.js';

// ── Subcommand handlers ───────────────────────────────────────────────────────

async function handleSetName(interaction, { nicknameHistory }) {
  const target   = interaction.options.getMember('user');
  const nickname = interaction.options.getString('nickname', true);

  if (!target) {
    return interaction.reply({ content: 'Could not find that user in this server.', ephemeral: true });
  }

  if (target.id === interaction.user.id) {
    return interaction.reply({ content: `<@${target.id}> er en pølse`, ephemeral: true });
  }

  if (nickname.length > 32) {
    return interaction.reply({ content: 'Name must not be longer than 32 characters.', ephemeral: true });
  }

  try {
    await target.setNickname(nickname);
  } catch {
    return interaction.reply({ content: 'Failed to change name. Missing permissions?', ephemeral: true });
  }

  await nicknameHistory.add(target.id, nickname, interaction.user.id);
  await interaction.reply(`Successfully changed <@${target.id}>'s name to **${nickname}**.`);
}

async function handleHistory(interaction, { nicknameHistory }) {
  const target = interaction.options.getMember('user');
  const length = interaction.options.getInteger('length') ?? 5;

  if (!target) {
    return interaction.reply({ content: 'Could not find that user in this server.', ephemeral: true });
  }

  const rows = await nicknameHistory.get(target.id);

  if (!rows.length) {
    return interaction.reply({ content: 'This user has no nickname history.', ephemeral: true });
  }

  const recent = rows.slice(-Math.min(length, rows.length));

  const nicknameStr = recent.map(r => r.nickname).join('\n');
  const authorStr   = recent.map(r => `<@${r.namer}>`).join('\n');
  const dateStr     = recent.map(r => {
    const d = new Date(r.time);
    return `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`;
  }).join('\n');

  const embed = new EmbedBuilder()
    .setColor(Colors.Red)
    .setAuthor({ name: 'Nickname history' })
    .addFields(
      { name: 'User',     value: `<@${target.id}>` },
      { name: 'Nickname', value: nicknameStr, inline: true },
      { name: 'Author',   value: authorStr,   inline: true },
      { name: 'Date',     value: dateStr,      inline: true },
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

async function handleSongHistory(interaction, { songHistory }) {
  const user = interaction.options.getMember('user');

  if (user) {
    const rows = await songHistory.getUserHistory(interaction.guildId, user.id);
    if (!rows.length) {
      return interaction.reply({ content: 'This user has no song history.', ephemeral: true });
    }

    const requestStr = rows.map(r => String(r.requests)).join('\n');
    const nameStr    = rows.map(r => {
      const name = r.songName.length > 50 ? r.songName.slice(0, 50) + '…' : r.songName;
      return `[${name}](${r.songUrl})`;
    }).join('\n');
    const playsStr = rows.map(r => String(r.plays)).join('\n');

    const embed = new EmbedBuilder()
      .setColor(Colors.Red)
      .setAuthor({ name: 'Song history' })
      .addFields(
        { name: 'User',     value: `<@${user.id}>` },
        { name: 'Requests', value: requestStr, inline: true },
        { name: 'Song',     value: nameStr,    inline: true },
        { name: 'Plays',    value: playsStr,   inline: true },
      )
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }

  // Guild-wide history
  const rows = await songHistory.getGuildHistory(interaction.guildId);
  if (!rows.length) {
    return interaction.reply({ content: 'This server has no song history.', ephemeral: true });
  }

  const requestStr = rows.map(r => String(r.requests)).join('\n');
  const nameStr    = rows.map(r => {
    const name = r.songName.length > 50 ? r.songName.slice(0, 50) + '…' : r.songName;
    return `[${name}](${r.songUrl})`;
  }).join('\n');
  const playsStr = rows.map(r => String(r.plays)).join('\n');

  const embed = new EmbedBuilder()
    .setColor(Colors.Red)
    .setAuthor({ name: 'Song history' })
    .addFields(
      { name: 'Requests', value: requestStr, inline: true },
      { name: 'Song',     value: nameStr,    inline: true },
      { name: 'Plays',    value: playsStr,   inline: true },
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

// ── Command definition ────────────────────────────────────────────────────────

const data = new SlashCommandBuilder()
  .setName('util')
  .setDescription('Utility commands')
  .addSubcommand(sub => sub
    .setName('setname')
    .setDescription('Set a server nickname for another user')
    .addUserOption(opt => opt.setName('user').setDescription('The user to rename').setRequired(true))
    .addStringOption(opt => opt.setName('nickname').setDescription('New nickname (max 32 characters)').setRequired(true)))
  .addSubcommand(sub => sub
    .setName('history')
    .setDescription('View nickname history for a user')
    .addUserOption(opt => opt.setName('user').setDescription('The user to look up').setRequired(true))
    .addIntegerOption(opt => opt.setName('length').setDescription('Number of entries to show (default 5)')))
  .addSubcommand(sub => sub
    .setName('songhistory')
    .setDescription('View song history for the server or a specific user')
    .addUserOption(opt => opt.setName('user').setDescription("Optional: a specific user's history")));

const HANDLERS = {
  setname:     handleSetName,
  history:     handleHistory,
  songhistory: handleSongHistory,
};

export default {
  data,
  async execute(interaction, services) {
    const sub     = interaction.options.getSubcommand();
    const handler = HANDLERS[sub];
    if (handler) await handler(interaction, services);
  },
};
