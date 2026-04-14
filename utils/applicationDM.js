const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { readData, writeData } = require('./index');

// In-memory sessions: userId → { panelId, panelName, forWhat, questions, answers, currentIndex, dmChannelId }
const sessions = new Map();

function saveSession(userId, session) {
  // strip non-serialisable client ref before saving
  const { client, ...rest } = session;
  const stored = readData('appSessions.json');
  stored[userId] = rest;
  writeData('appSessions.json', stored);
}

function deleteSession(userId) {
  sessions.delete(userId);
  const stored = readData('appSessions.json');
  delete stored[userId];
  writeData('appSessions.json', stored);
}

async function restoreSession(userId, client) {
  if (sessions.has(userId)) return sessions.get(userId);
  const stored = readData('appSessions.json');
  if (!stored[userId]) return null;
  const s = { ...stored[userId], client };
  sessions.set(userId, s);
  return s;
}

// ── Start a DM application session ───────────────────────────────────────────
async function startApplication(interaction, panelId) {
  const apps  = readData('applications.json');
  const panel = apps.panels?.[panelId];
  if (!panel) return interaction.reply({ content: '❌ Application not found.', ephemeral: true });

  // Check duplicate pending
  const results = readData('applicationResults.json');
  const existing = Object.values(results).find(
    r => r.userId === interaction.user.id && r.panelId === panelId && r.status === 'pending'
  );
  if (existing)
    return interaction.reply({ content: `❌ You already have a pending application for **${panel.name}**.`, ephemeral: true });

  if (panel.questions.length === 0)
    return interaction.reply({ content: '❌ This application has no questions configured yet.', ephemeral: true });

  // Try to open DMs
  let dmChannel;
  try {
    dmChannel = await interaction.user.createDM();
    await dmChannel.send({
      embeds: [new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle(`📋 ${panel.name}`)
        .setDescription(
          `👋 Hey **${interaction.user.username}**! You're applying for **${panel.forWhat}**.\n\n` +
          `I'll ask you **${panel.questions.length}** question(s) one by one. Simply reply here!\n\n` +
          `Type \`cancel\` at any time to cancel your application.`
        )
        .setFooter({ text: `Question 1 of ${panel.questions.length} coming up...` })
        .setTimestamp()],
    });
  } catch {
    return interaction.reply({
      content: '❌ I couldn\'t send you a DM! Please enable DMs from server members and try again.',
      ephemeral: true,
    });
  }

  const session = {
    panelId,
    panelName: panel.name,
    forWhat:   panel.forWhat,
    questions: panel.questions,
    answers:   [],
    currentIndex: 0,
    dmChannelId: dmChannel.id,
    guildId: interaction.guildId,
    client: interaction.client,
  };
  sessions.set(interaction.user.id, session);
  saveSession(interaction.user.id, session);

  await interaction.reply({ content: '✅ Check your DMs! I\'ve sent you the application questions.', ephemeral: true });
  await sendQuestion(dmChannel, session);
}

// ── Send the current question ─────────────────────────────────────────────────
async function sendQuestion(dmChannel, session) {
  const q     = session.questions[session.currentIndex];
  const num   = session.currentIndex + 1;
  const total = session.questions.length;

  const embed = new EmbedBuilder()
    .setColor('#FEE75C')
    .setTitle(`Question ${num}/${total}`)
    .setDescription(q.text)
    .setFooter({ text: q.type === 'yesno' ? 'Click Yes or No below' : 'Type your answer and send it' })
    .setTimestamp();

  if (q.type === 'yesno') {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`app_answer_yes:${session.panelId}`).setLabel('✅ Yes').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`app_answer_no:${session.panelId}`).setLabel('❌ No').setStyle(ButtonStyle.Danger),
    );
    await dmChannel.send({ embeds: [embed], components: [row] });
  } else {
    await dmChannel.send({ embeds: [embed] });
  }
}

