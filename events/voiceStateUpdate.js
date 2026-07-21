const { AuditLogEvent } = require('discord.js');
const { sendLog } = require('../utils/logger');

module.exports = {
  name: 'voiceStateUpdate',
  async execute(oldState, newState, client) {
    const member = newState.member ?? oldState.member;
    if (!member) return;

    const joined = !oldState.channelId && newState.channelId;
    const left   = oldState.channelId && !newState.channelId;
    const moved  = oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId;

    if (!joined && !left && !moved) return;

    const tag = member.user.tag;

    if (joined) {
      sendLog(client, {
        action: '🔊 Voice Channel Joined',
        executor: tag,
        target: `<@${member.id}>`,
        fields: { 'Channel': `<#${newState.channelId}>` },
        color: '#57F287',
      });
      return;
    }

    let kickExec = null;
    let moveExec = null;
    try {
      await new Promise(r => setTimeout(r, 500));
      if (left) {
        const audit = await oldState.guild.fetchAuditLogs({ type: AuditLogEvent.MemberDisconnect, limit: 1 });
        const entry = audit.entries.first();
        if (entry && Date.now() - entry.createdTimestamp < 5000) kickExec = entry.executor;
      }
      if (moved) {
        const audit = await newState.guild.fetchAuditLogs({ type: AuditLogEvent.MemberMove, limit: 1 });
        const entry = audit.entries.first();
        if (entry && Date.now() - entry.createdTimestamp < 5000) moveExec = entry.executor;
      }
    } catch {}

    if (left) {
      if (kickExec) {
        sendLog(client, {
          action: '🔇 Disconnected from Voice',
          executor: kickExec.tag,
          target: `<@${member.id}> (${tag})`,
          fields: {
            'Channel': `<#${oldState.channelId}>`,
            'Disconnected by': `<@${kickExec.id}>`,
          },
          color: '#ED4245',
        });
      } else {
        sendLog(client, {
          action: '🔇 Voice Channel Left',
          executor: tag,
          target: `<@${member.id}>`,
          fields: { 'Channel': `<#${oldState.channelId}>` },
          color: '#FEE75C',
        });
      }
    } else if (moved) {
      if (moveExec) {
        sendLog(client, {
          action: '↔️ Moved to Voice Channel',
          executor: moveExec.tag,
          target: `<@${member.id}> (${tag})`,
          fields: {
            'From': `<#${oldState.channelId}>`,
            'To': `<#${newState.channelId}>`,
            'Moved by': `<@${moveExec.id}>`,
          },
          color: '#5865F2',
        });
      } else {
        sendLog(client, {
          action: '↔️ Switched Voice Channel',
          executor: tag,
          target: `<@${member.id}>`,
          fields: {
            'From': `<#${oldState.channelId}>`,
            'To': `<#${newState.channelId}>`,
          },
          color: '#5865F2',
        });
      }
    }
  },
};
