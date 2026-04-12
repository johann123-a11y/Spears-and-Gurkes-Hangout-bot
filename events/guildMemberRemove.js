const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AuditLogEvent } = require('discord.js');
const { readData } = require('../utils');

module.exports = {
  name: 'guildMemberRemove',
  async execute(member) {
    console.log(`[guildMemberRemove] fired for ${member.user?.tag}`);

    // Open DM channel immediately while still in mutual guild
    let dmChannel;
    try {
      dmChannel = await member.user.createDM();
    } catch (err) {
      console.log(`[guildMemberRemove] Cannot open DM for ${member.user?.tag}: ${err.message}`);
      return;
    }

    // Check audit log — skip if kicked or banned
    try {
      const [kickLogs, banLogs] = await Promise.all([
        member.guild.fetchAuditLogs({ type: AuditLogEvent.MemberKick, limit: 3 }),
        member.guild.fetchAuditLogs({ type: AuditLogEvent.MemberBanAdd, limit: 3 }),
      ]);
      const allEntries = [...kickLogs.entries.values(), ...banLogs.entries.values()];
      const wasForced = allEntries.find(e =>
        e.target?.id === member.user.id &&
        Date.now() - e.createdTimestamp < 15000
      );
      if (wasForced) {
        console.log(`[guildMemberRemove] Skipped DM — was kicked/banned`);
        return;
      }
    } catch (err) {
      console.error('[guildMemberRemove] Audit log check failed:', err.message);
    }

    const data = readData('leave.json');
    const defaultMsg = 'Hey {user}, schade dass du unseren Server verlassen hast. Wir hoffen dich bald wiederzusehen!';
    const dmMessage = (data.message || defaultMsg).replace('{user}', member.user.username);

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
      await dmChannel.send({ embeds: [embed], components: [row] });
      console.log(`[guildMemberRemove] DM sent to ${member.user.tag}`);
    } catch (err) {
      console.log(`[guildMemberRemove] Could not DM ${member.user.tag}: ${err.message}`);
    }
  },
};
