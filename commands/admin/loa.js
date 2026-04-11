const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { parseTime, formatTime, hasPermission, readData, writeData } = require('../../utils');

module.exports = {
  name: 'loa',
  description: 'Sets a staff member on Leave of Absence. [Admin Only]',
  data: new SlashCommandBuilder()
    .setName('loa')
    .setDescription('Set a staff member on LOA [Admin Only]')
    .addUserOption(o => o.setName('user').setDescription('Staff member').setRequired(true))
    .addStringOption(o => o.setName('time').setDescription('LOA duration e.g. 3d 1w').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason for LOA').setRequired(true)),

  async execute(message, args) {
    if (!hasPermission(message.member, 'admin'))
      return message.reply('❌ Only **Admins** can use this command.');

    const target = message.mentions.members.first();
    const time = args[1];
    const reason = args.slice(2).join(' ');

    if (!target || !time || !reason)
      return message.reply('Usage: `?loa @user {time} {reason}`');

    const ms = parseTime(time);
    if (!ms) return message.reply('❌ Invalid time format.');

    setLOA(target, ms, reason, message.author.tag, message.channel);
  },

  async executeSlash(interaction) {
    if (!hasPermission(interaction.member, 'admin'))
      return interaction.reply({ content: '❌ Only **Admins** can use this command.', ephemeral: true });

    const user = interaction.options.getUser('user');
    const time = interaction.options.getString('time');
    const reason = interaction.options.getString('reason');
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!member) return interaction.reply({ content: '❌ User not found.', ephemeral: true });

    const ms = parseTime(time);
    if (!ms) return interaction.reply({ content: '❌ Invalid time format.', ephemeral: true });

    await interaction.deferReply();
    setLOA(member, ms, reason, interaction.user.tag, null, interaction);
  },
};

function setLOA(member, ms, reason, by, channel, interaction) {
  const loa = readData('loa.json');
  loa[member.user.id] = {
    endTime: Date.now() + ms,
    reason,
    by,
    username: member.user.tag,
  };
  writeData('loa.json', loa);

  const embed = new EmbedBuilder()
    .setColor('#5865F2')
    .setTitle('🏖️ Staff Member on LOA')
    .addFields(
      { name: 'Staff Member', value: `${member.user.tag}`, inline: true },
      { name: 'Duration', value: formatTime(ms), inline: true },
      { name: 'Set by', value: by, inline: true },
      { name: 'Reason', value: reason }
    )
    .setThumbnail(member.user.displayAvatarURL())
    .setTimestamp();

  if (channel) channel.send({ embeds: [embed] });
  else if (interaction) interaction.editReply({ embeds: [embed] });
}
