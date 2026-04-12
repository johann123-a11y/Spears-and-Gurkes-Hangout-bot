const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AuditLogEvent } = require('discord.js');
const { readData } = require('../utils');

module.exports = {
  name: 'guildMemberRemove',
  async execute(member) {
    console.log(`[guildMemberRemove] fired for ${member.user?.tag}`);
    const data = readData('leave.json');
    const defaultMsg = 'Hey {user}, schade dass du unseren Server verlassen hast. Wir hoffen dich bald wiederzusehen!';
    const messageText = data.message || defaultMsg;

    // Wait 2s so Discord has time to write the kick/ban audit log entry
    await new Promise(r => setTimeout(r, 2000));

    // Skip DM if the user was kicked or banned
    try {
      const [kickLogs, banLogs] = await Promise.all([
        member.guild.fetchAuditLogs({ type: AuditLogEvent.MemberKick, limit: 3 }),
        member.guild.fetchAuditLogs({ type: AuditLogEvent.MemberBanAdd, limit: 3 }),
      ]);
      const allEntries = [...kickLogs.entries.values(), ...banLogs.entries.values()];
      const wasForced = allEntries.find(e =>
        e.target?.id === member.user.id &&
        Date.now() - e.createdTimestamp < 10000
      );
      if (wasForced) return;
    } catch (err) {
      console.error('[guildMemberRemove] Audit log check failed:', err.message);
      // No audit log access — continue and send DM anyway
    }

    const dmMessage = messageText.replace('{user}', member.user.username);

    const embed = new EmbedBuilder()
      .setColor('#ED4245')
      .setTitle('👋 You left the server')
      .setDescription(dmMessage)
      .setThumbnail(member.guild.iconURL({ dynamic: true }))
      .setFooter({ text: member.guild.name })
      .setTimestamp();

    if (data.invite) {
      embed.addFields({ name: '🔗 Rejoin anytime', value: data.invite });
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`leave_reason_btn:${member.guild.id}:${member.user.id}`)
        .setLabel('Tell us why you left')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('💬'),
    );

    try {
      await member.user.send({ embeds: [embed], components: [row] });
      console.log(`[guildMemberRemove] DM sent to ${member.user.tag}`);
    } catch (err) {
      console.log(`[guildMemberRemove] Could not DM ${member.user.tag}: ${err.message}`);
    }
  },
};
