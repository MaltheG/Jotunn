// src/deploy-commands.js
// One-shot script to (re-)register slash commands globally.
// Run with: node src/deploy-commands.js
// Useful when iterating on command definitions without restarting the full bot.

import { REST, Routes } from 'discord.js';
import { loadConfig } from './config.js';
import musicCommand  from './commands/music.js';
import casinoCommand from './commands/casino.js';
import utilCommand   from './commands/util.js';

const { token } = loadConfig();

const commands = [musicCommand, casinoCommand, utilCommand].map(c => c.data.toJSON());

const rest = new REST().setToken(token);

// Fetch the application ID
const app = await rest.get(Routes.currentApplication());
console.log(`Deploying ${commands.length} commands for application ${app.id}…`);

await rest.put(Routes.applicationCommands(app.id), { body: commands });
console.log('Done.');
