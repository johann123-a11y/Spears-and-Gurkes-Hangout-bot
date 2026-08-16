const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { readData, writeData } = require('./index');

// In-memory sessions: userId → { panelId, panelName, forWhat, questions, answers, currentIndex, dmChannelId, lastQuestionMessageId }
const sessions = new Map();

function saveSession(userId, session) {
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

// Start a DM application session
async function startApplication(interaction, panelId) {
  const apps  = readData('applications.json');
  const panel = apps.panels?.[panelId];
  if (!panel) return interaction.reply({ content: 'Application not found.', ephemeral: true });

  // Blacklist check
  const blacklist = readData('blacklist.json');
  const bl = blacklist[interaction.user.id];
  if (bl?.application || bl?.all)
    return interaction.reply({ content: 'You are not allowed to submit applications.', ephemeral: true });

  // Check if user already has an active session
  const activeSessions = readData('appSessions.json');
  if (activeSessions[interaction.user.id])
    return interaction.reply({ content: 'You already have an application in progress! Check your DMs. Type `!app` to resend the current question or click **Cancel Application** to cancel.', ephemeral: true });

  // Check duplicate pending
  const results = readData('applicationResults.json');
  const existing = Object.values(results).find(
    r => r.userId === interaction.user.id && r.panelId === panelId && r.status === 'pending'
  );
  if (existing)
    return interaction.reply({ content: `You already have a pending application for **${panel.name}**.`, ephemeral: true });

  if (panel.questions.length === 0)
    return interaction.reply({ content: 'This application has no questions configured yet.', ephemeral: true });

  await interaction.deferReply({ ephemeral: true });

  let dmChannel;
  try {
    dmChannel = await interaction.user.createDM();
    await dmChannel.send({
      embeds: [new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle(`${panel.name}`)
        .setDescription(
          `Hey **${interaction.user.username}**! You're applying for **${panel.forWhat}**.\n\n` +
          `I'll ask you **${panel.questions.length}** question(s) one by one. Simply reply here!\n\n` +
          `Click **Cancel Application** at any time to cancel.\n` +
          `Type \`!app\` if a question doesn't appear.`
        )
        .setFooter({ text: `Question 1 of ${panel.questions.length} coming up...` })
        .setTimestamp()],
    });
  } catch {
    return interaction.editReply({ content: 'I couldn\'t send you a DM! Please enable DMs from server members and try again.' });
  }

  const session = {
    panelId,
    panelName: panel.name,
    forWhat:   panel.forWhat,
    questions: panel.questions,
    answers:   [],
    currentIndex: 0,
    dmChannelId: dmChannel.id,
    lastQuestionMessageId: null,
    guildId: interaction.guildId,
    client: interaction.client,
  };
  sessions.set(interaction.user.id, session);

  await interaction.editReply({ content: 'Check your DMs! I\'ve sent you the application questions.' });
  const msgId = await sendQuestion(dmChannel, session);
  session.lastQuestionMessageId = msgId;
  saveSession(interaction.user.id, session);
}

// Send the current question, delete the previous one, return the new message ID
async function sendQuestion(dmChannel, session) {
  // Delete the previous question message
  if (session.lastQuestionMessageId) {
    dmChannel.messages.fetch(session.lastQuestionMessageId)
      .then(m => m.delete())
      .catch(() => {});
  }

  const q     = session.questions[session.currentIndex];
  const num   = session.currentIndex + 1;
  const total = session.questions.length;

  const embed = new EmbedBuilder()
    .setColor('#FEE75C')
    .setTitle(`Question ${num}/${total}`)
    .setDescription(q.text)
    .setFooter({ text: q.type === 'yesno' ? 'Click Yes or No below' : 'Type your answer and send it' })
    .setTimestamp();

  const cancelBtn = new ButtonBuilder()
    .setCustomId('app_cancel_session')
    .setLabel('Cancel Application')
    .setStyle(ButtonStyle.Danger);

  let sent;
  if (q.type === 'yesno') {
    const answerRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`app_answer_yes:${session.panelId}`).setLabel('Yes').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`app_answer_no:${session.panelId}`).setLabel('No').setStyle(ButtonStyle.Secondary),
    );
    const cancelBtnRow = new ActionRowBuilder().addComponents(cancelBtn);
    sent = await dmChannel.send({ embeds: [embed], components: [answerRow, cancelBtnRow] });
  } else {
    sent = await dmChannel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(cancelBtn)] });
  }

  return sent.id;
}

