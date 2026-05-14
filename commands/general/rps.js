const {
  SlashCommandBuilder, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
} = require('discord.js');
const { checkPerm, parseTime, formatTime } = require('../../utils');

// Active lobbies: messageId → { participants: [], prize, channelId, guildId, endsAt, ended }
const lobbies = new Map();
// Active duels: gameId → { player1, player2, pick1, pick2, prize, channelId, messageId }
const duels   = new Map();

function rpsButtons(gameId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`rps_pick:${gameId}:rock`).setLabel('🪨 Rock').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`rps_pick:${gameId}:paper`).setLabel('📄 Paper').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`rps_pick:${gameId}:scissors`).setLabel('✂️ Scissors').setStyle(ButtonStyle.Secondary),
  );
}

function determineWinner(pick1, pick2) {
  if (pick1 === pick2) return 'tie';
  if (
    (pick1 === 'rock'     && pick2 === 'scissors') ||
    (pick1 === 'scissors' && pick2 === 'paper')    ||
    (pick1 === 'paper'    && pick2 === 'rock')
  ) return 'player1';
  return 'player2';
}

const EMOJI = { rock: '🪨', paper: '📄', scissors: '✂️' };

async function endLobby(messageId, client) {
  const lobby = lobbies.get(messageId);
  if (!lobby || lobby.ended) return;
  lobby.ended = true;

  const channel = await client.channels.fetch(lobby.channelId).catch(() => null);
  const lobbyMsg = channel ? await channel.messages.fetch(messageId).catch(() => null) : null;

  // Disable the join button
  if (lobbyMsg) {
    const disabledRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('rps_join_disabled').setLabel('🎟️ Join').setStyle(ButtonStyle.Primary).setDisabled(true),
    );
    lobbyMsg.edit({ components: [disabledRow] }).catch(() => {});
  }

  if (lobby.participants.length < 2) {
    channel?.send({ content: `**${lobby.prize}** RPS ended — not enough participants (need at least 2).` }).catch(() => {});
    lobbies.delete(messageId);
    return;
  }

  // Pick 2 random players
  const pool    = [...lobby.participants];
  const idx1    = Math.floor(Math.random() * pool.length);
  const [p1]    = pool.splice(idx1, 1);
  const idx2    = Math.floor(Math.random() * pool.length);
  const p2      = pool[idx2];

  const gameId  = `${messageId}_${Date.now()}`;
  duels.set(gameId, { player1: p1, player2: p2, pick1: null, pick2: null, prize: lobby.prize, channelId: lobby.channelId, msg: null, timeout: null });

  const embed = new EmbedBuilder()
    .setColor('#5865F2')
    .setTitle('⚔️ Rock Paper Scissors — FIGHT!')
    .setDescription(
      `🎁 Prize: **${lobby.prize}**\n\n` +
      `<@${p1}> vs <@${p2}>\n\n` +
      `Both players: pick your move below!\n` +
      `📄 **Paper** beats Rock · 🪨 **Rock** beats Scissors · ✂️ **Scissors** beats Paper`
    )
    .setTimestamp();

  if (channel) {
    const panelMsg = await channel.send({
      content: `<@${p1}> <@${p2}>`,
      embeds: [embed],
      components: [rpsButtons(gameId)],
      allowedMentions: { users: [p1, p2] },
    }).catch(() => null);

    if (panelMsg && duels.has(gameId)) {
      const duel = duels.get(gameId);
      duel.msg = panelMsg;
      duel.timeout = setTimeout(() => rpsTimeout(gameId, channel), 90_000);
    }
  }

  lobbies.delete(messageId);
}

async function rpsTimeout(gameId, channel) {
  const duel = duels.get(gameId);
  if (!duel) return;
  duels.delete(gameId);

  const disabledRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('rps_rock_d').setLabel('🪨 Rock').setStyle(ButtonStyle.Secondary).setDisabled(true),
    new ButtonBuilder().setCustomId('rps_paper_d').setLabel('📄 Paper').setStyle(ButtonStyle.Secondary).setDisabled(true),
    new ButtonBuilder().setCustomId('rps_scissors_d').setLabel('✂️ Scissors').setStyle(ButtonStyle.Secondary).setDisabled(true),
  );
  duel.msg?.edit({ components: [disabledRow] }).catch(() => {});

  if (duel.pick1 && !duel.pick2) {
    channel.send({ content: `<@${duel.player1}> wins — their opponent didn't respond in time! Prize: **${duel.prize}**` }).catch(() => {});
  } else if (!duel.pick1 && duel.pick2) {
    channel.send({ content: `<@${duel.player2}> wins — their opponent didn't respond in time! Prize: **${duel.prize}**` }).catch(() => {});
  } else {
    channel.send({ content: `No one claimed the prize! The **${duel.prize}** RPS event has ended.` }).catch(() => {});
  }
}

