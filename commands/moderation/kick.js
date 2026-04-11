const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { hasPermission } = require('../../utils');

module.exports = {
  name: 'kick',
  description: 'Kicks a user from the server. [Admin Only]',
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kicks a user from the server [Admin Only]')
    .addUserOption(o => o.setName('user').setDescription('User to kick').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason for the kick').setRequired(true)),

  async execute(message, args) {
    if (!hasPermission(message.member, 'admin'))
      return message.reply('❌ Only **Admins** can use this command.');

    const target = message.mentions.members.first();
    const reason = args.slice(1).join(' ');

    if (!target || !reason) return message.reply('Usage: `?kick @user {reason}`');

    try {
      await target.kick(reason);
      message.channel.send({ embeds: [buildEmbed(target.user, reason, message.author.tag)] });
    } catch {
      message.reply('❌ Could not kick that user. Check my permissions and role hierarchy.');
    }
  },

  async executeSlash(interaction) {
    if (!hasPermission(interaction.member, 'admin'))
      return interaction.reply({ content: '❌ Only **Admins** can use this command.', ephemeral: true });

    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason');
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!member) return interaction.reply({ content: '❌ User not found.', ephemeral: true });

    try {
      await member.kick(reason);
      interaction.reply({ embeds: [buildEmbed(user, reason, interaction.user.tag)] });
    } catch {
      interaction.reply({ content: '❌ Could not kick that user.', ephemeral: true });
    }
  },
};

function buildEmbed(user, reason, by) {
  return new EmbedBuilder()
    .setColor('#FEE75C')
    .setTitle('👢 User Kicked')
    .addFields(
      { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
      { name: 'Kicked by', value: by, inline: true },
      { name: 'Reason', value: reason }
    )
    .setThumbnail(user.displayAvatarURL())
    .setTimestamp();
}
