// src/commands/casino.js
// Mirrors CasinoModule.cs — the /casino slash command group.

import { SlashCommandBuilder, EmbedBuilder, Colors } from 'discord.js';
import { Blackjack } from '../casino/Blackjack.js';
import { Roulette }  from '../casino/Roulette.js';
import { Slots }     from '../casino/Slots.js';

const MIN_BET       = 10;
const CASINO_COLOR  = Colors.Green;
const GOLD_COLOR    = 0xFFD700;

// ── Bet parser (mirrors ParseBetAsync) ───────────────────────────────────────

async function parseBet(raw, guildId, userId, casinoRepo) {
  raw = raw.toLowerCase().trim();

  if (raw === 'all') {
    const bal = await casinoRepo.getBalance(guildId, userId);
    if (!bal) return { bet: 0, error: 'You have no balance!' };
    return { bet: bal, error: null };
  }

  const amount = parseInt(raw, 10);
  if (isNaN(amount)) return { bet: 0, error: 'Nice try dumbo.' };
  if (amount < MIN_BET) return { bet: 0, error: `Minimum bet is ${MIN_BET} TOPS.` };

  const balance = await casinoRepo.getBalance(guildId, userId);
  if (balance === null || balance < amount) {
    return { bet: 0, error: `You're too poor! Your balance is: ${balance ?? 0} TOPS` };
  }

  return { bet: amount, error: null };
}

// ── Blackjack helpers ────────────────────────────────────────────────────────

function buildGameDescription(game, userId, showDealer) {
  const playerVal = Blackjack.handValue(game.playerHand);
  if (showDealer) {
    const dealerVal = Blackjack.handValue(game.dealerHand);
    return `**User**: <@${userId}>\n` +
           `**Your hand**: ${Blackjack.formatHand(game.playerHand)} (${playerVal})\n` +
           `**Dealer hand**: ${Blackjack.formatHand(game.dealerHand)} (${dealerVal})`;
  }
  const dealerFirst = `${game.dealerHand[0].value}${game.dealerHand[0].suit}`;
  return `**User**: <@${userId}>\n` +
         `**Your hand**: ${Blackjack.formatHand(game.playerHand)} (${playerVal})\n` +
         `**Dealer shows**: ${dealerFirst}`;
}

// ── Subcommand handlers ───────────────────────────────────────────────────────

async function handleBalance(interaction, { casinoRepo }) {
  const balance = await casinoRepo.getBalance(interaction.guildId, interaction.user.id);
  if (balance === null) {
    return interaction.reply({ content: "You don't have an account yet. Play a game to get started!", ephemeral: true });
  }
  await interaction.reply(`Your balance is: **${balance} TOPS**`);
}

async function handleGive(interaction, { casinoRepo }) {
  const target = interaction.options.getUser('user', true);
  const amount = interaction.options.getInteger('amount', true);

  if (amount < 0) {
    return interaction.reply({ content: 'Very clever.', ephemeral: true });
  }

  const balance = await casinoRepo.getBalance(interaction.guildId, interaction.user.id);
  if (balance === null || balance < amount) {
    return interaction.reply({ content: `You're too poor! Your balance is: ${balance ?? 0} TOPS`, ephemeral: true });
  }

  await casinoRepo.transfer(interaction.guildId, interaction.user.id, target.id, amount);
  await interaction.reply(`Gifted **${amount} TOPS** to <@${target.id}>! New balance: ${balance - amount} TOPS`);
}

async function handleLeaderboards(interaction, { casinoRepo }) {
  const rows = await casinoRepo.getLeaderboard(interaction.guildId);

  if (!rows.length) {
    return interaction.reply({ content: 'No leaderboards yet!', ephemeral: true });
  }

  const top    = rows.slice(0, 10);
  const posStr = top.map((_, i) => String(i + 1)).join('\n');
  const usrStr = top.map(r => `<@${r.userId}>`).join('\n');
  const balStr = top.map(r => String(r.balance)).join('\n');

  const embed = new EmbedBuilder()
    .setColor(GOLD_COLOR)
    .setTitle(':trophy: Leaderboards :trophy:')
    .addFields(
      { name: 'Pos',     value: posStr, inline: true },
      { name: 'User',    value: usrStr, inline: true },
      { name: 'Balance', value: balStr, inline: true },
    );

  const callerIdx = rows.findIndex(r => r.userId === interaction.user.id);
  if (callerIdx >= 0) {
    embed.addFields(
      { name: '\u200b',  value: 'Your position:' },
      { name: 'Pos',     value: `${callerIdx + 1} / ${rows.length}`, inline: true },
      { name: 'User',    value: `<@${interaction.user.id}>`,          inline: true },
      { name: 'Balance', value: String(rows[callerIdx].balance),      inline: true },
    );
  }

  await interaction.reply({ embeds: [embed] });
}

