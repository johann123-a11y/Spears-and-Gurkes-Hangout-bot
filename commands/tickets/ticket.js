const {
  SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle,
  ActionRowBuilder, ChannelType, PermissionFlagsBits,
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
  ModalBuilder, TextInputBuilder, TextInputStyle,
  ChannelSelectMenuBuilder,
} = require('discord.js');
const { readData, writeData } = require('../../utils');
const { sendLog } = require('../../utils/logger');

function getPanelId(name) {
  return name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}

function buildDescEmbed(desc) {
  const embed = new EmbedBuilder().setColor('#5865F2').setTimestamp();
  embed.setTitle(desc?.title || 'Create Ticket');
  let content = '';
  if (desc?.subtitle) content += `**${desc.subtitle}**\n\n`;
  if (desc?.text)     content += desc.text;
  if (content)        embed.setDescription(content);
  if (desc?.footer)   embed.setFooter({ text: desc.footer });
  return embed;
}

function isStaff(member) {
  if (member.permissions.has(PermissionFlagsBits.ManageChannels)) return true;
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  const staffConfig = readData('staffConfig.json');
  if (staffConfig?.staffRoleId && member.roles.cache.has(staffConfig.staffRoleId)) return true;
  return false;
}

const STYLES = {
  blue: ButtonStyle.Primary,
  grey: ButtonStyle.Secondary,
  green: ButtonStyle.Success,
  red: ButtonStyle.Danger,
};

