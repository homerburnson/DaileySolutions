const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const router = express.Router();
const directories = ['covers', 'cv', 'jobs'];

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

module.exports = router;