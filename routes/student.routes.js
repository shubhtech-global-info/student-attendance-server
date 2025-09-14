const express = require('express');
const router = express.Router();
const studentController = require('../controllers/student.controller');
const { authenticate, authorizeHOD, authorizeStudent  } = require('../middleware/auth.middleware');
const { handleExcelUpload } = require('../middleware/upload.middleware');
const { validateStudentLogin } = require('../middleware/validation.middleware');

/**
 * Custom middleware: Allow either HOD or Professor to access
 */
const allowHODorProfessor = (req, res, next) => {
  if (req.user?.role === 'hod' || req.user?.role === 'professor') {
    return next();
  }
  return res.status(403).json({ message: 'Forbidden: Only HOD or Professor allowed' });
};

// Student login with HOD authorization
router.post('/login', authenticate, authorizeHOD, validateStudentLogin, studentController.loginStudent);

// ✅ Register FCM token → students only
router.post('/fcm-token', authenticate, authorizeStudent, studentController.registerFcmToken);

// ✅ (Optional later) Remove FCM token → students only
// router.delete('/fcm-token', authenticate, authorizeStudent, studentController.removeFcmToken);

// ✅ Shared access: HOD + Professor can fetch students
router.get('/', authenticate, allowHODorProfessor, studentController.getStudents);

// ✅ All routes below require HOD only
router.use(authenticate, authorizeHOD);

// Bulk upload students from Excel
router.post('/bulk-upload', handleExcelUpload, studentController.bulkUploadStudents);

// Bulk delete students
router.delete('/', studentController.deleteStudentsBulk);

// Add single student
router.post('/', studentController.addStudent);

// Get student by ID
router.get('/:id', studentController.getStudentById);

// Update student
router.put('/:id', studentController.updateStudent);

// Delete student
router.delete('/:id', studentController.deleteStudent);

module.exports = router;
