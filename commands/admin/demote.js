const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { sendLog } = require('../../utils/logger');

module.exports = {
  name: 'demote',
  description: 'Demotes a staff member [Admin Only]',
  data: new SlashCommandBuilder()
    .setName('demote')
    .setDescription('Demotes a staff member [Admin Only]')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption(o => o.setName('user').setDescription('Staff member to demote').setRequired(true))
    .addRoleOption(o => o.setName('oldrole').setDescription('Role to remove').setRequired(true))
    .addRoleOption(o => o.setName('newrole').setDescription('Role to give').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason for demotion').setRequired(true)),

  async executeSlash(interaction) {
    if (!interaction.member.permissions.has('Administrator'))
      return interaction.reply({ content: '❌ Only **Admins** can use this command.', ephemeral: true });

    const user    = interaction.options.getUser('user');
    const oldRole = interaction.options.getRole('oldrole');
    const newRole = interaction.options.getRole('newrole');
    const reason  = interaction.options.getString('reason');
    const member  = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!member) return interaction.reply({ content: '❌ User not found.', ephemeral: true });

    await interaction.deferReply();

    try {
      await member.roles.remove(oldRole.id);
      await member.roles.add(newRole.id);
    } catch (err) {
      return interaction.editReply({ content: `❌ Could not change roles: ${err.message}` });
    }

    const embed = new EmbedBuilder()
      .setColor('#ED4245')
      .setTitle('📉 Staff Member Demoted')
      .addFields(
        { name: 'Staff Member', value: `<@${member.user.id}>`, inline: true },
        { name: 'Demoted by',   value: `<@${interaction.user.id}>`, inline: true },
        { name: '\u200b',       value: '\u200b', inline: true },
        { name: 'Old Role',     value: `<@&${oldRole.id}>`, inline: true },
        { name: 'New Role',     value: `<@&${newRole.id}>`, inline: true },
        { name: '\u200b',       value: '\u200b', inline: true },
        { name: 'Reason',       value: reason },
      )
      .setThumbnail(member.user.displayAvatarURL())
      .setTimestamp();

    await interaction.editReply({
      content: `<@${member.user.id}>`,
      embeds: [embed],
      allowedMentions: { users: [member.user.id] },
    });

    sendLog(interaction.client, {
      action: 'Staff Demoted',
      executor: interaction.user.tag,
      target: member.user.tag,
      fields: { 'Old Role': oldRole.name, 'New Role': newRole.name, Reason: reason },
      color: '#ED4245',
    });
  },
};
