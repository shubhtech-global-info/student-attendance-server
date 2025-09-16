const { verifyToken } = require('../config/jwt.config');
const HOD = require('../models/hod.model');
const Professor = require('../models/professor.model');
const Student = require('../models/student.model');
const { errorResponse } = require('../utils/response.utils');
const jwt = require('jsonwebtoken');

// -------------------------------
// Authenticate: Verify JWT token
// -------------------------------

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
    req.user = decoded; // attach user data (id, role, etc.) for further middleware

    next();
  } catch (error) {
    return errorResponse(res, 'Token is invalid or expired', 401);
  }
};

// -------------------------------
// HOD Authorization
// -------------------------------

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

    req.hod = hod; // attach HOD for later use
    next();
  } catch (error) {
    return errorResponse(res, 'Authorization failed', 500);
  }
};

// -------------------------------
// Professor Authorization
// -------------------------------

const authorizeProfessor = async (req, res, next) => {
  try {
    if (!req.user) {
      return errorResponse(res, 'Authentication required', 401);
    }

    if (req.user.role !== 'professor') {
      return errorResponse(res, 'Access denied. Professor authorization required', 403);
    }

    const professor = await Professor.findById(req.user.id);
    if (!professor) {
      return errorResponse(res, 'Professor not found', 404);
    }

    // ✅ Since createdBy is optional, we only attach professor without enforcing link checks
    req.professor = professor;
    next();
  } catch (error) {
    return errorResponse(res, 'Authorization failed', 500);
  }
};

// -------------------------------
// Professor or HOD Authorization
// -------------------------------

const authorizeProfessorOrHod = async (req, res, next) => {
  try {
    if (!req.user) {
      return errorResponse(res, 'Authentication required', 401);
    }

    if (req.user.role === 'professor') {
      const professor = await Professor.findById(req.user.id);
      if (!professor) return errorResponse(res, 'Professor not found', 404);

      req.professor = professor;
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

// -------------------------------
// Student Authorization
// -------------------------------

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

    req.student = student;
    next();
  } catch (error) {
    return errorResponse(res, 'Authorization failed', 500);
  }
};

// -------------------------------
// Protect Student Route (legacy or specific use cases)
// -------------------------------

const protectStudent = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      req.student = await Student.findById(decoded.id).select('-password');

      next();
    } catch (error) {
      console.error(error);
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }
};

module.exports = {
  authenticate,
  authorizeHOD,
  authorizeProfessor,
  authorizeProfessorOrHod,
  authorizeStudent,
  protectStudent
};
