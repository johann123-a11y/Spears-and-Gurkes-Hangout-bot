const { EmbedBuilder } = require('discord.js');
const { readData } = require('./index');

// In-memory dedup — fast, no race condition, sufficient for a single-instance bot
const dedupCache = new Map();
const DEDUP_TTL = 3000;

function isDuplicate(key) {
  const now = Date.now();
  const last = dedupCache.get(key);
  if (last && now - last < DEDUP_TTL) return true;
  dedupCache.set(key, now);
  // Clean up old entries periodically
  if (dedupCache.size > 500) {
    for (const [k, ts] of dedupCache) {
      if (now - ts > DEDUP_TTL) dedupCache.delete(k);
    }
  }
  return false;
}

async function sendLog(client, { action, executor, target, fields = {}, color = '#5865F2' }) {
  const logs = readData('logs.json');
  if (!logs.channelId) return;

  const channel = client.channels.cache.get(logs.channelId);
  if (!channel) return;

  const dedupKey = `${action}|${executor}|${target}`;
  if (isDuplicate(dedupKey)) return;

  const extraFields = Object.entries(fields).map(([name, value]) => ({
    name,
    value: String(value),
    inline: true,
  }));

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(action)
    .addFields(
      { name: 'Executed by', value: executor, inline: true },
      ...(target ? [{ name: 'Target', value: target, inline: true }] : []),
      ...extraFields
    )
    .setTimestamp();

  await channel.send({ embeds: [embed] }).catch(() => {});
}

module.exports = { sendLog };
