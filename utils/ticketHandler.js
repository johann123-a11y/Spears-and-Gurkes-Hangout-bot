const {
  EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, AttachmentBuilder,
  ChannelType, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle,
} = require('discord.js');
const { readData, writeData, isStaffMember, trackActivity } = require('./index');
const { fetchAllMessages } = require('./transcripts');

function buildTxt({ ticketId, panelName, openedBy, closedBy, openedAt, closedAt, reason, answers }, messages) {
  const line = '═'.repeat(52);
  const fmt  = ts => new Date(ts).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  let txt = `${line}\nTICKET #${ticketId} — ${panelName}\n${line}\n`;
  txt += `Opened by : ${openedBy?.tag || 'Unknown'}\n`;
  txt += `Closed by : ${closedBy?.tag || 'Unknown'}\n`;
  txt += `Opened at : ${fmt(openedAt)}\n`;
  txt += `Closed at : ${fmt(closedAt)}\n`;
  txt += `Reason    : ${reason || '—'}\n`;
  txt += `Messages  : ${messages.length}\n`;
  if (answers?.length > 0) {
    txt += `${line}\n`;
    for (const a of answers) txt += `Q: ${a.question}\nA: ${a.answer}\n`;
  }
  txt += `${line}\n\n`;
  for (const m of messages) {
    const time   = fmt(m.timestamp);
    const author = m.bot ? `${m.author} [BOT]` : m.author;
    if (m.content) txt += `[${time}] ${author}: ${m.content}\n`;
    for (const att of (m.attachments || []))
      txt += `[${time}] ${author}: [Attachment: ${att.name} — ${att.url}]\n`;
  }
  return txt;
}

// Button: user clicks a ticket panel button 
async function handleTicketOpen(interaction) {
  const panelId = interaction.customId.split(':')[1];
  const tickets = readData('tickets.json');
  const panel   = tickets.panels?.[panelId];

  if (!panel)
    return interaction.reply({ content: 'This ticket panel no longer exists.', ephemeral: true });

  // Blacklist check
  const blacklist = readData('blacklist.json');
  const bl = blacklist[interaction.user.id];
  if (bl?.ticket || bl?.all)
    return interaction.reply({ content: 'You are not allowed to open tickets.', ephemeral: true });

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

// Modal: user submitted pre-open questions 
async function handleTicketQuestionsModal(interaction) {
  const panelId = interaction.customId.split(':')[1];
  const tickets = readData('tickets.json');
  const panel   = tickets.panels?.[panelId];

  if (!panel)
    return interaction.reply({ content: 'Panel not found.', ephemeral: true });

  await interaction.deferReply({ ephemeral: true });

  const answers = panel.questions.map((q, i) => ({
    question: q,
    answer: interaction.fields.getTextInputValue(`tq_${i}`) || '—',
  }));

  await createTicketChannel(interaction, panel, answers);
}

// Create the ticket channel 
async function createTicketChannel(interaction, panel, answers) {
  const guild     = interaction.guild;
  const tickets   = readData('tickets.json');
  const category  = guild.channels.cache.get(panel.categoryId);
  const safeName  = interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 20);
  const panelSlug = (panel.name || 'ticket').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 30);

  // For spawner panels: only the answers, no panel slug, no username
  const isSpawnerPanel = (panel.name || '').toLowerCase().includes('spawner');
  let channelName;
  if (isSpawnerPanel && answers?.length) {
    const answerSlugs = answers
      .map(a => a.answer.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 20))
      .filter(s => s && s !== '');
    channelName = answerSlugs.join('-').substring(0, 90);
  } else {
    channelName = `${panelSlug}-${safeName}`;
  }

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
    return interaction.editReply({ content: `Could not create ticket channel: ${err.message}` });
  }

  try {
    await interaction.editReply({ content: `Your ticket has been created: <#${ticketChannel.id}>` });

    // Build ticket embed
    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle(`🎫 ${panel.name}`)
      .setDescription(`Ticket opened by <@${interaction.user.id}>\n\nA staff member will be with you shortly.\n\nIf you ping anyone, your ticket will get closed and you won't get paid.`)
      .setThumbnail(interaction.user.displayAvatarURL())
      .setTimestamp();

    if (answers.length > 0)
      embed.addFields(answers.map(a => ({ name: a.question, value: a.answer })));

    const closeBtn = new ButtonBuilder()
      .setCustomId('ticket_close_btn')
      .setLabel('🔒 Close Ticket')
      .setStyle(ButtonStyle.Danger);

    const renameBtn = new ButtonBuilder()
      .setCustomId('ticket_rename_btn')
      .setLabel('✏️ Rename')
      .setStyle(ButtonStyle.Secondary);

    const requestCloseBtn = new ButtonBuilder()
      .setCustomId('ticket_request_close_btn')
      .setLabel('📩 Request Close')
      .setStyle(ButtonStyle.Secondary);

    const pingContent = [
      `<@${interaction.user.id}>`,
      ...pingRoles.map(r => `<@&${r}>`),
    ].join(' ');

    await ticketChannel.send({
      content: pingContent,
      embeds: [embed],
      components: [new ActionRowBuilder().addComponents(closeBtn, renameBtn, requestCloseBtn)],
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
            .setColor('#57F287').setTitle('📂 Ticket Opened')
            .addFields(
              { name: '🔢 Ticket ID',  value: `#${ticketId}`,                          inline: true },
              { name: '📋 Panel',      value: panel.name,                              inline: true },
              { name: '👤 Opened by',  value: `<@${interaction.user.id}>`,             inline: true },
              { name: '💬 Channel',    value: `<#${ticketChannel.id}>`,                inline: true },
              { name: '🕐 Time',       value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
            ).setTimestamp()],
        }).catch(() => {});
      }
    }
  } catch (err) {
    console.error('[TICKET_CREATE]', err);
    await ticketChannel.delete().catch(() => {});
  }
}

