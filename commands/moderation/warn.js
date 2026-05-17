const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { checkPerm, readData, writeData } = require('../../utils');

function getPunishment(count) {
  if (count >= 10) return { mute: 28 * 24 * 60 * 60 * 1000, blacklist: true };
  if (count >= 5)  return { mute: 2 * 24 * 60 * 60 * 1000,  blacklist: true };
  if (count >= 3)  return { mute: 24 * 60 * 60 * 1000,       blacklist: false };
  if (count >= 1)  return { mute: 30 * 60 * 1000,            blacklist: false };
  return null;
}

function formatPunishment(p) {
  if (!p) return 'None';
  const parts = [];
  if (p.mute) {
    const ms = p.mute;
    const mins = ms / (60 * 1000);
    if (mins < 60) parts.push(`Muted for ${mins} minute${mins !== 1 ? 's' : ''}`);
    else if (mins < 60 * 24) parts.push(`Muted for ${mins / 60} hour${mins / 60 !== 1 ? 's' : ''}`);
    else parts.push(`Muted for ${mins / (60 * 24)} day${mins / (60 * 24) !== 1 ? 's' : ''}`);
  }
  if (p.blacklist) parts.push('Application blacklisted');
  return parts.join(', ') || 'None';
}

module.exports = {
  name: 'warn',
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Warn system [Staff]')
    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('Add a warning to a user')
        .addUserOption(o => o.setName('user').setDescription('User to warn').setRequired(true))
        .addStringOption(o => o.setName('reason').setDescription('Reason for the warning').setRequired(false))
    )
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Remove warnings from a user')
        .addUserOption(o => o.setName('user').setDescription('User to remove warns from').setRequired(true))
        .addIntegerOption(o => o.setName('count').setDescription('Number of warns to remove').setRequired(true).setMinValue(1))
    ),

  async executeSlash(interaction) {
    if (!checkPerm(interaction.member, 'warn'))
      return interaction.reply({ content: 'Only **Staff** can use this command.', ephemeral: true });

    const sub    = interaction.options.getSubcommand();
    const target = interaction.options.getUser('user');
    const member = await interaction.guild.members.fetch(target.id).catch(() => null);

    if (!member)
      return interaction.reply({ content: 'Could not find that user in this server.', ephemeral: true });

    const warnsData = readData('warns.json');
    if (!warnsData[target.id]) warnsData[target.id] = { count: 0, warns: [] };
    const userData = warnsData[target.id];

    // /warn add
    if (sub === 'add') {
      const reason = interaction.options.getString('reason') || 'No reason provided.';

      userData.count++;
      userData.warns.push({ reason, date: new Date().toISOString(), by: interaction.user.tag });
      writeData('warns.json', warnsData);

      const punishment = getPunishment(userData.count);
      const punishDesc = formatPunishment(punishment);

      // Apply punishment
      if (punishment) {
        try {
          await member.timeout(punishment.mute, reason);
        } catch (e) {
          console.error('[warn] Failed to timeout:', e);
        }

        if (punishment.blacklist) {
          const bl = readData('blacklist.json');
          if (!bl[target.id]) bl[target.id] = {};
          bl[target.id].application = true;
          writeData('blacklist.json', bl);
        }
      }

      const embed = new EmbedBuilder()
        .setColor('#FEE75C')
        .setTitle('⚠️ Warning Issued')
        .addFields(
          { name: '👤 User',        value: `<@${target.id}> (${target.tag})`, inline: true },
          { name: '🛡️ Warned by',   value: `<@${interaction.user.id}>`,       inline: true },
          { name: '📋 Reason',      value: reason },
          { name: '🔢 Total Warns', value: `${userData.count}`,                inline: true },
          { name: '🔨 Punishment',  value: punishDesc,                         inline: true },
        )
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    // /warn remove
    if (sub === 'remove') {
      const removeCount = interaction.options.getInteger('count');

      const oldCount = userData.count;
      const oldPunishment = getPunishment(oldCount);

      userData.count = Math.max(0, userData.count - removeCount);
      userData.warns = userData.warns.slice(0, Math.max(0, userData.warns.length - removeCount));
      writeData('warns.json', warnsData);

      const newPunishment = getPunishment(userData.count);

      // Adjust punishments
      const shouldUntimeout = !newPunishment || newPunishment.mute < (oldPunishment?.mute ?? 0);
      if (shouldUntimeout && oldPunishment?.mute) {
        try {
          await member.timeout(null);
        } catch (e) {
          console.error('[warn] Failed to remove timeout:', e);
        }
      }

      // Apply new mute if needed (lower threshold now applies)
      if (newPunishment?.mute && (!oldPunishment?.mute || newPunishment.mute !== oldPunishment.mute)) {
        try {
          await member.timeout(newPunishment.mute, 'Warn level adjusted');
        } catch (e) {
          console.error('[warn] Failed to apply new timeout:', e);
        }
      }

      // Handle blacklist
      if (oldPunishment?.blacklist && !newPunishment?.blacklist) {
        const bl = readData('blacklist.json');
        if (bl[target.id]) {
          delete bl[target.id].application;
          if (Object.keys(bl[target.id]).length === 0) delete bl[target.id];
          writeData('blacklist.json', bl);
        }
      }

      const embed = new EmbedBuilder()
        .setColor('#57F287')
        .setTitle('✅ Warnings Removed')
        .addFields(
          { name: '👤 User',            value: `<@${target.id}> (${target.tag})`, inline: true },
          { name: '🛡️ Removed by',      value: `<@${interaction.user.id}>`,       inline: true },
          { name: '🔢 Remaining Warns', value: `${userData.count}`,                inline: true },
          { name: '🔨 Current Punishment', value: formatPunishment(newPunishment), inline: true },
        )
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }
  },
};
