const express = require('express');
const router = express.Router();
const professorController = require('../controllers/professor.controller');
const {
  authenticate,
  authorizeHOD,
  authorizeProfessor
} = require('../middleware/auth.middleware');
const {
  validateProfessor,
  validateProfessorLogin
} = require('../middleware/validation.middleware');
const { handleExcelUpload } = require('../middleware/upload.middleware'); // Middleware to handle file uploads

// --------------------
// Public Routes
// --------------------

// ✅ Professor login route
// Anyone with valid email and password can log in (no HOD token required)
router.post('/login', 
  validateProfessorLogin,         // Validate request body (email & password)
  professorController.loginProfessor
);

// --------------------
// Professor-Specific Routes
// --------------------

// ✅ Get classes assigned to the logged-in professor
// Requires valid professor authentication
router.get(
  '/classes',
  authenticate,           // Verify token
  authorizeProfessor,     // Ensure role is 'professor'
  professorController.getProfessorClasses
);

// ✅ Get a specific professor's details by ID
// Requires authentication but no role restriction here (implement in controller if needed)
router.get(
  '/:id',
  authenticate,           // Verify token
  professorController.getProfessorById
);

// ✅ Update a specific professor by ID
// Requires authentication but no role restriction here (implement in controller if needed)
router.put(
  '/:id',
  authenticate,           // Verify token
  professorController.updateProfessor
);

// --------------------
// HOD-Managed Routes
// --------------------

// NOTE: These routes are only accessible by HODs and allow them to manage professor records

// ✅ Bulk upload professors via Excel file
// Requires HOD authentication
router.post(
  '/bulk-upload',
  authenticate,           // Verify token
  authorizeHOD,           // Ensure role is 'hod'
  handleExcelUpload,      // Handle file upload
  professorController.bulkUploadProfessors
);

// ✅ Bulk delete professors by criteria
// Requires HOD authentication
router.delete(
  '/bulk',
  authenticate,           // Verify token
  authorizeHOD,           // Ensure role is 'hod'
  professorController.bulkDeleteProfessors
);

// ✅ Add a new professor
// Requires HOD authentication
router.post(
  '/',
  authenticate,           // Verify token
  authorizeHOD,           // Ensure role is 'hod'
  validateProfessor,      // Validate professor details (email, name, password)
  professorController.addProfessor
);

// ✅ Get all professors created by this HOD
// Requires HOD authentication
router.get(
  '/',
  authenticate,           // Verify token
  authorizeHOD,           // Ensure role is 'hod'
  professorController.getProfessors
);

// ✅ Delete a specific professor by ID
// Requires HOD authentication
router.delete(
  '/:id',
  authenticate,           // Verify token
  authorizeHOD,           // Ensure role is 'hod'
  professorController.deleteProfessor
);

module.exports = router;
