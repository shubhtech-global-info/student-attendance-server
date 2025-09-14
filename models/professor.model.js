const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const professorSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Professor name is required'],
    trim: true,
  },
  username: {
    type: String,
    required: [true, 'Username is required'],
    trim: true,
    minlength: [3, 'Username must be at least 3 characters'],
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
    ref: 'HOD',
    required: true,
  },
}, { timestamps: true });

// ✅ Ensure username is unique per HOD
professorSchema.index({ username: 1, createdBy: 1 }, { unique: true });

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

// 🔍 Find professor by username + HOD
professorSchema.statics.findByUsernameAndHod = function (username, hodId) {
  return this.findOne({ username: username.toLowerCase(), createdBy: hodId });
};

const Professor = mongoose.model('Professor', professorSchema);

module.exports = Professor;
