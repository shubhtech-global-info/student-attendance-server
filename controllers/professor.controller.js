const Professor = require('../models/professor.model');
const Class = require('../models/class.model');
const mongoose = require('mongoose');
const { generateToken } = require('../config/jwt.config');
const { successResponse, errorResponse } = require('../utils/response.utils');
const XLSX = require('xlsx');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

// -------------------------------
// Helper: Parse Excel file for professors
// -------------------------------

const parseProfessorExcel = async (filePath) => {
  if (!fs.existsSync(filePath)) return [];
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const raw = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

  const normalizeHeader = (h) => String(h || '').trim().toLowerCase().replace(/[\s_]+/g, '');
  const headerMap = {};
  Object.keys(raw[0] || {}).forEach((k) => {
    headerMap[normalizeHeader(k)] = k;
  });

  const nameHeader = headerMap['name'] || headerMap['professorname'] || headerMap['profname'];
  const emailHeader = headerMap['email'] || headerMap['e-mail'] || headerMap['emailaddress'];
  const passwordHeader = headerMap['password'] || headerMap['pass'] || null;

  if (!nameHeader || !emailHeader) return [];

  const DEFAULT_PASSWORD = 'Temp@1234';

  const rows = raw.map((row) => ({
    name: String(row[nameHeader] || '').trim(),
    email: String(row[emailHeader] || '').trim(),
    password: String((passwordHeader && row[passwordHeader]) || DEFAULT_PASSWORD).trim(),
  })).filter(r => r.name && r.email);

  fs.unlink(filePath, () => { });

  return rows;
};

// -------------------------------
// Bulk upload professors
// -------------------------------

const bulkUploadProfessors = async (req, res) => {
  let filePath;
  try {
    if (!req.file) return errorResponse(res, 'Please upload an Excel file', 400);

    filePath = req.file.path;
    const rows = await parseProfessorExcel(filePath);
    if (!rows || rows.length === 0) return errorResponse(res, 'No valid professor data found', 400);

    const normalizedRows = rows.map(r => ({
      name: r.name,
      email: r.email,
      password: r.password || 'Temp@1234'
    })).filter(r => r.name && r.email);

    if (normalizedRows.length === 0) {
      return successResponse(res, {
        message: 'No valid professor rows after normalization',
        totalProcessed: rows.length,
        inserted: 0,
        skipped: 0,
        skippedDetails: []
      });
    }

    // Get all existing emails
    const existing = await Professor.find({}).select('email');
    const existingSet = new Set(existing.map(e => String(e.email).toLowerCase()));

    const seenInFile = new Set();
    const toInsert = [];
    const skipped = [];

    normalizedRows.forEach((r, idx) => {
      const emailLower = r.email.toLowerCase();
      if (existingSet.has(emailLower)) {
        skipped.push({ email: r.email, reason: 'already exists (DB)', row: idx + 2 });
        return;
      }
      if (seenInFile.has(emailLower)) {
        skipped.push({ email: r.email, reason: 'duplicate in uploaded file', row: idx + 2 });
        return;
      }
      seenInFile.add(emailLower);
      toInsert.push({
        name: r.name,
        email: r.email,
        password: r.password
      });
    });

    if (toInsert.length === 0) {
      return successResponse(res, {
        message: 'No new professors to add',
        totalProcessed: normalizedRows.length,
        inserted: 0,
        skipped: skipped.length,
        skippedDetails: skipped
      });
    }

    const inserted = [];
    const errors = [];
    for (const doc of toInsert) {
      try {
        const prof = await Professor.create({
          name: doc.name,
          email: doc.email,
          password: doc.password
        });

        inserted.push({
          id: prof._id,
          name: prof.name,
          email: prof.email
        });
      } catch (err) {
        const errMsg = (err && err.message) ? err.message : String(err);
        if (err.code === 11000 || /duplicate/i.test(errMsg)) {
          skipped.push({ email: doc.email, reason: 'duplicate key error on insert (race?)' });
        } else {
          errors.push({ email: doc.email, error: errMsg });
        }
      }
    }

    return successResponse(res, {
      message: `${inserted.length} professors uploaded`,
      totalProcessed: normalizedRows.length,
      inserted: inserted.length,
      insertedDetails: inserted,
      skipped: skipped.length,
      skippedDetails: skipped,
      errors
    }, 201);

  } catch (error) {
    console.error('bulkUploadProfessors error:', error);
    return errorResponse(res, 'Server error during bulk professor upload', 500);
  } finally {
    try {
      if (filePath && fs.existsSync(filePath)) {
        fs.unlink(filePath, () => { });
      }
    } catch (e) { }
  }
};