module.exports = {
  name: 'ticket',
  description: 'Ticket system.',
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Ticket system')

    // ── /ticket perms ─────────────────────────────────────────────────────────
    .addSubcommandGroup(group =>
      group.setName('perms')
        .setDescription('Manage which roles get pinged/can view tickets')
        .addSubcommand(sub =>
          sub.setName('ping')
            .setDescription('Add a role that gets pinged when a ticket opens')
            .addRoleOption(o => o.setName('role').setDescription('Role to ping').setRequired(true))
        )
        .addSubcommand(sub =>
          sub.setName('view')
            .setDescription('Add a role that can see all ticket channels')
            .addRoleOption(o => o.setName('role').setDescription('Role to grant view access').setRequired(true))
        )
        .addSubcommand(sub =>
          sub.setName('info').setDescription('Show current ping & view role settings')
        )
        .addSubcommand(sub =>
          sub.setName('clear').setDescription('Clear all ticket ping and view role settings')
        )
    )

    // ── /ticket logs ──────────────────────────────────────────────────────────
    .addSubcommandGroup(group =>
      group.setName('logs')
        .setDescription('Manage the ticket log channel')
        .addSubcommand(sub =>
          sub.setName('set')
            .setDescription('Set the channel where all ticket events are logged')
            .addChannelOption(o => o.setName('channel').setDescription('Log channel').setRequired(true))
        )
        .addSubcommand(sub =>
          sub.setName('info').setDescription('Show the current ticket log channel')
        )
        .addSubcommand(sub =>
          sub.setName('remove').setDescription('Remove the ticket log channel')
        )
    )

    // ── /ticket setup ─────────────────────────────────────────────────────────
    .addSubcommand(sub =>
      sub.setName('setup')
        .setDescription('Create a new ticket panel (opens a form) [Admin]')
    )

    // ── /ticket description ───────────────────────────────────────────────────
    .addSubcommand(sub =>
      sub.setName('description')
        .setDescription('Set title, text & rules shown above the buttons [Admin]')
    )

    // ── /ticket group ─────────────────────────────────────────────────────────
    .addSubcommand(sub =>
      sub.setName('group')
        .setDescription('Send combined panels as an embed in this channel [Admin]')
    )

    // ── /ticket send ──────────────────────────────────────────────────────────
    .addSubcommand(sub =>
      sub.setName('send')
        .setDescription('Send a single panel to this channel [Admin]')
        .addStringOption(o => o.setName('panel').setDescription('Panel name').setRequired(true))
    )

    // ── /ticket info ──────────────────────────────────────────────────────────
    .addSubcommand(sub =>
      sub.setName('info')
        .setDescription('Overview of all panels — edit/delete [Admin] or view current ticket [Staff]')
    )

    // ── /ticket add ───────────────────────────────────────────────────────────
    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('Add a user to the current ticket [Staff]')
        .addUserOption(o => o.setName('user').setDescription('User to add').setRequired(true))
    )

    // ── /ticket remove ────────────────────────────────────────────────────────
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Remove a user from the current ticket [Staff]')
        .addUserOption(o => o.setName('user').setDescription('User to remove').setRequired(true))
    )

    // ── /ticket rename ────────────────────────────────────────────────────────
    .addSubcommand(sub =>
      sub.setName('rename')
        .setDescription('Rename the current ticket channel [Staff]')
        .addStringOption(o => o.setName('name').setDescription('New channel name').setRequired(true))
    )

    // ── /ticket move ──────────────────────────────────────────────────────────
    .addSubcommand(sub =>
      sub.setName('move')
        .setDescription('Move this ticket to another category [Staff]')
        .addChannelOption(o => o.setName('category').setDescription('Target category').setRequired(true))
    )

    // ── /ticket close ─────────────────────────────────────────────────────────
    .addSubcommand(sub =>
      sub.setName('close')
        .setDescription('Close this ticket in 5s [Staff]')
        .addStringOption(o => o.setName('reason').setDescription('Reason for closing').setRequired(true))
    )

    // ── /ticket requestclose ──────────────────────────────────────────────────
    .addSubcommand(sub =>
      sub.setName('requestclose')
        .setDescription('Ask staff to close the ticket')
        .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(false))
    ),

  async execute(message) {
    message.reply('❌ Please use `/ticket` slash commands for the ticket system.');
  },

  async executeSlash(interaction) {
    const group = interaction.options.getSubcommandGroup(false);
    const sub   = interaction.options.getSubcommand();

    // ── perms group ───────────────────────────────────────────────────────────
    if (group === 'perms') {
      if (!interaction.member.permissions.has('Administrator'))
        return interaction.reply({ content: '❌ Only **Administrators** can manage permissions.', ephemeral: true });
      if (sub === 'ping')  return handlePermsPing(interaction);
      if (sub === 'view')  return handlePermsView(interaction);
      if (sub === 'info')  return handlePermsInfo(interaction);
      if (sub === 'clear') return handlePermsClear(interaction);
    }

    // ── logs group ────────────────────────────────────────────────────────────
    if (group === 'logs') {
      if (!interaction.member.permissions.has('Administrator'))
        return interaction.reply({ content: '❌ Only **Administrators** can manage logs.', ephemeral: true });
      if (sub === 'set')    return handleLogsSet(interaction);
      if (sub === 'info')   return handleLogsInfo(interaction);
      if (sub === 'remove') return handleLogsRemove(interaction);
    }

    // ── admin subcommands ─────────────────────────────────────────────────────
    const adminOnly = ['setup', 'description', 'group', 'send'];
    if (adminOnly.includes(sub) && !interaction.member.permissions.has('Administrator'))
      return interaction.reply({ content: '❌ Only **Administrators** can use this command.', ephemeral: true });

    // ── staff subcommands ─────────────────────────────────────────────────────
    const staffOnly = ['add', 'remove', 'rename', 'move', 'close'];
    if (staffOnly.includes(sub) && !isStaff(interaction.member))
      return interaction.reply({ content: '❌ Only **Staff** can use this command.', ephemeral: true });

    if (sub === 'setup')          return handleSetup(interaction);
    if (sub === 'description')    return handleDescription(interaction);
    if (sub === 'group')          return handleGroup(interaction);
    if (sub === 'send')           return handleSend(interaction);
    if (sub === 'info')           return handleInfo(interaction);
    if (sub === 'add')            return handleAdd(interaction);
    if (sub === 'remove')         return handleRemove(interaction);
    if (sub === 'rename')         return handleRename(interaction);
    if (sub === 'move')           return handleMove(interaction);
    if (sub === 'close')          return handleClose(interaction);
    if (sub === 'requestclose')   return handleRequestClose(interaction);
  },
};

