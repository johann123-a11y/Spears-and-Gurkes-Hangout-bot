const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { readData, writeData } = require('../../utils');

module.exports = {
  name: 'welcomemessage',
  description: 'Sets the welcome message. Variables: {member} {server} {membercount}. [Admin Only]',
  data: new SlashCommandBuilder()
    .setName('welcomemessage')
    .setDescription('Set the welcome message text [Admin Only]')
    .addStringOption(o =>
      o.setName('message')
        .setDescription('Message text. Variables: {member} {server} {membercount}')
        .setRequired(true)
    ),

  async execute(message, args) {
    if (!message.member.permissions.has("Administrator"))
      return message.reply('❌ Only **Admins** can use this command.');

    const msg = args.join(' ');
    if (!msg) return message.reply('Usage: `?welcomemessage {message}` — Variables: `{member}` `{server}` `{membercount}`');

    respond(msg, message.channel);
  },

  async executeSlash(interaction) {
    if (!interaction.member.permissions.has("Administrator"))
      return interaction.reply({ content: '❌ Only **Admins** can use this command.', ephemeral: true });

    respond(interaction.options.getString('message'), null, interaction);
  },
};

function respond(msg, channel, interaction) {
  const data = readData('welcome.json');
  data.message = msg;
  writeData('welcome.json', data);

  const embed = new EmbedBuilder()
    .setColor('#57F287')
    .setTitle('✅ Welcome Message Updated')
    .addFields({ name: 'New Message', value: msg })
    .setFooter({ text: 'Variables: {member} {server} {membercount}' })
    .setTimestamp();

  if (channel) channel.send({ embeds: [embed] });
  else if (interaction) interaction.reply({ embeds: [embed] });
}
