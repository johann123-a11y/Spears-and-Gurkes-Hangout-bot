const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { checkPerm } = require('../../utils');
const { sendLog } = require('../../utils/logger');

module.exports = {
  name: 'ban',
  description: 'Bans a user from the server. [Admin Only]',
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Bans a user from the server [Admin Only]')
    .addUserOption(o => o.setName('user').setDescription('User to ban').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason for the ban').setRequired(true)),

  async execute(message, args) {
    if (!checkPerm(message.member, 'ban'))
      return message.reply('❌ Only **Admins** can use this command.');

    const target = message.mentions.members.first();
    const reason = args.slice(1).join(' ');
    if (!target || !reason) return message.reply('Usage: `?ban @user {reason}`');

    try {
      await target.ban({ reason });
      message.channel.send({ embeds: [buildEmbed(target.user, reason, message.author.tag)] });
      sendLog(message.client, { action: 'User Banned', executor: message.author.tag, target: target.user.tag, fields: { Grund: reason }, color: '#ED4245' });
    } catch {
      message.reply('❌ Could not ban that user. Check my permissions and role hierarchy.');
    }
  },

  async executeSlash(interaction) {
    if (!checkPerm(interaction.member, 'ban'))
      return interaction.reply({ content: '❌ Only **Admins** can use this command.', ephemeral: true });

    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason');
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!member) return interaction.reply({ content: '❌ User not found.', ephemeral: true });

    try {
      await member.ban({ reason });
      interaction.reply({ embeds: [buildEmbed(user, reason, interaction.user.tag)] });
      sendLog(interaction.client, { action: 'User Banned', executor: interaction.user.tag, target: user.tag, fields: { Grund: reason }, color: '#ED4245' });
    } catch {
      interaction.reply({ content: '❌ Could not ban that user.', ephemeral: true });
    }
  },
};

function buildEmbed(user, reason, by) {
  return new EmbedBuilder()
    .setColor('#ED4245')
    .setTitle('🔨 User Banned')
    .addFields(
      { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
      { name: 'Banned by', value: by, inline: true },
      { name: 'Reason', value: reason }
    )
    .setThumbnail(user.displayAvatarURL())
    .setTimestamp();
}
