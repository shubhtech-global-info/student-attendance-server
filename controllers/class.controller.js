const Class = require('../models/class.model');
const Student = require('../models/student.model');
const Professor = require('../models/professor.model');
const Counter = require('../models/counter.model'); // <-- ADD THIS LINE
const { successResponse, errorResponse } = require('../utils/response.utils');
const mongoose = require('mongoose');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

/**
 * Parse Excel file for classes
 * @param {String} filePath
 * @returns {Array} Array of { className, division }
 */
const parseClassExcel = async (filePath) => {
  if (!fs.existsSync(filePath)) return [];
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const raw = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

  // Normalize headers
  const normalizeHeader = h => String(h || '').trim().toLowerCase().replace(/[\s_]+/g, '');
  const headerMap = {};
  Object.keys(raw[0] || {}).forEach(k => {
    headerMap[normalizeHeader(k)] = k;
  });

  const classNameHeader = headerMap['classname'] || headerMap['class'] || headerMap['name'];
  const divisionHeader = headerMap['division'] || headerMap['section'] || headerMap['div'];

  if (!classNameHeader || !divisionHeader) return [];

  const classes = raw.map(row => ({
    className: String(row[classNameHeader] || '').trim(),
    division: String(row[divisionHeader] || '').trim()
  })).filter(c => c.className && c.division);

  // Remove temp file
  fs.unlink(filePath, () => { });

  return classes;
};

