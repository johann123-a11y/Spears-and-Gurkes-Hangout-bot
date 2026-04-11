const { parseTime, formatTime } = require('../utils');
const { createGiveaway } = require('../commands/giveaways/gstart');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {
    // --- Slash commands ---
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command?.executeSlash) return;
      try {
        await command.executeSlash(interaction, client);
      } catch (err) {
        console.error(`Error in slash command ${interaction.commandName}:`, err);
        const msg = { content: '❌ An error occurred.', ephemeral: true };
        if (interaction.replied || interaction.deferred) {
          interaction.followUp(msg).catch(() => {});
        } else {
          interaction.reply(msg).catch(() => {});
        }
      }
      return;
    }

    // --- Modal submit (giveaway) ---
    if (interaction.isModalSubmit() && interaction.customId === 'giveaway_modal') {
      const time = interaction.fields.getTextInputValue('gw_time');
      const prize = interaction.fields.getTextInputValue('gw_prize');
      const winnersRaw = interaction.fields.getTextInputValue('gw_winners');
      const description = interaction.fields.getTextInputValue('gw_description') || 'No description provided.';

      const ms = parseTime(time);
      const winners = parseInt(winnersRaw);

      if (!ms) return interaction.reply({ content: '❌ Invalid time format.', ephemeral: true });
      if (isNaN(winners) || winners < 1) return interaction.reply({ content: '❌ Winners must be a positive number.', ephemeral: true });

      await interaction.reply({ content: '✅ Giveaway started!', ephemeral: true });
      await createGiveaway(interaction.channel, ms, winners, prize, description, interaction.user.id);
      return;
    }
  },
};
