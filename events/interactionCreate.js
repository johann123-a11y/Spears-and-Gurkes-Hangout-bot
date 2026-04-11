const { parseTime } = require('../utils');
const { createGiveaway } = require('../commands/giveaways/gstart');
const { setPerm, buildSetEmbed, LEVEL_CHOICES } = require('../commands/admin/perms');
const {
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ActionRowBuilder, EmbedBuilder
} = require('discord.js');

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

    // --- Select Menu: perms command picker ---
    if (interaction.isStringSelectMenu() && interaction.customId === 'perms_select_command') {
      if (!interaction.member.permissions.has('Administrator'))
        return interaction.reply({ content: '❌ Keine Berechtigung.', ephemeral: true });

      const selectedCmd = interaction.values[0];
      const levelMenu = new StringSelectMenuBuilder()
        .setCustomId(`perms_select_level:${selectedCmd}`)
        .setPlaceholder(`Neue Berechtigung für "${selectedCmd}" wählen...`)
        .addOptions(LEVEL_CHOICES.map(l =>
          new StringSelectMenuOptionBuilder().setLabel(l.label).setValue(l.value)
        ));

      return interaction.reply({
        content: `Welche Berechtigung soll **\`${selectedCmd}\`** bekommen?`,
        components: [new ActionRowBuilder().addComponents(levelMenu)],
        ephemeral: true,
      });
    }

    // --- Select Menu: perms level picker ---
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('perms_select_level:')) {
      if (!interaction.member.permissions.has('Administrator'))
        return interaction.reply({ content: '❌ Keine Berechtigung.', ephemeral: true });

      const cmd = interaction.customId.split(':')[1];
      const level = interaction.values[0];
      setPerm(cmd, level);
      return interaction.update({
        content: null,
        embeds: [buildSetEmbed(cmd, level)],
        components: [],
      });
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
