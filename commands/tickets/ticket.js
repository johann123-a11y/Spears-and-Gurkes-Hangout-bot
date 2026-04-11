const {
  SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle,
  ActionRowBuilder, ChannelType, PermissionFlagsBits,
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
  ModalBuilder, TextInputBuilder, TextInputStyle,
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
  return member.permissions.has(PermissionFlagsBits.ManageChannels)
    || member.permissions.has(PermissionFlagsBits.Administrator);
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

    // ── /ticket perms (subcommand group) ─────────────────────────────────────
    .addSubcommandGroup(group =>
      group.setName('perms')
        .setDescription('Manage ticket role permissions')
        .addSubcommand(sub =>
          sub.setName('ping')
            .setDescription('Add a role that gets pinged when a ticket is opened')
            .addRoleOption(o => o.setName('role').setDescription('Role to ping').setRequired(true))
        )
        .addSubcommand(sub =>
          sub.setName('view')
            .setDescription('Add a role that can see all ticket channels')
            .addRoleOption(o => o.setName('role').setDescription('Role to grant view access').setRequired(true))
        )
        .addSubcommand(sub =>
          sub.setName('info')
            .setDescription('Show current ping and view role settings')
        )
        .addSubcommand(sub =>
          sub.setName('clear')
            .setDescription('Clear all ping and view role settings')
        )
    )

    // ── /ticket setup ─────────────────────────────────────────────────────────
    .addSubcommand(sub =>
      sub.setName('setup')
        .setDescription('Create a new ticket panel [Admin Only]')
        .addStringOption(o => o.setName('name').setDescription('Panel name (e.g. Support)').setRequired(true))
        .addStringOption(o => o.setName('label').setDescription('Button label text').setRequired(true))
        .addStringOption(o =>
          o.setName('color')
            .setDescription('Button color')
            .setRequired(true)
            .addChoices(
              { name: '🔵 Blue', value: 'blue' },
              { name: '⚫ Grey', value: 'grey' },
              { name: '🟢 Green', value: 'green' },
              { name: '🔴 Red', value: 'red' },
            )
        )
        .addChannelOption(o =>
          o.setName('category')
            .setDescription('Category where tickets are created')
            .setRequired(true)
        )
    )

    // ── /ticket question ──────────────────────────────────────────────────────
    .addSubcommand(sub =>
      sub.setName('question')
        .setDescription('Add a pre-open question to a panel (max 5) [Admin Only]')
        .addStringOption(o => o.setName('panel').setDescription('Panel name').setRequired(true))
        .addStringOption(o => o.setName('question').setDescription('Question text').setRequired(true))
    )

    // ── /ticket removequestion ────────────────────────────────────────────────
    .addSubcommand(sub =>
      sub.setName('removequestion')
        .setDescription('Remove a question from a panel [Admin Only]')
        .addStringOption(o => o.setName('panel').setDescription('Panel name').setRequired(true))
        .addIntegerOption(o => o.setName('number').setDescription('Question number').setRequired(true).setMinValue(1))
    )

    // ── /ticket description ───────────────────────────────────────────────────
    .addSubcommand(sub =>
      sub.setName('description')
        .setDescription('Set the title and description shown above panels [Admin Only]')
    )

    // ── /ticket group ─────────────────────────────────────────────────────────
    .addSubcommand(sub =>
      sub.setName('group')
        .setDescription('Send all panels as one grouped message in this channel [Admin Only]')
    )

    // ── /ticket send ──────────────────────────────────────────────────────────
    .addSubcommand(sub =>
      sub.setName('send')
        .setDescription('Send a single panel to this channel [Admin Only]')
        .addStringOption(o => o.setName('panel').setDescription('Panel name').setRequired(true))
    )

    // ── /ticket info ──────────────────────────────────────────────────────────
    .addSubcommand(sub =>
      sub.setName('info')
        .setDescription('View info about the current ticket or a panel [Staff]')
        .addStringOption(o => o.setName('panel').setDescription('Panel name — leave empty to view current ticket').setRequired(false))
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
        .setDescription('Move this ticket to a different category [Staff]')
        .addChannelOption(o => o.setName('category').setDescription('Target category').setRequired(true))
    )

    // ── /ticket close ─────────────────────────────────────────────────────────
    .addSubcommand(sub =>
      sub.setName('close')
        .setDescription('Close this ticket [Staff]')
        .addStringOption(o => o.setName('reason').setDescription('Reason for closing').setRequired(true))
    )

    // ── /ticket requestclose ──────────────────────────────────────────────────
    .addSubcommand(sub =>
      sub.setName('requestclose')
        .setDescription('Request this ticket to be closed')
        .addStringOption(o => o.setName('reason').setDescription('Reason for your request').setRequired(false))
    ),

  async execute(message) {
    message.reply('❌ Please use `/ticket` slash commands for the ticket system.');
  },

  async executeSlash(interaction) {
    const group = interaction.options.getSubcommandGroup(false);
    const sub   = interaction.options.getSubcommand();

    // Perms group — admin only
    if (group === 'perms') {
      if (!interaction.member.permissions.has('Administrator'))
        return interaction.reply({ content: '❌ Only **Administrators** can manage permissions.', ephemeral: true });
      if (sub === 'ping')  return handlePermsPing(interaction);
      if (sub === 'view')  return handlePermsView(interaction);
      if (sub === 'info')  return handlePermsInfo(interaction);
      if (sub === 'clear') return handlePermsClear(interaction);
    }

    // Admin-only subcommands
    const adminOnly = ['setup', 'question', 'removequestion', 'description', 'group', 'send'];
    if (adminOnly.includes(sub) && !interaction.member.permissions.has('Administrator'))
      return interaction.reply({ content: '❌ Only **Administrators** can use this command.', ephemeral: true });

    // Staff subcommands
    const staffOnly = ['add', 'remove', 'rename', 'move', 'close', 'info'];
    if (staffOnly.includes(sub) && !isStaff(interaction.member))
      return interaction.reply({ content: '❌ Only **Staff** can use this command.', ephemeral: true });

    if (sub === 'setup')          return handleSetup(interaction);
    if (sub === 'question')       return handleQuestion(interaction);
    if (sub === 'removequestion') return handleRemoveQuestion(interaction);
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

// ── Handlers ──────────────────────────────────────────────────────────────────

async function handleSetup(interaction) {
  const name     = interaction.options.getString('name');
  const label    = interaction.options.getString('label');
  const color    = interaction.options.getString('color');
  const category = interaction.options.getChannel('category');

  if (category.type !== ChannelType.GuildCategory)
    return interaction.reply({ content: '❌ Please select a **Category**, not a text channel.', ephemeral: true });

  const tickets  = readData('tickets.json');
  if (!tickets.panels) tickets.panels = {};
  const panelId  = getPanelId(name);

  tickets.panels[panelId] = { id: panelId, name, buttonLabel: label, buttonStyle: color, categoryId: category.id, questions: [] };
  writeData('tickets.json', tickets);

  interaction.reply({
    embeds: [new EmbedBuilder()
      .setColor('#57F287').setTitle('✅ Ticket Panel Created')
      .addFields(
        { name: 'Panel Name',   value: name,              inline: true },
        { name: 'Button Label', value: label,             inline: true },
        { name: 'Color',        value: color,             inline: true },
        { name: 'Category',     value: `<#${category.id}>`, inline: true },
        { name: 'Next Steps', value: `• Add questions: \`/ticket question panel:${name}\`\n• Send: \`/ticket send panel:${name}\`\n• Group all: \`/ticket group\`` },
      ).setTimestamp()],
    ephemeral: true,
  });
}

async function handleQuestion(interaction) {
  const panelName = interaction.options.getString('panel');
  const question  = interaction.options.getString('question');
  const tickets   = readData('tickets.json');
  const panel     = tickets.panels?.[getPanelId(panelName)];

  if (!panel) return interaction.reply({ content: `❌ Panel \`${panelName}\` not found.`, ephemeral: true });
  if (panel.questions.length >= 5) return interaction.reply({ content: '❌ Maximum **5 questions** per panel.', ephemeral: true });

  panel.questions.push(question);
  writeData('tickets.json', tickets);
  interaction.reply({ content: `✅ Question **#${panel.questions.length}** added to **${panel.name}**:\n> ${question}`, ephemeral: true });
}

async function handleRemoveQuestion(interaction) {
  const panelName = interaction.options.getString('panel');
  const num       = interaction.options.getInteger('number');
  const tickets   = readData('tickets.json');
  const panel     = tickets.panels?.[getPanelId(panelName)];

  if (!panel) return interaction.reply({ content: `❌ Panel \`${panelName}\` not found.`, ephemeral: true });
  if (num > panel.questions.length) return interaction.reply({ content: `❌ No question #${num}.`, ephemeral: true });

  const removed = panel.questions.splice(num - 1, 1)[0];
  writeData('tickets.json', tickets);
  interaction.reply({ content: `✅ Removed question #${num} from **${panel.name}**:\n> ${removed}`, ephemeral: true });
}

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
          .setLabel('Footer text (optional, e.g. Powered by MyBot)')
          .setStyle(TextInputStyle.Short)
          .setValue(current.footer || '')
          .setRequired(false)
      ),
    );

  await interaction.showModal(modal);
}

