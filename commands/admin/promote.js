const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getMemberRoleLevel, promoteOrder } = require('../../utils');
const { sendLog } = require('../../utils/logger');
const config = require('../../config.json');

module.exports = {
  name: 'promote',
  description: 'Promotes a staff member to a specified role. [Admin Only]',
  data: new SlashCommandBuilder()
    .setName('promote')
    .setDescription('Promotes a staff member to a specified role [Admin Only]')
    .addUserOption(o => o.setName('user').setDescription('Staff member to promote').setRequired(true))
    .addRoleOption(o => o.setName('role').setDescription('The role to promote to').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason for promotion').setRequired(true)),

  async execute(message, args) {
    if (!message.member.permissions.has("Administrator"))
      return message.reply('❌ Only **Admins** can use this command.');

    const target  = message.mentions.members.first();
    const roleKey = args[1]?.toLowerCase();
    const reason  = args.slice(2).join(' ');

    if (!target || !roleKey || !reason)
      return message.reply('Usage: `?promote @user {role} {reason}`');

    const matched = promoteOrder.find(k => k.toLowerCase() === roleKey);
    if (!matched)
      return message.reply(`❌ Unknown role. Allowed: \`${promoteOrder.slice(1).join('`, `')}\``);

    await performPromote(target, matched, reason, message.author, message.channel);
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
    await performPromote(member, role, reason, interaction.user, null, interaction);
  },
};

async function performPromote(member, newRole, reason, executor, channel, interaction) {
  const client       = channel?.client || interaction?.client;
  const currentLevel = getMemberRoleLevel(member);
  const oldRoleKey   = currentLevel >= 0 ? promoteOrder[currentLevel] : null;
  const oldRoleId    = oldRoleKey ? config.roles[oldRoleKey] : null;

  try {
    for (const key of promoteOrder) {
      const id = config.roles[key];
      if (id && !id.endsWith('_ROLE_ID') && member.roles.cache.has(id))
        await member.roles.remove(id);
    }
    await member.roles.add(newRole.id);
  } catch (err) {
    const msg = `❌ Could not change roles: ${err.message}`;
    return channel ? channel.send(msg) : interaction.editReply(msg);
  }

  const oldRoleDisplay = (oldRoleId && !oldRoleId.endsWith('_ROLE_ID'))
    ? `<@&${oldRoleId}>`
    : oldRoleKey || 'None';

  const embed = new EmbedBuilder()
    .setColor('#57F287')
    .setTitle('📈 Staff Member Promoted')
    .addFields(
      { name: 'Staff Member', value: `<@${member.user.id}>`, inline: true },
      { name: 'Promoted by',  value: `<@${executor.id}>`,    inline: true },
      { name: '\u200b',       value: '\u200b',                inline: true },
      { name: 'Old Role',     value: oldRoleDisplay,          inline: true },
      { name: 'New Role',     value: `<@&${newRole.id}>`,     inline: true },
      { name: '\u200b',       value: '\u200b',                inline: true },
      { name: 'Reason',       value: reason },
    )
    .setThumbnail(member.user.displayAvatarURL())
    .setTimestamp();

  const mentionedRoles = [newRole.id, ...(oldRoleId && !oldRoleId.endsWith('_ROLE_ID') ? [oldRoleId] : [])];
  const payload = {
    content: `<@${member.user.id}>`,
    embeds: [embed],
    allowedMentions: { users: [member.user.id], roles: mentionedRoles },
  };

  if (channel) channel.send(payload);
  else if (interaction) interaction.editReply(payload);

  sendLog(client, {
    action: 'Staff Promoted',
    executor: executor.tag,
    target: member.user.tag,
    fields: { 'Old Role': oldRoleKey || 'None', 'New Role': newRole.name, Reason: reason },
    color: '#57F287',
  });
}
