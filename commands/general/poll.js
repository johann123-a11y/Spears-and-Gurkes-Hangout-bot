const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { checkPerm } = require('../../utils');

const NUMBER_EMOJIS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];

module.exports = {
  name: 'poll',
  data: new SlashCommandBuilder()
    .setName('poll')
    .setDescription('Create a reaction poll [Staff]')
    .addSubcommand(sub =>
      sub.setName('create')
        .setDescription('Create a poll — users vote by clicking the number reactions')
        .addStringOption(o => o.setName('question').setDescription('Poll question').setRequired(true))
        .addStringOption(o => o.setName('option1').setDescription('Option 1').setRequired(true))
        .addStringOption(o => o.setName('option2').setDescription('Option 2').setRequired(true))
        .addStringOption(o => o.setName('option3').setDescription('Option 3').setRequired(false))
        .addStringOption(o => o.setName('option4').setDescription('Option 4').setRequired(false))
        .addStringOption(o => o.setName('option5').setDescription('Option 5').setRequired(false))
        .addStringOption(o => o.setName('option6').setDescription('Option 6').setRequired(false))
        .addStringOption(o => o.setName('option7').setDescription('Option 7').setRequired(false))
        .addStringOption(o => o.setName('option8').setDescription('Option 8').setRequired(false))
        .addStringOption(o => o.setName('option9').setDescription('Option 9').setRequired(false))
    ),

  async executeSlash(interaction) {
    if (!checkPerm(interaction.member, 'poll'))
      return interaction.reply({ content: 'Only **Staff** can use this command.', ephemeral: true });

    const question = interaction.options.getString('question');

    const options = [];
    for (let i = 1; i <= 9; i++) {
      const opt = interaction.options.getString(`option${i}`);
      if (opt) options.push(opt);
    }

    const description = options
      .map((opt, i) => `${NUMBER_EMOJIS[i]}  ${opt}`)
      .join('\n\n');

    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle('📊 ' + question)
      .setDescription(description)
      .setFooter({ text: `Poll by ${interaction.user.tag} • Vote by clicking a reaction below` })
      .setTimestamp();

    await interaction.reply({ content: '✅ Poll created!', ephemeral: true });
    const msg = await interaction.channel.send({ embeds: [embed] });

    for (let i = 0; i < options.length; i++) {
      await msg.react(NUMBER_EMOJIS[i]);
    }
  },
};