async function handleGroup(interaction) {
  const tickets = readData('tickets.json');
  const panels  = Object.values(tickets.panels || {});
  if (panels.length === 0)
    return interaction.reply({ content: '❌ No panels configured. Use `/ticket setup` first.', ephemeral: true });

  // Show multi-select dropdown so admin picks which panels to combine
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

async function handleSend(interaction) {
  const panelName = interaction.options.getString('panel');
  const tickets   = readData('tickets.json');
  const panel     = tickets.panels?.[getPanelId(panelName)];
  if (!panel) return interaction.reply({ content: `❌ Panel \`${panelName}\` not found.`, ephemeral: true });

  const embed  = buildDescEmbed(tickets.description);
  const button = new ButtonBuilder()
    .setCustomId(`ticket_open:${panel.id}`)
    .setLabel(panel.buttonLabel)
    .setStyle(STYLES[panel.buttonStyle] || ButtonStyle.Primary);

  await interaction.reply({ content: '✅ Panel sent!', ephemeral: true });
  await interaction.channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(button)] });
}

async function handleInfo(interaction) {
  const panelName   = interaction.options.getString('panel');
  const tickets     = readData('tickets.json');
  const openTickets = readData('openTickets.json');

  // If panel name provided → show panel info + edit menu
  if (panelName) {
    const panel = tickets.panels?.[getPanelId(panelName)];
    if (!panel) return interaction.reply({ content: `❌ Panel \`${panelName}\` not found.`, ephemeral: true });

    const embed = new EmbedBuilder()
      .setColor('#5865F2').setTitle(`🎫 Panel: ${panel.name}`)
      .addFields(
        { name: 'Button Label', value: panel.buttonLabel,        inline: true },
        { name: 'Color',        value: panel.buttonStyle,        inline: true },
        { name: 'Category',     value: `<#${panel.categoryId}>`, inline: true },
        { name: 'Questions',    value: panel.questions.length > 0
          ? panel.questions.map((q, i) => `${i + 1}. ${q}`).join('\n')
          : 'None' },
      ).setTimestamp();

    const editMenu = new StringSelectMenuBuilder()
      .setCustomId(`ticket_info_edit:${panel.id}`)
      .setPlaceholder('✏️ Edit panel settings...')
      .addOptions(
        new StringSelectMenuOptionBuilder().setLabel('Button Label').setValue('label').setDescription('Change the button text').setEmoji('🏷️'),
        new StringSelectMenuOptionBuilder().setLabel('Button Color').setValue('color').setDescription('Change button color').setEmoji('🎨'),
        new StringSelectMenuOptionBuilder().setLabel('Category').setValue('category').setDescription('Change the ticket category ID').setEmoji('📁'),
        new StringSelectMenuOptionBuilder().setLabel('Add Question').setValue('addq').setDescription('Add a pre-open question').setEmoji('➕'),
        new StringSelectMenuOptionBuilder().setLabel('Remove Question').setValue('removeq').setDescription('Remove a question by number').setEmoji('➖'),
        new StringSelectMenuOptionBuilder().setLabel('Delete Panel').setValue('delete').setDescription('Permanently delete this panel').setEmoji('🗑️'),
      );

    return interaction.reply({
      embeds: [embed],
      components: [new ActionRowBuilder().addComponents(editMenu)],
      ephemeral: true,
    });
  }

  // Otherwise → show current ticket info
  const ticket = openTickets[interaction.channelId];
  if (!ticket)
    return interaction.reply({ content: '❌ This is not a ticket channel. Provide a panel name to view panel info.', ephemeral: true });

  const embed = new EmbedBuilder()
    .setColor('#5865F2').setTitle('🎫 Ticket Info')
    .addFields(
      { name: 'Panel',    value: ticket.panelName,                                      inline: true },
      { name: 'Opened by', value: `<@${ticket.userId}>`,                                inline: true },
      { name: 'Opened at', value: `<t:${Math.floor(new Date(ticket.openedAt) / 1000)}:F>`, inline: true },
    );

  if (ticket.answers?.length > 0)
    embed.addFields(ticket.answers.map(a => ({ name: a.question, value: a.answer })));

  interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleAdd(interaction) {
  const openTickets = readData('openTickets.json');
  if (!openTickets[interaction.channelId])
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
    interaction.reply({ content: `❌ Failed to add user: ${err.message}`, ephemeral: true });
  }
}

