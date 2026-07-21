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
      return interaction.reply({ content: 'Only **Admins** can use this command.', ephemeral: true });

    const user    = interaction.options.getUser('user');
    const oldRole = interaction.options.getRole('oldrole');
    const newRole = interaction.options.getRole('newrole');
    const reason  = interaction.options.getString('reason');
    const member  = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!member) return interaction.reply({ content: 'User not found.', ephemeral: true });

    await interaction.deferReply();

    try {
      await member.roles.remove(oldRole.id);
      await member.roles.add(newRole.id);
    } catch (err) {
      return interaction.editReply({ content: `Could not change roles: ${err.message}` });
    }

    const embed = new EmbedBuilder()
      .setColor('#ED4245')
      .setTitle('\u2b07\ufe0f Staff Member Demoted')
      .addFields(
        { name: '\ud83d\udc64 Staff Member', value: `<@${member.user.id}>`, inline: true },
        { name: '\ud83d\udee1\ufe0f Demoted by',   value: `<@${interaction.user.id}>`, inline: true },
        { name: '\u200b',           value: '\u200b', inline: true },
        { name: '\ud83c\udf96\ufe0f Old Role',     value: `<@&${oldRole.id}>`, inline: true },
        { name: '\ud83c\udf96\ufe0f New Role',     value: `<@&${newRole.id}>`, inline: true },
        { name: '\u200b',           value: '\u200b', inline: true },
        { name: '\ud83d\udccb Reason',        value: reason },
      )
      .setThumbnail(member.user.displayAvatarURL())
      .setTimestamp();

    await interaction.editReply({
      content: `<@${member.user.id}>`,
      embeds: [embed],
      allowedMentions: { users: [member.user.id] },
    });

    sendLog(interaction.client, {
      action: '⬇️ Staff Member Demoted',
      executor: interaction.user.tag,
      target: `<@${member.user.id}> (${member.user.tag})`,
      fields: {
        'Demoted by': `<@${interaction.user.id}>`,
        'Old Role': `<@&${oldRole.id}>`,
        'New Role': `<@&${newRole.id}>`,
        'Reason': reason,
      },
      color: '#ED4245',
    });
  },
};
