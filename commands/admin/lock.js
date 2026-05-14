const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { readData, writeData } = require('../../utils');
const { sendLog } = require('../../utils/logger');
const config = require('../../config.json');

function getExemptRoleIds(guild) {
  const staffConfig = readData('staffConfig.json');
  const exempt = new Set();
  if (staffConfig?.staffRoleId) exempt.add(staffConfig.staffRoleId);
  const fallbackId = config.roles?.staffTeam;
  if (fallbackId && !fallbackId.endsWith('_ROLE_ID')) exempt.add(fallbackId);
  const lp = readData('lockperms.json');
  for (const id of (lp.roles || [])) exempt.add(id);
  return [...exempt];
}

module.exports = [
  // ── ?lock prefix command ────────────────────────────────────────────────────
  {
    name: 'lock',
    description: 'Locks the current channel. [Staff]',

    async execute(message) {
      if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels))
        return message.reply('You need **Manage Channels** permission to use this.');

      const channel = message.channel;

      await channel.permissionOverwrites.edit(message.guild.id, { SendMessages: false }).catch(() => {});

      for (const roleId of getExemptRoleIds(message.guild)) {
        const role = message.guild.roles.cache.get(roleId);
        if (role) await channel.permissionOverwrites.edit(role, { SendMessages: true }).catch(() => {});
      }

      message.channel.send({
        embeds: [new EmbedBuilder()
          .setColor('#ED4245')
          .setTitle('Channel Locked')
          .setDescription(`<#${channel.id}> has been locked. Only staff and exempt roles can write.`)
          .setTimestamp()],
      });

      sendLog(message.client, {
        action: 'Channel Locked',
        executor: message.author.tag,
        target: `<#${channel.id}>`,
        color: '#ED4245',
      });
    },
  },

  // ── ?unlock prefix command ──────────────────────────────────────────────────
  {
    name: 'unlock',
    description: 'Unlocks the current channel. [Staff]',

    async execute(message) {
      if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels))
        return message.reply('You need **Manage Channels** permission to use this.');

      const channel = message.channel;

      await channel.permissionOverwrites.edit(message.guild.id, { SendMessages: null }).catch(() => {});

      message.channel.send({
        embeds: [new EmbedBuilder()
          .setColor('#57F287')
          .setTitle('Channel Unlocked')
          .setDescription(`<#${channel.id}> has been unlocked. Everyone can write again.`)
          .setTimestamp()],
      });

      sendLog(message.client, {
        action: 'Channel Unlocked',
        executor: message.author.tag,
        target: `<#${channel.id}>`,
        color: '#57F287',
      });
    },
  },

  // ── /lockperm slash command ─────────────────────────────────────────────────
  {
    name: 'lockperm',
    data: new SlashCommandBuilder()
      .setName('lockperm')
      .setDescription('Manage roles that can still write in a locked channel [Admin]')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addSubcommand(sub =>
        sub.setName('add')
          .setDescription('Add a role that can write in locked channels')
          .addRoleOption(o => o.setName('role').setDescription('Role to add').setRequired(true))
      )
      .addSubcommand(sub =>
        sub.setName('remove')
          .setDescription('Remove a role from the lock-exempt list')
          .addRoleOption(o => o.setName('role').setDescription('Role to remove').setRequired(true))
      )
      .addSubcommand(sub =>
        sub.setName('list')
          .setDescription('Show all lock-exempt roles')
      ),

    async executeSlash(interaction) {
      const sub  = interaction.options.getSubcommand();
      const lp   = readData('lockperms.json');
      if (!Array.isArray(lp.roles)) lp.roles = [];

      if (sub === 'add') {
        const role = interaction.options.getRole('role');
        if (lp.roles.includes(role.id))
          return interaction.reply({ content: `**${role.name}** is already exempt.`, ephemeral: true });
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

      if (sub === 'remove') {
        const role = interaction.options.getRole('role');
        if (!lp.roles.includes(role.id))
          return interaction.reply({ content: `**${role.name}** is not in the exempt list.`, ephemeral: true });
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

      if (sub === 'list') {
        const roles = lp.roles.map(id => `<@&${id}>`).join('\n') || 'No exempt roles configured.';
        return interaction.reply({
          embeds: [new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('Lock-Exempt Roles')
            .setDescription(roles)
            .setTimestamp()],
          ephemeral: true,
        });
      }
    },
  },
];
