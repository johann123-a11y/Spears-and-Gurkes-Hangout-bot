const { EmbedBuilder } = require('discord.js');
const { readData } = require('./index');
const Store = require('../models/Store');

async function sendLog(client, { action, executor, target, fields = {}, color = '#5865F2' }) {
  const logs = readData('logs.json');
  if (!logs.channelId) return;

  const channel = client.channels.cache.get(logs.channelId);
  if (!channel) return;

  // Cross-instance deduplication via MongoDB — prevents doubles when multiple instances run
  const dedupKey = `dedup_log:${action}|${executor}|${target}`;
  const now = Date.now();
  try {
    const existing = await Store.findOne({ key: dedupKey });
    if (existing && now - existing.data.ts < 3000) return;
    await Store.findOneAndUpdate(
      { key: dedupKey },
      { $set: { data: { ts: now } } },
      { upsert: true }
    );
  } catch { /* if dedup fails, still send */ }

  const extraFields = Object.entries(fields).map(([name, value]) => ({
    name,
    value: String(value),
    inline: true,
  }));

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`${action}`)
    .addFields(
      { name: '🛡️ Executed by', value: executor, inline: true },
      ...(target ? [{ name: '🎯 Target', value: target, inline: true }] : []),
      ...extraFields
    )
    .setTimestamp();

  await channel.send({ embeds: [embed] }).catch(() => {});
}

module.exports = { sendLog };
