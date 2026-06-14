const { SlashCommandBuilder } = require('discord.js');
const { handleEdit, handleSend } = require('../../utils/pingHandlers');

const COMMANDS = ['gping', 'gpingdaily', 'gpingweekly', 'qping', 'qpingstream', 'gpingmassive'];

module.exports = COMMANDS.map(cmdName => ({
  name: cmdName,
  data: new SlashCommandBuilder()
    .setName(cmdName)
    .setDescription(`${cmdName} — Nachricht senden oder konfigurieren`)
    .addStringOption(o =>
      o.setName('aktion')
        .setDescription('Leer lassen zum Senden | "edit" zum Konfigurieren')
        .setRequired(false)
        .addChoices({ name: 'edit — Konfigurieren', value: 'edit' })
    ),

  async executeSlash(interaction) {
    const action = interaction.options.getString('aktion');
    if (action === 'edit') return handleEdit(interaction, cmdName);
    return handleSend(interaction, cmdName);
  },
}));