// -------------------------------
// Bulk delete professors
// -------------------------------

const bulkDeleteProfessors = async (req, res) => {
  try {
    let professorIds = req.body?.professorIds || req.query?.professorIds;
    if (typeof professorIds === 'string') {
      professorIds = professorIds.split(',').map(s => s.trim()).filter(Boolean);
    }

    if (!Array.isArray(professorIds) || professorIds.length === 0) {
      return errorResponse(res, 'Please provide an array of professor IDs', 400);
    }

    const validIds = professorIds.filter(mongoose.Types.ObjectId.isValid);
    if (validIds.length === 0) {
      return errorResponse(res, 'No valid professor IDs provided', 400);
    }

    const professors = await Professor.find({ _id: { $in: validIds } }).select('_id');

    if (!professors.length) {
      return errorResponse(res, 'No professors found for deletion', 404);
    }

    const profObjectIds = professors.map(p => p._id);

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await Class.updateMany(
          { professors: { $in: profObjectIds } },
          { $pull: { professors: { $in: profObjectIds } } },
          { session }
        );

        await Professor.deleteMany(
          { _id: { $in: profObjectIds } },
          { session }
        );
      });
    } finally {
      await session.endSession();
    }

    const notFound = validIds.filter(id => !profObjectIds.some(objId => objId.equals(id)));

    return successResponse(res, {
      message: `${profObjectIds.length} professors deleted successfully`,
      totalDeleted: profObjectIds.length,
      totalRequested: validIds.length,
      notDeleted: notFound
    });

  } catch (error) {
    console.error('bulkDeleteProfessors error:', error);
    return errorResponse(res, 'Server error while bulk deleting professors', 500);
  }
};

// -------------------------------
// Add professor
// -------------------------------

const addProfessor = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const professorExists = await Professor.findOne({ email: email.toLowerCase() });
    if (professorExists) {
      return errorResponse(res, 'Email already taken', 400);
    }

    const professor = await Professor.create({
      name,
      email: email.toLowerCase(),
      password
    });

    return successResponse(res, {
      message: 'Professor added successfully',
      professor: {
        id: professor._id,
        name: professor.name,
        email: professor.email
      }
    }, 201);

  } catch (error) {
    return errorResponse(res, 'Server error while adding professor', 500);
  }
};

// -------------------------------
// Get all professors
// -------------------------------

const getProfessors = async (req, res) => {
  try {
    const professors = await Professor.find()
      .select('-password')
      .sort({ createdAt: -1 });

    return successResponse(res, { professors });
  } catch (error) {
    return errorResponse(res, 'Server error while fetching professors', 500);
  }
};

// -------------------------------
// Get professor by ID
// -------------------------------

const getProfessorById = async (req, res) => {
  try {
    const professorId = req.params.id;
    const professor = await Professor.findById(professorId).select('-password');

    if (!professor) {
      return errorResponse(res, 'Professor not found', 404);
    }

    return successResponse(res, { professor });
  } catch (error) {
    return errorResponse(res, 'Server error while fetching professor', 500);
  }
};

// -------------------------------
// Update professor
// -------------------------------

/**
 * Update a specific professor by ID
 */
