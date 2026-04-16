const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { readData, writeData, formatTime } = require('../utils');
const config = require('../config.json');
const { setStick } = require('../commands/admin/stick');
const { handleDMAnswer } = require('../utils/applicationDM');
const { sendLog } = require('../utils/logger');

// Per-channel lock to prevent double-posting sticky on rapid messages
const stickyLocks = new Set();

module.exports = {
  name: 'messageCreate',
  async execute(message, client) {
    if (message.author.bot) return;

    // ── DM: handle application answers ───────────────────────────────────────
    if (!message.guild) {
      await handleDMAnswer(message);
      return;
    }


    // ── Log @everyone / @here pings ──────────────────────────────────────────
    if (message.mentions.everyone) {
      sendLog(client, {
        action: message.content.includes('@everyone') ? '@everyone Ping' : '@here Ping',
        executor: message.author.tag,
        target: `<#${message.channel.id}>`,
        fields: { 'Content': message.content.length > 512 ? message.content.substring(0, 509) + '...' : message.content },
        color: '#FEE75C',
      });
    }

    // ── Auto-Mod: link filter ─────────────────────────────────────────────────
    const isStaff = message.member?.permissions.has(PermissionFlagsBits.ManageMessages);

    if (!isStaff) {
      const urlRegex = /https?:\/\/\S+/gi;
      const inviteRegex = /discord(?:\.gg|app\.com\/invite)\/\S+/gi;
      const hasLink   = urlRegex.test(message.content);
      const hasInvite = inviteRegex.test(message.content);

      // ── Link filter ───────────────────────────────────────────────────────
      const openTickets = readData('openTickets.json') || {};
      const isTicket    = !!openTickets[message.channel.id];

      // ── Link filter (skip if message only contains Discord invites) ──────────
      const mRaw = readData('mediaFilter.json');
      const mediaFilter = { enabled: mRaw?.enabled ?? false, allowedChannels: Array.isArray(mRaw?.allowedChannels) ? mRaw.allowedChannels : [] };
      if (hasLink && !hasInvite && mediaFilter.enabled && !isTicket && !mediaFilter.allowedChannels.includes(message.channel.id)) {
        await message.delete().catch(() => {});
        const warn = await message.channel.send({
          content: `⚠️ <@${message.author.id}> Links are not allowed here!`,
          allowedMentions: { users: [message.author.id] },
        });
        setTimeout(() => warn.delete().catch(() => {}), 8000);
        return;
      }

      // ── Invite filter ─────────────────────────────────────────────────────
      const pRaw = readData('partnerFilter.json');
      const partnerFilter = { enabled: pRaw?.enabled ?? false, allowedChannels: Array.isArray(pRaw?.allowedChannels) ? pRaw.allowedChannels : [] };
      if (hasInvite && partnerFilter.enabled && !isTicket && !partnerFilter.allowedChannels.includes(message.channel.id)) {
        await message.delete().catch(() => {});
        const warn = await message.channel.send({
          content: `⚠️ <@${message.author.id}> Discord invites are not allowed here!`,
          allowedMentions: { users: [message.author.id] },
        });
        setTimeout(() => warn.delete().catch(() => {}), 8000);
        return;
      }
    }

    // --- AFK: author sent a message, remove their AFK ---
    const afk = readData('afk.json');
    if (afk[message.author.id]) {
      const since = afk[message.author.id].since;
      delete afk[message.author.id];
      writeData('afk.json', afk);
      const awayFor = formatTime(Date.now() - since);
      message.reply(`👋 Welcome back! Your AFK has been removed. You were away for **${awayFor}**.`).then(m => {
        setTimeout(() => m.delete().catch(() => {}), 5000);
      });
    }

    // --- AFK / LOA: check mentions ---
    const loa = readData('loa.json');
    const freshAfk = readData('afk.json');

    for (const mentioned of message.mentions.users.values()) {
      if (mentioned.bot) continue;

      // LOA check
      if (loa[mentioned.id]) {
        const data = loa[mentioned.id];
        const remaining = data.endTime - Date.now();
        if (remaining > 0) {
          const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('🏖️ User is on LOA')
            .setDescription(`<@${mentioned.id}> is currently on **Leave of Absence**.`)
            .addFields(
              { name: 'Reason', value: data.reason },
              { name: 'Returns in', value: formatTime(remaining) }
            )
            .setTimestamp();
          message.channel.send({ embeds: [embed] });
        }
      }

      // AFK check
      if (freshAfk[mentioned.id]) {
        const data = freshAfk[mentioned.id];
        const awayFor = formatTime(Date.now() - data.since);
        const embed = new EmbedBuilder()
          .setColor('#FEE75C')
          .setTitle('💤 User is AFK')
          .setDescription(`<@${mentioned.id}> is currently AFK.`)
          .addFields(
            { name: 'Reason', value: data.reason },
            { name: 'Away for', value: awayFor },
            ...(data.until ? [{ name: 'Returns in', value: formatTime(data.until - Date.now()) }] : [])
          )
          .setTimestamp();
        message.channel.send({ embeds: [embed] });
      }
    }

    // --- Sticky message: always keep at bottom, no duplicates ---
    const sticky     = readData('sticky.json');
    const stickyData = sticky[message.channel.id];
    if (stickyData && message.id !== stickyData.messageId && !stickyLocks.has(message.channel.id)) {
      stickyLocks.add(message.channel.id);
      setStick(message.channel, stickyData.text, null)
        .catch(() => {})
        .finally(() => stickyLocks.delete(message.channel.id));
    }

    // --- Prefix command handling ---
    const prefix = config.prefix;
    if (!message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/\s+/);
    const commandName = args.shift().toLowerCase();

    const command = client.commands.get(commandName);
    if (!command) return;

    try {
      await command.execute(message, args, client);
    } catch (err) {
      console.error(`Error in command ${commandName}:`, err);
      message.reply('❌ An error occurred while running that command.').catch(() => {});
    }
  },
};
