const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, Role } = require('discord.js');
const { readData, writeData } = require('../../utils');
const { sendLog } = require('../../utils/logger');
const config = require('../../config.json');

function getStaffRoleIds() {
  const staffConfig = readData('staffConfig.json');
  const ids = new Set();
  if (staffConfig?.staffRoleId) ids.add(staffConfig.staffRoleId);
  const fallbackId = config.roles?.staffTeam;
  if (fallbackId && !fallbackId.endsWith('_ROLE_ID')) ids.add(fallbackId);
  for (const id of (readData('lockperms.json').roles || [])) ids.add(id);
  return [...ids];
}

module.exports = {
  name: 'staff',
  data: new SlashCommandBuilder()
    .setName('staff')
    .setDescription('Staff role settings [Admin]')
    .addSubcommandGroup(group =>
      group.setName('role')
        .setDescription('Manage the staff role')
        .addSubcommand(sub =>
          sub.setName('set')
            .setDescription('Set the staff role that can use all staff commands [Admin]')
            .addRoleOption(o => o.setName('role').setDescription('The staff role').setRequired(true))
        )
        .addSubcommand(sub =>
          sub.setName('info')
            .setDescription('Show the current staff role [Admin]')
        )
    )
    .addSubcommand(sub =>
      sub.setName('lock')
        .setDescription('Lock this channel for everyone except admins [Admin]')
        .addMentionableOption(o =>
          o.setName('target')
            .setDescription('User or role that can still write (one-time exception, cleared on unlock)')
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub.setName('unlock')
        .setDescription('Undo a staff lock on this channel [Admin]')
    ),

  async executeSlash(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator))
      return interaction.reply({ content: 'Only **Administrators** can use this.', ephemeral: true });

    const sub = interaction.options.getSubcommand();

    // ── role set / info ─────────────────────────────────────────────────────
    if (sub === 'set') {
      const role = interaction.options.getRole('role');
      const data = readData('staffConfig.json');
      data.staffRoleId = role.id;
      writeData('staffConfig.json', data);
      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor('#57F287')
          .setTitle('✅ Staff Role Set')
          .setDescription(`<@&${role.id}> can now use all staff commands.`)
          .setTimestamp()],
        ephemeral: true,
      });
    }

    if (sub === 'info') {
      const roleId = readData('staffConfig.json').staffRoleId;
      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor('#5865F2')
          .setTitle('🛡️ Staff Role')
          .addFields({ name: '🎖️ Current Staff Role', value: roleId ? `<@&${roleId}>` : '*(not set)*' })
          .setTimestamp()],
        ephemeral: true,
      });
    }

    // ── /staff lock ─────────────────────────────────────────────────────────
    if (sub === 'lock') {
      const channel = interaction.channel;
      const target  = interaction.options.getMentionable('target');

      // Deny @everyone
      await channel.permissionOverwrites.edit(interaction.guild.id, { SendMessages: false }).catch(() => {});

      // Deny all staff roles so even staff can't bypass (admins bypass via Administrator flag)
      for (const roleId of getStaffRoleIds()) {
        const role = interaction.guild.roles.cache.get(roleId);
        if (role) await channel.permissionOverwrites.edit(role, { SendMessages: false }).catch(() => {});
      }

      // Apply one-time exception for the given user or role
      let allowedId   = null;
      let allowedType = null;
      if (target) {
        const isRole = target instanceof Role;
        await channel.permissionOverwrites.edit(target, { SendMessages: true }).catch(() => {});
        allowedId   = target.id;
        allowedType = isRole ? 'role' : 'user';
      }

      const sl = readData('staffLock.json');
      sl[channel.id] = { allowedId, allowedType };
      writeData('staffLock.json', sl);

      const exceptionLine = allowedType === 'role'
        ? `\n**One-time exception:** <@&${allowedId}> can write until unlocked.`
        : allowedType === 'user'
          ? `\n**One-time exception:** <@${allowedId}> can write until unlocked.`
          : '';

      await interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor('#ED4245')
          .setTitle('🔒 Channel Staff Locked')
          .setDescription(`<#${channel.id}> has been staff locked. Only **Admins** can write.${exceptionLine}`)
          .setTimestamp()],
      });

      sendLog(interaction.client, {
        action: 'Channel Staff Locked',
        executor: interaction.user.tag,
        target: `<#${channel.id}>`,
        color: '#ED4245',
      });
      return;
    }

    // ── /staff unlock ────────────────────────────────────────────────────────
    if (sub === 'unlock') {
      const channel = interaction.channel;

      await channel.permissionOverwrites.edit(interaction.guild.id, { SendMessages: null }).catch(() => {});

      // Reset explicit staff role denies set by /staff lock
      for (const roleId of getStaffRoleIds()) {
        const role = interaction.guild.roles.cache.get(roleId);
        if (role) await channel.permissionOverwrites.edit(role, { SendMessages: null }).catch(() => {});
      }

      // Remove the one-time exception (so the next lock won't re-allow them)
      const sl       = readData('staffLock.json');
      const lockData = sl[channel.id];
      if (lockData?.allowedId) {
        if (lockData.allowedType === 'role') {
          const role = interaction.guild.roles.cache.get(lockData.allowedId);
          if (role) await channel.permissionOverwrites.edit(role, { SendMessages: null }).catch(() => {});
        } else {
          const member = await interaction.guild.members.fetch(lockData.allowedId).catch(() => null);
          if (member) await channel.permissionOverwrites.edit(member, { SendMessages: null }).catch(() => {});
        }
      }
      delete sl[channel.id];
      writeData('staffLock.json', sl);

      await interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor('#57F287')
          .setTitle('🔓 Channel Staff Unlocked')
          .setDescription(`<#${channel.id}> has been unlocked. Everyone can write again.`)
          .setTimestamp()],
      });

      sendLog(interaction.client, {
        action: 'Channel Staff Unlocked',
        executor: interaction.user.tag,
        target: `<#${channel.id}>`,
        color: '#57F287',
      });
      return;
    }
  },
};