const bulkUploadClasses = async (req, res) => {
  try {
    if (!req.file) return errorResponse(res, 'Please upload an Excel file', 400);

    const hodId = req.user.id;
    const filePath = req.file.path;

    const classes = await parseClassExcel(filePath);
    if (!classes || classes.length === 0) return errorResponse(res, 'No valid class data found', 400);

    // Fetch existing classes for this HOD
    const existingClasses = await Class.find({ createdBy: hodId })
      .select('className division');

    const existingSet = new Set(
      existingClasses.map(c => `${c.className.toLowerCase()}||${c.division.toLowerCase()}`)
    );

    const classesToInsert = classes.filter(c => {
      const key = `${c.className.toLowerCase()}||${c.division.toLowerCase()}`;
      return !existingSet.has(key);
    });

    if (classesToInsert.length === 0) {
      return errorResponse(res, 'All classes in the file already exist in the database', 400);
    }

    const insertedClasses = [];
    for (let cls of classesToInsert) {
      const counter = await Counter.findOneAndUpdate(
        { hod: hodId },
        { $inc: { seq: 1 } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );

      const newClass = await Class.create({
        classId: counter.seq,
        className: cls.className,
        division: cls.division,
        students: [],
        professors: [],
        createdBy: hodId
      });
      insertedClasses.push(newClass);
    }

    return successResponse(res, {
      message: `${insertedClasses.length} classes uploaded successfully`,
      totalUploaded: insertedClasses.length,
      totalSkipped: classes.length - classesToInsert.length
    }, 201);

  } catch (error) {
    console.error('bulkUploadClasses error:', error);
    return errorResponse(res, 'Server error during bulk class upload', 500);
  }
};


/**
 * @desc    Create a new class
 * @route   POST /api/classes
 * @access  Private (HOD only)
 */
const createClass = async (req, res) => {
  try {
    const { className, division } = req.body;
    const hodId = req.user.id;

    if (!className || !division) {
      return errorResponse(res, 'Class name and division are required', 400);
    }

    // Atomically increment (or create) the counter for this HOD
    const counter = await Counter.findOneAndUpdate(
      { hod: hodId },
      { $inc: { seq: 1 } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    const newClassId = counter.seq;

    // Create new class with generated numeric classId
    const newClass = await Class.create({
      classId: newClassId,
      className,
      division,
      students: [],
      professors: [],
      createdBy: hodId
    });

    return successResponse(res, {
      message: 'Class created successfully',
      class: newClass
    }, 201);

  } catch (error) {
    // Handle unlikely duplicate key error gracefully
    if (error && (error.code === 11000 || (error.message && error.message.includes('duplicate')))) {
      return errorResponse(res, 'Duplicate class id generated. Please try again.', 500);
    }

    return errorResponse(res, 'Server error while creating class', 500);
  }
};

/**
 * @desc    Get all classes
 * @route   GET /api/classes
 * @access  Private (HOD only)
 */
const getClasses = async (req, res) => {
  try {
    const hodId = req.user.id;

    const classes = await Class.find({ createdBy: hodId })
      .sort({ className: 1, division: 1 })
      .populate("students", "enrollmentNumber name semester")
      .populate("professors", "name username _id");  // ✅ always populated

    return successResponse(res, { classes });
  } catch (error) {
    return errorResponse(res, "Server error while fetching classes", 500);
  }
};



/**
 * @desc    Get class by ID
 * @route   GET /api/classes/:id
 * @access  Private (HOD only)
 */
const getClassById = async (req, res) => {
  try {
    const _id = req.params.id;
    const hodId = req.user.id;

    // Find class by ID and created by this HOD
    const classData = await Class.findOne({
      _id,
      createdBy: hodId
    })
      .populate('students', 'enrollmentNumber name semester')
      .populate('professors', 'name username');

    if (!classData) {
      return errorResponse(res, 'Class not found', 404);
    }

    return successResponse(res, { class: classData });

  } catch (error) {
    return errorResponse(res, 'Server error while fetching class', 500);
  }
};

/**
 * @desc    Update class
 * @route   PUT /api/classes/:id
 * @access  Private (HOD only)
 */
const updateClass = async (req, res) => {
  try {
    const _id = req.params.id;
    const hodId = req.user.id;
    const { className, division } = req.body;

    // Find class by ID and created by this HOD
    let classData = await Class.findOne({
      _id,
      createdBy: hodId
    });

    if (!classData) {
      return errorResponse(res, 'Class not found', 404);
    }

    // Update class fields
    if (className) classData.className = className;
    if (division) classData.division = division;

    // Save updated class
    await classData.save();

    return successResponse(res, {
      message: 'Class updated successfully',
      class: classData
    });

  } catch (error) {
    return errorResponse(res, 'Server error while updating class', 500);
  }
};

/**
 * @desc    Delete class
 * @route   DELETE /api/classes/:id
 * @access  Private (HOD only)
 */
const deleteClass = async (req, res) => {
  try {
    const _id = req.params.id;
    const hodId = req.user.id;

    // Find class by ID and created by this HOD
    const classData = await Class.findOne({
      _id,
      createdBy: hodId
    });

    if (!classData) {
      return errorResponse(res, 'Class not found', 404);
    }

    // Update all students to remove class assignment
    await Student.updateMany(
      { classIds: classData._id },
      { $set: { classIds: null } }
    );

    // Update all professors to remove class from their classes array
    await Professor.updateMany(
      { classes: classData._id },
      { $pull: { classes: classData._id } }
    );

    // Delete class
    await classData.deleteOne();

    return successResponse(res, {
      message: 'Class deleted successfully'
    });

  } catch (error) {
    return errorResponse(res, 'Server error while deleting class', 500);
  }
};

/**
 * @desc    Assign students to class
 * @route   POST /api/classes/:id/students
 * @access  Private (HOD only)
 */
// Assign students
const assignStudentsToClass = async (req, res) => {
  try {
    const classId = req.params.id; // class _id
    const hodId = req.user.id;
    const { studentIds } = req.body;


    if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
      return errorResponse(res, 'Please provide an array of student IDs', 400);
    }

    const classData = await Class.findOne({ _id: classId, createdBy: hodId });
    if (!classData) return errorResponse(res, 'Class not found', 404);

    const studentObjectIds = studentIds.map(id => new mongoose.Types.ObjectId(id));

    const studentsFound = await Student.find({
      _id: { $in: studentObjectIds },
      createdBy: hodId
    });


    if (studentsFound.length !== studentIds.length) {
      return errorResponse(res, 'One or more students not found', 404);
    }

    // Add to class.students without duplicates
    await Class.updateOne(
      { _id: classData._id },
      { $addToSet: { students: { $each: studentObjectIds } } }
    );

    // Set student.classId to the Class _id (ObjectId)
    await Student.updateMany(
      { _id: { $in: studentObjectIds } },
      { $addToSet: { classIds: classData._id } }
    );

    return successResponse(res, { message: `${studentIds.length} students assigned to class successfully` });
  } catch (error) {
    return errorResponse(res, 'Server error while assigning students', 500);
  }
};


/**
 * @desc    Remove students from class
 * @route   DELETE /api/classes/:id/students
 * @access  Private (HOD only)
 */
// ====================== REMOVE STUDENTS FROM CLASS ======================
const removeStudentsFromClass = async (req, res) => {
  try {
    const classId = req.params.id;
    const hodId = req.user.id;

    let studentIds = req.body?.studentIds || req.query?.studentIds;

    if (typeof studentIds === "string") {
      studentIds = studentIds.split(",");
    }

    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      return errorResponse(res, "Please provide an array of student IDs", 400);
    }

    const classData = await Class.findOne({ _id: classId, createdBy: hodId });
    if (!classData) return errorResponse(res, "Class not found", 404);

    const studentObjectIds = studentIds.map(
      (id) => new mongoose.Types.ObjectId(id)
    );

    // 1) Update students collection → set classId = null
    await Student.updateMany(
      { _id: { $in: studentObjectIds } },
      { $pull: { classIds: classData._id } }
    );

    // 2) Remove ObjectIds from "students" array in Class
    await Class.updateOne(
      { _id: classData._id },
      { $pull: { students: { $in: studentObjectIds } } }
    );

    return successResponse(res, { message: "Students removed successfully" });
  } catch (error) {
    console.error("removeStudentsFromClass error:", error);
    return errorResponse(res, "Server error while removing students", 500);
  }
};

/**
 * @desc    Assign professors to class
 * @route   POST /api/classes/:id/professors
 * @access  Private (HOD only)
 */
const assignProfessorsToClass = async (req, res) => {
  try {
    const classId = req.params.id;
    const hodId = req.user.id;
    const { professorIds } = req.body;

    if (!professorIds || !Array.isArray(professorIds) || professorIds.length === 0) {
      return errorResponse(res, 'Please provide an array of professor IDs', 400);
    }

    const classData = await Class.findOne({ _id: classId, createdBy: hodId });
    if (!classData) return errorResponse(res, 'Class not found', 404);

    const profObjectIds = professorIds.map(id => new mongoose.Types.ObjectId(id));

    const professorsFound = await Professor.find({
      _id: { $in: profObjectIds },
      createdBy: hodId
    });

    if (professorsFound.length !== professorIds.length) {
      return errorResponse(res, 'One or more professors not found', 404);
    }

    const existing = classData.professors.map(id => id.toString());
    const merged = Array.from(new Set([...existing, ...professorIds.map(String)]));

    classData.professors = merged.map(id => new mongoose.Types.ObjectId(id));
    await classData.save();

    // Ensure professors reference this class._id
    await Professor.updateMany(
      { _id: { $in: profObjectIds } },
      { $addToSet: { classes: classData._id } }
    );

    return successResponse(res, { message: `${professorIds.length} professors assigned to class successfully` });
  } catch (error) {
    return errorResponse(res, 'Server error while assigning professors', 500);
  }
};


/**
 * @desc    Remove professors from class
 * @route   DELETE /api/classes/:id/professors
 * @access  Private (HOD only)
 */
const removeProfessorsFromClass = async (req, res) => {
  try {
    const classId = req.params.id;
    const hodId = req.user.id;
    const { professorIds } = req.body;

    if (!professorIds || !Array.isArray(professorIds) || professorIds.length === 0) {
      return errorResponse(res, 'Please provide an array of professor IDs', 400);
    }

    const classData = await Class.findOne({ _id: classId, createdBy: hodId });
    if (!classData) return errorResponse(res, 'Class not found', 404);

    const objectIds = professorIds.map(id => new mongoose.Types.ObjectId(id));

    // Pull class _id from professors' classes array
    await Professor.updateMany(
      { _id: { $in: objectIds } },
      { $pull: { classes: classData._id } }
    );

    // Remove from classData.professors (ObjectId compare)
    classData.professors = classData.professors.filter(
      profId => !objectIds.some(objId => objId.equals(profId))
    );
    await classData.save();

    return successResponse(res, { message: `Professors removed from class successfully` });
  } catch (error) {
    return errorResponse(res, 'Server error while removing professors', 500);
  }
};



/**
 * @desc    Bulk delete classes (with cleanup)
 * @route   DELETE /api/classes/bulk
 * @access  Private (HOD only)
 * @body    { classIds: string[] } OR query ?classIds=comma,separated,ids
 */
const bulkDeleteClasses = async (req, res) => {
  const hodId = req.user.id;

  try {
    let classIds = req.body?.classIds || req.query?.classIds;

    if (typeof classIds === 'string') {
      classIds = classIds.split(',').map(s => s.trim()).filter(Boolean);
    }

    if (!Array.isArray(classIds) || classIds.length === 0) {
      return errorResponse(res, 'Please provide an array of class IDs', 400);
    }

    // Validate ObjectIds and keep only valid ones
    const validIds = classIds.filter(mongoose.Types.ObjectId.isValid);
    if (validIds.length === 0) {
      return errorResponse(res, 'No valid class IDs provided', 400);
    }

    // Ensure classes belong to this HOD
    const classes = await Class.find({
      _id: { $in: validIds },
      createdBy: hodId
    }).select('_id');

    if (!classes.length) {
      return errorResponse(res, 'No classes found for deletion', 404);
    }

    const classObjectIds = classes.map(c => c._id);

    // Use a transaction for consistency
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        // 1) Detach students from these classes
        await Student.updateMany(
          { classIds: { $in: classObjectIds } },
          { $pull: { classIds: { $in: classObjectIds } } },
          { session }
        );

        // 2) Pull class references from professors
        await Professor.updateMany(
          { classes: { $in: classObjectIds } },
          { $pull: { classes: { $in: classObjectIds } } },
          { session }
        );

        // 3) Delete classes
        await Class.deleteMany(
          { _id: { $in: classObjectIds }, createdBy: hodId },
          { session }
        );
      });
    } finally {
      await session.endSession();
    }

    const notFoundOrUnauthorized = validIds.filter(
      id => !classObjectIds.some(objId => objId.equals(id))
    );

    return successResponse(res, {
      message: `${classObjectIds.length} classes deleted successfully`,
      totalDeleted: classObjectIds.length,
      totalRequested: validIds.length,
      notDeleted: notFoundOrUnauthorized // IDs not found or not owned by HOD
    });
  } catch (error) {
    console.error('bulkDeleteClasses error:', error);
    return errorResponse(res, 'Server error while bulk deleting classes', 500);
  }
};


module.exports = {
  createClass,
  getClasses,
  getClassById,
  updateClass,
  deleteClass,
  assignStudentsToClass,
  removeStudentsFromClass,
  assignProfessorsToClass,
  removeProfessorsFromClass,
  bulkUploadClasses,
  bulkDeleteClasses
};
