const {
  EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder,
  ChannelType, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle,
} = require('discord.js');
const { readData, writeData } = require('./index');
const { sendLog } = require('./logger');

// ── Button: user clicks a ticket panel button ─────────────────────────────────
async function handleTicketOpen(interaction) {
  const panelId = interaction.customId.split(':')[1];
  const tickets = readData('tickets.json');
  const panel   = tickets.panels?.[panelId];

  if (!panel)
    return interaction.reply({ content: '❌ This ticket panel no longer exists.', ephemeral: true });

  // Prevent duplicate tickets for same panel
  const openTickets = readData('openTickets.json');
  const existing    = Object.entries(openTickets).find(
    ([, t]) => t.userId === interaction.user.id && t.panelId === panelId
  );
  if (existing) {
    return interaction.reply({
      content: `❌ You already have an open ticket for **${panel.name}**: <#${existing[0]}>`,
      ephemeral: true,
    });
  }

  if (panel.questions.length > 0) {
    // Show modal with pre-open questions (Discord max: 5 inputs)
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
    await interaction.deferReply({ ephemeral: true });
    await createTicketChannel(interaction, panel, []);
  }
}

// ── Modal: user submitted pre-open questions ──────────────────────────────────
async function handleTicketQuestionsModal(interaction) {
  const panelId = interaction.customId.split(':')[1];
  const tickets = readData('tickets.json');
  const panel   = tickets.panels?.[panelId];

  if (!panel)
    return interaction.reply({ content: '❌ Panel not found.', ephemeral: true });

  await interaction.deferReply({ ephemeral: true });

  const answers = panel.questions.map((q, i) => ({
    question: q,
    answer: interaction.fields.getTextInputValue(`tq_${i}`) || '—',
  }));

  await createTicketChannel(interaction, panel, answers);
}

// ── Create the ticket channel ─────────────────────────────────────────────────
async function createTicketChannel(interaction, panel, answers) {
  const guild     = interaction.guild;
  const tickets   = readData('tickets.json');
  const category  = guild.channels.cache.get(panel.categoryId);
  const safeName  = interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 20);
  const channelName = `ticket-${safeName}`;

  const viewRoles = tickets.perms?.viewRoles || [];
  const pingRoles = tickets.perms?.pingRoles || [];

  // Build permission overwrites
  const permOverwrites = [
    { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
    {
      id: interaction.user.id,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
    },
    {
      id: interaction.client.user.id,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ReadMessageHistory],
    },
    // View roles can see all tickets
    ...viewRoles.map(roleId => ({
      id: roleId,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
    })),
  ];

  let ticketChannel;
  try {
    ticketChannel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: category || null,
      permissionOverwrites: permOverwrites,
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

  if (answers.length > 0)
    embed.addFields(answers.map(a => ({ name: a.question, value: a.answer })));

  const closeBtn = new ButtonBuilder()
    .setCustomId('ticket_close_btn')
    .setLabel('🔒 Close Ticket')
    .setStyle(ButtonStyle.Danger);

  // Build content with ping mentions
  const pingContent = [
    `<@${interaction.user.id}>`,
    ...pingRoles.map(r => `<@&${r}>`),
  ].join(' ');

  await ticketChannel.send({
    content: pingContent,
    embeds: [embed],
    components: [new ActionRowBuilder().addComponents(closeBtn)],
    allowedMentions: { users: [interaction.user.id], roles: pingRoles },
  });

  // Save open ticket
  const openTickets = readData('openTickets.json');
  openTickets[ticketChannel.id] = {
    userId:    interaction.user.id,
    panelId:   panel.id,
    panelName: panel.name,
    openedAt:  new Date().toISOString(),
    answers,
  };
  writeData('openTickets.json', openTickets);

  // Ticket-specific log
  if (tickets.logChannelId) {
    const logCh = interaction.client.channels.cache.get(tickets.logChannelId);
    if (logCh) {
      logCh.send({
        embeds: [new EmbedBuilder()
          .setColor('#57F287').setTitle('🎫 Ticket Opened')
          .addFields(
            { name: 'Panel',     value: panel.name,                              inline: true },
            { name: 'Opened by', value: interaction.user.tag,                    inline: true },
            { name: 'Channel',   value: `<#${ticketChannel.id}>`,                inline: true },
            { name: 'Time',      value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
          ).setTimestamp()],
      }).catch(() => {});
    }
  }

  sendLog(interaction.client, {
    action: 'Ticket Opened',
    executor: interaction.user.tag,
    target: panel.name,
    fields: { Channel: `<#${ticketChannel.id}>` },
    color: '#5865F2',
  });

  await interaction.editReply({ content: `✅ Your ticket has been created: <#${ticketChannel.id}>` });
}

// ── Button: "Close Ticket" button in ticket channel ───────────────────────────
async function handleCloseButton(interaction) {
  const openTickets = readData('openTickets.json');
  if (!openTickets[interaction.channelId])
    return interaction.reply({ content: '❌ This ticket is no longer active.', ephemeral: true });

  if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels) &&
      !interaction.member.permissions.has(PermissionFlagsBits.Administrator))
    return interaction.reply({ content: '❌ Only **Staff** can close tickets.', ephemeral: true });

  // Ask for reason via modal
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

// ── Modal: close reason submitted ────────────────────────────────────────────
async function handleCloseModal(interaction) {
  const reason      = interaction.fields.getTextInputValue('close_reason');
  const openTickets = readData('openTickets.json');
  const ticket      = openTickets[interaction.channelId];

  if (!ticket)
    return interaction.reply({ content: '❌ This is not an active ticket channel.', ephemeral: true });

  await interaction.reply({ content: '🔒 Closing ticket in **3 seconds**...' });

  // DM the user
  try {
    const user = await interaction.client.users.fetch(ticket.userId);
    await user.send({
      embeds: [new EmbedBuilder()
        .setColor('#ED4245').setTitle('🔒 Your Ticket Was Closed')
        .addFields(
          { name: 'Panel',     value: ticket.panelName,                          inline: true },
          { name: 'Closed by', value: interaction.user.tag,                      inline: true },
          { name: 'Time',      value: `<t:${Math.floor(Date.now() / 1000)}:F>`,  inline: true },
          { name: 'Reason',    value: reason },
        ).setTimestamp()],
    });
  } catch { /* DMs disabled */ }

  // Ticket log
  const tickets = readData('tickets.json');
  if (tickets.logChannelId) {
    const logCh = interaction.client.channels.cache.get(tickets.logChannelId);
    if (logCh) {
      logCh.send({
        embeds: [new EmbedBuilder()
          .setColor('#ED4245').setTitle('🔒 Ticket Closed')
          .addFields(
            { name: 'Panel',     value: ticket.panelName,                          inline: true },
            { name: 'Closed by', value: interaction.user.tag,                      inline: true },
            { name: 'Opened by', value: `<@${ticket.userId}>`,                     inline: true },
            { name: 'Time',      value: `<t:${Math.floor(Date.now() / 1000)}:F>`,  inline: true },
            { name: 'Reason',    value: reason },
          ).setTimestamp()],
      }).catch(() => {});
    }
  }

  sendLog(interaction.client, {
    action: 'Ticket Closed',
    executor: interaction.user.tag,
    target: `<@${ticket.userId}>`,
    fields: { Panel: ticket.panelName, Reason: reason },
    color: '#ED4245',
  });

  delete openTickets[interaction.channelId];
  writeData('openTickets.json', openTickets);
  setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
}

module.exports = {
  handleTicketOpen,
  handleTicketQuestionsModal,
  handleCloseButton,
  handleCloseModal,
  createTicketChannel,
};
