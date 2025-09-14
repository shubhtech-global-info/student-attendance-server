const { verifyToken } = require('../config/jwt.config');
const HOD = require('../models/hod.model');
const Professor = require('../models/professor.model');
const Student = require('../models/student.model');
const { errorResponse } = require('../utils/response.utils');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return errorResponse(res, 'No token provided, authorization denied', 401);
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return errorResponse(res, 'No token provided, authorization denied', 401);
    }

    const decoded = verifyToken(token);
    req.user = decoded;

    next();
  } catch (error) {
    return errorResponse(res, 'Token is invalid or expired', 401);
  }
};

const authorizeHOD = async (req, res, next) => {
  try {
    if (!req.user) {
      return errorResponse(res, 'Authentication required', 401);
    }

    if (req.user.role !== 'hod') {
      return errorResponse(res, 'Access denied. HOD authorization required', 403);
    }

    const hod = await HOD.findById(req.user.id);
    if (!hod) {
      return errorResponse(res, 'HOD not found', 404);
    }

    if (!hod.verified) {
      return errorResponse(res, 'Email verification required', 403);
    }

    next();
  } catch (error) {
    return errorResponse(res, 'Authorization failed', 500);
  }
};

const authorizeProfessor = async (req, res, next) => {
  try {
    if (!req.user) {
      return errorResponse(res, 'Authentication required', 401);
    }

    if (req.user.role !== 'professor') {
      return errorResponse(
        res,
        'Access denied. Professor authorization required',
        403
      );
    }

    const professor = await Professor.findById(req.user.id);
    if (!professor) {
      return errorResponse(res, 'Professor not found', 404);
    }

    // ✅ Extra safety: ensure professor is linked to a valid HOD
    if (!req.user.hodId) {
      return errorResponse(res, 'Professor must be linked to a HOD', 403);
    }

    // Extra validation
    if (String(professor.createdBy) !== String(req.user.hodId)) {
      return errorResponse(res, 'Professor not linked to this HOD', 403);
    }


    const hod = await HOD.findById(req.user.hodId);
    if (!hod) {
      return errorResponse(res, 'Linked HOD not found', 404);
    }

    req.professor = professor; // attach professor to req for convenience
    req.hod = hod; // attach hod if needed later

    next();
  } catch (error) {
    return errorResponse(res, 'Authorization failed', 500);
  }
};

const authorizeProfessorOrHod = async (req, res, next) => {
  try {
    if (!req.user) {
      return errorResponse(res, 'Authentication required', 401);
    }

    if (req.user.role === 'professor') {
      // same checks you already do for professors
      const professor = await Professor.findById(req.user.id);
      if (!professor) return errorResponse(res, 'Professor not found', 404);
      if (!req.user.hodId) return errorResponse(res, 'Professor must be linked to a HOD', 403);
      if (String(professor.createdBy) !== String(req.user.hodId)) {
        return errorResponse(res, 'Professor not linked to this HOD', 403);
      }
      const hod = await HOD.findById(req.user.hodId);
      if (!hod) return errorResponse(res, 'Linked HOD not found', 404);
      req.professor = professor;
      req.hod = hod;
      return next();
    }

    if (req.user.role === 'hod') {
      const hod = await HOD.findById(req.user.id);
      if (!hod) return errorResponse(res, 'HOD not found', 404);
      if (!hod.verified) return errorResponse(res, 'Email verification required', 403);
      req.hod = hod;
      return next();
    }

    return errorResponse(res, 'Access denied. Professor or HOD authorization required', 403);
  } catch (error) {
    return errorResponse(res, 'Authorization failed', 500);
  }
};

const authorizeStudent = async (req, res, next) => {
  try {
    if (!req.user) {
      return errorResponse(res, 'Authentication required', 401);
    }

    if (req.user.role !== 'student') {
      return errorResponse(res, 'Access denied. Student authorization required', 403);
    }

    const student = await Student.findById(req.user.id);
    if (!student) {
      return errorResponse(res, 'Student not found', 404);
    }

    if (!req.user.hodId) {
      return errorResponse(res, 'Student must be linked to a HOD', 403);
    }

    if (String(student.createdBy) !== String(req.user.hodId)) {
      return errorResponse(res, 'Student not linked to this HOD', 403);
    }

    const hod = await HOD.findById(req.user.hodId);
    if (!hod) {
      return errorResponse(res, 'Linked HOD not found', 404);
    }

    req.student = student;
    req.hod = hod;

    next();
  } catch (error) {
    return errorResponse(res, 'Authorization failed', 500);
  }
};


module.exports = {
  authenticate,
  authorizeHOD,
  authorizeProfessor,
  authorizeProfessorOrHod,
  authorizeStudent
};
