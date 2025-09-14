// server/models/counter.model.js
const mongoose = require('mongoose');

const counterSchema = new mongoose.Schema({
  hod: { type: mongoose.Schema.Types.ObjectId, ref: 'HOD', unique: true, required: true },
  seq: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('Counter', counterSchema);
