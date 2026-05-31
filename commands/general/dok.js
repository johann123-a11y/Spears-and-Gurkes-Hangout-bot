const {
  SlashCommandBuilder, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle,
} = require('discord.js');
const { checkPerm, parseTime, trackActivity } = require('../../utils');

// Active lobbies:  messageId → { participants, prize, channelId, channel, duration, round, ended }
const lobbies = new Map();
// Pending choices: gameId    → { winner, prize, channelId, channel, duration, round, client }
const pending = new Map();

// ── Prize helpers ─────────────────────────────────────────────────────────────
function parsePrize(prize) {
  const m = prize.trim().match(/^(\d+(?:\.\d+)?)\s*(k|m|b)?$/i);
  if (!m) return null;
  const num    = parseFloat(m[1]);
  const suffix = (m[2] || '').toLowerCase();
  const mult   = suffix === 'k' ? 1e3 : suffix === 'm' ? 1e6 : suffix === 'b' ? 1e9 : 1;
  return { raw: num * mult, suffix, display: prize.trim() };
}

function doublePrize(prize) {
  // Try k/m/b format first (e.g. "10m" → "20m")
  const p = parsePrize(prize);
  if (p) {
    const doubled = p.raw * 2;
    if (doubled >= 1e9 && doubled % 1e9 === 0) return `${doubled / 1e9}b`;
    if (doubled >= 1e6 && doubled % 1e6 === 0) return `${doubled / 1e6}m`;
    if (doubled >= 1e3 && doubled % 1e3 === 0) return `${doubled / 1e3}k`;
    if (doubled >= 1e9) return `${+(doubled / 1e9).toFixed(2)}b`;
    if (doubled >= 1e6) return `${+(doubled / 1e6).toFixed(2)}m`;
    if (doubled >= 1e3) return `${+(doubled / 1e3).toFixed(2)}k`;
    return `${doubled}`;
  }
  // Fallback: find any leading number and double it, keep the rest as-is
  // e.g. "15sec" → "30sec", "100 coins" → "200 coins"
  const numMatch = prize.trim().match(/^(\d+(?:\.\d+)?)(.*)/);
  if (numMatch) {
    const num    = parseFloat(numMatch[1]);
    const rest   = numMatch[2];
    const doubled = num % 1 === 0 ? (num * 2).toString() : (num * 2).toFixed(2).replace(/\.?0+$/, '');
    return `${doubled}${rest}`;
  }
  // No number found — just append x2
  return `${prize} x2`;
}

// ── Start a new lobby ─────────────────────────────────────────────────────────
async function startLobby(channel, prize, duration, round, client, previousWinner = null, hostUser = null) {
  const endsTs = Math.floor((Date.now() + duration) / 1000);

  const embed = new EmbedBuilder()
    .setColor('#FFD700')
    .setTitle(`💰 Double or Keep — Round ${round}`)
    .setDescription(
      `🏆 **Prize:** ${prize}\n` +
      `⏰ **Ends:** <t:${endsTs}:R>\n\n` +
      `Click **Join** to enter! One winner will choose to double the prize or keep it.`
    )
    .setFooter({ text: `Hosted by ${hostUser?.tag || 'Staff'}` })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`dok_join:placeholder`).setLabel('🎮 Join').setStyle(ButtonStyle.Primary),
  );

  const msg = await channel.send({ embeds: [embed], components: [row] });

  // Update button with real messageId
  const realRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`dok_join:${msg.id}`).setLabel('🎮 Join').setStyle(ButtonStyle.Primary),
  );
  await msg.edit({ components: [realRow] }).catch(() => {});

  lobbies.set(msg.id, {
    participants: [],
    prize,
    channel,
    channelId: channel.id,
    duration,
    round,
    previousWinner,
    ended: false,
    hostUser,
  });

  setTimeout(() => endLobby(msg.id, client), duration);
}

// ── End lobby → pick winner → show Double/Keep panel ─────────────────────────
async function endLobby(messageId, client) {
  const lobby = lobbies.get(messageId);
  if (!lobby || lobby.ended) return;
  lobby.ended = true;
  lobbies.delete(messageId);

  const channel = lobby.channel
    ?? await client.channels.fetch(lobby.channelId).catch(() => null);
  if (!channel) return;

  // Disable join button
  const lobbyMsg = await channel.messages.fetch(messageId).catch(() => null);
  if (lobbyMsg) {
    const disabled = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('dok_join_disabled').setLabel('Join').setStyle(ButtonStyle.Primary).setDisabled(true),
    );
    lobbyMsg.edit({ components: [disabled] }).catch(() => {});
  }

  if (lobby.participants.length === 0) {
    channel.send({ content: `Double or Keep — Round ${lobby.round} ended with no participants.` }).catch(() => {});
    return;
  }

  // Pick random winner
  const winner = lobby.participants[Math.floor(Math.random() * lobby.participants.length)];

  const gameId = `dok_${Date.now()}`;
  pending.set(gameId, {
    winner,
    previousWinner: lobby.previousWinner ?? null,
    prize:     lobby.prize,
    channel,
    channelId: lobby.channelId,
    duration:  lobby.duration,
    round:     lobby.round,
    client,
    msg:     null,
    timeout: null,
    hostUser: lobby.hostUser ?? null,
  });

  const embed = new EmbedBuilder()
    .setColor('#FFD700')
    .setTitle(`💰 Double or Keep — Round ${lobby.round}`)
    .setDescription(
      `Congratulations <@${winner}>!\n\n` +
      `🏆 **Current prize:** ${lobby.prize}\n` +
      `📈 **If doubled:** ${doublePrize(lobby.prize)}\n\n` +
      `What do you want to do?`
    )
    .setFooter({ text: `Hosted by ${lobby.hostUser?.tag || 'Staff'}` })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`dok_pick:${gameId}:double`).setLabel(`📈 Double — ${doublePrize(lobby.prize)}`).setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`dok_pick:${gameId}:keep`).setLabel(`💰 Keep — ${lobby.prize}`).setStyle(ButtonStyle.Primary),
  );

  const panelMsg = await channel.send({
    content: `<@${winner}>`,
    embeds: [embed],
    components: [row],
    allowedMentions: { users: [winner] },
  }).catch(() => null);

  if (panelMsg && pending.has(gameId)) {
    const game = pending.get(gameId);
    game.msg     = panelMsg;
    game.timeout = setTimeout(() => dokTimeout(gameId), 90_000);
  }
}

