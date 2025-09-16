const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const professorSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Professor name is required'],
    trim: true,
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true, // ✅ Globally unique
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
  },
  classes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    default: []
  }],
   createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'HOD', // ✅ Optional reference for tracking
    required: true, // Not required for authentication
  },
}, { timestamps: true });

// ✅ Ensure email is unique globally
professorSchema.index({ email: 1 }, { unique: true });

// 🔑 Hash password before saving
professorSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// 🔍 Compare password
professorSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

const Professor = mongoose.model('Professor', professorSchema);

module.exports = Professor;
