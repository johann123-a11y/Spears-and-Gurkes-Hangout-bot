const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { checkPerm } = require('../../utils');
const { sendLog } = require('../../utils/logger');

module.exports = {
  name: 'clear',
  description: 'Deletes a specific number of messages. [Mod+]',
  data: new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Delete a number of messages [Mod+]')
    .addIntegerOption(o =>
      o.setName('amount')
        .setDescription('Number of messages to delete (1–100)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100)
    )
    .addUserOption(o =>
      o.setName('user')
        .setDescription('Only delete messages from this user (optional)')
        .setRequired(false)
    ),

  async execute(message, args) {
    if (!checkPerm(message.member, 'clear'))
      return message.reply('❌ You do not have permission to use this command.');

    const amount = parseInt(args[0]);
    if (isNaN(amount) || amount < 1 || amount > 100)
      return message.reply('❌ Please provide a number between **1** and **100**.\nUsage: `?clear {amount}`');

    const targetUser = message.mentions.users.first() || null;

    await message.delete().catch(() => {});

    let messages = await message.channel.messages.fetch({ limit: 100 });

    if (targetUser) {
      messages = messages.filter(m => m.author.id === targetUser.id);
    }

    // Discord can only bulk delete messages < 14 days old
    const toDelete = [...messages.values()].slice(0, amount);
    const deleted  = await message.channel.bulkDelete(toDelete, true).catch(() => null);
    const count    = deleted ? deleted.size : 0;

    const reply = await message.channel.send({
      embeds: [new EmbedBuilder()
        .setColor('#57F287')
        .setTitle('🗑️ Messages Cleared')
        .addFields(
          { name: 'Deleted',   value: `${count} message(s)`, inline: true },
          { name: 'By',        value: message.author.tag,    inline: true },
          ...(targetUser ? [{ name: 'Filter', value: targetUser.tag, inline: true }] : []),
        )
        .setTimestamp()],
    });

    setTimeout(() => reply.delete().catch(() => {}), 4000);

    sendLog(message.client, {
      action: 'Messages Cleared',
      executor: message.author.tag,
      target: targetUser ? targetUser.tag : message.channel.name,
      fields: { 'Deleted': `${count}`, 'Channel': `<#${message.channel.id}>` },
      color: '#57F287',
    });
  },

  async executeSlash(interaction) {
    if (!checkPerm(interaction.member, 'clear'))
      return interaction.reply({ content: '❌ You do not have permission to use this command.', ephemeral: true });

    const amount     = interaction.options.getInteger('amount');
    const targetUser = interaction.options.getUser('user') || null;

    await interaction.deferReply({ ephemeral: true });

    let messages = await interaction.channel.messages.fetch({ limit: 100 });

    if (targetUser) {
      messages = messages.filter(m => m.author.id === targetUser.id);
    }

    const toDelete = [...messages.values()].slice(0, amount);
    const deleted  = await interaction.channel.bulkDelete(toDelete, true).catch(() => null);
    const count    = deleted ? deleted.size : 0;

    await interaction.editReply({
      embeds: [new EmbedBuilder()
        .setColor('#57F287')
        .setTitle('🗑️ Messages Cleared')
        .addFields(
          { name: 'Deleted',   value: `${count} message(s)`, inline: true },
          { name: 'By',        value: interaction.user.tag,  inline: true },
          ...(targetUser ? [{ name: 'Filter', value: targetUser.tag, inline: true }] : []),
        )
        .setTimestamp()],
    });

    sendLog(interaction.client, {
      action: 'Messages Cleared',
      executor: interaction.user.tag,
      target: targetUser ? targetUser.tag : interaction.channel.name,
      fields: { 'Deleted': `${count}`, 'Channel': `<#${interaction.channel.id}>` },
      color: '#57F287',
    });
  },
};
