const { parseTime, readData, writeData } = require('../utils');
const { createGiveaway } = require('../commands/giveaways/gstart');
const { setPerm, buildSetEmbed, LEVEL_CHOICES } = require('../commands/admin/perms');
const {
  handleTicketOpen,
  handleTicketQuestionsModal,
  handleCloseButton,
  handleCloseModal,
} = require('../utils/ticketHandler');
const { buildDescEmbed } = require('../commands/tickets/ticket');
const {
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ActionRowBuilder,
  ModalBuilder, TextInputBuilder, TextInputStyle, EmbedBuilder,
  ButtonBuilder, ButtonStyle,
} = require('discord.js');

const BTN_STYLES = { blue: ButtonStyle.Primary, grey: ButtonStyle.Secondary, green: ButtonStyle.Success, red: ButtonStyle.Danger };

module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {

    // ── Slash commands ────────────────────────────────────────────────────────
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command?.executeSlash) return;
      try {
        await command.executeSlash(interaction, client);
      } catch (err) {
        console.error(`Error in slash command ${interaction.commandName}:`, err);
        const msg = { content: '❌ An error occurred.', ephemeral: true };
        if (interaction.replied || interaction.deferred) interaction.followUp(msg).catch(() => {});
        else interaction.reply(msg).catch(() => {});
      }
      return;
    }

    // ── Buttons ───────────────────────────────────────────────────────────────
    if (interaction.isButton()) {
      // Ticket panel open button
      if (interaction.customId.startsWith('ticket_open:'))
        return handleTicketOpen(interaction);

      // Ticket close button (inside ticket channel)
      if (interaction.customId === 'ticket_close_btn')
        return handleCloseButton(interaction);
    }

    // ── Modal submits ─────────────────────────────────────────────────────────
    if (interaction.isModalSubmit()) {
      // Giveaway modal
      if (interaction.customId === 'giveaway_modal') {
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

      // Ticket description modal
      if (interaction.customId === 'ticket_description_modal') {
        const title    = interaction.fields.getTextInputValue('desc_title');
        const subtitle = interaction.fields.getTextInputValue('desc_subtitle') || null;
        const text     = interaction.fields.getTextInputValue('desc_text')     || null;
        const footer   = interaction.fields.getTextInputValue('desc_footer')   || null;
        const tickets  = readData('tickets.json');
        tickets.description = { title, subtitle, text, footer };
        writeData('tickets.json', tickets);

        // Show preview
        const previewEmbed = buildDescEmbed(tickets.description);
        const infoEmbed = new EmbedBuilder()
          .setColor('#57F287').setTitle('✅ Description Updated')
          .setDescription('**Preview:**')
          .setFooter({ text: 'Use /ticket group or /ticket send to post the panel' })
          .setTimestamp();

        return interaction.reply({ embeds: [infoEmbed, previewEmbed], ephemeral: true });
      }

      // Ticket pre-open questions modal
      if (interaction.customId.startsWith('ticket_questions:'))
        return handleTicketQuestionsModal(interaction);

      // Ticket close reason modal
      if (interaction.customId === 'ticket_close_modal')
        return handleCloseModal(interaction);

      // Ticket panel edit modal
      if (interaction.customId.startsWith('ticket_edit_modal:')) {
        const [, panelId, field] = interaction.customId.split(':');
        const value   = interaction.fields.getTextInputValue('value');
        const tickets = readData('tickets.json');
        const panel   = tickets.panels?.[panelId];
        if (!panel) return interaction.reply({ content: '❌ Panel not found.', ephemeral: true });

        if (field === 'label') {
          panel.buttonLabel = value;
          writeData('tickets.json', tickets);
          return interaction.reply({ content: `✅ Button label updated to **${value}**.`, ephemeral: true });
        }
        if (field === 'category') {
          panel.categoryId = value.replace(/[<#>]/g, '');
          writeData('tickets.json', tickets);
          return interaction.reply({ content: `✅ Category updated.`, ephemeral: true });
        }
        if (field === 'addq') {
          if (panel.questions.length >= 5)
            return interaction.reply({ content: '❌ Maximum 5 questions per panel.', ephemeral: true });
          panel.questions.push(value);
          writeData('tickets.json', tickets);
          return interaction.reply({ content: `✅ Question **#${panel.questions.length}** added:\n> ${value}`, ephemeral: true });
        }
        if (field === 'removeq') {
          const num = parseInt(value);
          if (isNaN(num) || num < 1 || num > panel.questions.length)
            return interaction.reply({ content: `❌ Invalid number. Panel has **${panel.questions.length}** question(s).`, ephemeral: true });
          const removed = panel.questions.splice(num - 1, 1)[0];
          writeData('tickets.json', tickets);
          return interaction.reply({ content: `✅ Removed question #${num}:\n> ${removed}`, ephemeral: true });
        }
        return;
      }
    }

    // ── Select Menu: ticket info panel picker (from /ticket info overview) ───
    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_info_panel_picker') {
      const panelId = interaction.values[0];
      const tickets = readData('tickets.json');
      const panel   = tickets.panels?.[panelId];
      if (!panel) return interaction.update({ content: '❌ Panel no longer exists.', embeds: [], components: [] });

      const embed = new EmbedBuilder()
        .setColor('#5865F2').setTitle(`🎫 Panel: ${panel.name}`)
        .addFields(
          { name: 'Button Label', value: panel.buttonLabel,        inline: true },
          { name: 'Color',        value: panel.buttonStyle,        inline: true },
          { name: 'Category',     value: `<#${panel.categoryId}>`, inline: true },
          { name: 'Questions',    value: panel.questions.length > 0
            ? panel.questions.map((q, i) => `${i + 1}. ${q}`).join('\n') : 'None' },
        ).setTimestamp();

      const editMenu = new StringSelectMenuBuilder()
        .setCustomId(`ticket_info_edit:${panel.id}`)
        .setPlaceholder('✏️ Edit this panel...')
        .addOptions(
          new StringSelectMenuOptionBuilder().setLabel('Button Label').setValue('label').setDescription('Change the button text').setEmoji('🏷️'),
          new StringSelectMenuOptionBuilder().setLabel('Button Color').setValue('color').setDescription('Change button color').setEmoji('🎨'),
          new StringSelectMenuOptionBuilder().setLabel('Category').setValue('category').setDescription('Change the ticket category ID').setEmoji('📁'),
          new StringSelectMenuOptionBuilder().setLabel('Add Question').setValue('addq').setDescription('Add a pre-open question').setEmoji('➕'),
          new StringSelectMenuOptionBuilder().setLabel('Remove Question').setValue('removeq').setDescription('Remove a question by number').setEmoji('➖'),
          new StringSelectMenuOptionBuilder().setLabel('Delete Panel').setValue('delete').setDescription('Permanently delete this panel').setEmoji('🗑️'),
        );

      return interaction.update({
        embeds: [embed],
        components: [new ActionRowBuilder().addComponents(editMenu)],
      });
    }

    // ── Select Menu: ticket group panel picker ────────────────────────────────
    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_group_select') {
      const selectedIds = interaction.values;
      const tickets     = readData('tickets.json');
      const selected    = selectedIds.map(id => tickets.panels?.[id]).filter(Boolean);

      if (selected.length === 0)
        return interaction.update({ content: '❌ No valid panels selected.', components: [] });

      const embed = buildDescEmbed(tickets.description);
      const rows  = [];
      let curRow  = new ActionRowBuilder();
      let count   = 0;

      for (const panel of selected) {
        if (count > 0 && count % 5 === 0) { rows.push(curRow); curRow = new ActionRowBuilder(); }
        curRow.addComponents(
          new ButtonBuilder()
            .setCustomId(`ticket_open:${panel.id}`)
            .setLabel(panel.buttonLabel)
            .setStyle(BTN_STYLES[panel.buttonStyle] || ButtonStyle.Primary)
        );
        count++;
      }
      rows.push(curRow);

      const sent = await interaction.channel.send({ embeds: [embed], components: rows });
      tickets.group = { enabled: true, channelId: interaction.channelId, messageId: sent.id };
      writeData('tickets.json', tickets);

      return interaction.update({ content: `✅ Grouped panel with **${selected.length}** panel(s) sent!`, components: [] });
    }

    // ── Select Menus: ticket info edit picker ────────────────────────────────
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('ticket_info_edit:')) {
      const panelId = interaction.customId.split(':')[1];
      const choice  = interaction.values[0];
      const tickets = readData('tickets.json');
      const panel   = tickets.panels?.[panelId];
      if (!panel) return interaction.reply({ content: '❌ Panel no longer exists.', ephemeral: true });

      if (choice === 'delete') {
        delete tickets.panels[panelId];
        writeData('tickets.json', tickets);
        return interaction.update({ content: `✅ Panel **${panel.name}** deleted.`, embeds: [], components: [] });
      }

      if (choice === 'color') {
        const colorMenu = new StringSelectMenuBuilder()
          .setCustomId(`ticket_edit_color:${panelId}`)
          .setPlaceholder('Select new button color...')
          .addOptions(
            new StringSelectMenuOptionBuilder().setLabel('🔵 Blue').setValue('blue'),
            new StringSelectMenuOptionBuilder().setLabel('⚫ Grey').setValue('grey'),
            new StringSelectMenuOptionBuilder().setLabel('🟢 Green').setValue('green'),
            new StringSelectMenuOptionBuilder().setLabel('🔴 Red').setValue('red'),
          );
        return interaction.update({ content: 'Select the new button color:', embeds: [], components: [new ActionRowBuilder().addComponents(colorMenu)] });
      }

      // All other choices → modal
      const modalMap = {
        label:    { title: 'Edit Button Label',    inputLabel: 'New button label',          field: 'label'    },
        category: { title: 'Edit Category',        inputLabel: 'New Category ID',           field: 'category' },
        addq:     { title: 'Add Question',         inputLabel: 'Question text',             field: 'addq'     },
        removeq:  { title: 'Remove Question',      inputLabel: 'Question number to remove', field: 'removeq'  },
      };
      const m = modalMap[choice];
      if (!m) return;

      const modal = new ModalBuilder()
        .setCustomId(`ticket_edit_modal:${panelId}:${m.field}`)
        .setTitle(m.title)
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('value')
              .setLabel(m.inputLabel)
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
          )
        );
      await interaction.showModal(modal);
      return;
    }

    // ── Select Menus: ticket color edit ──────────────────────────────────────
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('ticket_edit_color:')) {
      const panelId = interaction.customId.split(':')[1];
      const color   = interaction.values[0];
      const tickets = readData('tickets.json');
      if (!tickets.panels?.[panelId]) return interaction.update({ content: '❌ Panel not found.', embeds: [], components: [] });
      tickets.panels[panelId].buttonStyle = color;
      writeData('tickets.json', tickets);
      return interaction.update({ content: `✅ Button color updated to **${color}**.`, embeds: [], components: [] });
    }

    // ── Select Menus: perms command picker ────────────────────────────────────
    if (interaction.isStringSelectMenu() && interaction.customId === 'perms_select_command') {
      if (!interaction.member.permissions.has('Administrator'))
        return interaction.reply({ content: '❌ No permission.', ephemeral: true });

      const selectedCmd = interaction.values[0];
      const levelMenu = new StringSelectMenuBuilder()
        .setCustomId(`perms_select_level:${selectedCmd}`)
        .setPlaceholder(`Select new permission for "${selectedCmd}"...`)
        .addOptions(LEVEL_CHOICES.map(l =>
          new StringSelectMenuOptionBuilder().setLabel(l.label).setValue(l.value)
        ));

      return interaction.reply({
        content: `What permission level should **\`${selectedCmd}\`** require?`,
        components: [new ActionRowBuilder().addComponents(levelMenu)],
        ephemeral: true,
      });
    }

    // ── Select Menus: perms level picker ─────────────────────────────────────
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('perms_select_level:')) {
      if (!interaction.member.permissions.has('Administrator'))
        return interaction.reply({ content: '❌ No permission.', ephemeral: true });

      const cmd = interaction.customId.split(':')[1];
      const level = interaction.values[0];
      setPerm(cmd, level);
      return interaction.update({
        content: null,
        embeds: [buildSetEmbed(cmd, level)],
        components: [],
      });
    }
  },
};