// ── /ticket setup ─────────────────────────────────────────────────────────────
async function handleSetup(interaction) {
  const modal = new ModalBuilder()
    .setCustomId('ticket_setup_modal')
    .setTitle('🎫 Ticket Panel Setup')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('setup_panelid')
          .setLabel('Panel ID (internal, e.g. support)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('support')
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('setup_label')
          .setLabel('Button Text (e.g. 🔧 Support)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('🔧 Support')
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('setup_color')
          .setLabel('Button Color: Blue / Green / Red / Gray')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Blue')
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('setup_categoryid')
          .setLabel('Discord Category ID (optional)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Right-click category → Copy ID')
          .setRequired(false)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('setup_questions')
          .setLabel('Questions before ticket (optional)')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('What is your IGN?\nWhat is your issue?')
          .setRequired(false)
      ),
    );

  await interaction.showModal(modal);
}

// ── /ticket description ───────────────────────────────────────────────────────
async function handleDescription(interaction) {
  const tickets = readData('tickets.json');
  const current = tickets.description || {};

  const modal = new ModalBuilder()
    .setCustomId('ticket_description_modal')
    .setTitle('Set Ticket Panel Description')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('desc_title')
          .setLabel('Title (e.g. Create Ticket)')
          .setStyle(TextInputStyle.Short)
          .setValue(current.title || 'Create Ticket')
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('desc_subtitle')
          .setLabel('Subtitle — shown bold (e.g. Ticket Rules)')
          .setStyle(TextInputStyle.Short)
          .setValue(current.subtitle || '')
          .setPlaceholder('Ticket Rules')
          .setRequired(false)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('desc_text')
          .setLabel('Description — multiple lines & bullet points')
          .setStyle(TextInputStyle.Paragraph)
          .setValue(current.text || '')
          .setPlaceholder('• Respond within 24h\n• Trolling = 1 week timeout\n• No spam pinging')
          .setRequired(false)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('desc_footer')
          .setLabel('Footer text (optional)')
          .setStyle(TextInputStyle.Short)
          .setValue(current.footer || '')
          .setRequired(false)
      ),
    );

  await interaction.showModal(modal);
}

// ── /ticket group ─────────────────────────────────────────────────────────────
async function handleGroup(interaction) {
  const tickets = readData('tickets.json');
  const panels  = Object.values(tickets.panels || {});
  if (panels.length === 0)
    return interaction.reply({ content: '❌ No panels configured. Use `/ticket setup` first.', ephemeral: true });

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('ticket_group_select')
    .setPlaceholder('Select panels to combine...')
    .setMinValues(1)
    .setMaxValues(panels.length)
    .addOptions(panels.map(p =>
      new StringSelectMenuOptionBuilder()
        .setLabel(p.name)
        .setValue(p.id)
        .setDescription(`${p.buttonLabel} — ${p.buttonStyle}`)
    ));

  return interaction.reply({
    content: '**Select which panels to combine into one message:**\nThe grouped panel will be sent to this channel.',
    components: [new ActionRowBuilder().addComponents(selectMenu)],
    ephemeral: true,
  });
}

// ── /ticket send ──────────────────────────────────────────────────────────────
async function handleSend(interaction) {
  const panelName = interaction.options.getString('panel');
  const tickets   = readData('tickets.json');
  const panel     = tickets.panels?.[getPanelId(panelName)];
  if (!panel) return interaction.reply({ content: `❌ Panel \`${panelName}\` not found.`, ephemeral: true });

  const button = new ButtonBuilder()
    .setCustomId(`ticket_open:${panel.id}`)
    .setLabel(panel.buttonLabel)
    .setStyle(STYLES[panel.buttonStyle] || ButtonStyle.Primary);

  await interaction.reply({ content: '✅ Panel sent!', ephemeral: true });
  await interaction.channel.send({ embeds: [buildDescEmbed(tickets.description)], components: [new ActionRowBuilder().addComponents(button)] });
}