module.exports = {
  name: 'rps',
  data: new SlashCommandBuilder()
    .setName('rps')
    .setDescription('Rock Paper Scissors event [Staff Team]')
    .addSubcommand(sub =>
      sub.setName('start')
        .setDescription('Start an RPS event')
        .addStringOption(o => o.setName('prize').setDescription('Prize for the winner').setRequired(true))
        .addStringOption(o => o.setName('duration').setDescription('How long the lobby stays open (e.g. 1m, 5m, 1h)').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('end')
        .setDescription('Delete the active RPS lobby in this channel')
    )
    .addSubcommand(sub =>
      sub.setName('duel')
        .setDescription('Directly start an RPS duel between two users')
        .addUserOption(o => o.setName('user1').setDescription('First player').setRequired(true))
        .addUserOption(o => o.setName('user2').setDescription('Second player').setRequired(true))
        .addStringOption(o => o.setName('prize').setDescription('Prize for the winner (optional)').setRequired(false))
    ),

  async executeSlash(interaction) {
    if (!checkPerm(interaction.member, 'rps'))
      return interaction.reply({ content: 'Only **Staff Team** can use this command.', ephemeral: true });

    const sub = interaction.options.getSubcommand();

    // /rps start 
    if (sub === 'start') {
      const prize    = interaction.options.getString('prize');
      const durStr   = interaction.options.getString('duration');
      const ms       = parseTime(durStr);
      if (!ms) return interaction.reply({ content: 'Invalid duration. Use e.g. `1m`, `5m`, `1h`.', ephemeral: true });

      const endsAt   = Date.now() + ms;
      const endsTs   = Math.floor(endsAt / 1000);

      const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('🎮 Rock Paper Scissors Event!')
        .setDescription(
          `🎁 **Prize:** ${prize}\n` +
          `⏰ **Ends:** <t:${endsTs}:R>\n\n` +
          `Click **Join** to enter! 2 players will be picked to face off.`
        )
        .setFooter({ text: `Hosted by ${interaction.user.tag}` })
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`rps_join:placeholder`).setLabel('🎟️ Join').setStyle(ButtonStyle.Primary),
      );

      await interaction.reply({ embeds: [embed], components: [row] });
      const msg = await interaction.fetchReply();

      // Update button with real messageId
      const realRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`rps_join:${msg.id}`).setLabel('🎟️ Join').setStyle(ButtonStyle.Primary),
      );
      await msg.edit({ components: [realRow] }).catch(() => {});

      lobbies.set(msg.id, {
        participants: [],
        prize,
        channelId: interaction.channelId,
        guildId:   interaction.guildId,
        endsAt,
        ended: false,
      });

      setTimeout(() => endLobby(msg.id, interaction.client), ms);
    }

    // /rps end 
    if (sub === 'end') {
      // Find active lobby in this channel
      const entry = [...lobbies.entries()].find(([, l]) => l.channelId === interaction.channelId);
      if (!entry)
        return interaction.reply({ content: 'No active RPS lobby in this channel.', ephemeral: true });

      const [msgId, lobby] = entry;
      lobby.ended = true;
      lobbies.delete(msgId);

      // Delete the lobby message
      const msg = await interaction.channel.messages.fetch(msgId).catch(() => null);
      if (msg) await msg.delete().catch(() => {});

      return interaction.reply({ content: 'RPS lobby deleted.', ephemeral: true });
    }

    // /rps duel 
    if (sub === 'duel') {
      const user1 = interaction.options.getUser('user1');
      const user2 = interaction.options.getUser('user2');
      const prize = interaction.options.getString('prize') ?? null;

      if (user1.id === user2.id)
        return interaction.reply({ content: 'You cannot duel the same user twice!', ephemeral: true });
      if (user1.bot || user2.bot)
        return interaction.reply({ content: 'Bots cannot participate in duels.', ephemeral: true });

      const gameId = `duel_${interaction.id}`;
      duels.set(gameId, {
        player1: user1.id,
        player2: user2.id,
        pick1: null,
        pick2: null,
        prize,
        channelId: interaction.channelId,
        msg: null,
        timeout: null,
      });

      const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('⚔️ Rock Paper Scissors — FIGHT!')
        .setDescription(
          (prize ? `🎁 Prize: **${prize}**\n\n` : '') +
          `<@${user1.id}> vs <@${user2.id}>\n\n` +
          `Both players: pick your move below!\n` +
          `📄 **Paper** beats Rock · 🪨 **Rock** beats Scissors · ✂️ **Scissors** beats Paper`
        )
        .setTimestamp();

      await interaction.reply({
        content: `<@${user1.id}> <@${user2.id}>`,
        embeds: [embed],
        components: [rpsButtons(gameId)],
        allowedMentions: { users: [user1.id, user2.id] },
      });

      const panelMsg = await interaction.fetchReply().catch(() => null);
      if (panelMsg && duels.has(gameId)) {
        const duel = duels.get(gameId);
        duel.msg = panelMsg;
        duel.timeout = setTimeout(() => rpsTimeout(gameId, interaction.channel), 90_000);
      }
    }
  },

  // Button handlers (called from interactionCreate) 
  async handleJoin(interaction) {
    const messageId = interaction.customId.split(':')[1];
    const lobby     = lobbies.get(messageId);
    if (!lobby || lobby.ended)
      return interaction.reply({ content: 'This lobby is no longer active.', ephemeral: true });

    if (lobby.participants.includes(interaction.user.id))
      return interaction.reply({ content: 'You are already in this lobby!', ephemeral: true });

    lobby.participants.push(interaction.user.id);
    return interaction.reply({ content: `You joined the RPS lobby! (**${lobby.participants.length}** players so far)`, ephemeral: true });
  },

  async handlePick(interaction) {
    const [, gameId, pick] = interaction.customId.split(':');
    const duel = duels.get(gameId);

    if (!duel)
      return interaction.reply({ content: 'This game is no longer active.', ephemeral: true });

    const userId = interaction.user.id;
    if (userId !== duel.player1 && userId !== duel.player2)
      return interaction.reply({ content: 'You are not a participant in this duel.', ephemeral: true });

    const isP1 = userId === duel.player1;

    if (isP1 && duel.pick1)
      return interaction.reply({ content: `You already picked **${EMOJI[duel.pick1]} ${duel.pick1}**!`, ephemeral: true });
    if (!isP1 && duel.pick2)
      return interaction.reply({ content: `You already picked **${EMOJI[duel.pick2]} ${duel.pick2}**!`, ephemeral: true });

    if (isP1) duel.pick1 = pick; else duel.pick2 = pick;

    await interaction.reply({ content: `You picked **${EMOJI[pick]} ${pick}**! Waiting for your opponent...`, ephemeral: true });

    // Both picked → resolve
    if (duel.pick1 && duel.pick2) {
      clearTimeout(duel.timeout);
      duels.delete(gameId);

      const result  = determineWinner(duel.pick1, duel.pick2);
      const channel = await interaction.client.channels.fetch(duel.channelId).catch(() => null);

      let desc;
      if (result === 'tie') {
        desc =
          `<@${duel.player1}> picked ${EMOJI[duel.pick1]} **${duel.pick1}**\n` +
          `<@${duel.player2}> picked ${EMOJI[duel.pick2]} **${duel.pick2}**\n\n` +
          `It's a tie! No winner this time.`;
      } else {
        const winnerId = result === 'player1' ? duel.player1 : duel.player2;
        const loserId  = result === 'player1' ? duel.player2 : duel.player1;
        const winPick  = result === 'player1' ? duel.pick1   : duel.pick2;
        const losPick  = result === 'player1' ? duel.pick2   : duel.pick1;
        desc =
          `<@${duel.player1}> picked ${EMOJI[duel.pick1]} **${duel.pick1}**\n` +
          `<@${duel.player2}> picked ${EMOJI[duel.pick2]} **${duel.pick2}**\n\n` +
          `<@${winnerId}> wins with ${winPick} over ${losPick}!\n` +
          `Prize: **${duel.prize}**`;
      }

      const embed = new EmbedBuilder()
        .setColor(result === 'tie' ? '#FEE75C' : '#57F287')
        .setTitle(result === 'tie' ? 'It\'s a Tie!' : 'We have a winner!')
        .setDescription(desc)
        .setTimestamp();

      // Disable buttons on original message
      const disabledRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('rps_rock_d').setLabel('🪨 Rock').setStyle(ButtonStyle.Secondary).setDisabled(true),
        new ButtonBuilder().setCustomId('rps_paper_d').setLabel('📄 Paper').setStyle(ButtonStyle.Secondary).setDisabled(true),
        new ButtonBuilder().setCustomId('rps_scissors_d').setLabel('✂️ Scissors').setStyle(ButtonStyle.Secondary).setDisabled(true),
      );
      interaction.message.edit({ components: [disabledRow] }).catch(() => {});

      channel?.send({ embeds: [embed] }).catch(() => {});
    }
  },

  // Expose for index.js scheduler (restores timeouts on bot restart if needed)
  lobbies,
  duels,
};
