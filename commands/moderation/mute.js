const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { parseTime, formatTime, checkPerm, readData, writeData } = require('../../utils');
const { sendLog } = require('../../utils/logger');

const MAX_TIMEOUT = 28 * 24 * 60 * 60 * 1000; // 28 days (Discord max)

module.exports = {
  name: 'mute',
  description: 'Timeouts a user for a specified duration. [JrHelper+]',
  data: new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Timeouts a user [JrHelper+]')
    .addUserOption(o => o.setName('user').setDescription('User to mute').setRequired(true))
    .addStringOption(o => o.setName('time').setDescription('Duration e.g. 10m 1h 2d — or "perm" for permanent').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason for the mute').setRequired(true)),

  async execute(message, args) {
    if (!checkPerm(message.member, 'mute'))
      return message.reply('❌ You do not have permission to use this command.');

    const target = message.mentions.members.first();
    const time = args[1];
    const reason = args.slice(2).join(' ');
    if (!target || !time || !reason)
      return message.reply('Usage: `?mute @user {time|perm} {reason}`');

    const isPerm = ['perm', 'permanent', 'perma'].includes(time.toLowerCase());
    const ms = isPerm ? MAX_TIMEOUT : parseTime(time);
    if (!ms || (!isPerm && ms > MAX_TIMEOUT))
      return message.reply('❌ Invalid time. Use formats like `10m`, `2h`, `1d`, or `perm`.');

    try {
      await target.timeout(ms, reason);
      if (isPerm) savePermMute(target.user.id, message.guild.id, reason);
      message.channel.send({ embeds: [buildEmbed(target.user, isPerm ? '♾️ Permanent' : formatTime(ms), reason, message.author.tag)] });
      sendLog(message.client, { action: 'User Muted', executor: message.author.tag, target: target.user.tag, fields: { Duration: isPerm ? 'Permanent' : formatTime(ms), Reason: reason }, color: '#FF6B35' });
    } catch {
      message.reply('❌ Could not mute that user. Check my permissions and role hierarchy.');
    }
  },

  async executeSlash(interaction) {
    if (!checkPerm(interaction.member, 'mute'))
      return interaction.reply({ content: '❌ You do not have permission to use this command.', ephemeral: true });

    const user   = interaction.options.getUser('user');
    const time   = interaction.options.getString('time');
    const reason = interaction.options.getString('reason');
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!member) return interaction.reply({ content: '❌ User not found.', ephemeral: true });

    const isPerm = ['perm', 'permanent', 'perma'].includes(time.toLowerCase());
    const ms = isPerm ? MAX_TIMEOUT : parseTime(time);
    if (!ms || (!isPerm && ms > MAX_TIMEOUT))
      return interaction.reply({ content: '❌ Invalid time. Use formats like `10m`, `2h`, `1d`, or `perm`.', ephemeral: true });

    try {
      await member.timeout(ms, reason);
      if (isPerm) savePermMute(user.id, interaction.guild.id, reason);
      interaction.reply({ embeds: [buildEmbed(user, isPerm ? '♾️ Permanent' : formatTime(ms), reason, interaction.user.tag)] });
      sendLog(interaction.client, { action: 'User Muted', executor: interaction.user.tag, target: user.tag, fields: { Duration: isPerm ? 'Permanent' : formatTime(ms), Reason: reason }, color: '#FF6B35' });
    } catch {
      interaction.reply({ content: '❌ Could not mute that user.', ephemeral: true });
    }
  },
};

function savePermMute(userId, guildId, reason) {
  const data = readData('permMutes.json');
  data[userId] = { guildId, reason, mutedAt: Date.now() };
  writeData('permMutes.json', data);
}

function buildEmbed(user, duration, reason, by) {
  return new EmbedBuilder()
    .setColor('#FF6B35')
    .setTitle('🔇 User Muted')
    .addFields(
      { name: 'User',     value: `${user.tag} (${user.id})`, inline: true },
      { name: 'Duration', value: duration,                    inline: true },
      { name: 'Muted by', value: by,                          inline: true },
      { name: 'Reason',   value: reason }
    )
    .setThumbnail(user.displayAvatarURL())
    .setTimestamp();
}

module.exports.MAX_TIMEOUT = MAX_TIMEOUT;
