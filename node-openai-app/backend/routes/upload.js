const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const router = express.Router();
const directories = ['covers', 'cv', 'jobs','bio', 'company', 'user'];

// Ensure directories exist
directories.forEach((dir) => {
    const fullPath = path.join(__dirname, `../texts/${dir}`);
    if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
    }
});

// Multer configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const folder = req.body.folder;
        const uploadPath = path.join(__dirname, `../texts/${folder}`);
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    },
});

const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (path.extname(file.originalname) !== '.txt') {
            return cb(new Error('Only .txt files are allowed!'));
        }
        cb(null, true);
    },
});

const pdfUpload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => {
            const uploadPath = path.join(__dirname, '../../frontend/public/cv_public');
            cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
            cb(null, file.originalname);
        },
    }),
    fileFilter: (req, file, cb) => {
        if (path.extname(file.originalname).toLowerCase() !== '.pdf') {
            return cb(new Error('Only .pdf files are allowed!'));
        }
        cb(null, true);
    },
});

// Upload or replace a PDF file in the cv_public directory
router.post('/upload-pdf', pdfUpload.single('file'), (req, res) => {
    console.log('PDF upload request received.');

    const uploadPath = path.join(__dirname, '../../frontend/public/cv_public');
    const filePath = path.join(uploadPath, req.file.originalname);

    // Ensure the cv_public directory exists
    if (!fs.existsSync(uploadPath)) {
        console.log('cv_public directory does not exist. Creating it...');
        fs.mkdirSync(uploadPath, { recursive: true });
    }

    // Check if the uploaded file is a PDF
    if (path.extname(req.file.originalname).toLowerCase() !== '.pdf') {
        console.error('Uploaded file is not a PDF.');
        return res.status(400).json({ error: 'Only PDF files are allowed!' });
    }

    // Move the uploaded file to the cv_public directory
    fs.rename(req.file.path, filePath, (err) => {
        if (err) {
            console.error('Error moving the file:', err);
            return res.status(500).json({ error: 'Failed to upload PDF file.' });
        }
        console.log('PDF file uploaded successfully:', req.file.originalname);
        res.json({ message: 'PDF file uploaded successfully!', file: req.file.originalname });
    });
});

// Upload route
router.post('/', upload.single('file'), (req, res) => {
    res.json({ message: 'File uploaded successfully!', file: req.file });
});

// List files in a folder
router.get('/files', (req, res) => {
    const folder = req.query.folder;
    console.log('folder:', folder);
    const folderPath = path.join(__dirname, `../texts/${folder}`);

    if (!directories.includes(folder)) {
        return res.status(400).json({ error: 'Invalid folder specified.' });
    }

    fs.readdir(folderPath, (err, files) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to read folder.' });
        }

        const fileContents = files.map((file) => {
            const content = fs.readFileSync(path.join(folderPath, file), 'utf8');
            return { name: file, content };
        });

        res.json(fileContents);
    });
});

// Update file content
router.put('/files', (req, res) => {
    console.log('req.body:', req.body);
    const { folder, fileName, content } = req.body;
    const filePath = path.join(__dirname, `../texts/${folder}/${fileName}`);

    if (!directories.includes(folder)) {
        return res.status(400).json({ error: 'Invalid folder specified.' });
    }

    fs.writeFile(filePath, content, (err) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to update file.' });
        }
        res.json({ message: 'File updated successfully.' });
    });
});

// Delete a file
router.delete('/files', (req, res) => {
    const { folder, fileName } = req.query;
    const filePath = path.join(__dirname, `../texts/${folder}/${fileName}`);

    if (!directories.includes(folder)) {
        return res.status(400).json({ error: 'Invalid folder specified.' });
    }

    fs.unlink(filePath, (err) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to delete file.' });
        }
        res.json({ message: 'File deleted successfully.' });
    });
});

// Rename a file
router.put('/rename', (req, res) => {
    const { folder, currentFileName, newFileName } = req.body;

    // Validate folder
    if (!directories.includes(folder)) {
        return res.status(400).json({ error: 'Invalid folder specified.' });
    }

    // Validate file names
    if (!currentFileName || !newFileName) {
        return res.status(400).json({ error: 'Both currentFileName and newFileName must be provided.' });
    }

    const folderPath = path.join(__dirname, `../texts/${folder}`);
    const currentFilePath = path.join(folderPath, currentFileName);
    const newFilePath = path.join(folderPath, newFileName);

    // Check if the current file exists
    if (!fs.existsSync(currentFilePath)) {
        return res.status(404).json({ error: 'The file to rename does not exist.' });
    }

    // Rename the file
    fs.rename(currentFilePath, newFilePath, (err) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to rename file.' });
        }
        res.json({ message: 'File renamed successfully.', oldName: currentFileName, newName: newFileName });
    });
});

module.exports = router;