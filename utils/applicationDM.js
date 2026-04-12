const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { readData, writeData } = require('./index');

// In-memory sessions: userId → { panelId, panelName, forWhat, questions, answers, currentIndex }
const sessions = new Map();

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
          `I'll ask you **${panel.questions.length}** question(s). Simply reply here in DMs!\n\n` +
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

  // Set session
  sessions.set(interaction.user.id, {
    panelId,
    panelName: panel.name,
    forWhat:   panel.forWhat,
    questions: panel.questions,
    answers:   [],
    currentIndex: 0,
    dmChannelId: dmChannel.id,
  });

  await interaction.reply({ content: '✅ Check your DMs! I\'ve sent you the application questions.', ephemeral: true });

  // Send first question
  await sendQuestion(dmChannel, sessions.get(interaction.user.id));
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
    .setFooter({ text: q.type === 'yesno' ? 'Reply with: yes or no' : 'Type your answer and send it' })
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
  const session = sessions.get(message.author.id);
  if (!session) return;
  if (message.channel.id !== session.dmChannelId) return;

  const q = session.questions[session.currentIndex];
  if (q.type === 'yesno') return; // handled by button

  const answer = message.content.trim();

  if (answer.toLowerCase() === 'cancel') {
    sessions.delete(message.author.id);
    return message.channel.send({ content: '❌ Application cancelled.' });
  }

  await processAnswer(message.author, message.channel, session, answer);
}

// ── Handle a yes/no button click in DMs ──────────────────────────────────────
async function handleDMButton(interaction, answer) {
  const session = sessions.get(interaction.user.id);
  if (!session) return interaction.reply({ content: '❌ No active session.', ephemeral: true });

  await interaction.update({ components: [] });
  await processAnswer(interaction.user, interaction.channel, session, answer);
}

// ── Process a single answer and advance ──────────────────────────────────────
async function processAnswer(user, dmChannel, session, answer) {
  const q = session.questions[session.currentIndex];
  session.answers.push({ question: q.text, answer });
  session.currentIndex++;

  if (session.currentIndex >= session.questions.length) {
    // All questions answered → save result
    sessions.delete(user.id);
    await finalizeApplication(user, dmChannel, session);
  } else {
    await sendQuestion(dmChannel, session);
  }
}

// ── Save result and confirm to applicant ─────────────────────────────────────
async function finalizeApplication(user, dmChannel, session) {
  const results   = readData('applicationResults.json');
  const resultId  = `${user.id}_${session.panelId}_${Date.now()}`;

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

  const embed = new EmbedBuilder()
    .setColor('#57F287')
    .setTitle('✅ Application Submitted!')
    .setDescription(
      `Your application for **${session.forWhat}** has been submitted.\n` +
      `You will be notified once it has been reviewed. Thank you!`
    )
    .addFields(session.answers.map(a => ({ name: a.question, value: a.answer })))
    .setTimestamp();

  await dmChannel.send({ embeds: [embed] }).catch(() => {});
}

module.exports = { startApplication, handleDMAnswer, handleDMButton };
