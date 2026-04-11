const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { checkPerm } = require('../../utils');
const { sendLog } = require('../../utils/logger');

module.exports = {
  name: 'kick',
  description: 'Kicks a user from the server. [Admin Only]',
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kicks a user from the server [Admin Only]')
    .addUserOption(o => o.setName('user').setDescription('User to kick').setRequired(true))
    .addStringOption(o => o.setName('time').setDescription('How long they should stay away e.g. 1d 1w').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason for the kick').setRequired(true)),

  async execute(message, args) {
    if (!checkPerm(message.member, 'kick'))
      return message.reply('❌ Only **Admins** can use this command.');

    const target = message.mentions.members.first();
    const time = args[1];
    const reason = args.slice(2).join(' ');
    if (!target || !time || !reason) return message.reply('Usage: `?kick @user {time} {reason}`');

    try {
      await target.kick(reason);
      message.channel.send({ embeds: [buildEmbed(target.user, time, reason, message.author.tag)] });
      sendLog(message.client, { action: 'User Kicked', executor: message.author.tag, target: target.user.tag, fields: { Dauer: time, Grund: reason }, color: '#FEE75C' });
    } catch {
      message.reply('❌ Could not kick that user. Check my permissions and role hierarchy.');
    }
  },

  async executeSlash(interaction) {
    if (!checkPerm(interaction.member, 'kick'))
      return interaction.reply({ content: '❌ Only **Admins** can use this command.', ephemeral: true });

    const user = interaction.options.getUser('user');
    const time = interaction.options.getString('time');
    const reason = interaction.options.getString('reason');
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!member) return interaction.reply({ content: '❌ User not found.', ephemeral: true });

    try {
      await member.kick(reason);
      interaction.reply({ embeds: [buildEmbed(user, time, reason, interaction.user.tag)] });
      sendLog(interaction.client, { action: 'User Kicked', executor: interaction.user.tag, target: user.tag, fields: { Dauer: time, Grund: reason }, color: '#FEE75C' });
    } catch {
      interaction.reply({ content: '❌ Could not kick that user.', ephemeral: true });
    }
  },
};

function buildEmbed(user, time, reason, by) {
  return new EmbedBuilder()
    .setColor('#FEE75C')
    .setTitle('👢 User Kicked')
    .addFields(
      { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
      { name: 'Kicked by', value: by, inline: true },
      { name: 'Away for', value: time, inline: true },
      { name: 'Reason', value: reason }
    )
    .setThumbnail(user.displayAvatarURL())
    .setTimestamp();
}
