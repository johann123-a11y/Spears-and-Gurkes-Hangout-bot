const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  RoleSelectMenuBuilder, ChannelSelectMenuBuilder,
  ModalBuilder, TextInputBuilder, TextInputStyle,
} = require('discord.js');
const { readData, writeData } = require('./index');

const PING_COMMANDS = ['gping', 'gpingdaily', 'gpingweekly', 'qping', 'qpingstream', 'gpingmassive'];

function getCfg(cmdName) {
  const data = readData('pingcommands.json');
  return data[cmdName] ?? { message: null, allowedRoles: [], allowedChannels: [] };
}

function saveCfg(cmdName, cfg) {
  const data = readData('pingcommands.json');
  data[cmdName] = cfg;
  writeData('pingcommands.json', data);
}

function buildPanel(cmdName) {
  const cfg = getCfg(cmdName);

  const rolesText    = cfg.allowedRoles.length    > 0 ? cfg.allowedRoles.map(id    => `<@&${id}>`).join(', ') : '*(Alle)*';
  const channelsText = cfg.allowedChannels.length > 0 ? cfg.allowedChannels.map(id => `<#${id}>`).join(', ')  : '*(Alle)*';

  const embed = new EmbedBuilder()
    .setColor('#5865F2')
    .setTitle(`⚙️ Konfiguration: /${cmdName}`)
    .addFields(
      { name: '📝 Nachricht', value: cfg.message ? cfg.message.substring(0, 1000) : '*(Nicht gesetzt)*' },
      { name: '🎖️ Erlaubte Rollen',  value: rolesText,    inline: true },
      { name: '💬 Erlaubte Kanäle', value: channelsText, inline: true },
    )
    .setFooter({ text: 'Rollen/Kanäle leer lassen = keine Einschränkung' });

  const editBtn = new ButtonBuilder()
    .setCustomId(`ping_edit_msg:${cmdName}`)
    .setLabel('✏️ Nachricht bearbeiten')
    .setStyle(ButtonStyle.Primary);

  const roleSelect = new RoleSelectMenuBuilder()
    .setCustomId(`ping_roles:${cmdName}`)
    .setPlaceholder('Erlaubte Rollen (leer = alle dürfen)')
    .setMinValues(0)
    .setMaxValues(25);

  const channelSelect = new ChannelSelectMenuBuilder()
    .setCustomId(`ping_channels:${cmdName}`)
    .setPlaceholder('Erlaubte Kanäle (leer = überall)')
    .setMinValues(0)
    .setMaxValues(25);

  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(editBtn),
      new ActionRowBuilder().addComponents(roleSelect),
      new ActionRowBuilder().addComponents(channelSelect),
    ],
    ephemeral: true,
  };
}

// /gping aktion:edit → show panel
async function handleEdit(interaction, cmdName) {
  if (!interaction.member.permissions.has('Administrator'))
    return interaction.reply({ content: 'Nur **Admins** können das konfigurieren.', ephemeral: true });
  return interaction.reply(buildPanel(cmdName));
}

// /gping (no aktion) → send the saved message
async function handleSend(interaction, cmdName) {
  const cfg = getCfg(cmdName);

  if (!cfg.message)
    return interaction.reply({ content: `⚠️ Kein Text gesetzt. Nutze \`/${cmdName} aktion:edit\` zum Konfigurieren.`, ephemeral: true });

  // Role check (admins bypass)
  if (!interaction.member.permissions.has('Administrator') && cfg.allowedRoles.length > 0) {
    const hasRole = cfg.allowedRoles.some(id => interaction.member.roles.cache.has(id));
    if (!hasRole)
      return interaction.reply({ content: '❌ Du hast keine Berechtigung diesen Command zu nutzen.', ephemeral: true });
  }

  // Channel check (admins bypass)
  if (!interaction.member.permissions.has('Administrator') && cfg.allowedChannels.length > 0) {
    if (!cfg.allowedChannels.includes(interaction.channelId))
      return interaction.reply({ content: '❌ Dieser Command kann hier nicht genutzt werden.', ephemeral: true });
  }

  return interaction.reply({ content: cfg.message, allowedMentions: { parse: ['roles', 'users', 'everyone'] } });
}

// Button: ping_edit_msg:cmdname → open modal pre-filled with current message
async function handleButton(interaction) {
  const cmdName = interaction.customId.split(':')[1];
  if (!PING_COMMANDS.includes(cmdName)) return;

  const cfg = getCfg(cmdName);
  const input = new TextInputBuilder()
    .setCustomId('message')
    .setLabel('Nachricht (Pings wie @everyone erlaubt)')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMaxLength(2000);
  if (cfg.message) input.setValue(cfg.message);

  const modal = new ModalBuilder()
    .setCustomId(`ping_modal:${cmdName}`)
    .setTitle(`Nachricht: /${cmdName}`)
    .addComponents(new ActionRowBuilder().addComponents(input));

  return interaction.showModal(modal);
}

// Modal submit: ping_modal:cmdname → save message, show updated panel
async function handleModal(interaction) {
  const cmdName = interaction.customId.split(':')[1];
  if (!PING_COMMANDS.includes(cmdName)) return;

  const message = interaction.fields.getTextInputValue('message');
  const cfg = getCfg(cmdName);
  cfg.message = message;
  saveCfg(cmdName, cfg);

  return interaction.update(buildPanel(cmdName));
}

// Role select: ping_roles:cmdname → save immediately, update panel
async function handleRoles(interaction) {
  const cmdName = interaction.customId.split(':')[1];
  if (!PING_COMMANDS.includes(cmdName)) return;

  const cfg = getCfg(cmdName);
  cfg.allowedRoles = interaction.values;
  saveCfg(cmdName, cfg);

  return interaction.update(buildPanel(cmdName));
}

// Channel select: ping_channels:cmdname → save immediately, update panel
async function handleChannels(interaction) {
  const cmdName = interaction.customId.split(':')[1];
  if (!PING_COMMANDS.includes(cmdName)) return;

  const cfg = getCfg(cmdName);
  cfg.allowedChannels = interaction.values;
  saveCfg(cmdName, cfg);

  return interaction.update(buildPanel(cmdName));
}

module.exports = { PING_COMMANDS, handleEdit, handleSend, handleButton, handleModal, handleRoles, handleChannels };