// ── /ticket info ──────────────────────────────────────────────────────────────
async function handleInfo(interaction) {
  const tickets     = readData('tickets.json');
  const openTickets = readData('openTickets.json');
  const panels      = Object.values(tickets.panels || {});

  // If inside a ticket channel and not admin → show ticket details
  const ticket = openTickets[interaction.channelId];
  if (ticket && !interaction.member.permissions.has('Administrator')) {
    const embed = new EmbedBuilder()
      .setColor('#5865F2').setTitle('🎫 Ticket Info')
      .addFields(
        { name: 'Panel',     value: ticket.panelName,                                        inline: true },
        { name: 'Opened by', value: `<@${ticket.userId}>`,                                   inline: true },
        { name: 'Opened at', value: `<t:${Math.floor(new Date(ticket.openedAt) / 1000)}:F>`, inline: true },
      );
    if (ticket.answers?.length > 0)
      embed.addFields(ticket.answers.map(a => ({ name: a.question, value: a.answer })));
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  // Admin → full overview of everything
  return sendTicketOverview(interaction, 'reply');
}

// ── Shared: build & send the full ticket overview ─────────────────────────────
async function sendTicketOverview(interaction, method = 'reply') {
  const tickets = readData('tickets.json');
  const panels  = Object.values(tickets.panels || {});
  const perms   = tickets.perms || { pingRoles: [], viewRoles: [] };
  const desc    = tickets.description || {};

  const panelsValue = panels.length > 0
    ? panels.map(p =>
        `• **${p.name}** — \`${p.buttonLabel}\` (${p.buttonStyle})`
        + (p.categoryId ? ` → <#${p.categoryId}>` : '')
        + (p.questions.length > 0 ? ` • ${p.questions.length} question(s)` : '')
      ).join('\n')
    : '*No panels yet — use `/ticket setup`*';

  const descValue = [
    `**Title:** ${desc.title || 'Create Ticket'}`,
    desc.subtitle ? `**Subtitle:** ${desc.subtitle}` : null,
    desc.text     ? `**Text:** ${desc.text.substring(0, 80)}${desc.text.length > 80 ? '…' : ''}` : null,
    desc.footer   ? `**Footer:** ${desc.footer}` : null,
  ].filter(Boolean).join('\n') || '*Not configured*';

  const embed = new EmbedBuilder()
    .setColor('#5865F2')
    .setTitle('🎫 Ticket System Overview')
    .addFields(
      { name: `🎫 Panels (${panels.length})`,   value: panelsValue },
      { name: '📝 Description',                  value: descValue },
      { name: '🔔 Ping Roles',                   value: perms.pingRoles.length > 0 ? perms.pingRoles.map(id => `<@&${id}>`).join(', ') : 'None', inline: true },
      { name: '👁️ View Roles',                   value: perms.viewRoles.length > 0 ? perms.viewRoles.map(id => `<@&${id}>`).join(', ') : 'None', inline: true },
      { name: '📋 Log Channel',                  value: tickets.logChannelId ? `<#${tickets.logChannelId}>` : 'Not set', inline: true },
    )
    .setFooter({ text: 'Select a panel below • Use buttons to manage settings' })
    .setTimestamp();

  const components = [];

  if (panels.length > 0) {
    components.push(new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('ticket_info_panel_picker')
        .setPlaceholder('🎫 Select a panel to edit or delete...')
        .addOptions(panels.map(p =>
          new StringSelectMenuOptionBuilder()
            .setLabel(p.name)
            .setValue(p.id)
            .setDescription(`${p.buttonLabel} — ${p.buttonStyle}`)
        ))
    ));
  }

  components.push(new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket_info_nav_desc').setLabel('📝 Description').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('ticket_info_nav_perms').setLabel('🔐 Permissions').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('ticket_info_nav_logs').setLabel('📋 Log Channel').setStyle(ButtonStyle.Secondary),
  ));

  const payload = { embeds: [embed], components, ephemeral: true };
  if (method === 'update') return interaction.update(payload);
  return interaction.reply(payload);
}

