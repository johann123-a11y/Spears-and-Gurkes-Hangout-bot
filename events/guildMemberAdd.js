const { EmbedBuilder, AuditLogEvent } = require('discord.js');
const { readData, writeData } = require('../utils');
const { sendLog } = require('../utils/logger');

const ALERT_USERS = ['1321846194758222017', '1069649442828992523'];

// Deduplicate: track recently welcomed users to prevent double-firing
const recentlyWelcomed = new Map();

module.exports = {
  name: 'guildMemberAdd',
  async execute(member, client) {
    // Bot-add detection — runs before any other logic
    if (member.user.bot) {
      const cfg = readData('antiraid.json');
      if (cfg.enabled === false) return;

      const antiraidCh = cfg.channelId ? member.guild.channels.cache.get(cfg.channelId) : null;

      // Wait briefly for the audit log entry to appear
      await new Promise(r => setTimeout(r, 1500));

      let addedBy = null;
      try {
        const logs = await member.guild.fetchAuditLogs({ type: AuditLogEvent.BotAdd, limit: 5 });
        const entry = logs.entries.find(e => e.target?.id === member.id);
        if (entry) addedBy = entry.executor;
      } catch {}

      // Kick the bot
      await member.kick('AntiRaid: Unauthorized bot added').catch(() => {});

      // Remove all roles from whoever added the bot
      if (addedBy) {
        const adderMember = await member.guild.members.fetch(addedBy.id).catch(() => null);
        if (adderMember) {
          const rolesToRemove = [...adderMember.roles.cache.values()]
            .filter(r => r.id !== member.guild.id && !r.managed)
            .map(r => r.id);
          if (rolesToRemove.length)
            await adderMember.roles.remove(rolesToRemove, 'AntiRaid: Added unauthorized bot').catch(() => {});
        }
      }

      // Ping spear700 + gurkenaffr 5 times
      if (antiraidCh) {
        const pingContent = ALERT_USERS.map(id => `<@${id}>`).join(' ');
        for (let i = 0; i < 5; i++) {
          await antiraidCh.send({
            content: pingContent,
            allowedMentions: { users: ALERT_USERS },
          }).catch(() => {});
        }

        await antiraidCh.send({
          embeds: [new EmbedBuilder()
            .setColor('#ED4245')
            .setTitle('🚨 Unauthorized Bot Added!')
            .setThumbnail(member.user.displayAvatarURL())
            .addFields(
              { name: '🤖 Bot',            value: `${member.user.tag} (<@${member.id}>)`,                               inline: true },
              { name: '🆔 Bot ID',          value: member.id,                                                            inline: true },
              { name: '📅 Account Created', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`,           inline: true },
              { name: '👤 Added by',        value: addedBy ? `${addedBy.tag} (<@${addedBy.id}>)` : 'Unknown',           inline: true },
              { name: '🕐 Gekickt um',      value: `<t:${Math.floor(Date.now() / 1000)}:F>`,                             inline: true },
              { name: '⚡ Actions taken',   value: '✅ Bot gekickt\n✅ Alle Rollen des Adders entfernt',                inline: false },
            )
            .setTimestamp()],
        }).catch(() => {});
      }

      sendLog(client, {
        action: '🚨 AntiRaid — Unauthorized Bot Added',
        executor: addedBy?.tag || 'Unknown',
        target: member.user.tag,
        fields: {
          'Bot':             `${member.user.tag} (${member.id})`,
          'Hinzugefügt von': addedBy ? `${addedBy.tag} (${addedBy.id})` : 'Unknown',
          'Aktion':          'Bot gekickt, alle Rollen des Adders entfernt',
        },
        color: '#ED4245',
      });

      return;
    }

    const key = `${member.guild.id}:${member.id}`;
    const now = Date.now();
    if (recentlyWelcomed.has(key) && now - recentlyWelcomed.get(key) < 10_000) return;
    recentlyWelcomed.set(key, now);
    setTimeout(() => recentlyWelcomed.delete(key), 10_000);

    // Always log join regardless of welcome settings
    sendLog(client, {
      action: '👋 Member Joined',
      executor: member.user.tag,
      target: `<@${member.id}>`,
      fields: {
        '📅 Account Created': `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`,
        '👥 Members': `${member.guild.memberCount}`,
      },
      color: '#57F287',
    });

    // Auto-role
    const autorole = readData('autorole.json');
    if (autorole.roleId) {
      member.roles.add(autorole.roleId).catch(() => {});
    }

    const data = readData('welcome.json');
    if (!data.enabled || !data.channel) return;

    const channel = member.guild.channels.cache.get(data.channel);
    if (!channel) return;

    const text = (data.message || 'Welcome {member} to **{server}**! You are member #{membercount}.')
      .replace('{member}', `<@${member.id}>`)
      .replace('{server}', member.guild.name)
      .replace('{membercount}', member.guild.memberCount.toString());

    channel.send({ content: text, allowedMentions: { users: [member.id] } }).catch(() => {});
  },
};
