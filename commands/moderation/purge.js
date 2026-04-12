const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { sendLog } = require('../../utils/logger');

module.exports = {
  name: 'purge',
  description: 'Deletes a specific number of messages from a user. [Admin Only]',
  data: new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Delete messages from a specific user [Admin Only]')
    .addUserOption(o => o.setName('user').setDescription('User whose messages to delete').setRequired(true))
    .addIntegerOption(o =>
      o.setName('amount')
        .setDescription('Number of messages to delete (1–100)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100)
    ),

  async execute(message, args) {
    if (!message.member.permissions.has('Administrator'))
      return message.reply('❌ Only **Administrators** can use this command.');

    const target = message.mentions.members.first();
    const amount = parseInt(args[1]);

    if (!target) return message.reply('Usage: `?purge @user {amount}`');
    if (isNaN(amount) || amount < 1 || amount > 100)
      return message.reply('❌ Please provide a number between **1** and **100**.');

    await message.delete().catch(() => {});

    // Fetch last 100 messages and filter by user
    const fetched  = await message.channel.messages.fetch({ limit: 100 });
    const toDelete = [...fetched.values()]
      .filter(m => m.author.id === target.user.id)
      .slice(0, amount);

    if (toDelete.length === 0) {
      const reply = await message.channel.send(`❌ No recent messages from **${target.user.tag}** found.`);
      return setTimeout(() => reply.delete().catch(() => {}), 5000);
    }

    const deleted = await message.channel.bulkDelete(toDelete, true).catch(() => null);
    const count   = deleted ? deleted.size : toDelete.length;

    const reply = await message.channel.send({
      embeds: [new EmbedBuilder()
        .setColor('#57F287')
        .setTitle('🗑️ Purge Complete')
        .addFields(
          { name: 'User',    value: target.user.tag,       inline: true },
          { name: 'Deleted', value: `${count} message(s)`, inline: true },
          { name: 'By',      value: message.author.tag,    inline: true },
        )
        .setTimestamp()],
    });

    setTimeout(() => reply.delete().catch(() => {}), 5000);

    sendLog(message.client, {
      action: 'Purge',
      executor: message.author.tag,
      target: target.user.tag,
      fields: { Deleted: `${count}`, Channel: `<#${message.channel.id}>` },
      color: '#57F287',
    });
  },

  async executeSlash(interaction) {
    if (!interaction.member.permissions.has('Administrator'))
      return interaction.reply({ content: '❌ Only **Administrators** can use this command.', ephemeral: true });

    const user   = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount');

    await interaction.deferReply({ ephemeral: true });

    const fetched  = await interaction.channel.messages.fetch({ limit: 100 });
    const toDelete = [...fetched.values()]
      .filter(m => m.author.id === user.id)
      .slice(0, amount);

    if (toDelete.length === 0)
      return interaction.editReply(`❌ No recent messages from **${user.tag}** found.`);

    const deleted = await interaction.channel.bulkDelete(toDelete, true).catch(() => null);
    const count   = deleted ? deleted.size : toDelete.length;

    await interaction.editReply({
      embeds: [new EmbedBuilder()
        .setColor('#57F287')
        .setTitle('🗑️ Purge Complete')
        .addFields(
          { name: 'User',    value: user.tag,              inline: true },
          { name: 'Deleted', value: `${count} message(s)`, inline: true },
          { name: 'By',      value: interaction.user.tag,  inline: true },
        )
        .setTimestamp()],
    });

    sendLog(interaction.client, {
      action: 'Purge',
      executor: interaction.user.tag,
      target: user.tag,
      fields: { Deleted: `${count}`, Channel: `<#${interaction.channel.id}>` },
      color: '#57F287',
    });
  },
};
