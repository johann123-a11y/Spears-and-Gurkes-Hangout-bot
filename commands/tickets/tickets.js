const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { readData, writeData } = require('../../utils');

module.exports = {
  name: 'tickets',
  description: 'Ticket panel management. [Administrator Only]',
  data: new SlashCommandBuilder()
    .setName('tickets')
    .setDescription('Manage ticket panels [Administrator Only]')

    // ── /tickets logs (subcommand group) ──────────────────────────────────────
    .addSubcommandGroup(group =>
      group.setName('logs')
        .setDescription('Manage the ticket log channel')
        .addSubcommand(sub =>
          sub.setName('set')
            .setDescription('Set the channel where all ticket events are logged')
            .addChannelOption(o => o.setName('channel').setDescription('Log channel').setRequired(true))
        )
        .addSubcommand(sub =>
          sub.setName('info')
            .setDescription('Show the current ticket log channel')
        )
        .addSubcommand(sub =>
          sub.setName('remove')
            .setDescription('Remove the ticket log channel')
        )
    )

    // ── /tickets list ─────────────────────────────────────────────────────────
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('List all configured ticket panels')
    )

    // ── /tickets delete ───────────────────────────────────────────────────────
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

    const group = interaction.options.getSubcommandGroup(false);
    const sub   = interaction.options.getSubcommand();

    if (group === 'logs') {
      if (sub === 'set')    return handleLogsSet(interaction);
      if (sub === 'info')   return handleLogsInfo(interaction);
      if (sub === 'remove') return handleLogsRemove(interaction);
    }

    if (sub === 'list')   return handleList(interaction);
    if (sub === 'delete') return handleDelete(interaction);
  },
};

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
  const id      = tickets.logChannelId;

  interaction.reply({
    embeds: [new EmbedBuilder()
      .setColor('#5865F2').setTitle('📋 Ticket Log Channel')
      .setDescription(id ? `Logs are being sent to <#${id}>.` : '❌ No log channel configured.')
      .setTimestamp()],
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

async function handleList(interaction) {
  const tickets = readData('tickets.json');
  const panels  = Object.values(tickets.panels || {});

  if (panels.length === 0)
    return interaction.reply({ content: '❌ No panels configured yet. Use `/ticket setup` to create one.', ephemeral: true });

  const embed = new EmbedBuilder()
    .setColor('#5865F2').setTitle('🎫 Configured Ticket Panels')
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
  const tickets   = readData('tickets.json');
  const panelId   = panelName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  const panel     = tickets.panels?.[panelId];

  if (!panel)
    return interaction.reply({ content: `❌ Panel \`${panelName}\` not found.`, ephemeral: true });

  delete tickets.panels[panelId];
  writeData('tickets.json', tickets);
  interaction.reply({ content: `✅ Panel **${panel.name}** deleted.`, ephemeral: true });
}
