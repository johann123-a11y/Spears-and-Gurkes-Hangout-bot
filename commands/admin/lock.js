const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { readData, writeData, isStaffMember } = require('../../utils');
const { sendLog } = require('../../utils/logger');
const config = require('../../config.json');

function getExemptRoleIds(guild) {
  // Staff role(s)
  const staffConfig = readData('staffConfig.json');
  const exempt = new Set();
  if (staffConfig?.staffRoleId) exempt.add(staffConfig.staffRoleId);
  const fallbackId = config.roles?.staffTeam;
  if (fallbackId && !fallbackId.endsWith('_ROLE_ID')) exempt.add(fallbackId);

  // lockperm roles
  const lp = readData('lockperms.json');
  for (const id of (lp.roles || [])) exempt.add(id);

  return [...exempt];
}

module.exports = {
  name: 'lock',
  data: new SlashCommandBuilder()
    .setName('lock')
    .setDescription('Lock or unlock a channel, or manage lock-exempt roles')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addSubcommand(sub =>
      sub.setName('lock')
        .setDescription('Lock this channel — only staff and exempt roles can write')
        .addChannelOption(o => o.setName('channel').setDescription('Channel to lock (default: current)').setRequired(false))
    )
    .addSubcommand(sub =>
      sub.setName('unlock')
        .setDescription('Unlock this channel for everyone')
        .addChannelOption(o => o.setName('channel').setDescription('Channel to unlock (default: current)').setRequired(false))
    )
    .addSubcommand(sub =>
      sub.setName('lockperm')
        .setDescription('Add or remove a role that can still write when a channel is locked')
        .addStringOption(o =>
          o.setName('action').setDescription('Add or remove').setRequired(true)
            .addChoices({ name: 'Add', value: 'add' }, { name: 'Remove', value: 'remove' })
        )
        .addRoleOption(o => o.setName('role').setDescription('Role to add/remove').setRequired(true))
    ),

  async executeSlash(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels))
      return interaction.reply({ content: 'You need **Manage Channels** permission to use this.', ephemeral: true });

    const sub = interaction.options.getSubcommand();

    // ── /lock lock ────────────────────────────────────────────────────────────
    if (sub === 'lock') {
      const channel = interaction.options.getChannel('channel') ?? interaction.channel;

      // Deny @everyone send
      await channel.permissionOverwrites.edit(interaction.guild.id, {
        SendMessages: false,
      }).catch(() => {});

      // Allow exempt roles
      for (const roleId of getExemptRoleIds(interaction.guild)) {
        const role = interaction.guild.roles.cache.get(roleId);
        if (role) {
          await channel.permissionOverwrites.edit(role, { SendMessages: true }).catch(() => {});
        }
      }

      await interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor('#ED4245')
          .setTitle('Channel Locked')
          .setDescription(`<#${channel.id}> has been locked. Only staff and exempt roles can write.`)
          .setTimestamp()],
      });

      sendLog(interaction.client, {
        action: 'Channel Locked',
        executor: interaction.user.tag,
        target: `<#${channel.id}>`,
        color: '#ED4245',
      });
    }

    // ── /lock unlock ──────────────────────────────────────────────────────────
    if (sub === 'unlock') {
      const channel = interaction.options.getChannel('channel') ?? interaction.channel;

      // Restore @everyone send
      await channel.permissionOverwrites.edit(interaction.guild.id, {
        SendMessages: null,
      }).catch(() => {});

      await interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor('#57F287')
          .setTitle('Channel Unlocked')
          .setDescription(`<#${channel.id}> has been unlocked. Everyone can write again.`)
          .setTimestamp()],
      });

      sendLog(interaction.client, {
        action: 'Channel Unlocked',
        executor: interaction.user.tag,
        target: `<#${channel.id}>`,
        color: '#57F287',
      });
    }

    // ── /lock lockperm ────────────────────────────────────────────────────────
    if (sub === 'lockperm') {
      const action = interaction.options.getString('action');
      const role   = interaction.options.getRole('role');
      const lp     = readData('lockperms.json');
      if (!Array.isArray(lp.roles)) lp.roles = [];

      if (action === 'add') {
        if (lp.roles.includes(role.id))
          return interaction.reply({ content: `**${role.name}** is already in the lock-exempt list.`, ephemeral: true });
        lp.roles.push(role.id);
        writeData('lockperms.json', lp);
        return interaction.reply({
          embeds: [new EmbedBuilder()
            .setColor('#57F287')
            .setTitle('Lock Perm Added')
            .setDescription(`**${role.name}** can now write in locked channels.`)
            .setTimestamp()],
          ephemeral: true,
        });
      }

      if (action === 'remove') {
        if (!lp.roles.includes(role.id))
          return interaction.reply({ content: `**${role.name}** is not in the lock-exempt list.`, ephemeral: true });
        lp.roles = lp.roles.filter(id => id !== role.id);
        writeData('lockperms.json', lp);
        return interaction.reply({
          embeds: [new EmbedBuilder()
            .setColor('#ED4245')
            .setTitle('Lock Perm Removed')
            .setDescription(`**${role.name}** can no longer write in locked channels.`)
            .setTimestamp()],
          ephemeral: true,
        });
      }
    }
  },
};
