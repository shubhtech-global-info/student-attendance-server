// controllers/student.controller.js
const mongoose = require('mongoose');
const Student = require('../models/student.model');
const Class = require('../models/class.model');
const { parseExcel } = require('../utils/excel.utils');
const { successResponse, errorResponse } = require('../utils/response.utils');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { generateToken } = require('../config/jwt.config');
const { validatePassword } = require('../utils/validation');

/**
 * @desc    Register FCM token for student
 * @route   POST /api/students/fcm-token
 * @access  Private (Student only)
 */
const registerFcmToken = async (req, res) => {
  try {
    const studentId = req.student._id;
    let { fcmToken } = req.body;

    if (!fcmToken) {
      return errorResponse(res, 'fcmToken is required', 400);
    }

    // 🔑 Decode URL-encoded token (fixes %3A issue)
    fcmToken = decodeURIComponent(fcmToken);

    // Save the FCM token to the student document
    await Student.findByIdAndUpdate(
      studentId,
      { $addToSet: { fcmTokens: fcmToken } }, // ensures uniqueness
      { new: true }
    );

    return successResponse(res, {
      message: 'FCM token registered successfully'
    });

  } catch (error) {
    console.error('[registerFcmToken]', error);
    return errorResponse(res, 'Server error while registering FCM token', 500);
  }
};

/**
 * @desc    Remove FCM token for student (optional)
 * @route   DELETE /api/students/fcm-token
 * @access  Private (Student only)
 */
const removeFcmToken = async (req, res) => {
  try {
    const studentId = req.student._id;

    // Remove the FCM token from the student document
    await Student.findByIdAndUpdate(
      studentId,
      { $pull: { fcmTokens: req.body.fcmToken } },
      { new: true }
    );

    return successResponse(res, {
      message: 'FCM token removed successfully'
    });

  } catch (error) {
    console.error('[removeFcmToken]', error);
    return errorResponse(res, 'Server error while removing FCM token', 500);
  }
};

/**
 * @desc    Student login
 * @route   POST /api/students/login
 * @access  Student only
 */
const loginStudent = async (req, res) => {
  try {
    const { enrollmentNumber, password } = req.body;

    if (!enrollmentNumber || !password) {
      return errorResponse(res, 'Enrollment number and password are required', 400);
    }

    // Find student by enrollment number
    const student = await Student.findOne({ enrollmentNumber });

    if (!student) {
      return errorResponse(res, 'Invalid credentials', 401);
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, student.password);
    if (!isMatch) {
      return errorResponse(res, 'Invalid credentials', 401);
    }

    // Generate token for student
    const token = generateToken(student, 'student', student.createdBy);

    return successResponse(res, {
      message: 'Student logged in successfully',
      token,
      student: {
        id: student._id,
        name: student.name,
        enrollmentNumber: student.enrollmentNumber,
        semester: student.semester,
        division: student.division,
        classIds: student.classIds
      }
    });

  } catch (error) {
    console.error('[loginStudent]', error);
    return errorResponse(res, 'Server error during student login', 500);
  }
};

/**
 * @desc    Bulk upload students from Excel
 * @route   POST /api/students/bulk-upload
 * @access  Private (HOD only)
 */