// Button: "Close Ticket" button in ticket channel 
async function handleCloseButton(interaction) {
  const openTickets = readData('openTickets.json');
  if (!openTickets[interaction.channelId])
    return interaction.reply({ content: 'This ticket is no longer active.', ephemeral: true });

  if (!isStaffMember(interaction.member))
    return interaction.reply({ content: 'Only **Staff** can close tickets.', ephemeral: true });

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

// Shared close logic (used by modal AND /ticket close command) 
async function closeTicket(channel, reason, closedBy, client) {
  const openTickets = readData('openTickets.json');
  const ticket      = openTickets[channel.id];
  if (!ticket) return false;

  // Fetch all messages BEFORE deleting channel
  const messages     = await fetchAllMessages(channel);
  const ticketId     = ticket.ticketId || 0;
  const closedAt     = Date.now();
  const openedByUser = await client.users.fetch(ticket.userId).catch(() => ({ tag: 'Unknown', id: ticket.userId }));

  // DM the ticket opener
  try {
    await openedByUser.send({
      embeds: [new EmbedBuilder()
        .setColor('#ED4245').setTitle('🔒 Your Ticket Was Closed')
        .addFields(
          { name: '📋 Panel',     value: ticket.panelName,                       inline: true },
          { name: '🛡️ Closed by', value: closedBy.tag,                           inline: true },
          { name: '🕐 Time',      value: `<t:${Math.floor(closedAt / 1000)}:F>`, inline: true },
          { name: '📝 Reason',    value: reason },
        ).setTimestamp()],
    });
  } catch { /* DMs disabled */ }

  // Ticket log — send embed + txt transcript file
  const tickets = readData('tickets.json');
  if (tickets.logChannelId) {
    const logCh = client.channels.cache.get(tickets.logChannelId);
    if (logCh) {
      const embed = new EmbedBuilder()
        .setColor('#ED4245').setTitle('🔒 Ticket Closed')
        .addFields(
          { name: '🔢 Ticket ID',   value: `#${ticketId}`,                               inline: true },
          { name: '📋 Panel',       value: ticket.panelName,                              inline: true },
          { name: '👤 Opened by',   value: `<@${ticket.userId}>`,                         inline: true },
          { name: '🛡️ Closed by',   value: `<@${closedBy.id}>`,                           inline: true },
          { name: '🕐 Open Time',   value: `<t:${Math.floor(ticket.openedAt / 1000)}:F>`, inline: true },
          { name: '🕐 Closed Time', value: `<t:${Math.floor(closedAt / 1000)}:F>`,        inline: true },
          { name: '📝 Reason',      value: reason },
        ).setTimestamp();

      const txt  = buildTxt(
        { ticketId, panelName: ticket.panelName, openedBy: openedByUser, closedBy, openedAt: ticket.openedAt, closedAt, reason, answers: ticket.answers || [] },
        messages,
      );
      const file = new AttachmentBuilder(Buffer.from(txt, 'utf-8'), { name: `ticket-${ticketId}.txt` });

      logCh.send({ embeds: [embed], files: [file] }).catch(() => {});
    }
  }

  delete openTickets[channel.id];
  writeData('openTickets.json', openTickets);
  trackActivity(closedBy.id, closedBy.tag, 'ticket_closed');
  setTimeout(() => channel.delete().catch(() => {}), 5000);
  return true;
}

// Modal: close reason submitted 
async function handleCloseModal(interaction) {
  const reason      = interaction.fields.getTextInputValue('close_reason');
  const openTickets = readData('openTickets.json');
  if (!openTickets[interaction.channelId])
    return interaction.reply({ content: 'This is not an active ticket channel.', ephemeral: true });

  await interaction.reply({ content: 'Closing ticket in **3 seconds**...' });
  await closeTicket(interaction.channel, reason, interaction.user, interaction.client);
}

// Button: "Request Close" button in ticket channel (any member) 
async function handleRequestCloseButton(interaction) {
  const openTickets = readData('openTickets.json');
  if (!openTickets[interaction.channelId])
    return interaction.reply({ content: 'This is not an active ticket channel.', ephemeral: true });

  await interaction.reply({ content: 'Close request sent.', ephemeral: true });
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