async function dokTimeout(gameId) {
  const game = pending.get(gameId);
  if (!game) return;
  pending.delete(gameId);

  const disabledRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('dok_d_d').setLabel(`📈 Double — ${doublePrize(game.prize)}`).setStyle(ButtonStyle.Success).setDisabled(true),
    new ButtonBuilder().setCustomId('dok_k_d').setLabel(`💰 Keep — ${game.prize}`).setStyle(ButtonStyle.Primary).setDisabled(true),
  );
  game.msg?.edit({ components: [disabledRow] }).catch(() => {});

  if (game.previousWinner) {
    game.channel.send({
      content: `<@${game.winner}> didn't respond in time. The previous winner <@${game.previousWinner}> takes the prize: **${game.prize}**!`,
    }).catch(() => {});
  } else {
    game.channel.send({
      content: `No one claimed the prize! The **${game.prize}** Double or Keep event has ended.`,
    }).catch(() => {});
  }
}

// ── Button handlers ───────────────────────────────────────────────────────────
module.exports = {
  name: 'dok',
  data: new SlashCommandBuilder()
    .setName('dok')
    .setDescription('Start a Double or Keep event [Staff Team]'),

  async executeSlash(interaction) {
    if (!checkPerm(interaction.member, 'dok'))
      return interaction.reply({ content: 'Only **Staff Team** can use this command.', ephemeral: true });

    const modal = new ModalBuilder()
      .setCustomId('dok_modal')
      .setTitle('Double or Keep');

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('dok_prize')
          .setLabel('Prize (e.g. 10m)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('10m')
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('dok_duration')
          .setLabel('Duration per round (e.g. 1m, 5m, 1h)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('5m')
          .setRequired(true)
      ),
    );

    return interaction.showModal(modal);
  },

  // ── Modal submit ─────────────────────────────────────────────────────────
  async handleModal(interaction) {
    const prize  = interaction.fields.getTextInputValue('dok_prize').trim();
    const durStr = interaction.fields.getTextInputValue('dok_duration').trim();
    const ms     = parseTime(durStr);
    if (!ms) return interaction.reply({ content: 'Invalid duration. Use e.g. `1m`, `5m`.', ephemeral: true });

    await interaction.reply({ content: 'Double or Keep event started!', ephemeral: true });
    trackActivity(interaction.user.id, interaction.user.tag, 'dok', { prize });
    await startLobby(interaction.channel, prize, ms, 1, interaction.client, null, { id: interaction.user.id, tag: interaction.user.tag });
  },

  // ── Join button ─────────────────────────────────────────────────────────
  async handleJoin(interaction) {
    const messageId = interaction.customId.split(':')[1];
    const lobby     = lobbies.get(messageId);
    if (!lobby || lobby.ended)
      return interaction.reply({ content: 'This lobby is no longer active.', ephemeral: true });
    if (lobby.participants.includes(interaction.user.id))
      return interaction.reply({ content: 'You are already in this lobby!', ephemeral: true });

    lobby.participants.push(interaction.user.id);
    return interaction.reply({ content: `You joined! (**${lobby.participants.length}** players so far)`, ephemeral: true });
  },

  // ── Double/Keep button ──────────────────────────────────────────────────
  async handlePick(interaction) {
    const [, gameId, pick] = interaction.customId.split(':');
    const game = pending.get(gameId);

    if (!game)
      return interaction.reply({ content: 'This choice is no longer active.', ephemeral: true });
    if (interaction.user.id !== game.winner)
      return interaction.reply({ content: 'Only the winner can make this choice!', ephemeral: true });

    clearTimeout(game.timeout);
    pending.delete(gameId);

    // Disable buttons
    const disabledRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('dok_d_d').setLabel(`📈 Double — ${doublePrize(game.prize)}`).setStyle(ButtonStyle.Success).setDisabled(true),
      new ButtonBuilder().setCustomId('dok_k_d').setLabel(`💰 Keep — ${game.prize}`).setStyle(ButtonStyle.Primary).setDisabled(true),
    );
    interaction.message.edit({ components: [disabledRow] }).catch(() => {});

    if (pick === 'keep') {
      const embed = new EmbedBuilder()
        .setColor('#57F287')
        .setTitle('Double or Keep — Result')
        .setDescription(
          `<@${game.winner}> chose to **Keep**!\n\n` +
          `💰 Prize: **${game.prize}**`
        )
        .setFooter({ text: `Hosted by ${game.hostUser?.tag || 'Staff'}` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

    } else {
      // Double → start new lobby
      const newPrize = doublePrize(game.prize);

      const embed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('Double or Keep — Doubled!')
        .setDescription(
          `<@${game.winner}> chose to **Double**!\n\n` +
          `📈 The prize is now **${newPrize}**!\n` +
          `A new round is starting...`
        )
        .setFooter({ text: `Hosted by ${game.hostUser?.tag || 'Staff'}` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
      await startLobby(game.channel, newPrize, game.duration, game.round + 1, game.client, game.winner, game.hostUser);
    }
  },

  lobbies,
  pending,
};
