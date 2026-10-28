const {
  SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder, ActionRowBuilder,
  RoleSelectMenuBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle,
} = require('discord.js');
const { readData, writeData } = require('../../utils');

const MAX_ROLES   = 20; // Discord allows max 20 different reactions per message
const BATCH       = 5;  // Max text inputs per modal
const SESSION_TTL = 15 * 60 * 1000;

// Setup sessions: sessionId -> { userId, channelId, title, description, roles: [{ id, name }], emojis: { roleId: { react, display } } }
const sessions = new Map();

// Accepts unicode emojis, <:name:id>, :name: / name of a server emoji, or a server emoji ID
function parseEmoji(input, guild) {
  const raw = input.trim();
  if (!raw) return null;

  const custom = raw.match(/^<(a?):(\w+):(\d+)>$/);
  if (custom) return { react: custom[3], display: raw };

  const name = raw.replace(/^:|:$/g, '');
  const guildEmoji = guild.emojis.cache.get(raw) ?? guild.emojis.cache.find(e => e.name === name);
  if (guildEmoji) return { react: guildEmoji.id, display: guildEmoji.toString() };

  if (!/\s/.test(raw) && raw.length <= 16 && /^(\p{Extended_Pictographic}|\p{Regional_Indicator}|[#*0-9]️?⃣)/u.test(raw))
    return { react: raw, display: raw };

  return null;
}

function isComplete(session) {
  return session.roles.length > 0 && session.roles.every(r => session.emojis[r.id]);
}

function buildSetupView(sid, session, notice = null) {
  const complete = isComplete(session);
  const roleList = session.roles.length
    ? session.roles.map(r => `${session.emojis[r.id]?.display ?? '❔'}  <@&${r.id}>`).join('\n')
    : `*Select the roles below (max ${MAX_ROLES}).*`;

  const embed = new EmbedBuilder()
    .setColor('#5865F2')
    .setTitle('Reaction Role Setup')
    .setDescription(`**Channel:** <#${session.channelId}>\n**Title:** ${session.title}\n\n${roleList}`)
    .setFooter({ text: complete ? 'All emojis set — press Send.' : 'Select roles, set an emoji for each one, then press Send.' });
  if (notice) embed.addFields({ name: '⚠️ Notice', value: notice.substring(0, 1024) });

  const roleSelect = new RoleSelectMenuBuilder()
    .setCustomId(`rr_roles:${sid}`)
    .setPlaceholder('Select roles...')
    .setMinValues(1)
    .setMaxValues(MAX_ROLES);
  if (session.roles.length) roleSelect.setDefaultRoles(session.roles.map(r => r.id));
  const rows = [new ActionRowBuilder().addComponents(roleSelect)];

  if (session.roles.length) {
    const emojiRow = new ActionRowBuilder();
    for (let i = 0; i < session.roles.length; i += BATCH) {
      const end = Math.min(i + BATCH, session.roles.length);
      emojiRow.addComponents(new ButtonBuilder()
        .setCustomId(`rr_emoji:${sid}:${i}`)
        .setLabel(session.roles.length <= BATCH ? 'Set Emojis' : `Set Emojis ${i + 1}–${end}`)
        .setStyle(ButtonStyle.Primary));
    }
    rows.push(emojiRow);
  }

  rows.push(new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`rr_send:${sid}`).setLabel('Send').setStyle(ButtonStyle.Success).setDisabled(!complete),
    new ButtonBuilder().setCustomId(`rr_cancel:${sid}`).setLabel('Cancel').setStyle(ButtonStyle.Danger),
  ));

  return { embeds: [embed], components: rows };
}

// Handles all rr_* buttons, select menus and modals
async function handleInteraction(interaction) {
  const [action, sid, arg] = interaction.customId.split(':');
  const session = sessions.get(sid);
  if (!session)
    return interaction.reply({ content: 'This setup has expired. Run `/reactionrole` again.', ephemeral: true });
  if (interaction.user.id !== session.userId || !interaction.member.permissions.has(PermissionFlagsBits.Administrator))
    return interaction.reply({ content: 'No permission.', ephemeral: true });

  if (action === 'rr_roles') {
    const guild   = interaction.guild;
    const botTop  = guild.members.me.roles.highest.position;
    const valid   = [];
    const ignored = [];
    for (const id of interaction.values) {
      const role = guild.roles.cache.get(id);
      if (!role || role.id === guild.id || role.managed) ignored.push(`<@&${id}> (not assignable)`);
      else if (role.position >= botTop) ignored.push(`<@&${id}> (above my highest role)`);
      else valid.push({ id: role.id, name: role.name });
    }
    session.roles = valid;
    for (const roleId of Object.keys(session.emojis))
      if (!valid.some(r => r.id === roleId)) delete session.emojis[roleId];

    return interaction.update(buildSetupView(sid, session, ignored.length ? `Ignored: ${ignored.join(', ')}` : null));
  }

  if (action === 'rr_emoji') {
    const offset = parseInt(arg);
    const batch  = session.roles.slice(offset, offset + BATCH);
    const modal  = new ModalBuilder()
      .setCustomId(`rr_modal:${sid}:${offset}`)
      .setTitle(`Emojis for roles ${offset + 1}–${offset + batch.length}`);
    for (const role of batch) {
      const input = new TextInputBuilder()
        .setCustomId(`emoji_${role.id}`)
        .setLabel(`@${role.name}`.substring(0, 45))
        .setPlaceholder('e.g. 🎮 or :server_emoji:')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(100);
      if (session.emojis[role.id]) input.setValue(session.emojis[role.id].display);
      modal.addComponents(new ActionRowBuilder().addComponents(input));
    }
    return interaction.showModal(modal);
  }

  if (action === 'rr_modal') {
    const offset = parseInt(arg);
    const errors = [];
    for (const role of session.roles.slice(offset, offset + BATCH)) {
      const value = interaction.fields.getTextInputValue(`emoji_${role.id}`);
      const emoji = parseEmoji(value, interaction.guild);
      if (!emoji) {
        errors.push(`<@&${role.id}>: \`${value}\` is not a valid emoji`);
        continue;
      }
      const taken = session.roles.find(r => r.id !== role.id && session.emojis[r.id]?.react === emoji.react);
      if (taken) {
        errors.push(`<@&${role.id}>: ${emoji.display} is already used for <@&${taken.id}>`);
        continue;
      }
      session.emojis[role.id] = emoji;
    }
    return interaction.update(buildSetupView(sid, session, errors.length ? errors.join('\n') : null));
  }

  if (action === 'rr_cancel') {
    sessions.delete(sid);
    return interaction.update({ content: 'Reaction role setup cancelled.', embeds: [], components: [] });
  }

  if (action === 'rr_send') {
    if (!isComplete(session))
      return interaction.reply({ content: 'Set an emoji for every role first.', ephemeral: true });
    await interaction.deferUpdate();

    const channel = interaction.guild.channels.cache.get(session.channelId);
    if (!channel)
      return interaction.editReply(buildSetupView(sid, session, 'Target channel not found.'));

    const roleLines = session.roles.map(r => `${session.emojis[r.id].display}  —  <@&${r.id}>`).join('\n');
    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle(session.title)
      .setDescription(session.description ? `${session.description}\n\n${roleLines}` : roleLines)
      .setFooter({ text: 'React to get a role — remove your reaction to lose it.' });

    let message;
    try {
      message = await channel.send({ embeds: [embed] });
    } catch (err) {
      return interaction.editReply(buildSetupView(sid, session, `Could not send the message: ${err.message}`));
    }

    // Store the emoji key exactly as Discord reports it, so reaction events match reliably
    const entries = [];
    const failed  = [];
    for (const role of session.roles) {
      try {
        const reaction = await message.react(session.emojis[role.id].react);
        entries.push({ roleId: role.id, emoji: reaction.emoji.id ?? reaction.emoji.name });
      } catch {
        failed.push(role);
      }
    }

    if (failed.length) {
      await message.delete().catch(() => {});
      for (const role of failed) delete session.emojis[role.id];
      const list = failed.map(r => `<@&${r.id}>`).join(', ');
      return interaction.editReply(buildSetupView(sid, session, `I couldn't react with the emoji for ${list} (probably an emoji from another server). The message was deleted — set a different emoji and try again.`));
    }

    const data = readData('reactionroles.json');
    data[message.id] = { guildId: interaction.guild.id, channelId: channel.id, roles: entries };
    writeData('reactionroles.json', data);
    sessions.delete(sid);

    return interaction.editReply({ content: `✅ Reaction role message sent: ${message.url}`, embeds: [], components: [] });
  }
}

// Called from messageReactionAdd / messageReactionRemove
async function handleReaction(reaction, user, add) {
  if (user.bot) return;
  const entry = readData('reactionroles.json')[reaction.message.id];
  if (!entry) return;

  const key   = reaction.emoji.id ?? reaction.emoji.name;
  const match = entry.roles.find(r => r.emoji === key);
  if (!match) return;

  const guild  = reaction.client.guilds.cache.get(entry.guildId);
  const member = await guild?.members.fetch(user.id).catch(() => null);
  if (!member) return;

  const action = add ? member.roles.add(match.roleId, 'Reaction role') : member.roles.remove(match.roleId, 'Reaction role removed');
  await action.catch(err => console.error(`[ReactionRole] Failed to ${add ? 'add' : 'remove'} role ${match.roleId} for ${user.id}:`, err.message));
}

module.exports = {
  name: 'reactionrole',
  description: 'Create a reaction role message. [Admin Only]',
  handleInteraction,
  handleReaction,
  data: new SlashCommandBuilder()
    .setName('reactionrole')
    .setDescription('Create a reaction role message [Admin Only]')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption(o => o
      .setName('channel')
      .setDescription('Channel to send the message to (default: this channel)')
      .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
    )
    .addStringOption(o => o
      .setName('title')
      .setDescription('Embed title (default: Reaction Roles)')
      .setMaxLength(256)
    )
    .addStringOption(o => o
      .setName('description')
      .setDescription('Text shown above the role list')
      .setMaxLength(2000)
    ),

  async executeSlash(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator))
      return interaction.reply({ content: 'Only **Admins** can use this command.', ephemeral: true });

    const sid = interaction.id;
    const session = {
      userId: interaction.user.id,
      channelId: (interaction.options.getChannel('channel') ?? interaction.channel).id,
      title: interaction.options.getString('title') ?? 'Reaction Roles',
      description: interaction.options.getString('description'),
      roles: [],
      emojis: {},
    };
    sessions.set(sid, session);
    setTimeout(() => sessions.delete(sid), SESSION_TTL).unref();

    return interaction.reply({ ...buildSetupView(sid, session), ephemeral: true });
  },
};