async function handleSlots(interaction, { casinoRepo }) {
  const betStr = interaction.options.getString('bet', true);
  const { bet, error } = await parseBet(betStr, interaction.guildId, interaction.user.id, casinoRepo);
  if (error) return interaction.reply({ content: error, ephemeral: true });

  const result = Slots.spin(bet);
  const embed  = new EmbedBuilder()
    .setColor(CASINO_COLOR)
    .setTitle('Slots:')
    .addFields(
      { name: '\u200b', value: Slots.emoji(result.s1), inline: true },
      { name: '\u200b', value: Slots.emoji(result.s2), inline: true },
      { name: '\u200b', value: Slots.emoji(result.s3), inline: true },
    );

  if (result.win) {
    embed.addFields({ name: 'You won!', value: `Prize: ${result.balanceChange} TOPS 🔥!` });
    await casinoRepo.addWin(interaction.guildId, interaction.user.id, result.balanceChange - bet);
  } else {
    embed.addFields({ name: 'You lost!', value: `Loss: ${bet} TOPS 😭!` });
    await casinoRepo.addLoss(interaction.guildId, interaction.user.id, Math.abs(result.balanceChange));
  }

  await interaction.reply({ embeds: [embed] });
}

async function handleRoulette(interaction, { casinoRepo }) {
  let bet = interaction.options.getString('bet', true).toLowerCase().trim();
  if (!Roulette.isValidBet(bet)) {
    return interaction.reply({
      content: `**${bet}** is not a valid bet. Choose: red/black/green/odd/even/1st/2nd/3rd or 0-36.`,
      ephemeral: true,
    });
  }

  const amountStr = interaction.options.getString('amount', true);
  const { bet: amount, error } = await parseBet(amountStr, interaction.guildId, interaction.user.id, casinoRepo);
  if (error) return interaction.reply({ content: error, ephemeral: true });

  const result = Roulette.spin(bet, amount);
  const embed  = new EmbedBuilder()
    .setColor(CASINO_COLOR)
    .setTitle('Roulette:')
    .setDescription(`Result: ${result.color}`);

  if (result.win) {
    embed.addFields({ name: 'You won!', value: `Prize: ${result.balanceChange} TOPS 🔥!` });
    await casinoRepo.addWin(interaction.guildId, interaction.user.id, result.balanceChange - amount);
  } else {
    embed.addFields({ name: 'You lost!', value: `Loss: ${amount} TOPS 😭!` });
    await casinoRepo.addLoss(interaction.guildId, interaction.user.id, Math.abs(result.balanceChange));
  }

  await interaction.reply({ embeds: [embed] });
}

async function handleBlackjack(interaction, { casinoRepo }) {
  const existing = Blackjack.getGame(interaction.user.id);
  if (existing?.status === 'playing') {
    return interaction.reply({
      content: "You're already in a game. Use `/casino hit` or `/casino stand`.",
      ephemeral: true,
    });
  }

  const betStr = interaction.options.getString('bet', true);
  const { bet, error } = await parseBet(betStr, interaction.guildId, interaction.user.id, casinoRepo);
  if (error) return interaction.reply({ content: error, ephemeral: true });

  const game = Blackjack.createGame(interaction.user.id, bet);
  const embed = new EmbedBuilder()
    .setColor(CASINO_COLOR)
    .setTitle('Blackjack:')
    .setDescription(buildGameDescription(game, interaction.user.id, false));

  await interaction.reply({ embeds: [embed] });
}