// Handle a text answer from DMs
async function handleDMAnswer(message) {
  let session = sessions.get(message.author.id);
  if (!session) session = await restoreSession(message.author.id, message.client);
  if (!session) return;
  if (message.channel.id !== session.dmChannelId) return;

  const q      = session.questions[session.currentIndex];
  const answer = message.content.trim();

  if (q.type === 'yesno') {
    // User typed instead of clicking — send a brief hint and auto-delete it
    const hint = await message.channel.send({ content: 'Please answer by clicking the buttons above.' });
    setTimeout(() => hint.delete().catch(() => {}), 5000);
    return;
  }

  try {
    await processAnswer(message.author, message.channel, session, answer);
  } catch (err) {
    console.error('[App DM] Error processing answer:', err);
    message.channel.send({ content: 'Something went wrong. Use `!app` to resend the question.' }).catch(() => {});
  }
}

// Handle the Cancel Application button in DMs
async function handleCancelButton(interaction) {
  let session = sessions.get(interaction.user.id);
  if (!session) session = await restoreSession(interaction.user.id, interaction.client);

  await interaction.deferUpdate();
  if (session) deleteSession(interaction.user.id);
  await interaction.message.delete().catch(() => {});
  await interaction.channel.send({ content: 'Application cancelled.' }).catch(() => {});
}

// Handle !app command in DMs — resends the current question
async function handleAppCommand(message) {
  let session = sessions.get(message.author.id);
  if (!session) session = await restoreSession(message.author.id, message.client);
  if (!session) {
    return message.channel.send({ content: 'You don\'t have an active application.' }).catch(() => {});
  }
  const msgId = await sendQuestion(message.channel, session);
  session.lastQuestionMessageId = msgId;
  saveSession(message.author.id, session);
}

// Handle a yes/no button click in DMs
async function handleDMButton(interaction, answer) {
  let session = sessions.get(interaction.user.id);
  if (!session) session = await restoreSession(interaction.user.id, interaction.client);
  if (!session) return interaction.reply({ content: 'No active session. Please start a new application.', ephemeral: true });

  await interaction.deferUpdate();
  try {
    await processAnswer(interaction.user, interaction.channel, session, answer);
  } catch (err) {
    console.error('[App DM] Error processing button answer:', err);
    interaction.channel.send({ content: 'Something went wrong. Use `!app` to resend the question.' }).catch(() => {});
  }
}

// Process a single answer and advance
async function processAnswer(user, dmChannel, session, answer) {
  const q          = session.questions[session.currentIndex];
  const nextIndex  = session.currentIndex + 1;
  const nextAnswers = [...session.answers, { question: q.text, answer }];

  if (nextIndex >= session.questions.length) {
    // Last answer — delete last question message, finalize
    if (session.lastQuestionMessageId) {
      dmChannel.messages.fetch(session.lastQuestionMessageId)
        .then(m => m.delete())
        .catch(() => {});
    }
    session.answers      = nextAnswers;
    session.currentIndex = nextIndex;
    deleteSession(user.id);
    await finalizeApplication(user, dmChannel, session);
  } else {
    // Send next question first; if it fails the session stays at current index
    const nextSession = { ...session, answers: nextAnswers, currentIndex: nextIndex };
    const msgId = await sendQuestion(dmChannel, nextSession);
    session.answers               = nextAnswers;
    session.currentIndex          = nextIndex;
    session.lastQuestionMessageId = msgId;
    saveSession(user.id, session);
  }
}

// Save result, confirm to applicant, post to pending channel
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

  const apps        = readData('applications.json');
  const pendingChId = apps.channels?.pending;

  if (!pendingChId || !session.client) return;
  const pendingChannel = session.client.channels.cache.get(pendingChId);
  if (!pendingChannel) return;

  const embed = new EmbedBuilder()
    .setColor('#FEE75C')
    .setTitle('📋 New Application — Pending')
    .addFields(
      { name: '👤 Applicant',   value: `<@${user.id}> (${user.tag})`,                          inline: true },
      { name: '📝 Applied for', value: session.forWhat,                                         inline: true },
      { name: '🕐 Submitted',   value: `<t:${Math.floor(Date.now() / 1000)}:F>`,               inline: true },
      ...session.answers.map(a => ({ name: a.question, value: a.answer })),
    )
    .setThumbnail(user.displayAvatarURL())
    .setFooter({ text: `Result ID: ${resultId}` })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`app_accept:${resultId}`).setLabel('✅ Accept').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`app_deny:${resultId}`).setLabel('❌ Deny').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`app_warnhistory:${user.id}`).setLabel('📋 Warn History').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`app_openticket:${user.id}`).setLabel('🎫 Open Ticket').setStyle(ButtonStyle.Primary),
  );

  await pendingChannel.send({ embeds: [embed], components: [row] }).catch(() => {});
}

module.exports = { startApplication, handleDMAnswer, handleDMButton, handleCancelButton, handleAppCommand, deleteSession };
