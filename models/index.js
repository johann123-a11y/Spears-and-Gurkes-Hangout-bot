const mongoose = require('mongoose');
const { Schema } = mongoose;

const StrikeSchema = new Schema({
  userId: { type: String, required: true, unique: true },
  count: { type: Number, default: 0 },
  entries: [{ reason: String, by: String, at: { type: Date, default: Date.now } }],
});

const LOASchema = new Schema({
  userId: { type: String, required: true, unique: true },
  endTime: Number,
  reason: String,
  by: String,
  username: String,
});

const AFKSchema = new Schema({
  userId: { type: String, required: true, unique: true },
  reason: String,
  since: Number,
  until: { type: Number, default: null },
});

const GiveawaySchema = new Schema({
  messageId: { type: String, required: true, unique: true },
  channelId: String,
  guildId: String,
  endTime: Number,
  prize: String,
  winners: Number,
  description: String,
  hostId: String,
  ended: { type: Boolean, default: false },
  winnerIds: [String],
});

const WelcomeSchema = new Schema({
  guildId: { type: String, required: true, unique: true },
  enabled: { type: Boolean, default: false },
  channel: { type: String, default: null },
  message: { type: String, default: 'Welcome {member} to **{server}**! You are member #{membercount}.' },
});

module.exports = {
  Strike: mongoose.model('Strike', StrikeSchema),
  LOA: mongoose.model('LOA', LOASchema),
  AFK: mongoose.model('AFK', AFKSchema),
  Giveaway: mongoose.model('Giveaway', GiveawaySchema),
  Welcome: mongoose.model('Welcome', WelcomeSchema),
};