async function handleRemove(interaction) {
  const openTickets = readData('openTickets.json');
  if (!openTickets[interaction.channelId])
    return interaction.reply({ content: '❌ This is not a ticket channel.', ephemeral: true });

  const user = interaction.options.getUser('user');
  try {
    await interaction.channel.permissionOverwrites.delete(user.id);
    interaction.reply({ content: `✅ **${user.tag}** has been removed from this ticket.` });
  } catch (err) {
    interaction.reply({ content: `❌ Failed to remove user: ${err.message}`, ephemeral: true });
  }
}

async function handleRename(interaction) {
  const openTickets = readData('openTickets.json');
  if (!openTickets[interaction.channelId])
    return interaction.reply({ content: '❌ This is not a ticket channel.', ephemeral: true });

  const newName = interaction.options.getString('name').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  try {
    await interaction.channel.setName(newName);
    interaction.reply({ content: `✅ Ticket renamed to **${newName}**.` });
  } catch (err) {
    interaction.reply({ content: `❌ Failed to rename: ${err.message}`, ephemeral: true });
  }
}

async function handleMove(interaction) {
  const openTickets = readData('openTickets.json');
  if (!openTickets[interaction.channelId])
    return interaction.reply({ content: '❌ This is not a ticket channel.', ephemeral: true });

  const category = interaction.options.getChannel('category');
  if (category.type !== ChannelType.GuildCategory)
    return interaction.reply({ content: '❌ Please select a **Category**.', ephemeral: true });

  try {
    await interaction.channel.setParent(category.id, { lockPermissions: false });
    interaction.reply({ content: `✅ Ticket moved to **${category.name}**.` });
  } catch (err) {
    interaction.reply({ content: `❌ Failed to move ticket: ${err.message}`, ephemeral: true });
  }
}

