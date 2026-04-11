const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { hasPermission } = require('../../utils');

module.exports = {
  name: 'pingperm',
  description: 'Grants a role permission to ping a specific target. [Admin Only]',
  data: new SlashCommandBuilder()
    .setName('pingperm')
    .setDescription('Grant a role ping permission [Admin Only]')
    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('Give a role permission to ping a target')
        .addStringOption(o =>
          o.setName('ping')
            .setDescription('What to allow pinging: @everyone, @here, or a role mention')
            .setRequired(true)
        )
        .addRoleOption(o =>
          o.setName('role')
            .setDescription('The role that receives ping permission')
            .setRequired(true)
        )
    ),

  async execute(message, args) {
    if (!hasPermission(message.member, 'admin'))
      return message.reply('❌ Only **Admins** can use this command.');

    // ?pingperm add {ping} {role}
    const sub = args[0]?.toLowerCase();
    if (sub !== 'add') return message.reply('Usage: `?pingperm add {ping} {role}`');

    const pingTarget = args[1];
    const roleMention = message.mentions.roles.first();

    if (!pingTarget || !roleMention)
      return message.reply('Usage: `?pingperm add {@everyone|@here|@role} @role`');

    await performPingPerm(message.guild, pingTarget, roleMention, message.channel);
  },

  async executeSlash(interaction) {
    if (!hasPermission(interaction.member, 'admin'))
      return interaction.reply({ content: '❌ Only **Admins** can use this command.', ephemeral: true });

    const pingTarget = interaction.options.getString('ping');
    const role = interaction.options.getRole('role');

    await interaction.deferReply();
    await performPingPerm(interaction.guild, pingTarget, role, null, interaction);
  },
};

async function performPingPerm(guild, pingTarget, targetRole, channel, interaction) {
  const lower = pingTarget.toLowerCase();

  try {
    if (lower === '@everyone' || lower === '@here' || lower === 'everyone' || lower === 'here') {
      // Grant MENTION_EVERYONE permission to the role
      await targetRole.setPermissions(
        targetRole.permissions.add(PermissionFlagsBits.MentionEveryone)
      );

      const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('✅ Ping Permission Granted')
        .setDescription(`The role **${targetRole.name}** can now use \`@everyone\` / \`@here\`.`)
        .setTimestamp();

      return channel ? channel.send({ embeds: [embed] }) : interaction.editReply({ embeds: [embed] });
    }

    // It's a role mention — make that role mentionable
    const mentionableRoleId = pingTarget.replace(/[<@&>]/g, '');
    const mentionableRole = guild.roles.cache.get(mentionableRoleId);

    if (!mentionableRole) {
      const msg = '❌ Could not find the role to make mentionable.';
      return channel ? channel.send(msg) : interaction.editReply(msg);
    }

    await mentionableRole.setMentionable(true, `Ping permission granted to ${targetRole.name}`);

    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle('✅ Ping Permission Granted')
      .setDescription(`The role **${mentionableRole.name}** is now mentionable by **${targetRole.name}**.`)
      .setTimestamp();

    if (channel) channel.send({ embeds: [embed] });
    else if (interaction) interaction.editReply({ embeds: [embed] });
  } catch (err) {
    const msg = `❌ Failed: ${err.message}`;
    if (channel) channel.send(msg);
    else if (interaction) interaction.editReply(msg);
  }
}