async function handleHit(interaction, { casinoRepo }) {
  const result = Blackjack.hit(interaction.user.id);
  if (!result) {
    return interaction.reply({ content: "You're not in a game!", ephemeral: true });
  }

  const game  = Blackjack.getGame(interaction.user.id);
  const embed = new EmbedBuilder()
    .setColor(CASINO_COLOR)
    .setTitle('Blackjack:')
    .setDescription(buildGameDescription(game, interaction.user.id, false));

  if (result.bust) {
    embed.addFields({ name: 'Busted!', value: `You lost ${result.bet} TOPS 😭` });
    await casinoRepo.addLoss(interaction.guildId, interaction.user.id, result.bet);
    Blackjack.clearGame(interaction.user.id);
  }

  await interaction.reply({ embeds: [embed] });
}

async function handleStand(interaction, { casinoRepo }) {
  const result = Blackjack.stand(interaction.user.id);
  if (!result) {
    return interaction.reply({ content: "You're not in a game!", ephemeral: true });
  }

  const game  = Blackjack.getGame(interaction.user.id);
  const embed = new EmbedBuilder()
    .setColor(CASINO_COLOR)
    .setTitle('Blackjack:')
    .setDescription(buildGameDescription(game, interaction.user.id, true));

  switch (result.outcome) {
    case 'win':
      embed.addFields({ name: 'You won!', value: `Prize: ${result.payout} TOPS 🔥` });
      await casinoRepo.addWin(interaction.guildId, interaction.user.id, result.payout);
      break;
    case 'push':
      embed.addFields({ name: 'Push!', value: "It's a tie, your bet is returned." });
      break;
    case 'lose':
      embed.addFields({ name: `You lost ${result.bet} TOPS 😭`, value: 'Better luck next time!' });
      await casinoRepo.addLoss(interaction.guildId, interaction.user.id, result.bet);
      break;
  }

  await interaction.reply({ embeds: [embed] });
  Blackjack.clearGame(interaction.user.id);
}

// ── Command definition ────────────────────────────────────────────────────────

const data = new SlashCommandBuilder()
  .setName('casino')
  .setDescription('Casino commands')
  .addSubcommand(sub => sub.setName('balance').setDescription('Check your TOPS balance'))
  .addSubcommand(sub => sub
    .setName('give')
    .setDescription('Gift TOPS to another user')
    .addUserOption(opt => opt.setName('user').setDescription('Recipient').setRequired(true))
    .addIntegerOption(opt => opt.setName('amount').setDescription('Amount to gift').setRequired(true)))
  .addSubcommand(sub => sub.setName('leaderboards').setDescription('Show the TOPS leaderboard'))
  .addSubcommand(sub => sub
    .setName('slots')
    .setDescription('Spin the slot machine')
    .addStringOption(opt => opt.setName('bet').setDescription("Amount to bet (or 'all')").setRequired(true)))
  .addSubcommand(sub => sub
    .setName('roulette')
    .setDescription('Bet on roulette')
    .addStringOption(opt => opt.setName('bet').setDescription('red/black/green/odd/even/1st/2nd/3rd or 0-36').setRequired(true))
    .addStringOption(opt => opt.setName('amount').setDescription("Amount to bet (or 'all')").setRequired(true)))
  .addSubcommand(sub => sub
    .setName('blackjack')
    .setDescription('Start a blackjack game')
    .addStringOption(opt => opt.setName('bet').setDescription("Amount to bet (or 'all')").setRequired(true)))
  .addSubcommand(sub => sub.setName('hit').setDescription('Draw another card in blackjack'))
  .addSubcommand(sub => sub.setName('stand').setDescription('Stand in blackjack'));

const HANDLERS = {
  balance:     handleBalance,
  give:        handleGive,
  leaderboards: handleLeaderboards,
  slots:       handleSlots,
  roulette:    handleRoulette,
  blackjack:   handleBlackjack,
  hit:         handleHit,
  stand:       handleStand,
};

export default {
  data,
  async execute(interaction, services) {
    const sub     = interaction.options.getSubcommand();
    const handler = HANDLERS[sub];
    if (handler) await handler(interaction, services);
  },
};
