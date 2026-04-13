const mongoose = require('mongoose');

const storeSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  data: { type: mongoose.Schema.Types.Mixed, required: true },
});

module.exports = mongoose.model('Store', storeSchema);