const bulkUploadStudents = async (req, res) => {
  try {
    if (!req.file) {
      return errorResponse(res, 'Please upload an Excel file', 400);
    }

    const hodId = req.user.id;
    const filePath = req.file.path;

    const students = await parseExcel(filePath);
    if (Array.isArray(students)) console.log('[bulkUploadStudents] sample:', students.slice(0, 5));

    if (!students || students.length === 0) {
      return errorResponse(res, 'No valid student data found in the Excel file', 400);
    }

    const invalidStudents = students.filter(
      student => !student.enrollmentNumber || !student.name || !student.semester
    );

    if (invalidStudents.length > 0) {
      return errorResponse(res, 'Some student records are missing required fields', 400);
    }

    // ✅ Check globally unique enrollment numbers
    const existingEnrollments = await Student.find({
      enrollmentNumber: { $in: students.map(s => s.enrollmentNumber) }
    }).select('enrollmentNumber');

    const existingEnrollmentSet = new Set(existingEnrollments.map(s => s.enrollmentNumber));

    const newStudents = students.filter(s => !existingEnrollmentSet.has(s.enrollmentNumber));

    if (newStudents.length === 0) {
      return errorResponse(res, 'All students in the file already exist', 400);
    }

    const DEFAULT_PASSWORD = "Temp@1234";
    const salt = await bcrypt.genSalt(10);

    // ✅ Hash passwords before inserting, validate if provided
    const studentsToInsert = await Promise.all(newStudents.map(async student => {
      let plainPassword = student.password || DEFAULT_PASSWORD;

      if (student.password) {
        const passwordError = validatePassword(plainPassword);
        if (passwordError) {
          console.warn(`[bulkUploadStudents] Weak password for ${student.enrollmentNumber}: ${passwordError}`);
          // Optionally, you can skip this student or proceed with default password
          plainPassword = DEFAULT_PASSWORD;
        }
      }

      const hashedPassword = await bcrypt.hash(plainPassword, salt);
      return {
        enrollmentNumber: student.enrollmentNumber,
        name: student.name,
        semester: student.semester,
        division: student.division || null,
        classIds: [],
        fcmTokens: [],
        password: hashedPassword,
        createdBy: hodId
      };
    }));

    const insertedStudents = await Student.insertMany(studentsToInsert);

    return successResponse(res, {
      message: `${insertedStudents.length} students uploaded successfully`,
      totalUploaded: insertedStudents.length,
      totalSkipped: students.length - newStudents.length
    }, 201);

  } catch (error) {
    console.error("[bulkUploadStudents]", error);
    return errorResponse(res, 'Server error during bulk upload', 500);
  }
};

/**
 * @desc    Get all students
 * @route   GET /api/students
 * @access  Private (HOD only)
 */
const getStudents = async (req, res) => {
  try {
    const hodId = req.user.id;
    let { semester, classId } = req.query;

    // Build query
    const query = { createdBy: hodId };

    if (semester) {
      // accept either string or number
      const semNum = Number(semester);
      if (!Number.isNaN(semNum)) query.semester = semNum;
    }

    if (classId) {
      if (mongoose.Types.ObjectId.isValid(classId)) {
        query.classIds = classId;
      } else {
        const cls = await Class.findOne({ classId: classId, createdBy: hodId }).select('_id');
        if (cls) {
          query.classIds = cls._id;
        } else {
          return successResponse(res, { students: [] });
        }
      }
    }

    // Find students with optional filters
    const students = await Student.find(query).sort({ enrollmentNumber: 1 });

    return successResponse(res, { students });

  } catch (error) {
    return errorResponse(res, 'Server error while fetching students', 500);
  }
};

/**
 * @desc    Get student by ID
 * @route   GET /api/students/:id
 * @access  Private (HOD only)
 */
const getStudentById = async (req, res) => {
  try {
    const studentId = req.params.id;
    const hodId = req.user.id;

    // Find student by ID and created by this HOD
    const student = await Student.findOne({
      _id: studentId,
      createdBy: hodId
    });

    if (!student) {
      return errorResponse(res, 'Student not found', 404);
    }

    return successResponse(res, { student });

  } catch (error) {
    return errorResponse(res, 'Server error while fetching student', 500);
  }
};

/**
 * @desc    Update student
 * @route   PUT /api/students/:id
 * @access  Private (HOD only)
 */