// ── /ticket add ───────────────────────────────────────────────────────────────
async function handleAdd(interaction) {
  if (!readData('openTickets.json')[interaction.channelId])
    return interaction.reply({ content: '❌ This is not a ticket channel.', ephemeral: true });

  const user = interaction.options.getUser('user');
  try {
    await interaction.channel.permissionOverwrites.edit(user.id, {
      [PermissionFlagsBits.ViewChannel]:        true,
      [PermissionFlagsBits.SendMessages]:       true,
      [PermissionFlagsBits.ReadMessageHistory]: true,
    });
    interaction.reply({ content: `✅ **${user.tag}** has been added to this ticket.` });
  } catch (err) {
    interaction.reply({ content: `❌ Failed: ${err.message}`, ephemeral: true });
  }
}

// ── /ticket remove ────────────────────────────────────────────────────────────
async function handleRemove(interaction) {
  if (!readData('openTickets.json')[interaction.channelId])
    return interaction.reply({ content: '❌ This is not a ticket channel.', ephemeral: true });

  const user = interaction.options.getUser('user');
  try {
    await interaction.channel.permissionOverwrites.delete(user.id);
    interaction.reply({ content: `✅ **${user.tag}** has been removed from this ticket.` });
  } catch (err) {
    interaction.reply({ content: `❌ Failed: ${err.message}`, ephemeral: true });
  }
}

// ── /ticket rename ────────────────────────────────────────────────────────────
async function handleRename(interaction) {
  if (!readData('openTickets.json')[interaction.channelId])
    return interaction.reply({ content: '❌ This is not a ticket channel.', ephemeral: true });

  const newName = interaction.options.getString('name').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  try {
    await interaction.channel.setName(newName);
    interaction.reply({ content: `✅ Ticket renamed to **${newName}**.` });
  } catch (err) {
    interaction.reply({ content: `❌ Failed: ${err.message}`, ephemeral: true });
  }
}

// ── /ticket move ──────────────────────────────────────────────────────────────
async function handleMove(interaction) {
  if (!readData('openTickets.json')[interaction.channelId])
    return interaction.reply({ content: '❌ This is not a ticket channel.', ephemeral: true });

  const category = interaction.options.getChannel('category');
  if (category.type !== ChannelType.GuildCategory)
    return interaction.reply({ content: '❌ Please select a **Category**.', ephemeral: true });

  try {
    await interaction.channel.setParent(category.id, { lockPermissions: false });
    interaction.reply({ content: `✅ Ticket moved to **${category.name}**.` });
  } catch (err) {
    interaction.reply({ content: `❌ Failed: ${err.message}`, ephemeral: true });
  }
}

