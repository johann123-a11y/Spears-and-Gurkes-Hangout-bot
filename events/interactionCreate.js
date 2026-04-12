const { parseTime, readData, writeData, checkPerm, formatTime } = require('../utils');
const { createGiveaway } = require('../commands/giveaways/gstart');
const { setPerm, buildSetEmbed, LEVEL_CHOICES } = require('../commands/admin/perms');
const { setRole, buildSetEmbed: buildSetRoleEmbed, ROLE_KEYS } = require('../commands/admin/setrole');
const { handleStrike } = require('../commands/strikes/strike');
const {
  handleTicketOpen,
  handleTicketQuestionsModal,
  handleCloseButton,
  handleCloseModal,
} = require('../utils/ticketHandler');
const { buildDescEmbed, sendTicketOverview } = require('../commands/tickets/ticket');
const {
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ActionRowBuilder,
  ModalBuilder, TextInputBuilder, TextInputStyle, EmbedBuilder,
  ButtonBuilder, ButtonStyle, RoleSelectMenuBuilder, ChannelSelectMenuBuilder,
  ChannelType,
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

      // ── Strikes buttons ────────────────────────────────────────────────────
      if (interaction.customId.startsWith('strikes_add:')) {
        if (!checkPerm(interaction.member, 'strike'))
          return interaction.reply({ content: '❌ Only **SrMod+** can add strikes.', ephemeral: true });
        const userId = interaction.customId.split(':')[1];
        const modal  = new ModalBuilder()
          .setCustomId(`strikes_add_modal:${userId}`)
          .setTitle('Add Strike')
          .addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('reason').setLabel('Reason for strike').setStyle(TextInputStyle.Short).setRequired(true)
          ));
        return interaction.showModal(modal);
      }

      if (interaction.customId.startsWith('strikes_remove:')) {
        if (!checkPerm(interaction.member, 'strike'))
          return interaction.reply({ content: '❌ Only **SrMod+** can remove strikes.', ephemeral: true });
        const userId = interaction.customId.split(':')[1];
        const modal  = new ModalBuilder()
          .setCustomId(`strikes_remove_modal:${userId}`)
          .setTitle('Remove Strike')
          .addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('reason').setLabel('Reason for removal').setStyle(TextInputStyle.Short).setRequired(true)
          ));
        return interaction.showModal(modal);
      }

      // ── CheckLOA buttons ───────────────────────────────────────────────────
      if (interaction.customId.startsWith('checkloa_clear:')) {
        if (!checkPerm(interaction.member, 'checkloa'))
          return interaction.reply({ content: '❌ Only **Admins** can manage LOA.', ephemeral: true });
        const userId = interaction.customId.split(':')[1];
        const loa    = readData('loa.json');
        if (!loa[userId])
          return interaction.update({ content: '❌ This user is not on LOA.', embeds: [], components: [] });
        delete loa[userId];
        writeData('loa.json', loa);
        return interaction.update({ content: '✅ LOA cleared.', embeds: [], components: [] });
      }

      if (interaction.customId.startsWith('checkloa_set:')) {
        if (!checkPerm(interaction.member, 'checkloa'))
          return interaction.reply({ content: '❌ Only **Admins** can manage LOA.', ephemeral: true });
        const userId = interaction.customId.split(':')[1];
        const modal  = new ModalBuilder()
          .setCustomId(`checkloa_set_modal:${userId}`)
          .setTitle('Set LOA')
          .addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder().setCustomId('duration').setLabel('Duration (e.g. 3d, 1w, 12h)').setStyle(TextInputStyle.Short).setRequired(true)
            ),
            new ActionRowBuilder().addComponents(
              new TextInputBuilder().setCustomId('reason').setLabel('Reason').setStyle(TextInputStyle.Short).setRequired(true)
            ),
          );
        return interaction.showModal(modal);
      }

      // ── Ticket perms buttons ───────────────────────────────────────────────
      if (interaction.customId === 'ticket_perms_addping') {
        const roleSelect = new RoleSelectMenuBuilder()
          .setCustomId('ticket_perms_addping_select')
          .setPlaceholder('Select a role to add as ping role...');
        return interaction.update({
          content: 'Select a role to add as **Ping Role** (notified when a ticket opens):',
          embeds: [], components: [new ActionRowBuilder().addComponents(roleSelect)],
        });
      }

      if (interaction.customId === 'ticket_perms_addview') {
        const roleSelect = new RoleSelectMenuBuilder()
          .setCustomId('ticket_perms_addview_select')
          .setPlaceholder('Select a role to add as view role...');
        return interaction.update({
          content: 'Select a role to add as **View Role** (can see all ticket channels):',
          embeds: [], components: [new ActionRowBuilder().addComponents(roleSelect)],
        });
      }

      if (interaction.customId === 'ticket_perms_removeping') {
        const tickets   = readData('tickets.json');
        const pingRoles = tickets.perms?.pingRoles || [];
        if (pingRoles.length === 0)
          return interaction.update({ content: '❌ No ping roles configured.', embeds: [], components: [] });
        const menu = new StringSelectMenuBuilder()
          .setCustomId('ticket_perms_removeping_select')
          .setPlaceholder('Select a ping role to remove...')
          .addOptions(pingRoles.map(id => {
            const role = interaction.guild.roles.cache.get(id);
            return new StringSelectMenuOptionBuilder().setLabel(role ? role.name : id).setValue(id);
          }));
        return interaction.update({ content: 'Select a ping role to remove:', embeds: [], components: [new ActionRowBuilder().addComponents(menu)] });
      }

      if (interaction.customId === 'ticket_perms_removeview') {
        const tickets   = readData('tickets.json');
        const viewRoles = tickets.perms?.viewRoles || [];
        if (viewRoles.length === 0)
          return interaction.update({ content: '❌ No view roles configured.', embeds: [], components: [] });
        const menu = new StringSelectMenuBuilder()
          .setCustomId('ticket_perms_removeview_select')
          .setPlaceholder('Select a view role to remove...')
          .addOptions(viewRoles.map(id => {
            const role = interaction.guild.roles.cache.get(id);
            return new StringSelectMenuOptionBuilder().setLabel(role ? role.name : id).setValue(id);
          }));
        return interaction.update({ content: 'Select a view role to remove:', embeds: [], components: [new ActionRowBuilder().addComponents(menu)] });
      }

      if (interaction.customId === 'ticket_perms_clear') {
        const tickets = readData('tickets.json');
        tickets.perms = { pingRoles: [], viewRoles: [] };
        writeData('tickets.json', tickets);
        return interaction.update({ content: '✅ All ticket ping and view role settings cleared.', embeds: [], components: [] });
      }

      // ── Ticket logs buttons ────────────────────────────────────────────────
      if (interaction.customId === 'ticket_logs_remove_btn') {
        const tickets = readData('tickets.json');
        if (!tickets.logChannelId)
          return interaction.update({ content: '❌ No log channel is currently set.', embeds: [], components: [] });
        tickets.logChannelId = null;
        writeData('tickets.json', tickets);
        return interaction.update({ content: '✅ Ticket log channel removed.', embeds: [], components: [] });
      }

      // ── /ticket info navigation buttons ───────────────────────────────────
      if (interaction.customId === 'ticket_info_nav_desc') {
        const tickets = readData('tickets.json');
        const current = tickets.description || {};
        const previewEmbed = buildDescEmbed(current);
        previewEmbed.setTitle('📝 Ticket Description — Preview');
        const editBtn = new ButtonBuilder()
          .setCustomId('ticket_desc_edit_btn')
          .setLabel('✏️ Edit Description')
          .setStyle(ButtonStyle.Primary);
        const backBtn = new ButtonBuilder()
          .setCustomId('ticket_info_nav_back')
          .setLabel('← Back')
          .setStyle(ButtonStyle.Secondary);
        return interaction.update({ embeds: [previewEmbed], components: [new ActionRowBuilder().addComponents(editBtn, backBtn)] });
      }

      if (interaction.customId === 'ticket_info_nav_perms') {
        const tickets  = readData('tickets.json');
        const perms    = tickets.perms || { pingRoles: [], viewRoles: [] };
        const pingList = perms.pingRoles.length > 0 ? perms.pingRoles.map(id => `<@&${id}>`).join(', ') : 'None';
        const viewList = perms.viewRoles.length > 0 ? perms.viewRoles.map(id => `<@&${id}>`).join(', ') : 'None';
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('ticket_perms_addping').setLabel('➕ Ping').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId('ticket_perms_removeping').setLabel('➖ Ping').setStyle(ButtonStyle.Secondary).setDisabled(perms.pingRoles.length === 0),
          new ButtonBuilder().setCustomId('ticket_perms_addview').setLabel('➕ View').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('ticket_perms_removeview').setLabel('➖ View').setStyle(ButtonStyle.Secondary).setDisabled(perms.viewRoles.length === 0),
          new ButtonBuilder().setCustomId('ticket_perms_clear').setLabel('🗑️ Clear All').setStyle(ButtonStyle.Danger),
        );
        const backBtn = new ButtonBuilder().setCustomId('ticket_info_nav_back').setLabel('← Back').setStyle(ButtonStyle.Secondary);
        return interaction.update({
          embeds: [new EmbedBuilder()
            .setColor('#5865F2').setTitle('🔐 Ticket Permissions')
            .addFields(
              { name: '🔔 Ping Roles (notified on open)', value: pingList },
              { name: '👁️ View Roles (can see all tickets)', value: viewList },
            ).setFooter({ text: '➕ to add  •  ➖ to remove  •  🗑️ to clear all' }).setTimestamp()],
          components: [row, new ActionRowBuilder().addComponents(backBtn)],
        });
      }

      if (interaction.customId === 'ticket_info_nav_logs') {
        const tickets     = readData('tickets.json');
        const removeBtn   = new ButtonBuilder().setCustomId('ticket_logs_remove_btn').setLabel('🗑️ Remove Log Channel').setStyle(ButtonStyle.Danger).setDisabled(!tickets.logChannelId);
        const backBtn     = new ButtonBuilder().setCustomId('ticket_info_nav_back').setLabel('← Back').setStyle(ButtonStyle.Secondary);
        const channelSel  = new ChannelSelectMenuBuilder().setCustomId('ticket_logs_channel_select').setPlaceholder('Select a new log channel...').setChannelTypes(ChannelType.GuildText);
        return interaction.update({
          embeds: [new EmbedBuilder()
            .setColor('#5865F2').setTitle('📋 Ticket Log Channel')
            .setDescription(tickets.logChannelId ? `Currently logging to <#${tickets.logChannelId}>.` : '❌ No log channel configured.')
            .setTimestamp()],
          components: [
            new ActionRowBuilder().addComponents(removeBtn, backBtn),
            new ActionRowBuilder().addComponents(channelSel),
          ],
        });
      }

      if (interaction.customId === 'ticket_info_nav_back') {
        return sendTicketOverview(interaction, 'update');
      }

      if (interaction.customId === 'ticket_desc_edit_btn') {
        const tickets = readData('tickets.json');
        const current = tickets.description || {};
        const modal   = new ModalBuilder()
          .setCustomId('ticket_description_modal')
          .setTitle('Set Ticket Panel Description')
          .addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder().setCustomId('desc_title').setLabel('Title (e.g. Create Ticket)').setStyle(TextInputStyle.Short).setValue(current.title || 'Create Ticket').setRequired(true)
            ),
            new ActionRowBuilder().addComponents(
              new TextInputBuilder().setCustomId('desc_subtitle').setLabel('Subtitle — shown bold').setStyle(TextInputStyle.Short).setValue(current.subtitle || '').setRequired(false)
            ),
            new ActionRowBuilder().addComponents(
              new TextInputBuilder().setCustomId('desc_text').setLabel('Description — multiple lines & bullet points').setStyle(TextInputStyle.Paragraph).setValue(current.text || '').setPlaceholder('• Rule 1\n• Rule 2').setRequired(false)
            ),
            new ActionRowBuilder().addComponents(
              new TextInputBuilder().setCustomId('desc_footer').setLabel('Footer text (optional)').setStyle(TextInputStyle.Short).setValue(current.footer || '').setRequired(false)
            ),
          );
        return interaction.showModal(modal);
      }
    }

    // ── Modal submits ─────────────────────────────────────────────────────────
    if (interaction.isModalSubmit()) {
      // Giveaway modal
      if (interaction.customId === 'giveaway_modal') {
        const time        = interaction.fields.getTextInputValue('gw_time');
        const prize       = interaction.fields.getTextInputValue('gw_prize');
        const winnersRaw  = interaction.fields.getTextInputValue('gw_winners');
        const description = interaction.fields.getTextInputValue('gw_description') || 'No description provided.';
        const ms          = parseTime(time);
        const winners     = parseInt(winnersRaw);
        if (!ms)                             return interaction.reply({ content: '❌ Invalid time format.', ephemeral: true });
        if (isNaN(winners) || winners < 1)   return interaction.reply({ content: '❌ Winners must be a positive number.', ephemeral: true });
        await interaction.reply({ content: '✅ Giveaway started!', ephemeral: true });
        await createGiveaway(interaction.channel, ms, winners, prize, description, interaction.user.id);
        return;
      }

      // Ticket setup modal
      if (interaction.customId === 'ticket_setup_modal') {
        const name       = interaction.fields.getTextInputValue('setup_panelid').trim();
        const label      = interaction.fields.getTextInputValue('setup_label').trim();
        const colorRaw   = interaction.fields.getTextInputValue('setup_color').trim().toLowerCase();
        const categoryId = interaction.fields.getTextInputValue('setup_categoryid').trim().replace(/[^0-9]/g, '') || null;
        const questionsRaw = interaction.fields.getTextInputValue('setup_questions').trim();

        // Normalise color
        const colorMap = { blue: 'blue', green: 'green', red: 'red', gray: 'grey', grey: 'grey' };
        const color    = colorMap[colorRaw];
        if (!color)
          return interaction.reply({ content: '❌ Invalid color. Use: **Blue**, **Green**, **Red**, or **Gray**.', ephemeral: true });

        // Parse questions (one per line, max 5)
        const questions = questionsRaw
          ? questionsRaw.split('\n').map(q => q.trim()).filter(Boolean).slice(0, 5)
          : [];

        const tickets = readData('tickets.json');
        if (!tickets.panels) tickets.panels = {};
        const panelId = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');

        tickets.panels[panelId] = {
          id: panelId,
          name,
          buttonLabel: label,
          buttonStyle: color,
          categoryId,
          questions,
        };
        writeData('tickets.json', tickets);

        return interaction.reply({
          embeds: [new EmbedBuilder()
            .setColor('#57F287').setTitle('✅ Ticket Panel Created')
            .addFields(
              { name: 'Panel ID',     value: panelId,                                        inline: true },
              { name: 'Button',       value: `${label} (${color})`,                          inline: true },
              { name: 'Category',     value: categoryId ? `<#${categoryId}>` : 'None set',   inline: true },
              { name: 'Questions',    value: questions.length > 0 ? questions.map((q, i) => `${i + 1}. ${q}`).join('\n') : 'None' },
              { name: 'Next Steps',   value: `• Set description: \`/ticket description\`\n• Send panel: \`/ticket send panel:${panelId}\`\n• Group panels: \`/ticket group\`` },
            ).setTimestamp()],
          ephemeral: true,
        });
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

        const previewEmbed = buildDescEmbed(tickets.description);
        const infoEmbed    = new EmbedBuilder()
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

      // ── Strikes add/remove modals ──────────────────────────────────────────
      if (interaction.customId.startsWith('strikes_add_modal:')) {
        const userId = interaction.customId.split(':')[1];
        const reason = interaction.fields.getTextInputValue('reason');
        const member = await interaction.guild.members.fetch(userId).catch(() => null);
        if (!member) return interaction.reply({ content: '❌ User not found.', ephemeral: true });
        await interaction.deferReply();
        await handleStrike('add', member, reason, interaction.user, interaction.guild, null, interaction);
        return;
      }

      if (interaction.customId.startsWith('strikes_remove_modal:')) {
        const userId = interaction.customId.split(':')[1];
        const reason = interaction.fields.getTextInputValue('reason');
        const member = await interaction.guild.members.fetch(userId).catch(() => null);
        if (!member) return interaction.reply({ content: '❌ User not found.', ephemeral: true });
        await interaction.deferReply();
        await handleStrike('remove', member, reason, interaction.user, interaction.guild, null, interaction);
        return;
      }

      // ── CheckLOA set modal ─────────────────────────────────────────────────
      if (interaction.customId.startsWith('checkloa_set_modal:')) {
        const userId      = interaction.customId.split(':')[1];
        const durationStr = interaction.fields.getTextInputValue('duration');
        const reason      = interaction.fields.getTextInputValue('reason');
        const ms          = parseTime(durationStr);
        if (!ms) return interaction.reply({ content: '❌ Invalid duration. Use e.g. `3d`, `1w`, `12h`.', ephemeral: true });
        const member = await interaction.guild.members.fetch(userId).catch(() => null);
        if (!member) return interaction.reply({ content: '❌ User not found.', ephemeral: true });
        const loa = readData('loa.json');
        loa[userId] = { endTime: Date.now() + ms, reason, by: interaction.user.tag, username: member.user.tag };
        writeData('loa.json', loa);
        return interaction.reply({
          embeds: [new EmbedBuilder()
            .setColor('#5865F2').setTitle('🏖️ LOA Set')
            .addFields(
              { name: 'Staff Member', value: member.user.tag,      inline: true },
              { name: 'Duration',     value: formatTime(ms),       inline: true },
              { name: 'Set by',       value: interaction.user.tag, inline: true },
              { name: 'Reason',       value: reason },
            ).setTimestamp()],
          ephemeral: true,
        });
      }
    }

    // ── Role Select Menus ─────────────────────────────────────────────────────
    if (interaction.isRoleSelectMenu()) {
      // setrole: pick role for a slot
      if (interaction.customId.startsWith('setrole_pick_role:')) {
        if (!interaction.member.permissions.has('Administrator'))
          return interaction.reply({ content: '❌ No permission.', ephemeral: true });
        const slot   = interaction.customId.split(':')[1];
        const roleId = interaction.values[0];
        setRole(slot, roleId);
        return interaction.update({
          content: null,
          embeds: [new EmbedBuilder()
            .setColor('#57F287').setTitle('✅ Role Set')
            .addFields(
              { name: 'Slot', value: slot,            inline: true },
              { name: 'Role', value: `<@&${roleId}>`, inline: true },
            ).setTimestamp()],
          components: [],
        });
      }

      // ticket perms: add ping role
      if (interaction.customId === 'ticket_perms_addping_select') {
        const roleId  = interaction.values[0];
        const tickets = readData('tickets.json');
        if (!tickets.perms) tickets.perms = { pingRoles: [], viewRoles: [] };
        if (!tickets.perms.pingRoles.includes(roleId)) {
          tickets.perms.pingRoles.push(roleId);
          writeData('tickets.json', tickets);
          return interaction.update({ content: `✅ <@&${roleId}> added as ping role.`, embeds: [], components: [] });
        }
        return interaction.update({ content: `ℹ️ <@&${roleId}> is already a ping role.`, embeds: [], components: [] });
      }

      // ticket perms: add view role
      if (interaction.customId === 'ticket_perms_addview_select') {
        const roleId  = interaction.values[0];
        const tickets = readData('tickets.json');
        if (!tickets.perms) tickets.perms = { pingRoles: [], viewRoles: [] };
        if (!tickets.perms.viewRoles.includes(roleId)) {
          tickets.perms.viewRoles.push(roleId);
          writeData('tickets.json', tickets);
          return interaction.update({ content: `✅ <@&${roleId}> added as view role.`, embeds: [], components: [] });
        }
        return interaction.update({ content: `ℹ️ <@&${roleId}> already has view access.`, embeds: [], components: [] });
      }
    }

    // ── Channel Select Menus ──────────────────────────────────────────────────
    if (interaction.isChannelSelectMenu()) {
      // ticket logs: set log channel
      if (interaction.customId === 'ticket_logs_channel_select') {
        const channelId = interaction.values[0];
        const tickets   = readData('tickets.json');
        tickets.logChannelId = channelId;
        writeData('tickets.json', tickets);
        return interaction.update({ content: `✅ Ticket log channel set to <#${channelId}>.`, embeds: [], components: [] });
      }
    }

    // ── String Select Menus ───────────────────────────────────────────────────
    if (interaction.isStringSelectMenu()) {

      // ticket info panel picker (from /ticket info overview)
      if (interaction.customId === 'ticket_info_panel_picker') {
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

      // ticket group panel picker
      if (interaction.customId === 'ticket_group_select') {
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

      // ticket info edit picker
      if (interaction.customId.startsWith('ticket_info_edit:')) {
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

        // Remove question → show select menu with actual questions
        if (choice === 'removeq') {
          if (panel.questions.length === 0)
            return interaction.reply({ content: '❌ This panel has no questions.', ephemeral: true });
          const menu = new StringSelectMenuBuilder()
            .setCustomId(`ticket_removeq_select:${panelId}`)
            .setPlaceholder('Select a question to delete...')
            .addOptions(panel.questions.map((q, i) =>
              new StringSelectMenuOptionBuilder()
                .setLabel(`${i + 1}. ${q.substring(0, 90)}`)
                .setValue(String(i))
            ));
          return interaction.update({ content: '**Select the question to remove:**', embeds: [], components: [new ActionRowBuilder().addComponents(menu)] });
        }

        const modalMap = {
          label:    { title: 'Edit Button Label',    inputLabel: 'New button label', field: 'label'    },
          category: { title: 'Edit Category',        inputLabel: 'New Category ID',  field: 'category' },
          addq:     { title: 'Add Question',         inputLabel: 'Question text',    field: 'addq'     },
        };
        const m = modalMap[choice];
        if (!m) return;

        const modal = new ModalBuilder()
          .setCustomId(`ticket_edit_modal:${panelId}:${m.field}`)
          .setTitle(m.title)
          .addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('value').setLabel(m.inputLabel).setStyle(TextInputStyle.Short).setRequired(true)
          ));
        await interaction.showModal(modal);
        return;
      }

      // ticket color edit
      if (interaction.customId.startsWith('ticket_edit_color:')) {
        const panelId = interaction.customId.split(':')[1];
        const color   = interaction.values[0];
        const tickets = readData('tickets.json');
        if (!tickets.panels?.[panelId]) return interaction.update({ content: '❌ Panel not found.', embeds: [], components: [] });
        tickets.panels[panelId].buttonStyle = color;
        writeData('tickets.json', tickets);
        return interaction.update({ content: `✅ Button color updated to **${color}**.`, embeds: [], components: [] });
      }

      // perms command picker
      if (interaction.customId === 'perms_select_command') {
        if (!interaction.member.permissions.has('Administrator'))
          return interaction.reply({ content: '❌ No permission.', ephemeral: true });

        const selectedCmd = interaction.values[0];
        const levelMenu   = new StringSelectMenuBuilder()
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

      // perms level picker
      if (interaction.customId.startsWith('perms_select_level:')) {
        if (!interaction.member.permissions.has('Administrator'))
          return interaction.reply({ content: '❌ No permission.', ephemeral: true });

        const cmd   = interaction.customId.split(':')[1];
        const level = interaction.values[0];
        setPerm(cmd, level);
        return interaction.update({ content: null, embeds: [buildSetEmbed(cmd, level)], components: [] });
      }

      // setrole slot picker
      if (interaction.customId === 'setrole_pick_slot') {
        if (!interaction.member.permissions.has('Administrator'))
          return interaction.reply({ content: '❌ No permission.', ephemeral: true });

        const slot       = interaction.values[0];
        const roleSelect = new RoleSelectMenuBuilder()
          .setCustomId(`setrole_pick_role:${slot}`)
          .setPlaceholder(`Select the role for the "${slot}" slot...`);

        return interaction.update({
          content: `Assign a Discord role to the **${slot}** slot:`,
          embeds: [],
          components: [new ActionRowBuilder().addComponents(roleSelect)],
        });
      }

      // ticket remove question select
      if (interaction.customId.startsWith('ticket_removeq_select:')) {
        const panelId = interaction.customId.split(':')[1];
        const index   = parseInt(interaction.values[0]);
        const tickets = readData('tickets.json');
        const panel   = tickets.panels?.[panelId];
        if (!panel) return interaction.update({ content: '❌ Panel not found.', embeds: [], components: [] });
        const removed = panel.questions.splice(index, 1)[0];
        writeData('tickets.json', tickets);
        return interaction.update({ content: `✅ Question removed:\n> ${removed}`, embeds: [], components: [] });
      }

      // ticket perms remove ping role
      if (interaction.customId === 'ticket_perms_removeping_select') {
        const roleId  = interaction.values[0];
        const tickets = readData('tickets.json');
        tickets.perms.pingRoles = (tickets.perms?.pingRoles || []).filter(id => id !== roleId);
        writeData('tickets.json', tickets);
        return interaction.update({ content: `✅ <@&${roleId}> removed from ping roles.`, embeds: [], components: [] });
      }

      // ticket perms remove view role
      if (interaction.customId === 'ticket_perms_removeview_select') {
        const roleId  = interaction.values[0];
        const tickets = readData('tickets.json');
        tickets.perms.viewRoles = (tickets.perms?.viewRoles || []).filter(id => id !== roleId);
        writeData('tickets.json', tickets);
        return interaction.update({ content: `✅ <@&${roleId}> removed from view roles.`, embeds: [], components: [] });
      }
    }
  },
};
