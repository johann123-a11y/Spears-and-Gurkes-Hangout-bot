const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { checkPerm, getMemberRoleLevel, promoteOrder, readData, writeData } = require('../../utils');
const config = require('../../config.json');

module.exports = {
  name: 'demote',
  description: 'Demotes a staff member one rank down. [Admin Only]',
  data: new SlashCommandBuilder()
    .setName('demote')
    .setDescription('Demotes a staff member one rank down [Admin Only]')
    .addUserOption(o => o.setName('user').setDescription('Staff member to demote').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason for demotion').setRequired(true)),

  async execute(message, args) {
    if (!checkPerm(message.member, 'demote'))
      return message.reply('❌ Only **Admins** can use this command.');

    const target = message.mentions.members.first();
    const reason = args.slice(1).join(' ');
    if (!target || !reason) return message.reply('Usage: `?demote @user {reason}`');

    await performDemote(target, reason, message.author.tag, message.channel);
  },

  async executeSlash(interaction) {
    if (!checkPerm(interaction.member, 'demote'))
      return interaction.reply({ content: '❌ Only **Admins** can use this command.', ephemeral: true });

    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason');
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!member) return interaction.reply({ content: '❌ User not found.', ephemeral: true });

    await interaction.deferReply();
    await performDemote(member, reason, interaction.user.tag, null, interaction);
  },
};

async function performDemote(member, reason, by, channel, interaction) {
  const level = getMemberRoleLevel(member);

  if (level <= 0) {
    const msg = '❌ This user is already at the lowest rank or has no tracked role.';
    return channel ? channel.send(msg) : interaction.editReply(msg);
  }

  const oldRoleKey = promoteOrder[level];
  const newRoleKey = promoteOrder[level - 1];
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
    .setColor('#FF6B35')
    .setTitle('📉 Staff Member Demoted')
    .addFields(
      { name: 'Staff Member', value: `${member.user.tag}`, inline: true },
      { name: 'Demoted by', value: by, inline: true },
      { name: 'Old Role', value: oldRoleKey, inline: true },
      { name: 'New Role', value: newRoleKey, inline: true },
      { name: 'Reason', value: reason }
    )
    .setThumbnail(member.user.displayAvatarURL())
    .setTimestamp();

  if (channel) channel.send({ embeds: [embed] });
  else if (interaction) interaction.editReply({ embeds: [embed] });
}
