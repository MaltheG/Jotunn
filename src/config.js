// src/config.js
// Mirrors Program.cs config loading — reads token and database URL from
// environment variables (or a .env file if you use a loader like dotenv).

export function loadConfig() {
  const token       = process.env.JOTUNN_TOKEN;
  const databaseUrl = process.env.JOTUNN_DATABASE_URL;

  if (!token)       throw new Error('JOTUNN_TOKEN environment variable is not set.');
  if (!databaseUrl) throw new Error('JOTUNN_DATABASE_URL environment variable is not set.');

  return { token, databaseUrl };
}