async function handleClose(interaction, forcedReason, forcedBy) {
  const reason = forcedReason || interaction.options?.getString('reason') || 'No reason provided.';
  const by     = forcedBy || interaction.user;

  const openTickets = readData('openTickets.json');
  const ticket      = openTickets[interaction.channelId];
  if (!ticket)
    return interaction.reply({ content: '❌ This is not an active ticket channel.', ephemeral: true });

  await interaction.reply({ content: '🔒 Closing ticket in **3 seconds**...' });

  try {
    const user = await interaction.client.users.fetch(ticket.userId);
    await user.send({
      embeds: [new EmbedBuilder()
        .setColor('#ED4245').setTitle('🔒 Your Ticket Was Closed')
        .addFields(
          { name: 'Panel',      value: ticket.panelName,                           inline: true },
          { name: 'Closed by',  value: by.tag,                                     inline: true },
          { name: 'Time',       value: `<t:${Math.floor(Date.now() / 1000)}:F>`,   inline: true },
          { name: 'Reason',     value: reason },
        ).setTimestamp()],
    });
  } catch { /* DMs disabled */ }

  // Ticket-specific log
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
    action: 'Ticket Closed',
    executor: by.tag,
    target: `<@${ticket.userId}>`,
    fields: { Panel: ticket.panelName, Reason: reason },
    color: '#ED4245',
  });

  delete openTickets[interaction.channelId];
  writeData('openTickets.json', openTickets);
  setTimeout(() => interaction.channel.delete().catch(() => {}), 3000);
}

