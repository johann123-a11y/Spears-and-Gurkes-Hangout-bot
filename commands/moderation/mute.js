const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { parseTime, formatTime, checkPerm } = require('../../utils');
const { sendLog } = require('../../utils/logger');

module.exports = {
  name: 'mute',
  description: 'Timeouts a user for a specified duration. [JrHelper+]',
  data: new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Timeouts a user [JrHelper+]')
    .addUserOption(o => o.setName('user').setDescription('User to mute').setRequired(true))
    .addStringOption(o => o.setName('time').setDescription('Duration e.g. 10m 1h 2d').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason for the mute').setRequired(true)),

  async execute(message, args) {
    if (!checkPerm(message.member, 'mute'))
      return message.reply('❌ Du hast keine Berechtigung für diesen Command.');

    const target = message.mentions.members.first();
    const time = args[1];
    const reason = args.slice(2).join(' ');

    if (!target || !time || !reason)
      return message.reply('Usage: `?mute @user {time} {reason}`');

    const ms = parseTime(time);
    if (!ms || ms > 28 * 24 * 60 * 60 * 1000)
      return message.reply('❌ Invalid time. Use formats like `10m`, `2h`, `1d`. Maximum is **28 days**.');

    try {
      await target.timeout(ms, reason);
      const embed = buildEmbed(target.user, formatTime(ms), reason, message.author.tag);
      message.channel.send({ embeds: [embed] });
      sendLog(message.client, { action: 'User Muted', executor: message.author.tag, target: target.user.tag, fields: { Dauer: formatTime(ms), Grund: reason }, color: '#FF6B35' });
    } catch {
      message.reply('❌ Could not mute that user. Check my permissions and role hierarchy.');
    }
  },

  async executeSlash(interaction) {
    if (!checkPerm(interaction.member, 'mute'))
      return interaction.reply({ content: '❌ Du hast keine Berechtigung für diesen Command.', ephemeral: true });

    const user = interaction.options.getUser('user');
    const time = interaction.options.getString('time');
    const reason = interaction.options.getString('reason');
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);

    if (!member)
      return interaction.reply({ content: '❌ User not found.', ephemeral: true });

    const ms = parseTime(time);
    if (!ms || ms > 28 * 24 * 60 * 60 * 1000)
      return interaction.reply({ content: '❌ Invalid time. Maximum is **28 days**.', ephemeral: true });

    try {
      await member.timeout(ms, reason);
      interaction.reply({ embeds: [buildEmbed(user, formatTime(ms), reason, interaction.user.tag)] });
      sendLog(interaction.client, { action: 'User Muted', executor: interaction.user.tag, target: user.tag, fields: { Dauer: formatTime(ms), Grund: reason }, color: '#FF6B35' });
    } catch {
      interaction.reply({ content: '❌ Could not mute that user.', ephemeral: true });
    }
  },
};

function buildEmbed(user, duration, reason, by) {
  return new EmbedBuilder()
    .setColor('#FF6B35')
    .setTitle('🔇 User Muted')
    .addFields(
      { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
      { name: 'Duration', value: duration, inline: true },
      { name: 'Muted by', value: by, inline: true },
      { name: 'Reason', value: reason }
    )
    .setThumbnail(user.displayAvatarURL())
    .setTimestamp();
}