// ── Handle a text answer from DMs ─────────────────────────────────────────────
async function handleDMAnswer(message) {
  let session = sessions.get(message.author.id);
  if (!session) session = await restoreSession(message.author.id, message.client);
  if (!session) return;
  if (message.channel.id !== session.dmChannelId) return;

  const q = session.questions[session.currentIndex];

  const answer = message.content.trim();
  if (answer.toLowerCase() === 'cancel') {
    deleteSession(message.author.id);
    return message.channel.send({ content: '❌ Application cancelled.' });
  }

  if (q.type === 'yesno') {
    return message.channel.send({ content: '⚠️ Please use the **Yes** or **No** buttons above to answer this question.' });
  }

  await processAnswer(message.author, message.channel, session, answer);
}

// ── Handle a yes/no button click in DMs ──────────────────────────────────────
async function handleDMButton(interaction, answer) {
  let session = sessions.get(interaction.user.id);
  if (!session) session = await restoreSession(interaction.user.id, interaction.client);
  if (!session) return interaction.reply({ content: '❌ No active session. Please start a new application.', ephemeral: true });

  await interaction.update({ components: [] });
  await processAnswer(interaction.user, interaction.channel, session, answer);
}

// ── Process a single answer and advance ──────────────────────────────────────
async function processAnswer(user, dmChannel, session, answer) {
  const q = session.questions[session.currentIndex];
  session.answers.push({ question: q.text, answer });
  session.currentIndex++;

  if (session.currentIndex >= session.questions.length) {
    deleteSession(user.id);
    await finalizeApplication(user, dmChannel, session);
  } else {
    saveSession(user.id, session);
    await sendQuestion(dmChannel, session);
  }
}

// ── Save result, confirm to applicant, post to pending channel ────────────────
async function finalizeApplication(user, dmChannel, session) {
  const results  = readData('applicationResults.json');
  const resultId = `${user.id}_${session.panelId}_${Date.now()}`;

  results[resultId] = {
    userId:      user.id,
    username:    user.tag,
    panelId:     session.panelId,
    panelName:   session.panelName,
    forWhat:     session.forWhat,
    answers:     session.answers,
    submittedAt: new Date().toISOString(),
    status:      'pending',
  };
  writeData('applicationResults.json', results);

  // Confirm to applicant
  await dmChannel.send({
    embeds: [new EmbedBuilder()
      .setColor('#57F287')
      .setTitle('✅ Application Submitted!')
      .setDescription(
        `Your application for **${session.forWhat}** has been submitted.\n` +
        `You will be notified once it has been reviewed. Thank you!`
      )
      .addFields(session.answers.map(a => ({ name: a.question, value: a.answer })))
      .setTimestamp()],
  }).catch(() => {});

  // Post to pending channel
  const apps          = readData('applications.json');
  const pendingChId   = apps.channels?.pending;
  const pingTarget    = apps.pingTarget;

  if (!pendingChId || !session.client) return;
  const pendingChannel = session.client.channels.cache.get(pendingChId);
  if (!pendingChannel) return;

  const embed = new EmbedBuilder()
    .setColor('#FEE75C')
    .setTitle('📋 New Application — Pending')
    .addFields(
      { name: '👤 Applicant',   value: `<@${user.id}> (${user.tag})`,                          inline: true },
      { name: '📋 Applied for', value: session.forWhat,                                         inline: true },
      { name: '🕐 Submitted',   value: `<t:${Math.floor(Date.now() / 1000)}:F>`,               inline: true },
      ...session.answers.map(a => ({ name: a.question, value: a.answer })),
    )
    .setThumbnail(user.displayAvatarURL())
    .setFooter({ text: `Result ID: ${resultId}` })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`app_accept:${resultId}`).setLabel('✅ Accept').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`app_deny:${resultId}`).setLabel('❌ Deny').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`app_warnhistory:${user.id}`).setLabel('⚠️ Warn History').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`app_openticket:${user.id}`).setLabel('🎫 Open Ticket').setStyle(ButtonStyle.Primary),
  );

  const pingContent = pingTarget ? `<@${pingTarget}>` : null;

  await pendingChannel.send({
    content: pingContent,
    embeds:  [embed],
    components: [row],
    allowedMentions: pingTarget ? { users: [pingTarget], roles: [pingTarget] } : {},
  }).catch(() => {});
}

module.exports = { startApplication, handleDMAnswer, handleDMButton };
