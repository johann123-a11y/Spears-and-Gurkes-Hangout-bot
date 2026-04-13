const { EmbedBuilder } = require('discord.js');
const { readData, writeData, formatTime } = require('../utils');
const config = require('../config.json');
const { endGiveaway } = require('../commands/giveaways/gend');

module.exports = {
  name: 'clientReady',
  once: true,
  async execute(client) {
    console.log(`✅ Logged in as ${client.user.tag}`);
    client.user.setActivity('Spears and Gurkes Hangout', { type: 3 });

    // Check timers every 30 seconds
    setInterval(() => checkTimers(client), 30_000);

  },
};

async function checkTimers(client) {
  const now = Date.now();

  // --- LOA expiry ---
  const loa = readData('loa.json');
  let loaChanged = false;
  for (const [userId, data] of Object.entries(loa)) {
    if (data.endTime <= now) {
      try {
        const guild = client.guilds.cache.get(config.guildId);
        const loaChannel = guild?.channels.cache.get(config.loaChannel);
        if (loaChannel) {
          const embed = new EmbedBuilder()
            .setColor('#57F287')
            .setTitle('✅ LOA Ended — Staff Member Returned')
            .setDescription(`<@${userId}> (**${data.username}**) is back from their Leave of Absence!`)
            .setTimestamp();
          loaChannel.send({ embeds: [embed] });
        }
      } catch { /* ignore */ }

      delete loa[userId];
      loaChanged = true;
    }
  }
  if (loaChanged) writeData('loa.json', loa);

  // --- AFK expiry ---
  const afk = readData('afk.json');
  let afkChanged = false;
  for (const [userId, data] of Object.entries(afk)) {
    if (data.until && data.until <= now) {
      delete afk[userId];
      afkChanged = true;
    }
  }
  if (afkChanged) writeData('afk.json', afk);

  // --- Giveaway expiry ---
  const giveaways = readData('giveaways.json');
  for (const [msgId, gw] of Object.entries(giveaways)) {
    if (!gw.ended && gw.endTime <= now) {
      try {
        const guild = client.guilds.cache.get(gw.guildId);
        if (guild) {
          const channel = await guild.channels.fetch(gw.channelId).catch(() => null);
          await endGiveaway(msgId, guild, channel);
        }
      } catch { /* ignore */ }
    }
  }
}
