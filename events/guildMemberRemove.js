const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { readData } = require('../utils');

module.exports = {
  name: 'guildMemberRemove',
  async execute(member) {
    if (!member.user) return;

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

    member.user.send({ embeds: [embed], components: [row] })
      .then(() => console.log(`[leave] DM sent to ${member.user.tag}`))
      .catch(err => console.error(`[leave] DM FAILED for ${member.user.tag}: ${err.message}`));
  },
};
