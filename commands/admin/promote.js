const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { checkPerm, getMemberRoleLevel, promoteOrder } = require('../../utils');
const { sendLog } = require('../../utils/logger');
const config = require('../../config.json');

module.exports = {
  name: 'promote',
  description: 'Promotes a staff member to a specified role. [Admin Only]',
  data: new SlashCommandBuilder()
    .setName('promote')
    .setDescription('Promotes a staff member to a specified role [Admin Only]')
    .addUserOption(o => o.setName('user').setDescription('Staff member to promote').setRequired(true))
    .addStringOption(o =>
      o.setName('role')
        .setDescription('The role to promote to')
        .setRequired(true)
        .addChoices(
          { name: 'Helper', value: 'helper' },
          { name: 'SrHelper', value: 'srHelper' },
          { name: 'JrMod', value: 'jrMod' },
          { name: 'Mod', value: 'mod' },
          { name: 'SrMod', value: 'srMod' },
        )
    )
    .addStringOption(o => o.setName('reason').setDescription('Reason for promotion').setRequired(true)),

  async execute(message, args) {
    if (!checkPerm(message.member, 'promote'))
      return message.reply('❌ Only **Admins** can use this command.');

    const target = message.mentions.members.first();
    const roleKey = args[1]?.toLowerCase();
    const reason = args.slice(2).join(' ');

    if (!target || !roleKey || !reason)
      return message.reply('Usage: `?promote @user {role} {reason}`\nRoles: `helper`, `srHelper`, `jrMod`, `mod`, `srMod`');

    const matched = promoteOrder.find(k => k.toLowerCase() === roleKey);
    if (!matched)
      return message.reply(`❌ Unknown role. Allowed: \`${promoteOrder.slice(1).join('`, `')}\``);

    await performPromote(target, matched, reason, message.author.tag, message.channel);
  },

  async executeSlash(interaction) {
    if (!checkPerm(interaction.member, 'promote'))
      return interaction.reply({ content: '❌ Only **Admins** can use this command.', ephemeral: true });

    const user = interaction.options.getUser('user');
    const roleKey = interaction.options.getString('role');
    const reason = interaction.options.getString('reason');
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!member) return interaction.reply({ content: '❌ User not found.', ephemeral: true });

    await interaction.deferReply();
    await performPromote(member, roleKey, reason, interaction.user.tag, null, interaction);
  },
};

async function performPromote(member, newRoleKey, reason, by, channel, interaction) {
  const currentLevel = getMemberRoleLevel(member);
  const oldRoleKey = currentLevel >= 0 ? promoteOrder[currentLevel] : 'None';
  const newRoleId = config.roles[newRoleKey];

  if (!newRoleId || newRoleId.endsWith('_ROLE_ID')) {
    const msg = `❌ The role \`${newRoleKey}\` is not configured yet. Use \`?setrole set ${newRoleKey} @role\`.`;
    return channel ? channel.send(msg) : interaction.editReply(msg);
  }

  try {
    // Remove all current ranked roles
    for (const key of promoteOrder) {
      const id = config.roles[key];
      if (id && !id.endsWith('_ROLE_ID') && member.roles.cache.has(id)) {
        await member.roles.remove(id);
      }
    }
    await member.roles.add(newRoleId);
  } catch (err) {
    const msg = `❌ Could not change roles: ${err.message}`;
    return channel ? channel.send(msg) : interaction.editReply(msg);
  }

  const embed = new EmbedBuilder()
    .setColor('#57F287')
    .setTitle('📈 Staff Member Promoted')
    .addFields(
      { name: 'Staff Member', value: `${member.user.tag}`, inline: true },
      { name: 'Promoted by', value: by, inline: true },
      { name: 'Old Role', value: oldRoleKey, inline: true },
      { name: 'New Role', value: `<@&${newRoleId}>`, inline: true },
      { name: 'Reason', value: reason }
    )
    .setThumbnail(member.user.displayAvatarURL())
    .setTimestamp();

  if (channel) {
    channel.send({ embeds: [embed], allowedMentions: { roles: [newRoleId] } });
    sendLog(channel.client, { action: 'Staff Promoted', executor: by, target: member.user.tag, fields: { 'Old Role': oldRoleKey, 'New Role': newRoleKey, Reason: reason }, color: '#57F287' });
  } else if (interaction) {
    interaction.editReply({ embeds: [embed], allowedMentions: { roles: [newRoleId] } });
    sendLog(interaction.client, { action: 'Staff Promoted', executor: by, target: member.user.tag, fields: { 'Old Role': oldRoleKey, 'New Role': newRoleKey, Reason: reason }, color: '#57F287' });
  }
}
