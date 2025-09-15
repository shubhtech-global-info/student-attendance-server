const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const studentSchema = new mongoose.Schema({
  enrollmentNumber: {
    type: String,
    required: [true, 'Enrollment number is required'],
    trim: true,
    unique: true // ✅ Globally unique enrollment number
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
  password: {
    type: String,
    required: [true, 'Password is required']
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'HOD',
    required: true
  }
}, { timestamps: true });

// ✅ Indexes
studentSchema.index({ enrollmentNumber: 1 }, { unique: true });
studentSchema.index({ classIds: 1 });

// ✅ Hash password before saving
studentSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// ✅ Method to compare password
studentSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const Student = mongoose.model('Student', studentSchema);

module.exports = Student;
