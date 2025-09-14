// models/attendance.model.js
const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
      index: true,
    },
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Class',
      required: true,
      index: true,
    },

    // Exact date value your Android app already uses (midnight-normalized ms)
    dateMs: {
      type: Number, // epoch milliseconds at 00:00:00 local
      required: true,
      index: true,
    },

    // Session number for the day (S1, S2, ...)
    slotNumber: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },

    // Present/Absent
    isPresent: {
      type: Boolean,
      required: true,
    },

    // Who marked it
    markedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Professor',
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

// Prevent duplicate marks for the same (student, class, date, slot)
attendanceSchema.index(
  { studentId: 1, classId: 1, dateMs: 1, slotNumber: 1 },
  { unique: true }
);

// Helpful query indexes
attendanceSchema.index({ classId: 1, dateMs: 1, slotNumber: 1 });
attendanceSchema.index({ studentId: 1, dateMs: 1 });

const Attendance = mongoose.model('Attendance', attendanceSchema);
module.exports = Attendance;