const updateStudent = async (req, res) => {
  try {
    const studentId = req.params.id;
    const hodId = req.user.id;
    let { name, enrollmentNumber, semester, classId, division, password } = req.body;

    let student = await Student.findOne({
      _id: studentId,
      createdBy: hodId
    });

    if (!student) {
      return errorResponse(res, 'Student not found', 404);
    }

    if (enrollmentNumber && enrollmentNumber !== student.enrollmentNumber) {
      const existing = await Student.findOne({ enrollmentNumber });
      if (existing) {
        return errorResponse(res, 'Enrollment number already exists', 400);
      }
      student.enrollmentNumber = enrollmentNumber;
    }

    if (password) {
      const passwordError = validatePassword(password);
      if (passwordError) {
        return errorResponse(res, passwordError, 400);
      }
      student.password = password;
    }

    if (classId) {
      let newClassIds = [];
      const ids = Array.isArray(classId) ? classId : [classId];

      for (const id of ids) {
        let cls = null;
        if (mongoose.Types.ObjectId.isValid(id)) {
          cls = await Class.findOne({ _id: id, createdBy: hodId }).select('_id');
        } else {
          cls = await Class.findOne({ classId: id, createdBy: hodId }).select('_id');
        }
        if (!cls) return errorResponse(res, `Class not found: ${id}`, 404);
        newClassIds.push(cls._id);
      }

      const classesToRemove = student.classIds.filter(cid => !newClassIds.includes(cid));
      await Class.updateMany(
        { _id: { $in: classesToRemove } },
        { $pull: { students: student._id } }
      );

      const classesToAdd = newClassIds.filter(cid => !student.classIds.includes(cid));
      await Class.updateMany(
        { _id: { $in: classesToAdd } },
        { $addToSet: { students: student._id } }
      );

      student.classIds = newClassIds;
    }

    if (name) student.name = name;
    if (semester) {
      const semNum = Number(semester);
      if (!Number.isNaN(semNum)) student.semester = semNum;
    }
    if (division !== undefined) student.division = division;
    if (password) student.password = password;

    await student.save();

    return successResponse(res, {
      message: 'Student updated successfully',
      student
    });

  } catch (error) {
    console.error("[updateStudent]", error);
    return errorResponse(res, 'Server error while updating student', 500);
  }
};

/**
 * @desc    Update student's password only
 * @route   PUT /api/students/me
 * @access  Private (Student only)
 */
const updateOwnProfile = async (req, res) => {
  try {
    const student = req.student; // already loaded by authorizeStudent
    const { password } = req.body;

    if (!password) {
      return errorResponse(res, 'Password is required', 400);
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      return errorResponse(res, passwordError, 400);
    }

    student.password = password;

    await student.save();

    return successResponse(res, {
      message: 'Password updated successfully',
    });

  } catch (error) {
    console.error('[updateOwnProfile]', error);
    return errorResponse(res, 'Server error while updating password', 500);
  }
};


/**
 * @desc    Delete student
 * @route   DELETE /api/students/:id
 * @access  Private (HOD only)
 */
const deleteStudent = async (req, res) => {
  try {
    const studentId = req.params.id;
    const hodId = req.user.id;

    // Find student by ID and created by this HOD
    const student = await Student.findOne({
      _id: studentId,
      createdBy: hodId
    });

    if (!student) {
      return errorResponse(res, 'Student not found', 404);
    }

    if (student.classIds && student.classIds.length > 0) {
      await Class.updateMany(
        { _id: { $in: student.classIds } },
        { $pull: { students: student._id } }
      );
    }


    // Delete student
    await student.deleteOne();

    return successResponse(res, {
      message: 'Student deleted successfully'
    });

  } catch (error) {
    return errorResponse(res, 'Server error while deleting student', 500);
  }
};

/**
 * @desc    Bulk delete students
 * @route   DELETE /api/students
 * @access  Private (HOD only)
 * @body    { studentIds: [ "id1", "id2", ... ] }
 */