async function handleRequestClose(interaction) {
  const openTickets = readData('openTickets.json');
  if (!openTickets[interaction.channelId])
    return interaction.reply({ content: '❌ This is not an active ticket channel.', ephemeral: true });

  const reason = interaction.options.getString('reason') || 'No reason provided.';

  const closeBtn = new ButtonBuilder()
    .setCustomId('ticket_close_btn')
    .setLabel('🔒 Close Ticket')
    .setStyle(ButtonStyle.Danger);

  const embed = new EmbedBuilder()
    .setColor('#FEE75C')
    .setTitle('📩 Close Request')
    .setDescription(`<@${interaction.user.id}> has requested this ticket to be closed.`)
    .addFields({ name: 'Reason', value: reason })
    .setTimestamp();

  await interaction.reply({ content: '✅ Close request sent.', ephemeral: true });
  await interaction.channel.send({
    embeds: [embed],
    components: [new ActionRowBuilder().addComponents(closeBtn)],
  });
}

// ── Perms handlers ────────────────────────────────────────────────────────────

async function handlePermsPing(interaction) {
  const role    = interaction.options.getRole('role');
  const tickets = readData('tickets.json');
  if (!tickets.perms) tickets.perms = { pingRoles: [], viewRoles: [] };
  if (!tickets.perms.pingRoles.includes(role.id)) {
    tickets.perms.pingRoles.push(role.id);
    writeData('tickets.json', tickets);
    interaction.reply({ content: `✅ **${role.name}** will now be pinged when a ticket is opened.`, ephemeral: true });
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
  const tickets = readData('tickets.json');
  const perms   = tickets.perms || { pingRoles: [], viewRoles: [] };
  const guild   = interaction.guild;

  const pingList = perms.pingRoles.length > 0
    ? perms.pingRoles.map(id => `<@&${id}>`).join(', ')
    : 'None';
  const viewList = perms.viewRoles.length > 0
    ? perms.viewRoles.map(id => `<@&${id}>`).join(', ')
    : 'None';

  interaction.reply({
    embeds: [new EmbedBuilder()
      .setColor('#5865F2').setTitle('🔐 Ticket Permission Settings')
      .addFields(
        { name: '🔔 Ping Roles (notified on open)', value: pingList },
        { name: '👁️ View Roles (can see all tickets)', value: viewList },
      ).setTimestamp()],
    ephemeral: true,
  });
}

async function handlePermsClear(interaction) {
  const tickets = readData('tickets.json');
  tickets.perms = { pingRoles: [], viewRoles: [] };
  writeData('tickets.json', tickets);
  interaction.reply({ content: '✅ All ticket ping and view role settings have been cleared.', ephemeral: true });
}

module.exports.handleClose    = handleClose;
module.exports.getPanelId     = getPanelId;
module.exports.buildDescEmbed = buildDescEmbed;
