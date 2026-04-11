const { EmbedBuilder } = require('discord.js');
const { readData } = require('./index');

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
      { name: 'Executed by', value: executor, inline: true },
      ...(target ? [{ name: 'Target', value: target, inline: true }] : []),
      ...extraFields
    )
    .setTimestamp();

  await channel.send({ embeds: [embed] }).catch(() => {});
}

module.exports = { sendLog };
