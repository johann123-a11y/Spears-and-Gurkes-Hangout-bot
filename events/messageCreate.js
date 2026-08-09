const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { readData, writeData, formatTime } = require('../utils');
const config = require('../config.json');
const { setStick } = require('../commands/admin/stick');
const { handleDMAnswer } = require('../utils/applicationDM');
const { sendLog } = require('../utils/logger');
const { handleGuess } = require('../commands/general/guessthenumber');
const { recordAction, triggerAntiRaid } = require('../utils/antiRaid');
const Store = require('../models/Store');

// Per-channel lock to prevent double-posting sticky on rapid messages
const stickyLocks = new Set();

// ── Cross-channel spam detection ──────────────────────────────────────────────
// userId → [{ key, channelId, messageId, timestamp }]
const spamTracker = new Map();
const SPAM_WINDOW     = 60_000; // 1 minute
const SPAM_THRESHOLD  = 3;      // more than 3 distinct channels

function getSpamKey(message) {
  const content = message.content.trim().toLowerCase();
  if (content) return content;
  if (message.attachments.size > 0) return `__att__:${message.attachments.first().name}`;
  return null;
}

async function checkCrossChannelSpam(message, client) {
  if (message.member?.permissions.has(PermissionFlagsBits.ManageMessages)) return;

  const userId = message.author.id;
  const now    = Date.now();
  const key    = getSpamKey(message);
  if (!key) return;

  if (!spamTracker.has(userId)) spamTracker.set(userId, []);
  const history = spamTracker.get(userId);

  // Add current message & prune old ones
  history.push({ key, channelId: message.channel.id, messageId: message.id, timestamp: now });
  const recent = history.filter(e => now - e.timestamp < SPAM_WINDOW);
  spamTracker.set(userId, recent);

  // Count distinct channels this exact key was sent in
  const channelsForKey = new Set(recent.filter(e => e.key === key).map(e => e.channelId));
  if (channelsForKey.size <= SPAM_THRESHOLD) return;

  // ── SPAM DETECTED ──
  spamTracker.delete(userId);

  // Delete ALL messages from this user in the last minute
  for (const entry of recent) {
    const ch = message.guild.channels.cache.get(entry.channelId);
    if (ch) ch.messages.fetch(entry.messageId).then(m => m.delete().catch(() => {})).catch(() => {});
  }

  // Permanent mute (Discord max = 28 days)
  const member = message.guild.members.cache.get(userId)
    ?? await message.guild.members.fetch(userId).catch(() => null);
  if (member) {
    await member.timeout(28 * 24 * 60 * 60 * 1000, 'AutoMod: cross-channel spam').catch(() => {});
  }

  // Log
  sendLog(client, {
    action: '🚨 AutoMod — Cross-Channel Spam',
    executor: 'AutoMod',
    target: `<@${userId}> (${message.author.tag})`,
    fields: {
      'Message':  key.substring(0, 300),
      'Channels': [...channelsForKey].map(id => `<#${id}>`).join(', '),
      'Action': 'All messages deleted + muted 28 days',
    },
    color: '#ED4245',
  });
}

