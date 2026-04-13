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
  let giveawaysChanged = false;
  for (const [msgId, gw] of Object.entries(giveaways)) {
    if (!gw.ended && gw.endTime <= now) {
      try {
        const guild = client.guilds.cache.get(gw.guildId);
        if (!guild) continue;
        const channel = await guild.channels.fetch(gw.channelId).catch(() => null);
        if (!channel) {
          giveaways[msgId].fetchFailures = (gw.fetchFailures || 0) + 1;
          if (giveaways[msgId].fetchFailures >= 3) {
            giveaways[msgId].ended = true;
            console.log(`Giveaway ${msgId} cancelled — channel not found after 3 attempts.`);
          }
          giveawaysChanged = true;
          continue;
        }
        const msg = await channel.messages.fetch(msgId).catch(() => null);
        if (!msg) {
          giveaways[msgId].fetchFailures = (gw.fetchFailures || 0) + 1;
          if (giveaways[msgId].fetchFailures >= 3) {
            giveaways[msgId].ended = true;
            console.log(`Giveaway ${msgId} cancelled — message not found after 3 attempts.`);
          }
          giveawaysChanged = true;
          continue;
        }
        // Reset failures on success
        giveaways[msgId].fetchFailures = 0;
        giveawaysChanged = true;
        await endGiveaway(msgId, guild, channel);
      } catch { /* ignore */ }
    }
  }
  if (giveawaysChanged) writeData('giveaways.json', giveaways);

  // --- Activity check expiry ---
  const { handleStrike } = require('../commands/strikes/strike');
  const checks = readData('activitychecks.json');
  let checksChanged = false;
  for (const [msgId, check] of Object.entries(checks)) {
    if (!check.processed && check.deadline <= now) {
      try {
        const guild = client.guilds.cache.get(check.guildId);
        if (!guild) continue;
        const members = await guild.members.fetch();
        const staffRoleIds = config.staffRoles.map(k => config.roles[k]).filter(id => id && !id.endsWith('_ROLE_ID'));
        const staffMembers = members.filter(m => !m.user.bot && staffRoleIds.some(id => m.roles.cache.has(id)));
        const responded = check.respondedUserIds || [];
        const notResponded = staffMembers.filter(m => !responded.includes(m.id));

        const channel = guild.channels.cache.get(check.channelId);

        // Strike all who didn't respond
        for (const [, member] of notResponded) {
          await handleStrike('add', member, 'Did not respond to activity check in time', client.user, guild, channel);
        }

        // Disable the button on the original message
        if (channel) {
          const gwMsg = await channel.messages.fetch(msgId).catch(() => null);
          if (gwMsg) await gwMsg.edit({ components: [] }).catch(() => {});

          // Post results
          const embed = new EmbedBuilder()
            .setColor(notResponded.size > 0 ? '#ED4245' : '#57F287')
            .setTitle('📋 Activity Check Results')
            .addFields(
              { name: '✅ Responded', value: `${responded.length}`, inline: true },
              { name: '⚠️ Striked', value: `${notResponded.size}`, inline: true },
              { name: 'Striked Members', value: notResponded.size > 0 ? [...notResponded.values()].map(m => `<@${m.id}>`).join(', ') : 'None' }
            )
            .setTimestamp();
          channel.send({ embeds: [embed] });
        }
      } catch (err) {
        console.error('Activity check error:', err);
      }
      checks[msgId].processed = true;
      checksChanged = true;
    }
  }
  if (checksChanged) writeData('activitychecks.json', checks);
}
