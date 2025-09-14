// routes/attendance.routes.js
const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendance.controller');
const { authenticate, authorizeProfessor, authorizeProfessorOrHod, authorizeStudent } = require('../middleware/auth.middleware');

// Write attendance → professors only
router.post('/bulk', authenticate, authorizeProfessor, attendanceController.markBulkAttendance);

router.get('/me', authenticate, authorizeStudent, attendanceController.getStudentAttendanceForSelf);

// Read attendance → professors or hods
router.get('/student/:studentId', authenticate, authorizeProfessorOrHod, attendanceController.getStudentAttendance);
router.get('/class/:classId', authenticate, authorizeProfessorOrHod, attendanceController.getClassAttendance);
router.get('/:classId', authenticate, authorizeProfessorOrHod, attendanceController.getAttendanceByDate);
router.get('/summary/:classId', authenticate, authorizeProfessorOrHod, attendanceController.getMonthlySummary);

module.exports = router;
