const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getMemberRoleLevel, promoteOrder } = require('../../utils');
const { sendLog } = require('../../utils/logger');
const config = require('../../config.json');

module.exports = {
  name: 'demote',
  description: 'Demotes a staff member to a specified role. [Admin Only]',
  data: new SlashCommandBuilder()
    .setName('demote')
    .setDescription('Demotes a staff member to a specified role [Admin Only]')
    .addUserOption(o => o.setName('user').setDescription('Staff member to demote').setRequired(true))
    .addRoleOption(o => o.setName('role').setDescription('The role to demote to').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason for demotion').setRequired(true)),

  async execute(message, args) {
    if (!message.member.permissions.has("Administrator"))
      return message.reply('❌ Only **Admins** can use this command.');

    const target  = message.mentions.members.first();
    const roleKey = args[1]?.toLowerCase();
    const reason  = args.slice(2).join(' ');

    if (!target || !roleKey || !reason)
      return message.reply('Usage: `?demote @user {role} {reason}`');

    const matched = promoteOrder.find(k => k.toLowerCase() === roleKey);
    if (!matched)
      return message.reply(`❌ Unknown role. Allowed: \`${promoteOrder.slice(0, -1).join('`, `')}\``);

    await performDemote(target, matched, reason, message.author, message.channel);
  },

  async executeSlash(interaction) {
    if (!interaction.member.permissions.has("Administrator"))
      return interaction.reply({ content: '❌ Only **Admins** can use this command.', ephemeral: true });

    const user   = interaction.options.getUser('user');
    const role   = interaction.options.getRole('role');
    const reason = interaction.options.getString('reason');
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!member) return interaction.reply({ content: '❌ User not found.', ephemeral: true });

    await interaction.deferReply();
    await performDemote(member, role, reason, interaction.user, null, interaction);
  },
};

async function performDemote(member, newRole, reason, executor, channel, interaction) {
  const client       = channel?.client || interaction?.client;
  const currentLevel = getMemberRoleLevel(member);
  const oldRoleKey   = currentLevel >= 0 ? promoteOrder[currentLevel] : null;
  const oldRoleId    = oldRoleKey ? config.roles[oldRoleKey] : null;

  // Support both a Discord Role object (slash) and a role key string (prefix)
  const newRoleId   = typeof newRole === 'string' ? config.roles[newRole] : newRole.id;
  const newRoleName = typeof newRole === 'string' ? newRole : newRole.name;

  if (!newRoleId || newRoleId.endsWith('_ROLE_ID')) {
    const msg = `❌ Role not configured. Use \`/setrole set\`.`;
    return channel ? channel.send(msg) : interaction.editReply(msg);
  }

  try {
    for (const key of promoteOrder) {
      const id = config.roles[key];
      if (id && !id.endsWith('_ROLE_ID') && member.roles.cache.has(id))
        await member.roles.remove(id);
    }
    await member.roles.add(newRoleId);
  } catch (err) {
    const msg = `❌ Could not change roles: ${err.message}`;
    return channel ? channel.send(msg) : interaction.editReply(msg);
  }

  const oldRoleDisplay = (oldRoleId && !oldRoleId.endsWith('_ROLE_ID'))
    ? `<@&${oldRoleId}>`
    : oldRoleKey || 'None';

  const embed = new EmbedBuilder()
    .setColor('#ED4245')
    .setTitle('📉 Staff Member Demoted')
    .addFields(
      { name: 'Staff Member', value: `<@${member.user.id}>`, inline: true },
      { name: 'Demoted by',   value: `<@${executor.id}>`,    inline: true },
      { name: '\u200b',       value: '\u200b',                inline: true },
      { name: 'Old Role',     value: oldRoleDisplay,          inline: true },
      { name: 'New Role',     value: `<@&${newRoleId}>`,      inline: true },
      { name: '\u200b',       value: '\u200b',                inline: true },
      { name: 'Reason',       value: reason },
    )
    .setThumbnail(member.user.displayAvatarURL())
    .setTimestamp();

  const mentionedRoles = [newRoleId, ...(oldRoleId && !oldRoleId.endsWith('_ROLE_ID') ? [oldRoleId] : [])];
  const payload = {
    content: `<@${member.user.id}>`,
    embeds: [embed],
    allowedMentions: { users: [member.user.id], roles: mentionedRoles },
  };

  if (channel) channel.send(payload);
  else if (interaction) interaction.editReply(payload);

  sendLog(client, {
    action: 'Staff Demoted',
    executor: executor.tag,
    target: member.user.tag,
    fields: { 'Old Role': oldRoleKey || 'None', 'New Role': newRoleName, Reason: reason },
    color: '#ED4245',
  });
}
