const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { checkPerm } = require('../../utils');
const { sendLog } = require('../../utils/logger');

module.exports = {
  name: 'unmute',
  description: 'Removes a timeout from a user. [JrHelper+]',
  data: new SlashCommandBuilder()
    .setName('unmute')
    .setDescription('Removes timeout from a user [JrHelper+]')
    .addUserOption(o => o.setName('user').setDescription('User to unmute').setRequired(true)),

  async execute(message, args) {
    if (!checkPerm(message.member, 'unmute'))
      return message.reply('❌ You do not have permission to use this command.');

    const target = message.mentions.members.first();
    if (!target) return message.reply('Usage: `?unmute @user`');

    try {
      await target.timeout(null);
      message.channel.send({ embeds: [buildEmbed(target.user, message.author.tag)] });
      sendLog(message.client, { action: 'User Unmuted', executor: message.author.tag, target: target.user.tag, color: '#57F287' });
    } catch {
      message.reply('❌ Could not unmute that user.');
    }
  },

  async executeSlash(interaction) {
    if (!checkPerm(interaction.member, 'unmute'))
      return interaction.reply({ content: '❌ You do not have permission to use this command.', ephemeral: true });

    const user = interaction.options.getUser('user');
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!member) return interaction.reply({ content: '❌ User not found.', ephemeral: true });

    try {
      await member.timeout(null);
      interaction.reply({ embeds: [buildEmbed(user, interaction.user.tag)] });
      sendLog(interaction.client, { action: 'User Unmuted', executor: interaction.user.tag, target: user.tag, color: '#57F287' });
    } catch {
      interaction.reply({ content: '❌ Could not unmute that user.', ephemeral: true });
    }
  },
};

function buildEmbed(user, by) {
  return new EmbedBuilder()
    .setColor('#57F287')
    .setTitle('🔊 User Unmuted')
    .addFields(
      { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
      { name: 'Unmuted by', value: by, inline: true }
    )
    .setThumbnail(user.displayAvatarURL())
    .setTimestamp();
}
