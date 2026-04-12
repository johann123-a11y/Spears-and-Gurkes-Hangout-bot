const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { checkPerm, readData, writeData } = require('../../utils');

module.exports = {
  name: 'welcome',
  description: 'Enable or disable the welcome message. [Admin Only]',
  data: new SlashCommandBuilder()
    .setName('welcome')
    .setDescription('Enable or disable welcome messages [Admin Only]')
    .addStringOption(o =>
      o.setName('action')
        .setDescription('enable or disable')
        .setRequired(true)
        .addChoices({ name: 'enable', value: 'enable' }, { name: 'disable', value: 'disable' })
    ),

  async execute(message, args) {
    if (!message.member.permissions.has("Administrator"))
      return message.reply('❌ Only **Admins** can use this command.');

    const action = args[0]?.toLowerCase();
    if (action !== 'enable' && action !== 'disable')
      return message.reply('Usage: `?welcome enable` or `?welcome disable`');

    respond(action, message.channel);
  },

  async executeSlash(interaction) {
    if (!interaction.member.permissions.has("Administrator"))
      return interaction.reply({ content: '❌ Only **Admins** can use this command.', ephemeral: true });

    respond(interaction.options.getString('action'), null, interaction);
  },
};

function respond(action, channel, interaction) {
  const data = readData('welcome.json');
  data.enabled = action === 'enable';
  writeData('welcome.json', data);

  const embed = new EmbedBuilder()
    .setColor(data.enabled ? '#57F287' : '#ED4245')
    .setTitle(`Welcome Messages ${data.enabled ? 'Enabled ✅' : 'Disabled ❌'}`)
    .setTimestamp();

  if (channel) channel.send({ embeds: [embed] });
  else if (interaction) interaction.reply({ embeds: [embed] });
}