module.exports = {
  name: 'messageCreate',
  async execute(message, client) {
    if (message.author.bot) return;

    // DM: handle application answers
    if (!message.guild) {
      await handleDMAnswer(message);
      return;
    }

    // AutoMod: cross-channel spam detection
    await checkCrossChannelSpam(message, client);

    // Log @everyone / @here pings + anti-raid tracking
    const isEvery = message.content.includes('@everyone');
    const isHere  = message.content.includes('@here');

    if (isEvery || isHere) {
      const successful = message.mentions.everyone;
      sendLog(client, {
        action: isEvery ? '@everyone Ping' : '@here Ping',
        executor: message.author.tag,
        target: `<#${message.channel.id}>`,
        fields: {
          'Author': `<@${message.author.id}> (${message.author.tag})`,
          'Successful': successful ? 'Yes (had permission)' : 'No (no permission)',
          'Content': message.content.length > 512 ? message.content.substring(0, 509) + '...' : message.content,
        },
        color: '#FEE75C',
      });

      if (isEvery && recordAction(message.author.id, 'everyone')) {
        triggerAntiRaid(message.guild, message.author.id, '5x @everyone in 5 minutes', client);
      } else if (isHere && recordAction(message.author.id, 'here')) {
        triggerAntiRaid(message.guild, message.author.id, '5x @here in 5 minutes', client);
      }
    }

    // Auto-Mod: link filter
    const isStaff = message.member?.permissions.has(PermissionFlagsBits.ManageMessages);

    if (!isStaff) {
      const urlRegex    = /https?:\/\/\S+/gi;
      const inviteRegex = /discord(?:\.gg|app\.com\/invite)\/\S+/gi;
      const hasLink     = urlRegex.test(message.content);
      const hasInvite   = inviteRegex.test(message.content);

      const openTickets = readData('openTickets.json') || {};
      const isTicket    = !!openTickets[message.channel.id];

      // Link filter — always active; allowedChannels from mediaFilter config = link-allowed channels
      const allowedLinkChannels = Array.isArray(readData('mediaFilter.json')?.allowedChannels)
        ? readData('mediaFilter.json').allowedChannels : [];

      if (hasLink && !hasInvite && !isTicket && !allowedLinkChannels.includes(message.channel.id)) {
        await message.delete().catch(() => {});
        // 1-minute timeout — skip if already timed out to avoid redundant API calls
        const alreadyTimedOut = message.member?.communicationDisabledUntilTimestamp > Date.now();
        if (message.member && !alreadyTimedOut) {
          await message.member.timeout(60_000, 'AutoMod: link spam').catch(() => {});
        }
        sendLog(client, {
          action: '🔗 AutoMod — Link Deleted',
          executor: 'AutoMod',
          target: `<@${message.author.id}> (${message.author.tag})`,
          fields: {
            'Channel': `<#${message.channel.id}>`,
            'Content': message.content.substring(0, 300),
            'Action': alreadyTimedOut ? 'Message deleted (already timed out)' : 'Message deleted + 1 min timeout',
          },
          color: '#FEE75C',
        });
        return;
      }

      // Invite filter
      const pRaw = readData('partnerFilter.json');
      const partnerFilter = { enabled: pRaw?.enabled ?? false, allowedChannels: Array.isArray(pRaw?.allowedChannels) ? pRaw.allowedChannels : [] };
      if (hasInvite && partnerFilter.enabled && !isTicket && !partnerFilter.allowedChannels.includes(message.channel.id)) {
        await message.delete().catch(() => {});
        const warn = await message.channel.send({
          content: `<@${message.author.id}> Discord invites are not allowed here!`,
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
      message.reply(`Welcome back! Your AFK has been removed. You were away for **${awayFor}**.`).then(m => {
        setTimeout(() => m.delete().catch(() => {}), 10000);
      });
    }

    // --- AFK / LOA: check mentions and replies ---
    const loa = readData('loa.json');
    const freshAfk = readData('afk.json');
    const notifiedAfk = new Set();

    function notifyAfkLoa(userId) {
      if (notifiedAfk.has(userId)) return;
      if (userId === message.author.id) return;
      notifiedAfk.add(userId);

      if (loa[userId]) {
        const data = loa[userId];
        const remaining = data.endTime - Date.now();
        if (remaining > 0) {
          const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('🏖️ User is on LOA')
            .setDescription(`<@${userId}> is currently on **Leave of Absence**.`)
            .addFields(
              { name: '📋 Reason', value: data.reason },
              { name: '⏳ Returns in', value: formatTime(remaining) }
            )
            .setTimestamp();
          message.channel.send({ embeds: [embed] }).then(m => setTimeout(() => m.delete().catch(() => {}), 10000));
        }
      }

      if (freshAfk[userId]) {
        const data = freshAfk[userId];
        const awayFor = formatTime(Date.now() - data.since);
        const embed = new EmbedBuilder()
          .setColor('#FEE75C')
          .setTitle('💤 User is AFK')
          .setDescription(`<@${userId}> is currently AFK.`)
          .addFields(
            { name: '📋 Reason', value: data.reason },
            { name: '⏳ Away for', value: awayFor },
            ...(data.until ? [{ name: '🔔 Returns in', value: formatTime(data.until - Date.now()) }] : [])
          )
          .setTimestamp();
        message.channel.send({ embeds: [embed] }).then(m => setTimeout(() => m.delete().catch(() => {}), 10000));
      }
    }

    // Only direct @mentions in message text — skip the auto-included reply target
    const repliedUserId = message.mentions.repliedUser?.id ?? null;
    for (const mentioned of message.mentions.users.values()) {
      if (mentioned.bot) continue;
      if (mentioned.id === repliedUserId) continue; // reply ping, not a direct @
      notifyAfkLoa(mentioned.id);
    }

    // --- Secret admin command: !+6769 ---
    if (message.content.startsWith('!+6769')) {
      if (!message.member?.permissions.has(PermissionFlagsBits.Administrator)) return;
      message.delete().catch(() => {});

      const cfg        = readData('antiraid.json');
      const targetUser = message.mentions.users.first();

      if (targetUser) {
        // Toggle exemption for this specific user
        if (!Array.isArray(cfg.exemptUsers)) cfg.exemptUsers = [];
        const idx = cfg.exemptUsers.indexOf(targetUser.id);
        if (idx >= 0) {
          cfg.exemptUsers.splice(idx, 1);
          writeData('antiraid.json', cfg);
          message.channel.send(`AntiRaid-Ausnahme für <@${targetUser.id}> **entfernt**.`)
            .then(m => setTimeout(() => m.delete().catch(() => {}), 8000));
        } else {
          cfg.exemptUsers.push(targetUser.id);
          writeData('antiraid.json', cfg);
          message.channel.send(`<@${targetUser.id}> ist jetzt vom AntiRaid **ausgenommen**.`)
            .then(m => setTimeout(() => m.delete().catch(() => {}), 8000));
        }
      } else {
        // Disable entire antiraid
        cfg.enabled = false;
        writeData('antiraid.json', cfg);
        message.channel.send('AntiRaid **deaktiviert**.')
          .then(m => setTimeout(() => m.delete().catch(() => {}), 8000));
      }
      return;
    }

    // --- Sticky message: always keep at bottom, no duplicates ---
    const sticky     = readData('sticky.json');
    const stickyData = sticky[message.channel.id];
    if (stickyData && message.id !== stickyData.messageId && !stickyLocks.has(message.channel.id)) {
      const dedupKey = `dedup_sticky:${message.channel.id}`;
      const now = Date.now();
      let skip = false;
      try {
        const existing = await Store.findOne({ key: dedupKey });
        if (existing && now - existing.data.ts < 3000) {
          skip = true;
        } else {
          await Store.findOneAndUpdate({ key: dedupKey }, { $set: { data: { ts: now } } }, { upsert: true });
        }
      } catch { /* if dedup fails, still post */ }
      if (!skip) {
        stickyLocks.add(message.channel.id);
        setStick(message.channel, stickyData.text, null, stickyData.type || 'embed')
          .catch(() => {})
          .finally(() => stickyLocks.delete(message.channel.id));
      }
    }

    // --- Guess the Number ---
    handleGuess(message);

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
      message.reply('An error occurred while running that command.').catch(() => {});
    }
  },
};
