const {
  EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder,
  ChannelType, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle,
} = require('discord.js');
const { readData, writeData, isStaffMember } = require('./index');
const { saveTranscript, fetchAllMessages } = require('./transcripts');

function getBaseUrl() {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL;
  if (process.env.RAILWAY_PUBLIC_DOMAIN) return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  return null;
}

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

  // Collect staff role IDs (from DB + config fallback)
  const staffConfig = readData('staffConfig.json');
  const config = require('../config.json');
  const staffRoleIds = new Set();
  if (staffConfig?.staffRoleId) staffRoleIds.add(staffConfig.staffRoleId);
  const fallbackId = config.roles?.staffTeam;
  if (fallbackId && !fallbackId.endsWith('_ROLE_ID')) staffRoleIds.add(fallbackId);

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
    // Staff role can see and manage all tickets
    ...[...staffRoleIds].map(roleId => ({
      id: roleId,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
    })),
    // View roles can see all tickets
    ...viewRoles.filter(id => !staffRoleIds.has(id)).map(roleId => ({
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
    .setDescription(`Ticket opened by <@${interaction.user.id}>\n\nA staff member will be with you shortly.\n\n⚠️ If you ping anyone, your ticket will get closed and you won't get paid.`)
    .setThumbnail(interaction.user.displayAvatarURL())
    .setTimestamp();

  if (answers.length > 0)
    embed.addFields(answers.map(a => ({ name: a.question, value: a.answer })));

  const closeBtn = new ButtonBuilder()
    .setCustomId('ticket_close_btn')
    .setLabel('🔒 Close Ticket')
    .setStyle(ButtonStyle.Danger);

  const requestCloseBtn = new ButtonBuilder()
    .setCustomId('ticket_request_close_btn')
    .setLabel('📩 Request Close')
    .setStyle(ButtonStyle.Secondary);

  // Build content with ping mentions
  const pingContent = [
    `<@${interaction.user.id}>`,
    ...pingRoles.map(r => `<@&${r}>`),
  ].join(' ');

  await ticketChannel.send({
    content: pingContent,
    embeds: [embed],
    components: [new ActionRowBuilder().addComponents(closeBtn, requestCloseBtn)],
    allowedMentions: { users: [interaction.user.id], roles: pingRoles },
  });

  // Assign ticket ID
  tickets.ticketCounter = (tickets.ticketCounter || 0) + 1;
  const ticketId = tickets.ticketCounter;
  writeData('tickets.json', tickets);

  // Save open ticket
  const openTickets = readData('openTickets.json');
  openTickets[ticketChannel.id] = {
    ticketId,
    userId:    interaction.user.id,
    panelId:   panel.id,
    panelName: panel.name,
    openedAt:  Date.now(),
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
            { name: '🎟️ Ticket ID',  value: `#${ticketId}`,                          inline: true },
            { name: 'Panel',          value: panel.name,                              inline: true },
            { name: 'Opened by',      value: `<@${interaction.user.id}>`,             inline: true },
            { name: 'Channel',        value: `<#${ticketChannel.id}>`,                inline: true },
            { name: 'Time',           value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
          ).setTimestamp()],
      }).catch(() => {});
    }
  }

  await interaction.editReply({ content: `✅ Your ticket has been created: <#${ticketChannel.id}>` });
}

