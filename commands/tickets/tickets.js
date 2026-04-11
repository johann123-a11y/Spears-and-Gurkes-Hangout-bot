const {
  SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder,
} = require('discord.js');
const { readData, writeData } = require('../../utils');

const STYLES = {
  blue: ButtonStyle.Primary,
  grey: ButtonStyle.Secondary,
  green: ButtonStyle.Success,
  red: ButtonStyle.Danger,
};

module.exports = {
  name: 'tickets',
  description: 'Manage ticket panels, groups and description. [Administrator Only]',
  data: new SlashCommandBuilder()
    .setName('tickets')
    .setDescription('Manage ticket panels [Administrator Only]')
    .addSubcommand(sub =>
      sub.setName('group')
        .setDescription('Send all panels as one grouped message in this channel')
    )
    .addSubcommand(sub =>
      sub.setName('description')
        .setDescription('Set the title and text shown above ticket panels')
        .addStringOption(o => o.setName('title').setDescription('Embed title (e.g. Create Ticket)').setRequired(true))
        .addStringOption(o => o.setName('text').setDescription('Description text — use \\n for line breaks').setRequired(false))
    )
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('List all configured ticket panels')
    )
    .addSubcommand(sub =>
      sub.setName('delete')
        .setDescription('Delete a ticket panel')
        .addStringOption(o => o.setName('panel').setDescription('Panel name to delete').setRequired(true))
    ),

  async execute(message) {
    message.reply('❌ Please use `/tickets` slash commands for the ticket system.');
  },

  async executeSlash(interaction) {
    if (!interaction.member.permissions.has('Administrator'))
      return interaction.reply({ content: '❌ Only **Administrators** can use this command.', ephemeral: true });

    const sub = interaction.options.getSubcommand();
    if (sub === 'group') return handleGroup(interaction);
    if (sub === 'description') return handleDescription(interaction);
    if (sub === 'list') return handleList(interaction);
    if (sub === 'delete') return handleDelete(interaction);
  },
};

async function handleGroup(interaction) {
  const tickets = readData('tickets.json');
  const panels = Object.values(tickets.panels || {});

  if (panels.length === 0)
    return interaction.reply({ content: '❌ No panels configured. Create one with `/ticket setup` first.', ephemeral: true });

  const desc = tickets.description;
  const embed = new EmbedBuilder()
    .setColor('#5865F2')
    .setTitle(desc?.title || 'Create Ticket')
    .setTimestamp();

  if (desc?.text) embed.setDescription(desc.text.replace(/\\n/g, '\n'));

  // Build button rows (max 5 buttons per row)
  const rows = [];
  let currentRow = new ActionRowBuilder();
  let btnCount = 0;

  for (const panel of panels) {
    if (btnCount > 0 && btnCount % 5 === 0) {
      rows.push(currentRow);
      currentRow = new ActionRowBuilder();
    }
    currentRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`ticket_open:${panel.id}`)
        .setLabel(panel.buttonLabel)
        .setStyle(STYLES[panel.buttonStyle] || ButtonStyle.Primary)
    );
    btnCount++;
  }
  if (btnCount % 5 !== 0 || btnCount === 0) rows.push(currentRow);

  await interaction.reply({ content: '✅ Grouped panel sent!', ephemeral: true });
  const sent = await interaction.channel.send({ embeds: [embed], components: rows });

  if (!tickets.group) tickets.group = {};
  tickets.group.enabled = true;
  tickets.group.channelId = interaction.channelId;
  tickets.group.messageId = sent.id;
  writeData('tickets.json', tickets);
}

async function handleDescription(interaction) {
  const title = interaction.options.getString('title');
  const text = interaction.options.getString('text') || null;

  const tickets = readData('tickets.json');
  tickets.description = { title, text };
  writeData('tickets.json', tickets);

  const embed = new EmbedBuilder()
    .setColor('#57F287')
    .setTitle('✅ Description Updated')
    .addFields(
      { name: 'Title', value: title },
      ...(text ? [{ name: 'Text', value: text.replace(/\\n/g, '\n') }] : []),
    )
    .setFooter({ text: 'Use /tickets group or /ticket send to post the updated panel' })
    .setTimestamp();

  interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleList(interaction) {
  const tickets = readData('tickets.json');
  const panels = Object.values(tickets.panels || {});

  if (panels.length === 0)
    return interaction.reply({ content: '❌ No panels configured yet. Use `/ticket setup` to create one.', ephemeral: true });

  const embed = new EmbedBuilder()
    .setColor('#5865F2')
    .setTitle('🎫 Configured Ticket Panels')
    .addFields(panels.map(p => ({
      name: `${p.name}  (ID: \`${p.id}\`)`,
      value: [
        `**Button:** ${p.buttonLabel} — ${p.buttonStyle}`,
        `**Category:** <#${p.categoryId}>`,
        p.questions.length > 0
          ? `**Questions:**\n${p.questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}`
          : '**Questions:** None',
      ].join('\n'),
    })))
    .setTimestamp();

  interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleDelete(interaction) {
  const panelName = interaction.options.getString('panel');
  const tickets = readData('tickets.json');
  const panelId = panelName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  const panel = tickets.panels?.[panelId];

  if (!panel)
    return interaction.reply({ content: `❌ Panel \`${panelName}\` not found.`, ephemeral: true });

  delete tickets.panels[panelId];
  writeData('tickets.json', tickets);

  interaction.reply({ content: `✅ Panel **${panel.name}** has been deleted.`, ephemeral: true });
}
