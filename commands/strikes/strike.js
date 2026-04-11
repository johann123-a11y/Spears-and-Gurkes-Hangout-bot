const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { readData, writeData, checkPerm, getMemberRoleLevel, promoteOrder } = require('../../utils');
const { sendLog } = require('../../utils/logger');
const config = require('../../config.json');

module.exports = {
  name: 'strike',
  description: 'Add or remove a strike from a staff member. [SrMod+]',
  data: new SlashCommandBuilder()
    .setName('strike')
    .setDescription('Manage staff member strikes [SrMod+]')
    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('Add a strike to a staff member')
        .addUserOption(o => o.setName('user').setDescription('Staff member').setRequired(true))
        .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Remove a strike from a staff member')
        .addUserOption(o => o.setName('user').setDescription('Staff member').setRequired(true))
        .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(true))
    ),

  async execute(message, args) {
    if (!checkPerm(message.member, 'strike'))
      return message.reply('❌ Only **SrMod** or above can use this command.');

    // ?strike remove @user {reason}  OR  ?strike @user {reason}
    let action = 'add';
    let startIdx = 0;

    if (args[0]?.toLowerCase() === 'remove') {
      action = 'remove';
      startIdx = 1;
    }

    const target = message.mentions.members.first();
    const reason = args.slice(startIdx + 1).join(' ');

    if (!target || !reason)
      return message.reply(`Usage: \`?strike @user {reason}\` or \`?strike remove @user {reason}\``);

    await handleStrike(action, target, reason, message.author, message.guild, message.channel);
  },

  async executeSlash(interaction) {
    if (!checkPerm(interaction.member, 'strike'))
      return interaction.reply({ content: '❌ Only **SrMod** or above can use this command.', ephemeral: true });

    const action = interaction.options.getSubcommand();
    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason');
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!member) return interaction.reply({ content: '❌ User not found.', ephemeral: true });

    await interaction.deferReply();
    await handleStrike(action, member, reason, interaction.user, interaction.guild, null, interaction);
  },
};

async function handleStrike(action, targetMember, reason, executor, guild, channel, interaction) {
  const strikes = readData('strikes.json');
  const userId = targetMember.user.id;

  if (!strikes[userId]) strikes[userId] = { count: 0, entries: [] };

  if (action === 'add') {
    strikes[userId].count += 1;
    strikes[userId].entries.push({
      reason,
      by: executor.tag,
      at: new Date().toISOString(),
    });
    writeData('strikes.json', strikes);

    const count = strikes[userId].count;
    const embed = new EmbedBuilder()
      .setColor('#FF0000')
      .setTitle('⚠️ Staff Member Striked')
      .addFields(
        { name: 'Staff Member', value: `${targetMember.user.tag}`, inline: true },
        { name: 'Striked by', value: executor.tag, inline: true },
        { name: 'Total Strikes', value: `${count}/3`, inline: true },
        { name: 'Reason', value: reason }
      )
      .setThumbnail(targetMember.user.displayAvatarURL())
      .setTimestamp();

    if (channel) channel.send({ embeds: [embed] });
    else if (interaction) await interaction.editReply({ embeds: [embed] });

    // Auto-demote at 3 strikes
    if (count >= 3) {
      await autoDemote(targetMember, guild, channel, interaction);
      strikes[userId] = { count: 0, entries: [] };
      writeData('strikes.json', strikes);
    }
  } else {
    // remove
    if (strikes[userId].count <= 0)
      return channel
        ? channel.send('❌ This user has no strikes to remove.')
        : interaction.editReply('❌ This user has no strikes to remove.');

    strikes[userId].count -= 1;
    strikes[userId].entries.pop();
    writeData('strikes.json', strikes);

    const embed = new EmbedBuilder()
      .setColor('#57F287')
      .setTitle('✅ Strike Removed')
      .addFields(
        { name: 'Staff Member', value: `${targetMember.user.tag}`, inline: true },
        { name: 'Removed by', value: executor.tag, inline: true },
        { name: 'Remaining Strikes', value: `${strikes[userId].count}/3`, inline: true },
        { name: 'Reason', value: reason }
      )
      .setThumbnail(targetMember.user.displayAvatarURL())
      .setTimestamp();

    if (channel) channel.send({ embeds: [embed] });
    else if (interaction) await interaction.editReply({ embeds: [embed] });
  }
}

async function autoDemote(member, guild, channel, interaction) {
  const level = getMemberRoleLevel(member);
  if (level <= 0) return;

  const newRoleKey = promoteOrder[level - 1];
  const oldRoleKey = promoteOrder[level];
  const newRoleId = config.roles[newRoleKey];
  const oldRoleId = config.roles[oldRoleKey];

  try {
    if (oldRoleId && !oldRoleId.endsWith('_ROLE_ID')) await member.roles.remove(oldRoleId);
    if (newRoleId && !newRoleId.endsWith('_ROLE_ID')) await member.roles.add(newRoleId);
  } catch { /* ignore role errors */ }

  const embed = new EmbedBuilder()
    .setColor('#FF0000')
    .setTitle('📉 Auto-Demoted — 3 Strikes Reached')
    .setDescription(`${member.user.tag} has been automatically demoted after reaching **3 strikes**.`)
    .addFields({ name: 'New Role', value: newRoleKey })
    .setTimestamp();

  if (channel) channel.send({ embeds: [embed] });
  else if (interaction) {
    try { await interaction.channel?.send({ embeds: [embed] }); } catch { /* ignore */ }
  }
}
