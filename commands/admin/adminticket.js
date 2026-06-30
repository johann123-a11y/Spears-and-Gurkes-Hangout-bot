const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { readData, writeData } = require('../../utils');
const { sendLog } = require('../../utils/logger');

module.exports = {
  name: 'admin',
  data: new SlashCommandBuilder()
    .setName('admin')
    .setDescription('Admin-only commands')
    .addSubcommand(sub =>
      sub.setName('ticket')
        .setDescription('Make this ticket admin-only — only Discord Admins + ticket creator can see it [Admin]')
    ),

  async executeSlash(interaction) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'ticket') return handleAdminTicket(interaction);
  },
};

async function handleAdminTicket(interaction) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator))
    return interaction.reply({ content: 'Only **Administrators** can use this command.', ephemeral: true });

  const openTickets = readData('openTickets.json');
  const ticket = openTickets[interaction.channelId];
  if (!ticket)
    return interaction.reply({ content: 'This command can only be used inside a ticket channel.', ephemeral: true });

  await interaction.deferReply({ ephemeral: true });

  const channel = interaction.channel;

  try {
    // Remove all overwrites except @everyone, the bot, and the ticket creator
    const toDelete = [];
    for (const [id] of channel.permissionOverwrites.cache) {
      if (id === interaction.guild.id) continue;
      if (id === interaction.client.user.id) continue;
      if (id === ticket.userId) continue;
      toDelete.push(id);
    }
    for (const id of toDelete) {
      await channel.permissionOverwrites.delete(id);
    }

    ticket.adminOnly = true;
    writeData('openTickets.json', openTickets);

    await channel.send(`🔒 This ticket has been made **admin-only** by <@${interaction.user.id}>. Only Discord Administrators and the ticket creator can now see it.`);
    await interaction.editReply({ content: 'Ticket is now admin-only.' });

    sendLog(interaction.client, {
      action: 'Ticket Made Admin-Only',
      executor: interaction.user.tag,
      fields: { 'Ticket ID': `#${ticket.ticketId || '?'}`, Channel: `<#${interaction.channelId}>` },
      color: '#ED4245',
    });
  } catch (err) {
    await interaction.editReply({ content: `Failed: ${err.message}` });
  }
}