// ── Button: "Close Ticket" button in ticket channel ───────────────────────────
async function handleCloseButton(interaction) {
  const openTickets = readData('openTickets.json');
  if (!openTickets[interaction.channelId])
    return interaction.reply({ content: '❌ This ticket is no longer active.', ephemeral: true });

  if (!isStaffMember(interaction.member))
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

// ── Shared close logic (used by modal AND /ticket close command) ──────────────
async function closeTicket(channel, reason, closedBy, client) {
  const openTickets = readData('openTickets.json');
  const ticket      = openTickets[channel.id];
  if (!ticket) return false;

  // Fetch all messages for transcript BEFORE deleting channel
  const messages  = await fetchAllMessages(channel);
  const ticketId  = ticket.ticketId || 0;
  const closedAt  = Date.now();
  const expiresAt = closedAt + 3 * 24 * 60 * 60 * 1000; // 3 days

  // Save transcript
  const openedByUser = await client.users.fetch(ticket.userId).catch(() => ({ tag: 'Unknown', id: ticket.userId }));
  await saveTranscript(ticketId, {
    ticketId,
    panelName: ticket.panelName,
    openedBy:  { id: ticket.userId, tag: openedByUser.tag },
    closedBy:  { id: closedBy.id, tag: closedBy.tag },
    openedAt:  ticket.openedAt,
    closedAt,
    reason,
    answers:   ticket.answers || [],
    messages,
    saved:     false,
    expiresAt,
  });

  // DM the ticket opener
  try {
    await openedByUser.send({
      embeds: [new EmbedBuilder()
        .setColor('#ED4245').setTitle('🔒 Your Ticket Was Closed')
        .addFields(
          { name: 'Panel',     value: ticket.panelName,                       inline: true },
          { name: 'Closed by', value: closedBy.tag,                           inline: true },
          { name: 'Time',      value: `<t:${Math.floor(closedAt / 1000)}:F>`, inline: true },
          { name: 'Reason',    value: reason },
        ).setTimestamp()],
    });
  } catch { /* DMs disabled */ }

  // Ticket log with transcript buttons
  const tickets = readData('tickets.json');
  if (tickets.logChannelId) {
    const logCh = client.channels.cache.get(tickets.logChannelId);
    if (logCh) {
      const embed = new EmbedBuilder()
        .setColor('#ED4245').setTitle('🔒 Ticket Closed')
        .addFields(
          { name: '🎟️ Ticket ID', value: `#${ticketId}`,                              inline: true },
          { name: 'Panel',         value: ticket.panelName,                             inline: true },
          { name: 'Opened by',     value: `<@${ticket.userId}>`,                        inline: true },
          { name: 'Closed by',     value: `<@${closedBy.id}>`,                          inline: true },
          { name: 'Open Time',     value: `<t:${Math.floor(ticket.openedAt / 1000)}:F>`, inline: true },
          { name: 'Closed Time',   value: `<t:${Math.floor(closedAt / 1000)}:F>`,       inline: true },
          { name: 'Reason',        value: reason },
        ).setFooter({ text: 'Transcript auto-deletes in 3 days' }).setTimestamp();

      const baseUrl = getBaseUrl();
      const btns = [];
      if (baseUrl) {
        btns.push(new ButtonBuilder()
          .setLabel('📄 View Transcript')
          .setStyle(ButtonStyle.Link)
          .setURL(`${baseUrl}/transcript/${ticketId}`));
      }
      btns.push(new ButtonBuilder()
        .setCustomId(`transcript_save:${ticketId}`)
        .setLabel('💾 Save Transcript')
        .setStyle(ButtonStyle.Secondary));

      logCh.send({
        embeds: [embed],
        components: [new ActionRowBuilder().addComponents(btns)],
      }).catch(() => {});
    }
  }

  delete openTickets[channel.id];
  writeData('openTickets.json', openTickets);
  setTimeout(() => channel.delete().catch(() => {}), 5000);
  return true;
}

// ── Modal: close reason submitted ────────────────────────────────────────────
async function handleCloseModal(interaction) {
  const reason      = interaction.fields.getTextInputValue('close_reason');
  const openTickets = readData('openTickets.json');
  if (!openTickets[interaction.channelId])
    return interaction.reply({ content: '❌ This is not an active ticket channel.', ephemeral: true });

  await interaction.reply({ content: '🔒 Closing ticket in **3 seconds**...' });
  await closeTicket(interaction.channel, reason, interaction.user, interaction.client);
}

// ── Button: "Request Close" button in ticket channel (any member) ─────────────
async function handleRequestCloseButton(interaction) {
  const openTickets = readData('openTickets.json');
  if (!openTickets[interaction.channelId])
    return interaction.reply({ content: '❌ This is not an active ticket channel.', ephemeral: true });

  await interaction.reply({ content: '✅ Close request sent.', ephemeral: true });
  await interaction.channel.send({
    embeds: [new EmbedBuilder()
      .setColor('#FEE75C').setTitle('📩 Close Request')
      .setDescription(`<@${interaction.user.id}> has requested this ticket to be closed.`)
      .setTimestamp()],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ticket_close_btn').setLabel('🔒 Close Ticket').setStyle(ButtonStyle.Danger)
    )],
  });
}

module.exports = {
  handleTicketOpen,
  handleTicketQuestionsModal,
  handleCloseButton,
  handleCloseModal,
  handleRequestCloseButton,
  createTicketChannel,
  closeTicket,
};
