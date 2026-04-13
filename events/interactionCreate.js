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
const { startApplication, handleDMButton } = require('../utils/applicationDM');
const { getAppId } = require('../commands/applications/application');
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

      // ── Application: yes/no DM buttons ────────────────────────────────────
      if (interaction.customId.startsWith('app_answer_yes:'))
        return handleDMButton(interaction, 'Yes');
      if (interaction.customId.startsWith('app_answer_no:'))
        return handleDMButton(interaction, 'No');

      // ── Application: question builder buttons ──────────────────────────────
      if (interaction.customId.startsWith('app_addq_yesno:')) {
        const panelId = interaction.customId.split(':')[1];
        const modal   = new ModalBuilder()
          .setCustomId(`app_addq_modal:${panelId}:yesno`)
          .setTitle('Add Yes/No Question')
          .addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('question').setLabel('Question text').setStyle(TextInputStyle.Short).setRequired(true)
          ));
        return interaction.showModal(modal);
      }

      if (interaction.customId.startsWith('app_addq_text:')) {
        const panelId = interaction.customId.split(':')[1];
        const modal   = new ModalBuilder()
          .setCustomId(`app_addq_modal:${panelId}:text`)
          .setTitle('Add Text Answer Question')
          .addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('question').setLabel('Question text').setStyle(TextInputStyle.Short).setRequired(true)
          ));
        return interaction.showModal(modal);
      }

      if (interaction.customId.startsWith('app_addq_done:')) {
        return interaction.update({ content: '✅ Questions saved! Use `/application group` and `/application open` to publish.', embeds: [], components: [] });
      }

      // ── Application: action buttons on result ──────────────────────────────
      if (interaction.customId.startsWith('app_accept:')) {
        const resultId = interaction.customId.split(':')[1];
        const modal    = new ModalBuilder()
          .setCustomId(`app_accept_modal:${resultId}`)
          .setTitle('Accept Application')
          .addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('reason').setLabel('Reason for acceptance').setStyle(TextInputStyle.Paragraph).setRequired(true)
          ));
        return interaction.showModal(modal);
      }

      if (interaction.customId.startsWith('app_deny:')) {
        const resultId = interaction.customId.split(':')[1];
        const modal    = new ModalBuilder()
          .setCustomId(`app_deny_modal:${resultId}`)
          .setTitle('Deny Application')
          .addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('reason').setLabel('Reason for denial').setStyle(TextInputStyle.Paragraph).setRequired(true)
          ));
        return interaction.showModal(modal);
      }

      if (interaction.customId.startsWith('app_warnhistory:')) {
        const userId = interaction.customId.split(':')[1];
        await interaction.deferReply({ ephemeral: true });
        try {
          const [bans, timeouts, kicks] = await Promise.all([
            interaction.guild.bans.fetch().catch(() => new Map()),
            interaction.guild.fetchAuditLogs({ type: 24, limit: 10 }).catch(() => null), // MEMBER_UPDATE (timeout)
            interaction.guild.fetchAuditLogs({ type: 20, limit: 10 }).catch(() => null), // MEMBER_KICK
          ]);

          const banEntry     = bans.get(userId);
          const timeoutLogs  = timeouts?.entries.filter(e => e.target?.id === userId) || [];
          const kickLogs     = kicks?.entries.filter(e => e.target?.id === userId) || [];

          const fields = [];
          if (banEntry) fields.push({ name: '🔨 Banned', value: banEntry.reason || 'No reason', inline: false });
          timeoutLogs.forEach(e => fields.push({ name: `🔇 Timeout by ${e.executor?.tag || '?'}`, value: e.reason || 'No reason', inline: false }));
          kickLogs.forEach(e => fields.push({ name: `👢 Kicked by ${e.executor?.tag || '?'}`, value: e.reason || 'No reason', inline: false }));

          const embed = new EmbedBuilder()
            .setColor(fields.length > 0 ? '#FF6B35' : '#57F287')
            .setTitle(`⚠️ Warn/Punishment History — <@${userId}>`)
            .setDescription(fields.length === 0 ? '✅ No recorded punishments found.' : null)
            .addFields(fields)
            .setFooter({ text: 'Based on Discord audit logs (last 10 entries each)' })
            .setTimestamp();

          return interaction.editReply({ embeds: [embed] });
        } catch (err) {
          return interaction.editReply({ content: `❌ Failed to fetch history: ${err.message}` });
        }
      }

      if (interaction.customId.startsWith('app_openticket:')) {
        const userId = interaction.customId.split(':')[1];
        const tickets = readData('tickets.json');
        const panels  = Object.values(tickets.panels || {});
        if (panels.length === 0)
          return interaction.reply({ content: '❌ No ticket panels configured. Use `/ticket setup` first.', ephemeral: true });

        // Open a ticket for the applicant using the first ticket panel
        const panel = panels[0];
        const { createTicketChannel } = require('../utils/ticketHandler');

        // Fetch the applicant as a guild member
        const member = await interaction.guild.members.fetch(userId).catch(() => null);
        if (!member)
          return interaction.reply({ content: '❌ Could not find this user in the server.', ephemeral: true });

        // Create a fake interaction-like object so we can reuse createTicketChannel
        const fakeInteraction = {
          guild:       interaction.guild,
          user:        member.user,
          client:      interaction.client,
          channelId:   interaction.channelId,
          channel:     interaction.channel,
          editReply:   (d) => interaction.editReply(d),
        };

        await interaction.deferReply({ ephemeral: true });
        await createTicketChannel(fakeInteraction, panel, []);
        return;
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

      // ── Review: submit button ────────────────────────────────────────────
      if (interaction.customId === 'review_submit_btn') {
        const modal = new ModalBuilder()
          .setCustomId('review_modal')
          .setTitle('Submit your Review')
          .addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId('review_title')
                .setLabel('Überschrift / Title')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setMaxLength(100)
            ),
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId('review_text')
                .setLabel('Deine Review / Your Review')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true)
                .setMaxLength(1000)
            ),
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId('review_rating')
                .setLabel('Bewertung / Rating (1-5 ⭐)')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setMaxLength(1)
            ),
          );
        return interaction.showModal(modal);
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

      // ── /send DM modal ────────────────────────────────────────────────────
      if (interaction.customId === 'send_dm_modal' || interaction.customId === 'send_dm_modal_test') {
        const isTest  = interaction.customId === 'send_dm_modal_test';
        const isLeave = false;
        const title    = interaction.fields.getTextInputValue('title');
        const subtitle = interaction.fields.getTextInputValue('subtitle') || null;
        const content  = interaction.fields.getTextInputValue('content');
        const footer   = interaction.fields.getTextInputValue('footer') || null;

        const embed = new EmbedBuilder()
          .setColor('#5865F2')
          .setTitle(title)
          .setDescription((subtitle ? `**${subtitle}**\n\n` : '') + content)
          .setFooter({ text: footer || interaction.guild.name })
          .setTimestamp();

        if (isTest) {
          try {
            await interaction.user.send({ embeds: [embed] });
            return interaction.reply({ content: '✅ Test-DM wurde dir geschickt!', ephemeral: true });
          } catch {
            return interaction.reply({ content: '❌ Konnte dir keine DM schicken — prüf ob deine DMs offen sind.', ephemeral: true });
          }
        }

        await interaction.reply({ content: `⏳ DMs werden verschickt...`, ephemeral: true });

        const guild = interaction.guild;
        const members = await guild.members.fetch();
        let sent = 0, failed = 0;
        for (const [, member] of members) {
          if (member.user.bot) continue;
          const ok = await member.user.send({ embeds: [embed] }).then(() => true).catch(() => false);
          if (ok) sent++; else failed++;
          if ((sent + failed) % 10 === 0) await new Promise(r => setTimeout(r, 1000));
        }

        return interaction.followUp({
          content: `✅ DM an **${sent}** Member verschickt. (${failed} fehlgeschlagen — DMs geschlossen)`,
          ephemeral: true,
        });
      }

      // ── Review panel modal (send / test) ─────────────────────────────────
      if (interaction.customId === 'review_panel_modal' || interaction.customId === 'review_panel_modal_test') {
        const isTest      = interaction.customId === 'review_panel_modal_test';
        const title       = interaction.fields.getTextInputValue('title');
        const description = interaction.fields.getTextInputValue('description');
        const footer      = interaction.fields.getTextInputValue('footer') || interaction.guild.name;

        const { EmbedBuilder: EB2, ActionRowBuilder: AR2, ButtonBuilder: BB2, ButtonStyle: BS2 } = require('discord.js');
        const embed = new EB2()
          .setColor('#5865F2')
          .setTitle(title)
          .setDescription(description)
          .setFooter({ text: isTest ? `${footer} — TEST` : footer })
          .setTimestamp();

        const row = new AR2().addComponents(
          new BB2().setCustomId('review_submit_btn').setLabel('Submit Review').setStyle(BS2.Primary).setEmoji('⭐'),
        );

        if (isTest) {
          try {
            await interaction.user.send({ embeds: [embed], components: [row] });
            return interaction.reply({ content: '✅ Test-DM wurde dir geschickt!', ephemeral: true });
          } catch {
            return interaction.reply({ content: '❌ Konnte dir keine DM schicken — prüf ob deine DMs offen sind.', ephemeral: true });
          }
        } else {
          await interaction.channel.send({ embeds: [embed], components: [row] });
          return interaction.reply({ content: '✅ Review-Panel gepostet!', ephemeral: true });
        }
      }

      // ── Review modal ──────────────────────────────────────────────────────
      if (interaction.customId === 'review_modal') {
        const title  = interaction.fields.getTextInputValue('review_title');
        const text   = interaction.fields.getTextInputValue('review_text');
        const rating = interaction.fields.getTextInputValue('review_rating').trim();
        const stars  = parseInt(rating);
        if (isNaN(stars) || stars < 1 || stars > 5)
          return interaction.reply({ content: '❌ Bewertung muss zwischen 1 und 5 sein.', ephemeral: true });

        const data = readData('review.json');
        if (!data.channel)
          return interaction.reply({ content: '❌ Kein Review-Channel konfiguriert. Frag einen Admin.', ephemeral: true });

        const channel = interaction.client.guilds.cache.get(interaction.guildId || data.guildId)
          ?.channels.cache.get(data.channel);
        if (!channel)
          return interaction.reply({ content: '❌ Review-Channel nicht gefunden.', ephemeral: true });

        const starStr = '⭐'.repeat(stars) + '☆'.repeat(5 - stars);
        const embed = new EmbedBuilder()
          .setColor('#FFD700')
          .setTitle(title)
          .setDescription(text)
          .addFields({ name: 'Bewertung', value: starStr })
          .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
          .setTimestamp();

        await channel.send({ embeds: [embed] });
        return interaction.reply({ content: '✅ Danke für deine Review!', ephemeral: true });
      }

      // ── Application: setup modal ───────────────────────────────────────────
      if (interaction.customId === 'app_setup_modal') {
        const name    = interaction.fields.getTextInputValue('app_name').trim();
        const forWhat = interaction.fields.getTextInputValue('app_for').trim();
        const apps    = readData('applications.json');
        if (!apps.panels) apps.panels = {};
        const panelId = getAppId(name);

        apps.panels[panelId] = { id: panelId, name, forWhat, questions: [] };
        writeData('applications.json', apps);

        return interaction.reply({
          embeds: [new EmbedBuilder()
            .setColor('#57F287').setTitle('✅ Application Created')
            .addFields(
              { name: 'Name',     value: name,    inline: true },
              { name: 'For',      value: forWhat, inline: true },
              { name: 'Questions', value: 'None yet — add them below!' },
            ).setTimestamp()],
          components: [new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`app_addq_yesno:${panelId}`).setLabel('➕ Yes/No Question').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`app_addq_text:${panelId}`).setLabel('➕ Text Question').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`app_addq_done:${panelId}`).setLabel('✅ Done').setStyle(ButtonStyle.Success),
          )],
          ephemeral: true,
        });
      }

      // ── Application: add question modal ───────────────────────────────────
      if (interaction.customId.startsWith('app_addq_modal:')) {
        const [, panelId, type] = interaction.customId.split(':');
        const questionText      = interaction.fields.getTextInputValue('question').trim();
        const apps              = readData('applications.json');
        const panel             = apps.panels?.[panelId];
        if (!panel) return interaction.reply({ content: '❌ Panel not found.', ephemeral: true });

        panel.questions.push({ text: questionText, type });
        writeData('applications.json', apps);

        const qList = panel.questions.map((q, i) => `${i + 1}. [${q.type === 'yesno' ? 'Yes/No' : 'Text'}] ${q.text}`).join('\n');

        return interaction.reply({
          embeds: [new EmbedBuilder()
            .setColor('#57F287').setTitle(`📋 ${panel.name} — Questions`)
            .addFields({ name: `${panel.questions.length} Question(s)`, value: qList })
            .setFooter({ text: 'Keep adding or click Done when finished' })
            .setTimestamp()],
          components: [new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`app_addq_yesno:${panelId}`).setLabel('➕ Yes/No Question').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`app_addq_text:${panelId}`).setLabel('➕ Text Question').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`app_addq_done:${panelId}`).setLabel('✅ Done').setStyle(ButtonStyle.Success),
          )],
          ephemeral: true,
        });
      }

      // ── Application: description modal ────────────────────────────────────
      if (interaction.customId === 'app_description_modal') {
        const title  = interaction.fields.getTextInputValue('app_desc_title');
        const text   = interaction.fields.getTextInputValue('app_desc_text')   || null;
        const footer = interaction.fields.getTextInputValue('app_desc_footer') || null;
        const apps   = readData('applications.json');
        apps.description = { title, text, footer };
        writeData('applications.json', apps);
        return interaction.reply({ content: '✅ Description saved! Use `/application open` to send the panel.', ephemeral: true });
      }

      // ── Application: accept modal ─────────────────────────────────────────
      if (interaction.customId.startsWith('app_accept_modal:')) {
        const resultId = interaction.customId.split(':')[1];
        const reason   = interaction.fields.getTextInputValue('reason');
        const results  = readData('applicationResults.json');
        const result   = results[resultId];
        if (!result) return interaction.reply({ content: '❌ Application not found.', ephemeral: true });

        result.status       = 'accepted';
        result.reviewedBy   = interaction.user.tag;
        result.reviewReason = reason;
        writeData('applicationResults.json', results);

        const resultEmbed = new EmbedBuilder()
          .setColor('#57F287').setTitle('✅ Application Accepted')
          .addFields(
            { name: '👤 Applicant',   value: result.username,         inline: true },
            { name: '📋 For',         value: result.forWhat,          inline: true },
            { name: '✅ Accepted by', value: interaction.user.tag,    inline: true },
            { name: 'Reason',         value: reason },
          ).setTimestamp();

        // DM the applicant
        try {
          const user = await interaction.client.users.fetch(result.userId);
          await user.send({
            embeds: [new EmbedBuilder()
              .setColor('#57F287').setTitle('✅ Application Accepted!')
              .setDescription(
                `You got **accepted** as **${result.forWhat}** by <@${interaction.user.id}>!\n\n**Reason:** ${reason}`
              ).setTimestamp()],
          });
        } catch { /* DMs closed */ }

        // Post to accepted channel
        const apps = readData('applications.json');
        if (apps.channels?.accepted) {
          const ch = interaction.client.channels.cache.get(apps.channels.accepted);
          if (ch) await ch.send({ embeds: [resultEmbed] }).catch(() => {});
        }

        return interaction.update({ embeds: [resultEmbed], components: [] });
      }

      // ── Application: deny modal ───────────────────────────────────────────
      if (interaction.customId.startsWith('app_deny_modal:')) {
        const resultId = interaction.customId.split(':')[1];
        const reason   = interaction.fields.getTextInputValue('reason');
        const results  = readData('applicationResults.json');
        const result   = results[resultId];
        if (!result) return interaction.reply({ content: '❌ Application not found.', ephemeral: true });

        result.status       = 'denied';
        result.reviewedBy   = interaction.user.tag;
        result.reviewReason = reason;
        writeData('applicationResults.json', results);

        const resultEmbed = new EmbedBuilder()
          .setColor('#ED4245').setTitle('❌ Application Denied')
          .addFields(
            { name: '👤 Applicant', value: result.username,       inline: true },
            { name: '📋 For',       value: result.forWhat,        inline: true },
            { name: '❌ Denied by', value: interaction.user.tag,  inline: true },
            { name: 'Reason',       value: reason },
          ).setTimestamp();

        // DM the applicant
        try {
          const user = await interaction.client.users.fetch(result.userId);
          await user.send({
            embeds: [new EmbedBuilder()
              .setColor('#ED4245').setTitle('❌ Application Denied')
              .setDescription(
                `You got **denied** as **${result.forWhat}** by <@${interaction.user.id}>.\n\n**Reason:** ${reason}`
              ).setTimestamp()],
          });
        } catch { /* DMs closed */ }

        // Post to denied channel
        const apps = readData('applications.json');
        if (apps.channels?.denied) {
          const ch = interaction.client.channels.cache.get(apps.channels.denied);
          if (ch) await ch.send({ embeds: [resultEmbed] }).catch(() => {});
        }

        return interaction.update({ embeds: [resultEmbed], components: [] });
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

      // review: set channel
      if (interaction.customId === 'review_channel_select') {
        const channelId = interaction.values[0];
        const data      = readData('review.json');
        data.channel    = channelId;
        data.guildId    = interaction.guildId;
        writeData('review.json', data);
        return interaction.update({ content: `✅ Reviews werden in <#${channelId}> gepostet.`, embeds: [], components: [] });
      }
    }

    // ── String Select Menus ───────────────────────────────────────────────────
    if (interaction.isStringSelectMenu()) {

      // ── Application: user selects which app to apply for ──────────────────
      if (interaction.customId === 'app_apply_select') {
        const panelId = interaction.values[0];
        return startApplication(interaction, panelId);
      }

      // ── Application: group select ──────────────────────────────────────────
      if (interaction.customId === 'app_group_select') {
        const panelIds = interaction.values;
        const apps     = readData('applications.json');
        if (!apps.group) apps.group = {};
        apps.group.enabled  = true;
        apps.group.panelIds = panelIds;
        writeData('applications.json', apps);
        const names = panelIds.map(id => apps.panels?.[id]?.name || id).join(', ');
        return interaction.update({ content: `✅ Grouped **${panelIds.length}** application(s): ${names}\nNow use \`/application description\` and \`/application open\`.`, components: [] });
      }

      // ── Application: result picker ─────────────────────────────────────────
      if (interaction.customId === 'app_result_picker') {
        const resultId = interaction.values[0];
        const results  = readData('applicationResults.json');
        const result   = results[resultId];
        if (!result) return interaction.update({ content: '❌ Application not found.', embeds: [], components: [] });

        const embed = new EmbedBuilder()
          .setColor('#5865F2')
          .setTitle(`📋 Application — ${result.username}`)
          .addFields(
            { name: '👤 Applicant', value: `<@${result.userId}>`,                              inline: true },
            { name: '📋 Applied for', value: result.forWhat,                                   inline: true },
            { name: '🕐 Submitted',   value: `<t:${Math.floor(new Date(result.submittedAt) / 1000)}:F>`, inline: true },
            ...result.answers.map(a => ({ name: a.question, value: a.answer })),
          )
          .setThumbnail(`https://cdn.discordapp.com/embed/avatars/0.png`)
          .setTimestamp();

        try {
          const user = await interaction.client.users.fetch(result.userId);
          embed.setThumbnail(user.displayAvatarURL());
        } catch {}

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`app_accept:${resultId}`).setLabel('✅ Accept with Reason').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId(`app_deny:${resultId}`).setLabel('❌ Deny with Reason').setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId(`app_warnhistory:${result.userId}`).setLabel('⚠️ Warn History').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId(`app_openticket:${result.userId}`).setLabel('🎫 Open Ticket').setStyle(ButtonStyle.Primary),
        );

        return interaction.update({ embeds: [embed], components: [row] });
      }

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
      if (interaction.customId === 'perms_select_command_a' || interaction.customId === 'perms_select_command_b') {
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