const updateProfessor = async (req, res) => {
  try {
    const professorId = req.params.id;
    const { name, email, password } = req.body;

    // Check if at least one field is provided
    if (!name && !email && !password) {
      return errorResponse(res, 'At least one field (name, email, or password) must be provided', 400);
    }

    let professor = await Professor.findById(professorId);
    if (!professor) {
      return errorResponse(res, 'Professor not found', 404);
    }

    // Validate and update email if provided
    if (email) {
      const trimmedEmail = email.trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmedEmail)) {
        return errorResponse(res, 'A valid email is required', 400);
      }
      if (trimmedEmail !== professor.email) {
        const emailExists = await Professor.findOne({
          email: trimmedEmail,
          _id: { $ne: professorId }
        });
        if (emailExists) {
          return errorResponse(res, 'Email already taken', 400);
        }
        professor.email = trimmedEmail;
      }
    }

    // Update name if provided
    if (name) {
      const trimmedName = name.trim();
      if (!trimmedName) {
        return errorResponse(res, 'Name cannot be empty', 400);
      }
      professor.name = trimmedName;
    }

    // Update password if provided
    if (password) {
      if (password.length < 6) {
        return errorResponse(res, 'Password must be at least 6 characters long', 400);
      }
      professor.password = password; // The pre-save hook will hash this
    }

    // Save updates
    await professor.save();

    return successResponse(res, {
      message: 'Professor updated successfully',
      professor: {
        id: professor._id,
        name: professor.name,
        email: professor.email
      }
    });

  } catch (error) {
    console.error('updateProfessor error:', error);
    return errorResponse(res, 'Server error while updating professor', 500);
  }
};

// -------------------------------
// Delete professor
// -------------------------------

const deleteProfessor = async (req, res) => {
  try {
    const professorId = req.params.id;

    const professor = await Professor.findById(professorId);
    if (!professor) {
      return errorResponse(res, 'Professor not found', 404);
    }

    await Class.updateMany(
      { professors: professorId },
      { $pull: { professors: professorId } }
    );

    await professor.deleteOne();

    return successResponse(res, { message: 'Professor deleted successfully' });

  } catch (error) {
    return errorResponse(res, 'Server error while deleting professor', 500);
  }
};

// -------------------------------
// Professor login
// -------------------------------
const loginProfessor = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find professor by email (case-insensitive)
    const professor = await Professor.findOne({ email: email.toLowerCase() });
    if (!professor) {
      return errorResponse(res, 'Professor not found', 404);
    }

    // Check if password matches
    const isMatch = await bcrypt.compare(password, professor.password);
    if (!isMatch) {
      return errorResponse(res, 'Invalid credentials', 400);
    }

    // Generate token with professor info
    const token = generateToken(professor, 'professor');

    // Return token to client
    return successResponse(res, { token }, 'Professor logged in successfully');
  } catch (error) {
    console.error('loginProfessor error:', error);
    return errorResponse(res, 'Professor login failed', 500);
  }
};


// -------------------------------
// Get professor's classes
// -------------------------------

const getProfessorClasses = async (req, res) => {
  try {
    const professorId = req.user.id;

    const professor = await Professor.findById(professorId);
    if (!professor) {
      return errorResponse(res, 'Professor not found', 404);
    }

    const classes = await Class.find({ professors: professorId })
      .populate('students', 'enrollmentNumber name');

    const formattedClasses = classes.map(cls => ({
      _id: cls._id,
      classId: cls.classId,
      className: cls.className,
      division: cls.division,
      students: cls.students.map(student => ({
        id: student._id,
        enrollment: student.enrollmentNumber,
        name: student.name
      }))
    }));

    return successResponse(res, { classes: formattedClasses });

  } catch (error) {
    console.error('getProfessorClasses error:', error);
    return errorResponse(res, 'Server error while fetching classes', 500);
  }
};

module.exports = {
  addProfessor,
  getProfessors,
  getProfessorById,
  updateProfessor,
  deleteProfessor,
  loginProfessor,
  getProfessorClasses,
  bulkUploadProfessors,
  bulkDeleteProfessors,
};
