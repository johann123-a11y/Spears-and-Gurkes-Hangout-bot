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

async function applyStaffLock(guild, channel, target, targetType) {
  await channel.permissionOverwrites.edit(guild.id, { SendMessages: false }).catch(() => {});
  for (const roleId of getStaffRoleIds()) {
    const role = guild.roles.cache.get(roleId);
    if (role) await channel.permissionOverwrites.edit(role, { SendMessages: false }).catch(() => {});
  }
  if (target) {
    await channel.permissionOverwrites.edit(target, { SendMessages: true }).catch(() => {});
  }
  const sl = readData('staffLock.json');
  sl[channel.id] = { allowedId: target ? target.id : null, allowedType: targetType };
  writeData('staffLock.json', sl);
}

async function applyStaffUnlock(guild, channel) {
  await channel.permissionOverwrites.edit(guild.id, { SendMessages: null }).catch(() => {});
  for (const roleId of getStaffRoleIds()) {
    const role = guild.roles.cache.get(roleId);
    if (role) await channel.permissionOverwrites.edit(role, { SendMessages: null }).catch(() => {});
  }
  const sl = readData('staffLock.json');
  const lockData = sl[channel.id];
  if (lockData?.allowedId) {
    if (lockData.allowedType === 'role') {
      const role = guild.roles.cache.get(lockData.allowedId);
      if (role) await channel.permissionOverwrites.edit(role, { SendMessages: null }).catch(() => {});
    } else {
      const member = await guild.members.fetch(lockData.allowedId).catch(() => null);
      if (member) await channel.permissionOverwrites.edit(member, { SendMessages: null }).catch(() => {});
    }
  }
  delete sl[channel.id];
  writeData('staffLock.json', sl);
}

module.exports = [

  // ── /staff slash command ──────────────────────────────────────────────────
  {
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

      if (sub === 'lock') {
        const channel = interaction.channel;
        const raw     = interaction.options.getMentionable('target');
        const isRole  = raw instanceof Role;
        await applyStaffLock(interaction.guild, channel, raw, raw ? (isRole ? 'role' : 'user') : null);

        const exceptionLine = !raw ? ''
          : isRole
            ? `\n**One-time exception:** <@&${raw.id}> can write until unlocked.`
            : `\n**One-time exception:** <@${raw.id}> can write until unlocked.`;

        await interaction.reply({
          embeds: [new EmbedBuilder()
            .setColor('#ED4245')
            .setTitle('🔒 Channel Staff Locked')
            .setDescription(`<#${channel.id}> has been staff locked. Only **Admins** can write.${exceptionLine}`)
            .setTimestamp()],
        });
        sendLog(interaction.client, { action: 'Channel Staff Locked', executor: interaction.user.tag, target: `<#${channel.id}>`, color: '#ED4245' });
        return;
      }

      if (sub === 'unlock') {
        const channel = interaction.channel;
        await applyStaffUnlock(interaction.guild, channel);
        await interaction.reply({
          embeds: [new EmbedBuilder()
            .setColor('#57F287')
            .setTitle('🔓 Channel Staff Unlocked')
            .setDescription(`<#${channel.id}> has been unlocked. Everyone can write again.`)
            .setTimestamp()],
        });
        sendLog(interaction.client, { action: 'Channel Staff Unlocked', executor: interaction.user.tag, target: `<#${channel.id}>`, color: '#57F287' });
        return;
      }
    },
  },

  // ── ?stafflock prefix command ─────────────────────────────────────────────
  {
    name: 'stafflock',
    description: 'Staff locks the current channel. [Admin]',

    async execute(message) {
      if (!message.member.permissions.has(PermissionFlagsBits.Administrator))
        return message.reply('Only **Administrators** can use this command.');

      const channel = message.channel;

      // Resolve optional target — role mention takes priority over user mention
      let target     = null;
      let targetType = null;
      const mentionedRole   = message.mentions.roles.first();
      const mentionedMember = message.mentions.members.first();
      if (mentionedRole) {
        target     = mentionedRole;
        targetType = 'role';
      } else if (mentionedMember) {
        target     = mentionedMember;
        targetType = 'user';
      }

      await applyStaffLock(message.guild, channel, target, targetType);

      const exceptionLine = !target ? ''
        : targetType === 'role'
          ? `\n**One-time exception:** <@&${target.id}> can write until unlocked.`
          : `\n**One-time exception:** <@${target.id}> can write until unlocked.`;

      message.channel.send({
        embeds: [new EmbedBuilder()
          .setColor('#ED4245')
          .setTitle('🔒 Channel Staff Locked')
          .setDescription(`<#${channel.id}> has been staff locked. Only **Admins** can write.${exceptionLine}`)
          .setTimestamp()],
      });

      sendLog(message.client, { action: 'Channel Staff Locked', executor: message.author.tag, target: `<#${channel.id}>`, color: '#ED4245' });
    },
  },

  // ── ?staffunlock prefix command ───────────────────────────────────────────
  {
    name: 'staffunlock',
    description: 'Undoes a staff lock on the current channel. [Admin]',

    async execute(message) {
      if (!message.member.permissions.has(PermissionFlagsBits.Administrator))
        return message.reply('Only **Administrators** can use this command.');

      const channel = message.channel;
      await applyStaffUnlock(message.guild, channel);

      message.channel.send({
        embeds: [new EmbedBuilder()
          .setColor('#57F287')
          .setTitle('🔓 Channel Staff Unlocked')
          .setDescription(`<#${channel.id}> has been unlocked. Everyone can write again.`)
          .setTimestamp()],
      });

      sendLog(message.client, { action: 'Channel Staff Unlocked', executor: message.author.tag, target: `<#${channel.id}>`, color: '#57F287' });
    },
  },
];
