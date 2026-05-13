const {
  SlashCommandBuilder, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
} = require('discord.js');
const { checkPerm, parseTime } = require('../../utils');

// Active lobbies: messageId → { participants, prize, channelId, endsAt, ended }
const lobbies = new Map();
// Active games: gameId → { player1, player2, pick1, pick2, prize, channelId }
const games   = new Map();

// Helper: try to halve a prize string (e.g. "10m" → "5m") 
function halfPrize(prize) {
  const m = prize.trim().match(/^(\d+(?:\.\d+)?)\s*(k|m|b)?$/i);
  if (!m) return null;
  const num    = parseFloat(m[1]);
  const suffix = (m[2] || '').toLowerCase();
  const half   = num / 2;
  const str    = half % 1 === 0 ? half.toString() : half.toFixed(1).replace(/\.?0+$/, '');
  return `${str}${suffix}`;
}

function splitStealButtons(gameId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`ss_pick:${gameId}:split`).setLabel('Split').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`ss_pick:${gameId}:steal`).setLabel('Steal').setStyle(ButtonStyle.Danger),
  );
}

async function startGame(p1, p2, prize, channelId, client, replyFn) {
  const gameId = `ss_${Date.now()}`;
  games.set(gameId, { player1: p1, player2: p2, pick1: null, pick2: null, prize, channelId });

  const embed = new EmbedBuilder()
    .setColor('#5865F2')
    .setTitle('Split or Steal?')
    .setDescription(
      `**Prize:** ${prize}\n\n` +
      `<@${p1}> vs <@${p2}>\n\n` +
      `Both players must make their choice:\n\n` +
      `**Split** — divide the prize equally\n` +
      `**Steal** — take everything (but if both steal, nobody gets anything!)`
    )
    .setTimestamp();

  await replyFn({
    content: `<@${p1}> <@${p2}>`,
    embeds: [embed],
    components: [splitStealButtons(gameId)],
    allowedMentions: { users: [p1, p2] },
  });
}

async function endLobby(messageId, client) {
  const lobby = lobbies.get(messageId);
  if (!lobby || lobby.ended) return;
  lobby.ended = true;
  lobbies.delete(messageId);

  // Use stored channel reference first, fallback to fetch
  const channel = lobby.channel
    ?? await client.channels.fetch(lobby.channelId).catch(() => null);

  if (!channel) {
    console.error('[SOS] Could not resolve channel', lobby.channelId);
    return;
  }

  // Disable the join button
  const lobbyMsg = await channel.messages.fetch(messageId).catch(() => null);
  if (lobbyMsg) {
    const disabled = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ss_join_disabled').setLabel('Join').setStyle(ButtonStyle.Primary).setDisabled(true),
    );
    lobbyMsg.edit({ components: [disabled] }).catch(() => {});
  }

  if (lobby.participants.length < 2) {
    channel.send({ content: `**${lobby.prize}** — Split or Steal ended. Not enough participants (need at least 2).` }).catch(console.error);
    return;
  }

  const pool = [...lobby.participants];
  const idx1 = Math.floor(Math.random() * pool.length);
  const [p1] = pool.splice(idx1, 1);
  const p2   = pool[Math.floor(Math.random() * pool.length)];

  await startGame(p1, p2, lobby.prize, lobby.channelId, client, opts => channel.send(opts).catch(console.error));
}

