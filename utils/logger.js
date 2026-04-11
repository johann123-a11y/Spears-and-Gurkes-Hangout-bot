const { EmbedBuilder } = require('discord.js');
const { readData } = require('./index');

/**
 * Sends a log embed to the configured log channel.
 * @param {Client} client
 * @param {object} opts
 * @param {string} opts.action  - Title of the log entry
 * @param {string} opts.executor - Who ran the command
 * @param {string} [opts.target] - Who was targeted
 * @param {object} [opts.fields] - Extra fields { label: value }
 * @param {string} [opts.color]  - Embed color hex
 */
async function sendLog(client, { action, executor, target, fields = {}, color = '#5865F2' }) {
  const logs = readData('logs.json');
  if (!logs.channelId) return;

  const channel = client.channels.cache.get(logs.channelId);
  if (!channel) return;

  const extraFields = Object.entries(fields).map(([name, value]) => ({
    name,
    value: String(value),
    inline: true,
  }));

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`📋 ${action}`)
    .addFields(
      { name: 'Ausgeführt von', value: executor, inline: true },
      ...(target ? [{ name: 'Ziel', value: target, inline: true }] : []),
      ...extraFields
    )
    .setTimestamp();

  await channel.send({ embeds: [embed] }).catch(() => {});
}

module.exports = { sendLog };
