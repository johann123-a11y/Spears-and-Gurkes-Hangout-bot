const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { hasPermission, getMemberRoleLevel, promoteOrder } = require('../../utils');
const config = require('../../config.json');

module.exports = {
  name: 'promote',
  description: 'Promotes a staff member one rank up. [Admin Only]',
  data: new SlashCommandBuilder()
    .setName('promote')
    .setDescription('Promotes a staff member one rank up [Admin Only]')
    .addUserOption(o => o.setName('user').setDescription('Staff member to promote').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason for promotion').setRequired(true)),

  async execute(message, args) {
    if (!hasPermission(message.member, 'admin'))
      return message.reply('❌ Only **Admins** can use this command.');

    const target = message.mentions.members.first();
    const reason = args.slice(1).join(' ');
    if (!target || !reason) return message.reply('Usage: `?promote @user {reason}`');

    await performPromote(target, reason, message.author.tag, message.channel);
  },

  async executeSlash(interaction) {
    if (!hasPermission(interaction.member, 'admin'))
      return interaction.reply({ content: '❌ Only **Admins** can use this command.', ephemeral: true });

    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason');
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!member) return interaction.reply({ content: '❌ User not found.', ephemeral: true });

    await interaction.deferReply();
    await performPromote(member, reason, interaction.user.tag, null, interaction);
  },
};

async function performPromote(member, reason, by, channel, interaction) {
  const level = getMemberRoleLevel(member);

  if (level >= promoteOrder.length - 1) {
    const msg = '❌ This user is already at the highest rank (SrMod).';
    return channel ? channel.send(msg) : interaction.editReply(msg);
  }

  const oldRoleKey = promoteOrder[level];
  const newRoleKey = promoteOrder[level + 1];
  const oldRoleId = config.roles[oldRoleKey];
  const newRoleId = config.roles[newRoleKey];

  try {
    if (oldRoleId && !oldRoleId.endsWith('_ROLE_ID')) await member.roles.remove(oldRoleId);
    if (newRoleId && !newRoleId.endsWith('_ROLE_ID')) await member.roles.add(newRoleId);
  } catch (err) {
    const msg = `❌ Failed to update roles: ${err.message}`;
    return channel ? channel.send(msg) : interaction.editReply(msg);
  }

  const embed = new EmbedBuilder()
    .setColor('#57F287')
    .setTitle('📈 Staff Member Promoted')
    .addFields(
      { name: 'Staff Member', value: `${member.user.tag}`, inline: true },
      { name: 'Promoted by', value: by, inline: true },
      { name: 'Old Role', value: level >= 0 ? oldRoleKey : 'None', inline: true },
      { name: 'New Role', value: newRoleKey, inline: true },
      { name: 'Reason', value: reason }
    )
    .setThumbnail(member.user.displayAvatarURL())
    .setTimestamp();

  if (channel) channel.send({ embeds: [embed] });
  else if (interaction) interaction.editReply({ embeds: [embed] });
}
