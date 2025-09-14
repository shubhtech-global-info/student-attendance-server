// utils/excel.utils.js
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

/**
 * Normalize header for matching (strip spaces, toLowerCase)
 */
function normalizeHeader(h) {
  if (!h) return '';
  return String(h).trim().toLowerCase().replace(/[\s_]+/g, '');
}

/**
 * Parse Excel file and extract student data
 * @param {String} filePath - Path to the Excel file
 * @returns {Array} Array of student objects [{ enrollmentNumber, name, semester }, ...]
 */
const parseExcel = async (filePath) => {
  try {
    if (!fs.existsSync(filePath)) {
      console.warn('[parseExcel] file does not exist:', filePath);
      return [];
    }

    // Read the workbook
    const workbook = XLSX.readFile(filePath);

    // Get the first worksheet
    const sheetName = workbook.SheetNames && workbook.SheetNames[0];
    if (!sheetName) {
      console.warn('[parseExcel] no sheets found');
      return [];
    }
    const worksheet = workbook.Sheets[sheetName];

    // Convert to JSON (keys = header cells as-is)
    const raw = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

    // Optional: remove temp file after reading
    fs.unlink(filePath, (err) => {
      if (err) console.error('Error deleting temporary file:', err);
    });

    if (!Array.isArray(raw) || raw.length === 0) {
      console.warn('[parseExcel] sheet_to_json returned empty or no rows');
      return [];
    }

    // Build header map from first row keys
    const firstRowKeys = Object.keys(raw[0] || {});
    const headerMap = {};
    firstRowKeys.forEach((k) => {
      headerMap[normalizeHeader(k)] = k; // normalized -> original
    });

    // Accept multiple possible header names for each field
    const enrollmentHeader =
      headerMap['enrollmentnumber'] ||
      headerMap['enrollment'] ||
      headerMap['enrollmentno'] ||
      headerMap['roll'] ||
      headerMap['rollnumber'] ||
      headerMap['id'] ||
      headerMap['enrollnumber'] ||
      headerMap['enrollment_number'];

    const nameHeader =
      headerMap['name'] ||
      headerMap['studentname'] ||
      headerMap['fullname'] ||
      headerMap['fullName'.toLowerCase()] ||
      headerMap['student'];

    const semesterHeader =
      headerMap['semester'] ||
      headerMap['sem'] ||
      headerMap['classsemester'];

    const divisionHeader =
      headerMap['division'] ||
      headerMap['div'] ||
      headerMap['section'];


    // Debug logs — helpful while debugging header mismatches
    console.log('[parseExcel] detected headers:', headerMap);
    console.log('[parseExcel] mapped headers =>', { enrollmentHeader, nameHeader, semesterHeader });

    if (!enrollmentHeader || !nameHeader || !semesterHeader) {
      console.warn('[parseExcel] required headers missing; returning []');
      return [];
    }

    // Map rows to expected shape and validate/clean
    const students = raw.map((row) => {
      const enrollmentRaw = row[enrollmentHeader];
      const nameRaw = row[nameHeader];
      const semesterRaw = row[semesterHeader];
      const divisionRaw = row[divisionHeader];


      const enrollmentNumber = enrollmentRaw !== undefined && enrollmentRaw !== null
        ? String(enrollmentRaw).trim()
        : '';

      const name = nameRaw !== undefined && nameRaw !== null
        ? String(nameRaw).trim()
        : '';

      const division = divisionRaw !== undefined && divisionRaw !== null
        ? String(divisionRaw).trim()
        : null;

      // parse semester to integer
      let semester = 0;
      if (typeof semesterRaw === 'number') semester = semesterRaw;
      else if (semesterRaw !== undefined && semesterRaw !== null && String(semesterRaw).trim() !== '') {
        const n = Number(String(semesterRaw).replace(/[^\d.-]/g, ''));
        semester = Number.isNaN(n) ? 0 : n;
      }

      return {
        enrollmentNumber,
        name,
        semester,
        division
      };
    });

    // Filter invalid rows
    const filtered = students.filter(s => s.enrollmentNumber && s.name && s.semester && Number.isFinite(s.semester));

    console.log('[parseExcel] parsed rows:', students.length, 'valid:', filtered.length);
    return filtered;
  } catch (error) {
    console.error('Excel Parsing Error:', error);
    return [];
  }
};

/**
 * Generate Excel file with student data
 * @param {Array} students - Array of student objects
 * @returns {String} Path to the generated Excel file
 */
const generateExcel = async (students) => {
  try {
    // Create a new workbook
    const workbook = XLSX.utils.book_new();

    // Convert students array to worksheet
    const worksheet = XLSX.utils.json_to_sheet(students);

    // Add the worksheet to the workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Students');

    // Generate a unique filename
    const filename = `students_${Date.now()}.xlsx`;
    const filePath = path.join(__dirname, '../uploads', filename);

    // Write to file
    XLSX.writeFile(workbook, filePath);

    return filePath;
  } catch (error) {
    console.error('Excel Generation Error:', error);
    throw new Error('Failed to generate Excel file: ' + error.message);
  }
};

module.exports = {
  parseExcel,
  generateExcel
};
