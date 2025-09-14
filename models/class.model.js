const mongoose = require('mongoose');

const classSchema = new mongoose.Schema({
  classId: {
    type: Number,
    required: [true, 'Class ID is required'],
  },
  className: {
    type: String,
    required: [true, 'Class name is required'],
    trim: true
  },
  division: {
    type: String,
    required: [true, 'Division is required'],
    trim: true
  },
  students: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    default: []
  }],
  professors: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Professor',
    default: []
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'HOD',
    required: true
  }
}, { timestamps: true });

// ✅ Compound unique index so each HOD can reuse classIds
classSchema.index({ classId: 1, createdBy: 1 }, { unique: true });

// ✅ Optional: make queries faster for HOD dashboard
classSchema.index({ className: 1, division: 1, createdBy: 1 });

const Class = mongoose.model('Class', classSchema);

module.exports = Class;