// ── /ticket close ─────────────────────────────────────────────────────────────
async function handleClose(interaction, forcedReason, forcedBy) {
  const reason = forcedReason || interaction.options?.getString('reason') || 'No reason provided.';
  const by     = forcedBy || interaction.user;

  const openTickets = readData('openTickets.json');
  const ticket      = openTickets[interaction.channelId];
  if (!ticket)
    return interaction.reply({ content: '❌ This is not an active ticket channel.', ephemeral: true });

  await interaction.reply({ content: '🔒 Closing ticket in **5 seconds**...' });

  try {
    const user = await interaction.client.users.fetch(ticket.userId);
    await user.send({
      embeds: [new EmbedBuilder()
        .setColor('#ED4245').setTitle('🔒 Your Ticket Was Closed')
        .addFields(
          { name: 'Panel',     value: ticket.panelName,                          inline: true },
          { name: 'Closed by', value: by.tag,                                    inline: true },
          { name: 'Time',      value: `<t:${Math.floor(Date.now() / 1000)}:F>`,  inline: true },
          { name: 'Reason',    value: reason },
        ).setTimestamp()],
    });
  } catch { /* DMs disabled */ }

  const tickets = readData('tickets.json');
  if (tickets.logChannelId) {
    const logCh = interaction.client.channels.cache.get(tickets.logChannelId);
    if (logCh) {
      logCh.send({
        embeds: [new EmbedBuilder()
          .setColor('#ED4245').setTitle('🔒 Ticket Closed')
          .addFields(
            { name: 'Panel',     value: ticket.panelName,                          inline: true },
            { name: 'Closed by', value: by.tag,                                    inline: true },
            { name: 'Opened by', value: `<@${ticket.userId}>`,                     inline: true },
            { name: 'Time',      value: `<t:${Math.floor(Date.now() / 1000)}:F>`,  inline: true },
            { name: 'Reason',    value: reason },
          ).setTimestamp()],
      }).catch(() => {});
    }
  }

  sendLog(interaction.client, {
    action: 'Ticket Closed', executor: by.tag,
    target: `<@${ticket.userId}>`,
    fields: { Panel: ticket.panelName, Reason: reason },
    color: '#ED4245',
  });

  delete openTickets[interaction.channelId];
  writeData('openTickets.json', openTickets);
  setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
}

// ── /ticket requestclose ──────────────────────────────────────────────────────
async function handleRequestClose(interaction) {
  if (!readData('openTickets.json')[interaction.channelId])
    return interaction.reply({ content: '❌ This is not an active ticket channel.', ephemeral: true });

  const reason = interaction.options.getString('reason') || 'No reason provided.';

  await interaction.reply({ content: '✅ Close request sent.', ephemeral: true });
  await interaction.channel.send({
    embeds: [new EmbedBuilder()
      .setColor('#FEE75C').setTitle('📩 Close Request')
      .setDescription(`<@${interaction.user.id}> has requested this ticket to be closed.`)
      .addFields({ name: 'Reason', value: reason })
      .setTimestamp()],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ticket_close_btn').setLabel('🔒 Close Ticket').setStyle(ButtonStyle.Danger)
    )],
  });
}

// ── /ticket logs ──────────────────────────────────────────────────────────────
async function handleLogsSet(interaction) {
  const channel = interaction.options.getChannel('channel');
  const tickets = readData('tickets.json');
  tickets.logChannelId = channel.id;
  writeData('tickets.json', tickets);
  interaction.reply({
    embeds: [new EmbedBuilder()
      .setColor('#57F287').setTitle('✅ Ticket Log Channel Set')
      .setDescription(`All ticket events will be logged to <#${channel.id}>.`)
      .setTimestamp()],
    ephemeral: true,
  });
}

async function handleLogsInfo(interaction) {
  const tickets = readData('tickets.json');

  const removeBtn = new ButtonBuilder()
    .setCustomId('ticket_logs_remove_btn')
    .setLabel('🗑️ Remove Log Channel')
    .setStyle(ButtonStyle.Danger)
    .setDisabled(!tickets.logChannelId);

  const channelSelect = new ChannelSelectMenuBuilder()
    .setCustomId('ticket_logs_channel_select')
    .setPlaceholder('Select a new log channel...')
    .setChannelTypes(ChannelType.GuildText);

  interaction.reply({
    embeds: [new EmbedBuilder()
      .setColor('#5865F2').setTitle('📋 Ticket Log Channel')
      .setDescription(tickets.logChannelId ? `Logs are sent to <#${tickets.logChannelId}>.` : '❌ No log channel configured.')
      .setFooter({ text: 'Use the menu below to set a new channel, or remove the current one.' })
      .setTimestamp()],
    components: [
      new ActionRowBuilder().addComponents(removeBtn),
      new ActionRowBuilder().addComponents(channelSelect),
    ],
    ephemeral: true,
  });
}