module.exports = {
  name: 'sos',
  data: new SlashCommandBuilder()
    .setName('sos')
    .setDescription('Split or Steal event [Staff Team]')
    .setDefaultMemberPermissions(0)
    .addSubcommand(sub =>
      sub.setName('start')
        .setDescription('Start a Split or Steal lobby')
        .addStringOption(o => o.setName('prize').setDescription('The prize (e.g. 10m)').setRequired(true))
        .addStringOption(o => o.setName('duration').setDescription('How long the lobby stays open (e.g. 1m, 5m)').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('duel')
        .setDescription('Directly start Split or Steal between two users')
        .addUserOption(o => o.setName('user1').setDescription('First player').setRequired(true))
        .addUserOption(o => o.setName('user2').setDescription('Second player').setRequired(true))
        .addStringOption(o => o.setName('prize').setDescription('The prize (e.g. 10m)').setRequired(true))
    ),

  async executeSlash(interaction) {
    if (!checkPerm(interaction.member, 'sos'))
      return interaction.reply({ content: 'Only **Staff Team** can use this command.', ephemeral: true });

    const sub = interaction.options.getSubcommand();

    // /sos start 
    if (sub === 'start') {
      const prize  = interaction.options.getString('prize');
      const durStr = interaction.options.getString('duration');
      const ms     = parseTime(durStr);
      if (!ms) return interaction.reply({ content: 'Invalid duration. Use e.g. `1m`, `5m`, `1h`.', ephemeral: true });

      const endsTs = Math.floor((Date.now() + ms) / 1000);
      const embed  = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('Split or Steal Event!')
        .setDescription(
          `**Prize:** ${prize}\n` +
          `**Ends:** <t:${endsTs}:R>\n\n` +
          `Click **Join** to enter! 2 players will be picked to face off.\n\n` +
          `Split — divide equally · Steal — winner takes all · Both steal — nobody wins!`
        )
        .setFooter({ text: `Hosted by ${interaction.user.tag}` })
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`ss_join:placeholder`).setLabel('Join').setStyle(ButtonStyle.Primary),
      );

      await interaction.reply({ embeds: [embed], components: [row] });
      const msg = await interaction.fetchReply();

      const realRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`ss_join:${msg.id}`).setLabel('Join').setStyle(ButtonStyle.Primary),
      );
      await msg.edit({ components: [realRow] }).catch(() => {});

      lobbies.set(msg.id, {
        participants: [],
        prize,
        channel:   interaction.channel,
        channelId: interaction.channelId,
        guildId:   interaction.guildId,
        endsAt:    Date.now() + ms,
        ended:     false,
      });

      setTimeout(() => endLobby(msg.id, interaction.client), ms);
    }

    // /sos duel 
    if (sub === 'duel') {
      const user1 = interaction.options.getUser('user1');
      const user2 = interaction.options.getUser('user2');
      const prize = interaction.options.getString('prize');

      if (user1.id === user2.id)
        return interaction.reply({ content: 'You cannot pick the same user twice!', ephemeral: true });
      if (user1.bot || user2.bot)
        return interaction.reply({ content: 'Bots cannot participate.', ephemeral: true });

      await startGame(
        user1.id, user2.id, prize, interaction.channelId, interaction.client,
        opts => interaction.reply(opts),
      );
    }
  },

  // Button: join lobby 
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

  // Button: pick split or steal 
  async handlePick(interaction) {
    const [, gameId, pick] = interaction.customId.split(':');
    const game = games.get(gameId);

    if (!game)
      return interaction.reply({ content: 'This game is no longer active.', ephemeral: true });

    const userId = interaction.user.id;
    if (userId !== game.player1 && userId !== game.player2)
      return interaction.reply({ content: 'You are not a participant in this game.', ephemeral: true });

    const isP1 = userId === game.player1;

    if (isP1 && game.pick1)
      return interaction.reply({ content: `You already chose **${game.pick1 === 'split' ? 'Split' : 'Steal'}**!`, ephemeral: true });
    if (!isP1 && game.pick2)
      return interaction.reply({ content: `You already chose **${game.pick2 === 'split' ? 'Split' : 'Steal'}**!`, ephemeral: true });

    if (isP1) game.pick1 = pick; else game.pick2 = pick;

    await interaction.reply({
      content: `You chose **${pick === 'split' ? 'Split' : 'Steal'}**! Waiting for your opponent...`,
      ephemeral: true,
    });

    if (!game.pick1 || !game.pick2) return;

    // Both picked — resolve 
    games.delete(gameId);
    const channel = await interaction.client.channels.fetch(game.channelId).catch(() => null);

    const p1Pick = game.pick1;
    const p2Pick = game.pick2;
    let color, title, desc;

    if (p1Pick === 'split' && p2Pick === 'split') {
      const half    = halfPrize(game.prize);
      const halfStr = half ? `**${half}**` : `**half of ${game.prize}**`;
      color = '#57F287';
      title = 'Both Split!';
      desc  =
        `<@${game.player1}> chose **Split**\n` +
        `<@${game.player2}> chose **Split**\n\n` +
        `Both players win! Each receives ${halfStr}!`;

    } else if (p1Pick === 'steal' && p2Pick === 'steal') {
      color = '#ED4245';
      title = 'Both Stole — Nobody Wins!';
      desc  =
        `<@${game.player1}> chose **Steal**\n` +
        `<@${game.player2}> chose **Steal**\n\n` +
        `Both players chose to steal — **nobody receives anything!**`;

    } else {
      const stealerId  = p1Pick === 'steal' ? game.player1 : game.player2;
      const splitterId = p1Pick === 'split' ? game.player1 : game.player2;
      color = '#FEE75C';
      title = 'Stolen!';
      desc  =
        `<@${game.player1}> chose **${p1Pick === 'split' ? 'Split' : 'Steal'}**\n` +
        `<@${game.player2}> chose **${p2Pick === 'split' ? 'Split' : 'Steal'}**\n\n` +
        `<@${stealerId}> stole the prize and wins **${game.prize}**!\n` +
        `<@${splitterId}> trusted and gets nothing.`;
    }

    const resultEmbed = new EmbedBuilder()
      .setColor(color)
      .setTitle(title)
      .setDescription(desc)
      .setTimestamp();

    const disabledRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ss_split_d').setLabel('Split').setStyle(ButtonStyle.Success).setDisabled(true),
      new ButtonBuilder().setCustomId('ss_steal_d').setLabel('Steal').setStyle(ButtonStyle.Danger).setDisabled(true),
    );
    interaction.message.edit({ components: [disabledRow] }).catch(() => {});

    channel?.send({ embeds: [resultEmbed] }).catch(() => {});
  },

  lobbies,
  games,
};
