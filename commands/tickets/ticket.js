const {
  SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, ChannelType,
} = require('discord.js');
const { readData, writeData } = require('../../utils');
const { sendLog } = require('../../utils/logger');

function getPanelId(name) {
  return name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}

module.exports = {
  name: 'ticket',
  description: 'Ticket system management. [Administrator Only]',
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Ticket system management [Administrator Only]')
    .addSubcommand(sub =>
      sub.setName('setup')
        .setDescription('Create a new ticket panel')
        .addStringOption(o => o.setName('name').setDescription('Panel name (e.g. Buy/Sell Spawners)').setRequired(true))
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
    .addSubcommand(sub =>
      sub.setName('question')
        .setDescription('Add a pre-open question to a panel (max 5 per panel)')
        .addStringOption(o => o.setName('panel').setDescription('Panel name').setRequired(true))
        .addStringOption(o => o.setName('question').setDescription('The question to ask before opening a ticket').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('removequestion')
        .setDescription('Remove a question from a panel by its number')
        .addStringOption(o => o.setName('panel').setDescription('Panel name').setRequired(true))
        .addIntegerOption(o => o.setName('number').setDescription('Question number to remove').setRequired(true).setMinValue(1))
    )
    .addSubcommand(sub =>
      sub.setName('send')
        .setDescription('Send a single ticket panel to this channel')
        .addStringOption(o => o.setName('panel').setDescription('Panel name').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('close')
        .setDescription('Close the current ticket channel')
        .addStringOption(o => o.setName('reason').setDescription('Reason for closing').setRequired(true))
    ),

  async execute(message) {
    message.reply('❌ Please use `/ticket` slash commands for the ticket system.');
  },

  async executeSlash(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub !== 'close' && !interaction.member.permissions.has('Administrator'))
      return interaction.reply({ content: '❌ Only **Administrators** can use this command.', ephemeral: true });

    if (sub === 'setup') return handleSetup(interaction);
    if (sub === 'question') return handleQuestion(interaction);
    if (sub === 'removequestion') return handleRemoveQuestion(interaction);
    if (sub === 'send') return handleSend(interaction);
    if (sub === 'close') return handleClose(interaction);
  },
};

async function handleSetup(interaction) {
  const name = interaction.options.getString('name');
  const label = interaction.options.getString('label');
  const color = interaction.options.getString('color');
  const category = interaction.options.getChannel('category');

  if (category.type !== ChannelType.GuildCategory)
    return interaction.reply({ content: '❌ Please select a **Category** (not a text channel).', ephemeral: true });

  const tickets = readData('tickets.json');
  if (!tickets.panels) tickets.panels = {};

  const panelId = getPanelId(name);

  tickets.panels[panelId] = {
    id: panelId,
    name,
    buttonLabel: label,
    buttonStyle: color,
    categoryId: category.id,
    questions: [],
  };
  writeData('tickets.json', tickets);

  const embed = new EmbedBuilder()
    .setColor('#57F287')
    .setTitle('✅ Ticket Panel Created')
    .addFields(
      { name: 'Panel Name', value: name, inline: true },
      { name: 'Button Label', value: label, inline: true },
      { name: 'Button Color', value: color, inline: true },
      { name: 'Category', value: `<#${category.id}>`, inline: true },
      { name: 'Questions', value: 'None — add with `/ticket question`' },
      {
        name: 'Next Steps',
        value: [
          `• Add questions: \`/ticket question panel:${name} question:...\``,
          `• Send panel: \`/ticket send panel:${name}\``,
          `• Or group all panels: \`/tickets group\``,
        ].join('\n'),
      },
    )
    .setFooter({ text: `Panel ID: ${panelId}` })
    .setTimestamp();

  interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleQuestion(interaction) {
  const panelName = interaction.options.getString('panel');
  const question = interaction.options.getString('question');
  const tickets = readData('tickets.json');
  const panel = tickets.panels?.[getPanelId(panelName)];

  if (!panel)
    return interaction.reply({ content: `❌ Panel \`${panelName}\` not found. Use \`/tickets list\` to see all panels.`, ephemeral: true });

  if (panel.questions.length >= 5)
    return interaction.reply({ content: '❌ Maximum **5 questions** per panel (Discord modal limit).', ephemeral: true });

  panel.questions.push(question);
  writeData('tickets.json', tickets);

  interaction.reply({
    content: `✅ Question **#${panel.questions.length}** added to **${panel.name}**:\n> ${question}`,
    ephemeral: true,
  });
}

async function handleRemoveQuestion(interaction) {
  const panelName = interaction.options.getString('panel');
  const num = interaction.options.getInteger('number');
  const tickets = readData('tickets.json');
  const panel = tickets.panels?.[getPanelId(panelName)];

  if (!panel)
    return interaction.reply({ content: `❌ Panel \`${panelName}\` not found.`, ephemeral: true });

  if (num > panel.questions.length)
    return interaction.reply({ content: `❌ Question #${num} doesn't exist. Panel has **${panel.questions.length}** question(s).`, ephemeral: true });

  const removed = panel.questions.splice(num - 1, 1)[0];
  writeData('tickets.json', tickets);

  interaction.reply({
    content: `✅ Removed question #${num} from **${panel.name}**:\n> ${removed}`,
    ephemeral: true,
  });
}

async function handleSend(interaction) {
  const panelName = interaction.options.getString('panel');
  const tickets = readData('tickets.json');
  const panel = tickets.panels?.[getPanelId(panelName)];

  if (!panel)
    return interaction.reply({ content: `❌ Panel \`${panelName}\` not found.`, ephemeral: true });

  const desc = tickets.description;
  const embed = new EmbedBuilder()
    .setColor('#5865F2')
    .setTitle(desc?.title || 'Create Ticket')
    .setTimestamp();

  if (desc?.text) embed.setDescription(desc.text.replace(/\\n/g, '\n'));

  const STYLES = { blue: ButtonStyle.Primary, grey: ButtonStyle.Secondary, green: ButtonStyle.Success, red: ButtonStyle.Danger };
  const button = new ButtonBuilder()
    .setCustomId(`ticket_open:${panel.id}`)
    .setLabel(panel.buttonLabel)
    .setStyle(STYLES[panel.buttonStyle] || ButtonStyle.Primary);

  await interaction.reply({ content: '✅ Panel sent!', ephemeral: true });
  await interaction.channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(button)] });
}

async function handleClose(interaction, forcedReason, forcedBy) {
  const reason = forcedReason || interaction.options?.getString('reason') || 'No reason provided.';
  const by = forcedBy || interaction.user;

  const openTickets = readData('openTickets.json');
  const ticket = openTickets[interaction.channelId];

  if (!ticket)
    return interaction.reply({ content: '❌ This is not an active ticket channel.', ephemeral: true });

  await interaction.reply({ content: '🔒 Closing ticket in **3 seconds**...' });

  try {
    const user = await interaction.client.users.fetch(ticket.userId);
    const dmEmbed = new EmbedBuilder()
      .setColor('#ED4245')
      .setTitle('🔒 Your Ticket Was Closed')
      .addFields(
        { name: 'Panel', value: ticket.panelName, inline: true },
        { name: 'Closed by', value: by.tag, inline: true },
        { name: 'Time', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
        { name: 'Reason', value: reason },
      )
      .setTimestamp();
    await user.send({ embeds: [dmEmbed] });
  } catch { /* DMs disabled */ }

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

module.exports.handleClose = handleClose;
module.exports.getPanelId = getPanelId;
