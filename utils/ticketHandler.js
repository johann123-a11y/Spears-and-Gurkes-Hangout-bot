const {
  EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder,
  ChannelType, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle,
} = require('discord.js');
const { readData, writeData } = require('./index');
const { sendLog } = require('./logger');

// --- Button: user clicks a ticket panel button ---
async function handleTicketOpen(interaction) {
  const panelId = interaction.customId.split(':')[1];
  const tickets = readData('tickets.json');
  const panel = tickets.panels?.[panelId];

  if (!panel)
    return interaction.reply({ content: '❌ This ticket panel no longer exists.', ephemeral: true });

  // Prevent duplicate open tickets per user per panel
  const openTickets = readData('openTickets.json');
  const existing = Object.entries(openTickets).find(
    ([, t]) => t.userId === interaction.user.id && t.panelId === panelId
  );
  if (existing) {
    return interaction.reply({
      content: `❌ You already have an open ticket for this panel: <#${existing[0]}>`,
      ephemeral: true,
    });
  }

  if (panel.questions.length > 0) {
    // Show modal with questions (Discord max: 5 inputs)
    const modal = new ModalBuilder()
      .setCustomId(`ticket_questions:${panelId}`)
      .setTitle(`Open Ticket — ${panel.name.substring(0, 40)}`);

    for (let i = 0; i < Math.min(panel.questions.length, 5); i++) {
      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId(`tq_${i}`)
            .setLabel(panel.questions[i].substring(0, 45))
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        )
      );
    }

    await interaction.showModal(modal);
  } else {
    // No questions — create ticket channel directly
    await interaction.deferReply({ ephemeral: true });
    await createTicketChannel(interaction, panel, []);
  }
}

// --- Modal: user submitted pre-open questions ---
async function handleTicketQuestionsModal(interaction) {
  const panelId = interaction.customId.split(':')[1];
  const tickets = readData('tickets.json');
  const panel = tickets.panels?.[panelId];

  if (!panel)
    return interaction.reply({ content: '❌ Panel not found.', ephemeral: true });

  await interaction.deferReply({ ephemeral: true });

  const answers = panel.questions.map((q, i) => ({
    question: q,
    answer: interaction.fields.getTextInputValue(`tq_${i}`) || '—',
  }));

  await createTicketChannel(interaction, panel, answers);
}

// --- Create the ticket channel ---
async function createTicketChannel(interaction, panel, answers) {
  const guild = interaction.guild;
  const category = guild.channels.cache.get(panel.categoryId);
  const safeName = interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 20);
  const channelName = `ticket-${safeName}`;

  let ticketChannel;
  try {
    ticketChannel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: category || null,
      permissionOverwrites: [
        {
          id: guild.id,
          deny: [PermissionFlagsBits.ViewChannel],
        },
        {
          id: interaction.user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
          ],
        },
        {
          id: interaction.client.user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ManageChannels,
            PermissionFlagsBits.ReadMessageHistory,
          ],
        },
      ],
    });
  } catch (err) {
    return interaction.editReply({ content: `❌ Could not create ticket channel: ${err.message}` });
  }

  // Build ticket embed
  const embed = new EmbedBuilder()
    .setColor('#5865F2')
    .setTitle(`🎫 ${panel.name}`)
    .setDescription(`Ticket opened by <@${interaction.user.id}>\n\nA staff member will be with you shortly.`)
    .setThumbnail(interaction.user.displayAvatarURL())
    .setTimestamp();

  if (answers.length > 0) {
    embed.addFields(answers.map(a => ({ name: a.question, value: a.answer })));
  }

  const closeBtn = new ButtonBuilder()
    .setCustomId('ticket_close_btn')
    .setLabel('🔒 Close Ticket')
    .setStyle(ButtonStyle.Danger);

  await ticketChannel.send({
    content: `<@${interaction.user.id}>`,
    embeds: [embed],
    components: [new ActionRowBuilder().addComponents(closeBtn)],
  });

  // Save open ticket
  const openTickets = readData('openTickets.json');
  openTickets[ticketChannel.id] = {
    userId: interaction.user.id,
    panelId: panel.id,
    panelName: panel.name,
    openedAt: new Date().toISOString(),
    answers,
  };
  writeData('openTickets.json', openTickets);

  sendLog(interaction.client, {
    action: 'Ticket Opened',
    executor: interaction.user.tag,
    target: panel.name,
    fields: { Channel: `<#${ticketChannel.id}>` },
    color: '#5865F2',
  });

  await interaction.editReply({ content: `✅ Your ticket has been created: <#${ticketChannel.id}>` });
}

// --- Button: "Close Ticket" button in ticket channel ---
async function handleCloseButton(interaction) {
  // Ask for a reason via modal
  const modal = new ModalBuilder()
    .setCustomId('ticket_close_modal')
    .setTitle('Close Ticket');

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('close_reason')
        .setLabel('Reason for closing this ticket')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
    )
  );

  await interaction.showModal(modal);
}

// --- Modal: close reason submitted ---
async function handleCloseModal(interaction) {
  const reason = interaction.fields.getTextInputValue('close_reason');
  const openTickets = readData('openTickets.json');
  const ticket = openTickets[interaction.channelId];

  if (!ticket)
    return interaction.reply({ content: '❌ This is not an active ticket channel.', ephemeral: true });

  await interaction.reply({ content: '🔒 Closing ticket in **3 seconds**...' });

  // DM the user
  try {
    const user = await interaction.client.users.fetch(ticket.userId);
    const dmEmbed = new EmbedBuilder()
      .setColor('#ED4245')
      .setTitle('🔒 Your Ticket Was Closed')
      .addFields(
        { name: 'Panel', value: ticket.panelName, inline: true },
        { name: 'Closed by', value: interaction.user.tag, inline: true },
        { name: 'Time', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
        { name: 'Reason', value: reason },
      )
      .setTimestamp();
    await user.send({ embeds: [dmEmbed] });
  } catch { /* User has DMs disabled */ }

  sendLog(interaction.client, {
    action: 'Ticket Closed',
    executor: interaction.user.tag,
    target: `<@${ticket.userId}>`,
    fields: { Panel: ticket.panelName, Reason: reason },
    color: '#ED4245',
  });

  delete openTickets[interaction.channelId];
  writeData('openTickets.json', openTickets);

  setTimeout(() => interaction.channel.delete().catch(() => {}), 3000);
}

module.exports = {
  handleTicketOpen,
  handleTicketQuestionsModal,
  handleCloseButton,
  handleCloseModal,
};
