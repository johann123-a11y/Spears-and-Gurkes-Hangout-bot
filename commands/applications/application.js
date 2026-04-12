const {
  SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle,
  ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
  ModalBuilder, TextInputBuilder, TextInputStyle,
} = require('discord.js');
const { readData, writeData } = require('../../utils');

function getAppId(name) {
  return name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}

module.exports = {
  name: 'application',
  description: 'Application system.',
  data: new SlashCommandBuilder()
    .setName('application')
    .setDescription('Application system')
    .addSubcommand(sub =>
      sub.setName('setup').setDescription('Create a new application panel [Admin]')
    )
    .addSubcommand(sub =>
      sub.setName('group').setDescription('Combine applications into one panel [Admin]')
    )
    .addSubcommand(sub =>
      sub.setName('description').setDescription('Set the panel description [Admin]')
    )
    .addSubcommand(sub =>
      sub.setName('open').setDescription('Send the final application panel to this channel [Admin]')
    )
    .addSubcommand(sub =>
      sub.setName('results').setDescription('View all submitted applications [Admin]')
    ),

  async execute(message) {
    message.reply('❌ Please use `/application` slash commands.');
  },

  async executeSlash(interaction) {
    if (!interaction.member.permissions.has('Administrator'))
      return interaction.reply({ content: '❌ Only **Administrators** can use this command.', ephemeral: true });

    const sub = interaction.options.getSubcommand();
    if (sub === 'setup')       return handleSetup(interaction);
    if (sub === 'group')       return handleGroup(interaction);
    if (sub === 'description') return handleDescription(interaction);
    if (sub === 'open')        return handleOpen(interaction);
    if (sub === 'results')     return handleResults(interaction);
  },
};

// ── /application setup ────────────────────────────────────────────────────────
async function handleSetup(interaction) {
  const modal = new ModalBuilder()
    .setCustomId('app_setup_modal')
    .setTitle('📋 Create Application')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('app_name')
          .setLabel('Application Name (e.g. Staff Application)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Staff Application')
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('app_for')
          .setLabel('Applying for (e.g. Moderator)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Moderator')
          .setRequired(true)
      ),
    );
  await interaction.showModal(modal);
}

// ── /application group ────────────────────────────────────────────────────────
async function handleGroup(interaction) {
  const apps   = readData('applications.json');
  const panels = Object.values(apps.panels || {});
  if (panels.length === 0)
    return interaction.reply({ content: '❌ No applications yet. Use `/application setup` first.', ephemeral: true });

  const menu = new StringSelectMenuBuilder()
    .setCustomId('app_group_select')
    .setPlaceholder('Select applications to combine...')
    .setMinValues(1)
    .setMaxValues(panels.length)
    .addOptions(panels.map(p =>
      new StringSelectMenuOptionBuilder()
        .setLabel(p.name)
        .setValue(p.id)
        .setDescription(`For: ${p.forWhat} — ${p.questions.length} question(s)`)
    ));

  return interaction.reply({
    content: '**Select which applications to combine into one panel:**',
    components: [new ActionRowBuilder().addComponents(menu)],
    ephemeral: true,
  });
}

// ── /application description ──────────────────────────────────────────────────
async function handleDescription(interaction) {
  const apps    = readData('applications.json');
  const current = apps.description || {};

  const modal = new ModalBuilder()
    .setCustomId('app_description_modal')
    .setTitle('📋 Application Panel Description')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('app_desc_title')
          .setLabel('Title')
          .setStyle(TextInputStyle.Short)
          .setValue(current.title || 'Applications')
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('app_desc_text')
          .setLabel('Description / Rules (multi-line)')
          .setStyle(TextInputStyle.Paragraph)
          .setValue(current.text || '')
          .setPlaceholder('• Be at least 13 years old\n• No active punishments')
          .setRequired(false)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('app_desc_footer')
          .setLabel('Footer (optional)')
          .setStyle(TextInputStyle.Short)
          .setValue(current.footer || '')
          .setRequired(false)
      ),
    );
  await interaction.showModal(modal);
}

// ── /application open ─────────────────────────────────────────────────────────
async function handleOpen(interaction) {
  const apps   = readData('applications.json');
  const panels = Object.values(apps.panels || {}).filter(Boolean);

  if (panels.length === 0)
    return interaction.reply({ content: '❌ No applications created yet.', ephemeral: true });

  const groupedIds = apps.group?.panelIds || [];
  const toShow     = groupedIds.length > 0
    ? panels.filter(p => groupedIds.includes(p.id))
    : panels;

  if (toShow.length === 0)
    return interaction.reply({ content: '❌ No panels in the group. Use `/application group` first.', ephemeral: true });

  const desc  = apps.description || {};
  const embed = new EmbedBuilder().setColor('#5865F2').setTimestamp();
  embed.setTitle(desc.title || 'Applications');
  if (desc.text)   embed.setDescription(desc.text);
  if (desc.footer) embed.setFooter({ text: desc.footer });

  const menu = new StringSelectMenuBuilder()
    .setCustomId('app_apply_select')
    .setPlaceholder('📋 Select an application...')
    .addOptions(toShow.map(p =>
      new StringSelectMenuOptionBuilder()
        .setLabel(p.name)
        .setValue(p.id)
        .setDescription(`Apply for: ${p.forWhat}`)
    ));

  const sent = await interaction.channel.send({
    embeds: [embed],
    components: [new ActionRowBuilder().addComponents(menu)],
  });

  if (!apps.group) apps.group = {};
  apps.group.channelId = interaction.channelId;
  apps.group.messageId = sent.id;
  writeData('applications.json', apps);

  return interaction.reply({ content: '✅ Application panel sent!', ephemeral: true });
}

// ── /application results ──────────────────────────────────────────────────────
async function handleResults(interaction) {
  const results  = readData('applicationResults.json');
  const all      = Object.entries(results);

  if (all.length === 0)
    return interaction.reply({ content: '❌ No applications submitted yet.', ephemeral: true });

  const pending  = all.filter(([, r]) => r.status === 'pending');
  const accepted = all.filter(([, r]) => r.status === 'accepted').length;
  const denied   = all.filter(([, r]) => r.status === 'denied').length;

  const embed = new EmbedBuilder()
    .setColor('#5865F2')
    .setTitle('📋 Application Results')
    .addFields(
      { name: '⏳ Pending',  value: `**${pending.length}**`,  inline: true },
      { name: '✅ Accepted', value: `**${accepted}**`,         inline: true },
      { name: '❌ Denied',   value: `**${denied}**`,           inline: true },
    )
    .setFooter({ text: 'Select an application below to review it' })
    .setTimestamp();

  if (pending.length === 0)
    return interaction.reply({ embeds: [embed], content: '✅ All applications have been reviewed!', ephemeral: true });

  const menu = new StringSelectMenuBuilder()
    .setCustomId('app_result_picker')
    .setPlaceholder('Select an application to review...')
    .addOptions(pending.slice(0, 25).map(([id, r]) =>
      new StringSelectMenuOptionBuilder()
        .setLabel(`${r.username} — ${r.panelName}`)
        .setValue(id)
        .setDescription(`For: ${r.forWhat} • ${new Date(r.submittedAt).toLocaleDateString()}`)
    ));

  return interaction.reply({
    embeds: [embed],
    components: [new ActionRowBuilder().addComponents(menu)],
    ephemeral: true,
  });
}

module.exports.getAppId = getAppId;
