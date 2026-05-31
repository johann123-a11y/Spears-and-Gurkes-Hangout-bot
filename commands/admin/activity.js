const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { readData, isStaffMember } = require('../../utils');
const config = require('../../config.json');

function getStaffRoleId() {
  const staffConfig = readData('staffConfig.json');
  if (staffConfig?.staffRoleId) return staffConfig.staffRoleId;
  const fallback = config.roles?.staffTeam;
  return (fallback && !fallback.endsWith('_ROLE_ID')) ? fallback : null;
}

function prizeList(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return '—';
  const prizes = arr.map(e => e.prize).filter(Boolean);
  return prizes.length ? prizes.slice(-5).join(', ') : '—';
}

function buildUserField(member, data) {
  const d = data || {};
  const t = d.tickets   || { closed: 0, renamed: 0, usersAdded: 0 };
  const g = d.giveaways || [];
  const m = d.minigames  || {};

  const ticketLine = `🎫 Geschlossen: **${t.closed || 0}** · Umbenannt: **${t.renamed || 0}** · User hinzugefügt: **${t.usersAdded || 0}**`;

  const gwCount  = g.length;
  const gwPrizes = g.map(e => e.prize).filter(Boolean).slice(-5).join(', ');
  const gwLine   = gwCount > 0 ? `🎉 Giveaways: **${gwCount}** (${gwPrizes})` : `🎉 Giveaways: **0**`;

  const poll = m.poll || 0;
  const rps  = Array.isArray(m.rps)  ? m.rps  : [];
  const dok  = Array.isArray(m.dok)  ? m.dok  : [];
  const sos  = Array.isArray(m.sos)  ? m.sos  : [];
  const ftpb = Array.isArray(m.ftpb) ? m.ftpb : [];
  const gtn  = Array.isArray(m.gtn)  ? m.gtn  : [];

  const parts = [];
  if (poll)       parts.push(`Poll: **${poll}**`);
  if (rps.length) parts.push(`RPS: **${rps.length}** (${prizeList(rps)})`);
  if (dok.length) parts.push(`DoK: **${dok.length}** (${prizeList(dok)})`);
  if (sos.length) parts.push(`SoS: **${sos.length}** (${prizeList(sos)})`);
  if (ftpb.length)parts.push(`FtPB: **${ftpb.length}** (${prizeList(ftpb)})`);
  if (gtn.length) parts.push(`GTN: **${gtn.length}** (${prizeList(gtn)})`);
  const gameLine = parts.length ? `🎮 ${parts.join(' · ')}` : '🎮 Keine Minispiele';

  return {
    name: member.user.tag,
    value: [ticketLine, gwLine, gameLine].join('\n'),
    inline: false,
  };
}

async function showActivity(guild, replyFn) {
  await guild.members.fetch().catch(() => {});

  const roleId   = getStaffRoleId();
  const activity = readData('activity.json');

  const staffMembers = roleId
    ? [...guild.members.cache.values()].filter(m => !m.user.bot && m.roles.cache.has(roleId))
    : [...guild.members.cache.values()].filter(m => !m.user.bot && isStaffMember(m));

  if (staffMembers.length === 0) {
    return replyFn({
      embeds: [new EmbedBuilder()
        .setColor('#FEE75C')
        .setTitle('📊 Staff Activity')
        .setDescription('Keine Staff-Mitglieder gefunden.')
        .setTimestamp()],
    });
  }

  const fields = staffMembers.map(m => buildUserField(m, activity[m.id]));

  // Split into embeds of 10 fields each (Discord limit: 25, but 10 keeps it readable)
  const embeds = [];
  for (let i = 0; i < fields.length; i += 10) {
    embeds.push(
      new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle(i === 0 ? '📊 Staff Activity' : '📊 Staff Activity (Fortsetzung)')
        .addFields(fields.slice(i, i + 10))
        .setFooter({ text: `${staffMembers.length} Staff-Mitglieder gesamt` })
        .setTimestamp()
    );
  }

  return replyFn({ embeds: embeds.slice(0, 10) });
}

module.exports = {
  name: 'activity',
  description: 'Zeigt die Aktivitätsstatistiken aller Staff-Mitglieder [Admin]',
  data: new SlashCommandBuilder()
    .setName('activity')
    .setDescription('Zeigt die Aktivitätsstatistiken aller Staff-Mitglieder [Admin]')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async executeSlash(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator))
      return interaction.reply({ content: 'Nur **Administratoren** können das nutzen.', ephemeral: true });

    await interaction.deferReply();
    await showActivity(interaction.guild, opts => interaction.editReply(opts));
  },

  async execute(message) {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator))
      return message.reply('Nur **Administratoren** können das nutzen.');

    await showActivity(message.guild, opts => message.channel.send(opts));
  },
};
