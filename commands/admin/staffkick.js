const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { checkPerm } = require('../../utils');
const config = require('../../config.json');

module.exports = {
  name: 'staffkick',
  description: 'Removes all staff roles from a user. [Admin Only]',
  data: new SlashCommandBuilder()
    .setName('staffkick')
    .setDescription('Removes all staff roles from a user [Admin Only]')
    .addUserOption(o => o.setName('user').setDescription('User to remove from staff').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(true)),

  async execute(message, args) {
    if (!checkPerm(message.member, 'staffkick'))
      return message.reply('❌ Only **Admins** can use this command.');

    const target = message.mentions.members.first();
    const reason = args.slice(1).join(' ');
    if (!target || !reason) return message.reply('Usage: `?staffkick @user {reason}`');

    await performStaffKick(target, reason, message.author.tag, message.channel);
  },

  async executeSlash(interaction) {
    if (!checkPerm(interaction.member, 'staffkick'))
      return interaction.reply({ content: '❌ Only **Admins** can use this command.', ephemeral: true });

    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason');
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!member) return interaction.reply({ content: '❌ User not found.', ephemeral: true });

    await interaction.deferReply();
    await performStaffKick(member, reason, interaction.user.tag, null, interaction);
  },
};

async function performStaffKick(member, reason, by, channel, interaction) {
  const staffRoleIds = config.staffRoles
    .map(key => config.roles[key])
    .filter(id => id && !id.endsWith('_ROLE_ID') && member.roles.cache.has(id));

  try {
    for (const roleId of staffRoleIds) {
      await member.roles.remove(roleId);
    }
  } catch (err) {
    const msg = `❌ Failed to remove roles: ${err.message}`;
    return channel ? channel.send(msg) : interaction.editReply(msg);
  }

  const embed = new EmbedBuilder()
    .setColor('#ED4245')
    .setTitle('🚪 Staff Member Removed')
    .addFields(
      { name: 'User', value: `${member.user.tag}`, inline: true },
      { name: 'Removed by', value: by, inline: true },
      { name: 'Roles Removed', value: staffRoleIds.length > 0 ? `${staffRoleIds.length} role(s)` : 'None found', inline: true },
      { name: 'Reason', value: reason }
    )
    .setThumbnail(member.user.displayAvatarURL())
    .setTimestamp();

  if (channel) channel.send({ embeds: [embed] });
  else if (interaction) interaction.editReply({ embeds: [embed] });
}