const deleteStudentsBulk = async (req, res) => {
  try {
    const { studentIds } = req.body;
    const hodId = req.user.id;

    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      return errorResponse(res, "No studentIds provided", 400);
    }

    // Find students belonging to this HOD
    const students = await Student.find({
      _id: { $in: studentIds },
      createdBy: hodId
    });

    if (students.length === 0) {
      return errorResponse(res, "No students found for deletion", 404);
    }

    // Remove student refs from their classes
    const classUpdates = [];

    students.forEach(s => {
      if (s.classIds && s.classIds.length > 0) {
        classUpdates.push(
          Class.updateMany({ _id: { $in: s.classIds } }, { $pull: { students: s._id } })
        );
      }
    });


    await Promise.all(classUpdates);

    // Delete students in one go
    const result = await Student.deleteMany({
      _id: { $in: studentIds },
      createdBy: hodId
    });

    return successResponse(res, {
      message: `${result.deletedCount} students deleted successfully`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error("[deleteStudentsBulk]", error);
    return errorResponse(res, "Server error while bulk deleting students", 500);
  }
};

/**
 * @desc    Add a single student
 * @route   POST /api/students
 * @access  Private (HOD only)
 */
const addStudent = async (req, res) => {
  try {
    const hodId = req.user.id;
    let { enrollmentNumber, name, semester, division, classId, password } = req.body;

    if (!enrollmentNumber || !name || !semester || !password) {
      return errorResponse(res, "Enrollment number, name, semester, and password are required", 400);
    }

    // ✅ Validate password strength
    const passwordError = validatePassword(password);
    if (passwordError) {
      return errorResponse(res, passwordError, 400);
    }

    // ✅ Check global uniqueness of enrollmentNumber
    const existing = await Student.findOne({ enrollmentNumber });
    if (existing) {
      return errorResponse(res, "Enrollment number already exists", 400);
    }

    let resolvedClassId = null;

    if (classId) {
      if (mongoose.Types.ObjectId.isValid(classId)) {
        const cls = await Class.findOne({ _id: classId, createdBy: hodId }).select("_id");
        if (!cls) return errorResponse(res, "Class not found", 404);
        resolvedClassId = cls._id;
      } else {
        const cls = await Class.findOne({ classId, createdBy: hodId }).select("_id");
        if (!cls) return errorResponse(res, "Class not found", 404);
        resolvedClassId = cls._id;
      }
    }

    const student = new Student({
      enrollmentNumber,
      name,
      semester,
      division: division || null,
      classIds: resolvedClassId ? [resolvedClassId] : [],
      password,
      createdBy: hodId
    });

    await student.save();

    if (resolvedClassId) {
      await Class.updateOne(
        { _id: resolvedClassId },
        { $addToSet: { students: student._id } }
      );
    }

    return successResponse(res, {
      message: "Student added successfully",
      student
    }, 201);

  } catch (error) {
    console.error("[addStudent]", error);
    return errorResponse(res, "Server error while adding student", 500);
  }
};


/**
 * @desc    Get logged-in student details
 * @route   GET /api/students/me
 * @access  Student only
 */
const getStudentProfile = async (req, res) => {
  try {
    const student = req.student; // ✅ set by authorizeStudent

    if (!student) {
      return errorResponse(res, 'Student not authenticated', 401);
    }

    return successResponse(res, {
      student: {
        id: student._id,
        name: student.name,
        enrollmentNumber: student.enrollmentNumber,
        semester: student.semester,
        division: student.division,
        classIds: student.classIds,
        fcmTokens: student.fcmTokens
      }
    });

  } catch (error) {
    console.error('[getStudentProfile]', error);
    return errorResponse(res, 'Server error while fetching profile', 500);
  }
};



module.exports = {
  bulkUploadStudents,
  getStudents,
  getStudentById,
  updateStudent,
  updateOwnProfile,
  deleteStudent,
  deleteStudentsBulk,
  addStudent,
  loginStudent,
  registerFcmToken,
  removeFcmToken,
  getStudentProfile
};
