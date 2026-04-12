const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AuditLogEvent } = require('discord.js');
const { readData } = require('../utils');

module.exports = {
  name: 'guildMemberRemove',
  async execute(member) {
    const data = readData('leave.json');
    if (!data.message || !data.invite) return; // not configured

    // Check audit log — skip DM if the user was kicked or banned
    try {
      const logs = await member.guild.fetchAuditLogs({ limit: 5 });
      const recent = logs.entries.find(e =>
        (e.action === AuditLogEvent.MemberKick || e.action === AuditLogEvent.MemberBanAdd) &&
        e.target?.id === member.user.id &&
        Date.now() - e.createdTimestamp < 5000
      );
      if (recent) return;
    } catch {
      // No audit log access — still send DM to be safe
    }

    const dmMessage = data.message.replace('{user}', member.user.username);

    const embed = new EmbedBuilder()
      .setColor('#ED4245')
      .setTitle('👋 You left the server')
      .setDescription(dmMessage)
      .addFields({ name: '🔗 Rejoin anytime', value: data.invite })
      .setThumbnail(member.guild.iconURL({ dynamic: true }))
      .setFooter({ text: member.guild.name })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`leave_reason_btn:${member.guild.id}:${member.user.id}`)
        .setLabel('Tell us why you left')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('💬'),
    );

    try {
      await member.user.send({ embeds: [embed], components: [row] });
    } catch {
      // DMs closed — silently ignore
    }
  },
};
