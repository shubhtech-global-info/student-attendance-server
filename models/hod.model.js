const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const hodSchema = new mongoose.Schema({
  collegeName: {
    type: String,
    required: [true, 'College name is required'],
    trim: true
  },
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    minlength: [3, 'Username must be at least 3 characters']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters']
  },
  altPassword: {
    type: String,
    required: [true, 'Secondary password is required'],
    minlength: [6, 'Password must be at least 6 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      'Please provide a valid email address'
    ]
  },
  verified: {
    type: Boolean,
    default: false
  },
  otp: {
    code: String,
    expiresAt: Date
  },
  deleteOtp: {
    code: String,
    expiresAt: Date
  },
  pendingUpdates: {
    email: String,
    password: String
  }
}, { timestamps: true });

// ================== PASSWORD HASH ==================
hodSchema.pre('save', async function (next) {
  try {
    if (this.isModified('password')) {
      const salt = await bcrypt.genSalt(10);
      this.password = await bcrypt.hash(this.password, salt);
    }

    if (this.isModified('altPassword')) {
      const salt = await bcrypt.genSalt(10);
      this.altPassword = await bcrypt.hash(this.altPassword, salt);
    }

    next();
  } catch (error) {
    next(error);
  }
});


// ================== CASCADE DELETE ==================
async function cascadeDelete(hodId) {
  const Professor = mongoose.model("Professor");
  const Student = mongoose.model("Student");
  const ClassModel = mongoose.model("Class");
  const Counter = mongoose.model("Counter");
  const Attendance = mongoose.model("Attendance");

  // find all related entities first
  const [professors, students, classes] = await Promise.all([
    Professor.find({ createdBy: hodId }).select("_id"),
    Student.find({ createdBy: hodId }).select("_id"),
    ClassModel.find({ createdBy: hodId }).select("_id"),
  ]);

  const professorIds = professors.map(p => p._id);
  const studentIds = students.map(s => s._id);
  const classIds = classes.map(c => c._id);

  await Promise.all([
    // delete main entities
    Professor.deleteMany({ _id: { $in: professorIds } }),
    Student.deleteMany({ _id: { $in: studentIds } }),
    ClassModel.deleteMany({ _id: { $in: classIds } }),
    Counter.deleteOne({ hod: hodId }),

    // delete attendance linked to any of them
    Attendance.deleteMany({
      $or: [
        { studentId: { $in: studentIds } },
        { classId: { $in: classIds } },
        { markedBy: { $in: professorIds } }
      ]
    })
  ]);
}


hodSchema.pre("findOneAndDelete", async function (next) {
  try {
    const hodId = this.getQuery()["_id"];
    await cascadeDelete(hodId);
    next();
  } catch (err) {
    next(err);
  }
});

hodSchema.pre("remove", async function (next) {
  try {
    await cascadeDelete(this._id);
    next();
  } catch (err) {
    next(err);
  }
});

// ================== METHODS ==================
hodSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// ================== METHODS ==================
hodSchema.methods.compareAltPassword = async function (candidatePassword) {
  if (!this.altPassword) return false;
  return await bcrypt.compare(candidatePassword, this.altPassword);
};


const HOD = mongoose.model('HOD', hodSchema);
module.exports = HOD;
