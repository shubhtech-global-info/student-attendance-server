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
  validateLogin
} = require('../middleware/validation.middleware');
const { handleExcelUpload } = require('../middleware/upload.middleware'); // MUST exist (same as classes)

// Public routes
router.post('/login', 
  validateLogin, 
  professorController.loginProfessor);

  // Professor routes
router.get(
  '/classes',
  authenticate,
  authorizeProfessor,
  professorController.getProfessorClasses
);

// HOD routes for managing professors
// NOTE: put bulk-upload and bulk before parameterized routes
router.post(
  '/bulk-upload',
  authenticate,
  authorizeHOD,
  handleExcelUpload, // middleware that places file on req.file
  professorController.bulkUploadProfessors
);

router.delete(
  '/bulk',
  authenticate,
  authorizeHOD,
  professorController.bulkDeleteProfessors
);

router.post(
  '/',
  authenticate,
  authorizeHOD,
  validateProfessor,
  professorController.addProfessor
);

router.get(
  '/',
  authenticate,
  authorizeHOD,
  professorController.getProfessors
);

router.get(
  '/:id',
  authenticate,
  authorizeHOD,
  professorController.getProfessorById
);

router.put(
  '/:id',
  authenticate,
  authorizeHOD,
  professorController.updateProfessor
);

router.delete(
  '/:id',
  authenticate,
  authorizeHOD,
  professorController.deleteProfessor
);

module.exports = router;

