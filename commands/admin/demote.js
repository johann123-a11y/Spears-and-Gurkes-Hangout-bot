const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { checkPerm, getMemberRoleLevel, promoteOrder } = require('../../utils');
const config = require('../../config.json');

module.exports = {
  name: 'demote',
  description: 'Demotes a staff member to a specified role. [Admin Only]',
  data: new SlashCommandBuilder()
    .setName('demote')
    .setDescription('Demotes a staff member to a specified role [Admin Only]')
    .addUserOption(o => o.setName('user').setDescription('Staff member to demote').setRequired(true))
    .addStringOption(o =>
      o.setName('role')
        .setDescription('The role to demote to')
        .setRequired(true)
        .addChoices(
          { name: 'Member', value: 'member' },
          { name: 'Helper', value: 'helper' },
          { name: 'SrHelper', value: 'srHelper' },
          { name: 'JrMod', value: 'jrMod' },
          { name: 'Mod', value: 'mod' },
        )
    )
    .addStringOption(o => o.setName('reason').setDescription('Reason for demotion').setRequired(true)),

  async execute(message, args) {
    if (!checkPerm(message.member, 'demote'))
      return message.reply('❌ Only **Admins** can use this command.');

    const target = message.mentions.members.first();
    const roleKey = args[1]?.toLowerCase();
    const reason = args.slice(2).join(' ');

    if (!target || !roleKey || !reason)
      return message.reply('Usage: `?demote @user {role} {reason}`\nRoles: `member`, `helper`, `srHelper`, `jrMod`, `mod`');

    const matched = promoteOrder.find(k => k.toLowerCase() === roleKey);
    if (!matched)
      return message.reply(`❌ Unbekannte Rolle. Erlaubt: \`${promoteOrder.slice(0, -1).join('`, `')}\``);

    await performDemote(target, matched, reason, message.author.tag, message.channel);
  },

  async executeSlash(interaction) {
    if (!checkPerm(interaction.member, 'demote'))
      return interaction.reply({ content: '❌ Only **Admins** can use this command.', ephemeral: true });

    const user = interaction.options.getUser('user');
    const roleKey = interaction.options.getString('role');
    const reason = interaction.options.getString('reason');
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!member) return interaction.reply({ content: '❌ User not found.', ephemeral: true });

    await interaction.deferReply();
    await performDemote(member, roleKey, reason, interaction.user.tag, null, interaction);
  },
};

async function performDemote(member, newRoleKey, reason, by, channel, interaction) {
  const currentLevel = getMemberRoleLevel(member);
  const oldRoleKey = currentLevel >= 0 ? promoteOrder[currentLevel] : 'None';
  const newRoleId = config.roles[newRoleKey];

  if (!newRoleId || newRoleId.endsWith('_ROLE_ID')) {
    const msg = `❌ Die Rolle \`${newRoleKey}\` ist noch nicht konfiguriert. Benutze \`?setrole set ${newRoleKey} @role\`.`;
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
    const msg = `❌ Konnte Rollen nicht ändern: ${err.message}`;
    return channel ? channel.send(msg) : interaction.editReply(msg);
  }

  const embed = new EmbedBuilder()
    .setColor('#FF6B35')
    .setTitle('📉 Staff Member Demoted')
    .addFields(
      { name: 'Staff Member', value: `${member.user.tag}`, inline: true },
      { name: 'Demoted by', value: by, inline: true },
      { name: 'Old Role', value: oldRoleKey, inline: true },
      { name: 'New Role', value: `<@&${newRoleId}>`, inline: true },
      { name: 'Reason', value: reason }
    )
    .setThumbnail(member.user.displayAvatarURL())
    .setTimestamp();

  if (channel) channel.send({ embeds: [embed], allowedMentions: { roles: [newRoleId] } });
  else if (interaction) interaction.editReply({ embeds: [embed], allowedMentions: { roles: [newRoleId] } });
}
