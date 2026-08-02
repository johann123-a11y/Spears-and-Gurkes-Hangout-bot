const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  RoleSelectMenuBuilder, ChannelSelectMenuBuilder,
  ModalBuilder, TextInputBuilder, TextInputStyle,
} = require('discord.js');
const { readData, writeData } = require('./index');
const { COOLDOWN_MS, pingCooldowns } = require('./pingCooldowns');

const PING_COMMANDS = ['gping', 'gpingdaily', 'gpingweekly', 'qping', 'qpingstream', 'gpingmassive'];
const COOLDOWN_COMMANDS = new Set(['gping', 'qping']);

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

  const rolesText    = cfg.allowedRoles.length    > 0 ? cfg.allowedRoles.map(id    => `<@&${id}>`).join(', ') : '*(Everyone)*';
  const channelsText = cfg.allowedChannels.length > 0 ? cfg.allowedChannels.map(id => `<#${id}>`).join(', ')  : '*(Everywhere)*';

  const embed = new EmbedBuilder()
    .setColor('#5865F2')
    .setTitle(`⚙️ Configuration: /${cmdName}`)
    .addFields(
      { name: '📝 Message', value: cfg.message ? cfg.message.substring(0, 1000) : '*(Not set)*' },
      { name: '🎖️ Allowed Roles',    value: rolesText,    inline: true },
      { name: '💬 Allowed Channels', value: channelsText, inline: true },
    )
    .setFooter({ text: 'Leave roles/channels empty = no restriction' });

  const editBtn = new ButtonBuilder()
    .setCustomId(`ping_edit_msg:${cmdName}`)
    .setLabel('✏️ Edit Message')
    .setStyle(ButtonStyle.Primary);

  const roleSelect = new RoleSelectMenuBuilder()
    .setCustomId(`ping_roles:${cmdName}`)
    .setPlaceholder('Allowed roles (empty = everyone)')
    .setMinValues(0)
    .setMaxValues(25);

  const channelSelect = new ChannelSelectMenuBuilder()
    .setCustomId(`ping_channels:${cmdName}`)
    .setPlaceholder('Allowed channels (empty = everywhere)')
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
    return interaction.reply({ content: 'Only **Admins** can configure this.', ephemeral: true });
  return interaction.reply(buildPanel(cmdName));
}

// /gping (no aktion) → send the saved message
async function handleSend(interaction, cmdName) {
  const cfg = getCfg(cmdName);

  if (!cfg.message)
    return interaction.reply({ content: `⚠️ No message set. Use \`/${cmdName} aktion:edit\` to configure.`, ephemeral: true });

  // Role check (admins bypass)
  if (!interaction.member.permissions.has('Administrator') && cfg.allowedRoles.length > 0) {
    const hasRole = cfg.allowedRoles.some(id => interaction.member.roles.cache.has(id));
    if (!hasRole)
      return interaction.reply({ content: '❌ You do not have permission to use this command.', ephemeral: true });
  }

  // Channel check (admins bypass)
  if (!interaction.member.permissions.has('Administrator') && cfg.allowedChannels.length > 0) {
    if (!cfg.allowedChannels.includes(interaction.channelId))
      return interaction.reply({ content: '❌ This command cannot be used here.', ephemeral: true });
  }

  // Cooldown check — only for gping and qping, admins bypass
  if (COOLDOWN_COMMANDS.has(cmdName) && !interaction.member.permissions.has('Administrator')) {
    const lastUsed = pingCooldowns.get(cmdName);
    if (lastUsed) {
      const expiresAt = lastUsed + COOLDOWN_MS;
      if (Date.now() < expiresAt) {
        const unixExpiry = Math.floor(expiresAt / 1000);
        return interaction.reply({
          content: `❌ **/${cmdName}** is on cooldown — available <t:${unixExpiry}:R> (at <t:${unixExpiry}:t>).`,
          ephemeral: true,
        });
      }
    }
  }

  if (COOLDOWN_COMMANDS.has(cmdName)) pingCooldowns.set(cmdName, Date.now());
  return interaction.reply({ content: cfg.message, allowedMentions: { parse: ['roles', 'users', 'everyone'] } });
}

// Button: ping_edit_msg:cmdname → open modal pre-filled with current message
async function handleButton(interaction) {
  const cmdName = interaction.customId.split(':')[1];
  if (!PING_COMMANDS.includes(cmdName)) return;

  const cfg = getCfg(cmdName);
  const input = new TextInputBuilder()
    .setCustomId('message')
    .setLabel('Message (@everyone pings allowed)')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMaxLength(2000);
  if (cfg.message) input.setValue(cfg.message);

  const modal = new ModalBuilder()
    .setCustomId(`ping_modal:${cmdName}`)
    .setTitle(`Message: /${cmdName}`)
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
