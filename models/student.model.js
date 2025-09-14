const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  enrollmentNumber: {
    type: String,
    required: [true, 'Enrollment number is required'],
    trim: true
  },
  name: {
    type: String,
    required: [true, 'Student name is required'],
    trim: true
  },
  semester: {
    type: Number,
    required: [true, 'Semester is required'],
    min: [1, 'Semester must be at least 1']
  },
  division: {
    type: String,
    trim: true,
    default: null
  },
  classIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    default: []
  }],
  fcmTokens: {
    type: [String],
    default: []
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'HOD',
    required: true
  }
}, { timestamps: true });

// ✅ Compound unique index: enrollmentNumber must be unique per HOD
studentSchema.index({ enrollmentNumber: 1, createdBy: 1 }, { unique: true });

// ✅ Useful indexes for queries
studentSchema.index({ classIds: 1 });

const Student = mongoose.model('Student', studentSchema);

module.exports = Student;