async function handleLogsRemove(interaction) {
  const tickets = readData('tickets.json');
  if (!tickets.logChannelId)
    return interaction.reply({ content: '❌ No log channel is currently set.', ephemeral: true });
  tickets.logChannelId = null;
  writeData('tickets.json', tickets);
  interaction.reply({ content: '✅ Ticket log channel removed.', ephemeral: true });
}

// ── /ticket perms ─────────────────────────────────────────────────────────────
async function handlePermsPing(interaction) {
  const role    = interaction.options.getRole('role');
  const tickets = readData('tickets.json');
  if (!tickets.perms) tickets.perms = { pingRoles: [], viewRoles: [] };
  if (!tickets.perms.pingRoles.includes(role.id)) {
    tickets.perms.pingRoles.push(role.id);
    writeData('tickets.json', tickets);
    interaction.reply({ content: `✅ **${role.name}** will be pinged when a ticket opens.`, ephemeral: true });
  } else {
    interaction.reply({ content: `ℹ️ **${role.name}** is already a ping role.`, ephemeral: true });
  }
}

async function handlePermsView(interaction) {
  const role    = interaction.options.getRole('role');
  const tickets = readData('tickets.json');
  if (!tickets.perms) tickets.perms = { pingRoles: [], viewRoles: [] };
  if (!tickets.perms.viewRoles.includes(role.id)) {
    tickets.perms.viewRoles.push(role.id);
    writeData('tickets.json', tickets);
    interaction.reply({ content: `✅ **${role.name}** can now see all ticket channels.`, ephemeral: true });
  } else {
    interaction.reply({ content: `ℹ️ **${role.name}** already has view access.`, ephemeral: true });
  }
}

async function handlePermsInfo(interaction) {
  const tickets  = readData('tickets.json');
  const perms    = tickets.perms || { pingRoles: [], viewRoles: [] };
  const pingList = perms.pingRoles.length > 0 ? perms.pingRoles.map(id => `<@&${id}>`).join(', ') : 'None';
  const viewList = perms.viewRoles.length > 0 ? perms.viewRoles.map(id => `<@&${id}>`).join(', ') : 'None';

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket_perms_addping').setLabel('➕ Ping').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('ticket_perms_removeping').setLabel('➖ Ping').setStyle(ButtonStyle.Secondary).setDisabled(perms.pingRoles.length === 0),
    new ButtonBuilder().setCustomId('ticket_perms_addview').setLabel('➕ View').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('ticket_perms_removeview').setLabel('➖ View').setStyle(ButtonStyle.Secondary).setDisabled(perms.viewRoles.length === 0),
    new ButtonBuilder().setCustomId('ticket_perms_clear').setLabel('🗑️ Clear All').setStyle(ButtonStyle.Danger),
  );

  interaction.reply({
    embeds: [new EmbedBuilder()
      .setColor('#5865F2').setTitle('🔐 Ticket Permission Settings')
      .addFields(
        { name: '🔔 Ping Roles (notified on open)', value: pingList },
        { name: '👁️ View Roles (can see all tickets)', value: viewList },
      )
      .setFooter({ text: '➕ Ping / ➕ View to add  •  ➖ to remove  •  🗑️ to clear all' })
      .setTimestamp()],
    components: [row],
    ephemeral: true,
  });
}

async function handlePermsClear(interaction) {
  const tickets = readData('tickets.json');
  tickets.perms = { pingRoles: [], viewRoles: [] };
  writeData('tickets.json', tickets);
  interaction.reply({ content: '✅ All ticket ping and view role settings cleared.', ephemeral: true });
}

module.exports.handleClose        = handleClose;
module.exports.getPanelId         = getPanelId;
module.exports.buildDescEmbed     = buildDescEmbed;
module.exports.sendTicketOverview = sendTicketOverview;
