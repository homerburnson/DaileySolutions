const openai = require('../openai');
const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const router = express.Router();
const directories = ['covers', 'cv', 'jobs','bio', 'company', 'user'];

// Path to the embeddings folder and embeddinglinks.json
const embeddingsFolder = path.join(__dirname, '../embeddings');
const embeddingLinksPath = path.join(__dirname, '../embeddinglinks.json');

// Ensure the embeddings folder and embeddinglinks.json exist
if (!fs.existsSync(embeddingsFolder)) {
    fs.mkdirSync(embeddingsFolder);
}
if (!fs.existsSync(embeddingLinksPath)) {
    fs.writeFileSync(embeddingLinksPath, JSON.stringify([]));
}

// Ensure directories exist
directories.forEach((dir) => {
    const fullPath = path.join(__dirname, `../texts/${dir}`);
    if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
    }
});

// Check embedding links exist
let embeddingLinks = [];
try {
    console.log('Reading embedding links from:', embeddingLinksPath);
    const fileContent = fs.readFileSync(embeddingLinksPath, 'utf8');
    embeddingLinks = fileContent ? JSON.parse(fileContent) : [];
} catch (error) {
    console.error('Error reading or parsing embeddingLinks.json:', error);
    // Initialize with an empty array if the file is invalid
    embeddingLinks = [];
}

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

// Generate embeddings for selected files
router.post('/generate-multi-embedding', async (req, res) => {
    const { files } = req.body;

    if (!files || !Array.isArray(files) || files.length === 0) {
        return res.status(400).json({ error: 'No files specified.' });
    }

    try {
        let combinedContent = '';
        const fileNames = [];

        // Read and combine content from all specified files
        for (const { folder, fileName } of files) {
            const folderPath = path.join(__dirname, `../texts/${folder}`);
            const filePath = path.join(folderPath, fileName);

            if (!fs.existsSync(filePath)) {
                return res.status(404).json({ error: `File not found: ${fileName} in ${folder}` });
            }

            const fileContent = fs.readFileSync(filePath, 'utf8');
            combinedContent += fileContent + '\n';
            fileNames.push(fileName);
        }

        // Generate embedding using OpenAI API
        const response = await openai.embeddings.create({
            model: 'text-embedding-ada-002',
            input: combinedContent,
        });

        const embedding = response.data[0].embedding;

        // Save the embedding to the embeddings folder
        const embeddingsFolder = path.join(__dirname, '../embeddings');
        if (!fs.existsSync(embeddingsFolder)) {
            fs.mkdirSync(embeddingsFolder);
        }

        const embeddingFileName = fileNames.join('_').replace(/[^a-zA-Z0-9_-]/g, '_') + '.json';
        const embeddingFilePath = path.join(embeddingsFolder, embeddingFileName);

        fs.writeFileSync(embeddingFilePath, JSON.stringify({ embedding }, null, 2));

        res.json({ message: 'Embedding generated successfully.', embedding, fileName: embeddingFileName });
    } catch (error) {
        console.error('Error generating embedding:', error);
        res.status(500).json({ error: 'Failed to generate embedding.' });
    }
});

// Save embedding with a key-value pair
router.post('/save-embedding', (req, res) => {

    const { key, fileName } = req.body;

    console.log('Incoming request:', req.body); // Log the request body

    if (!key || !fileName) {
        console.error('Missing key or fileName');
        return res.status(400).json({ error: 'Key and file name are required.' });
    }

    try {
        // Read the existing embedding links
        console.log('Reading embedding links from:', embeddingLinksPath);
        const embeddingLinks = JSON.parse(fs.readFileSync(embeddingLinksPath, 'utf8'));

        // Check if the key already exists
        if (embeddingLinks.some(link => link.key === key)) {
            console.error('Duplicate key:', key);
            return res.status(400).json({ error: 'Key already exists. Please use a unique key.' });
        }

        // Add the new key-value pair
        embeddingLinks.push({ key, fileName });
        console.log('Updated embedding links:', embeddingLinks);

        // Save the updated embedding links
        fs.writeFileSync(embeddingLinksPath, JSON.stringify(embeddingLinks, null, 2));
        console.log('Embedding saved successfully.');

        res.json({ message: 'Embedding saved successfully.' });
    } catch (error) {
        console.error('Error saving embedding:', error);
        res.status(500).json({ error: 'Failed to save embedding.' });
    }
});

// Get all embedding links
router.get('/embedding-links', (req, res) => {
    try {
        const embeddingLinks = JSON.parse(fs.readFileSync(embeddingLinksPath, 'utf8'));
        res.json(embeddingLinks);
    } catch (error) {
        console.error('Error reading embedding links:', error);
        res.status(500).json({ error: 'Failed to load embedding links.' });
    }
});

// Edit an embedding key
router.put('/edit-embedding-key', (req, res) => {
    const { index, oldKey, newKey, fileName } = req.body;

    if (!newKey || !fileName) {
        return res.status(400).json({ error: 'New key and file name are required.' });
    }

    try {
        const embeddingLinks = JSON.parse(fs.readFileSync(embeddingLinksPath, 'utf8'));

        // Check if the new key already exists
        if (embeddingLinks.some(link => link.key === newKey)) {
            return res.status(400).json({ error: 'New key already exists. Please use a unique key.' });
        }

        // Update the key
        embeddingLinks[index].key = newKey;
        fs.writeFileSync(embeddingLinksPath, JSON.stringify(embeddingLinks, null, 2));

        res.json({ message: 'Embedding key updated successfully.' });
    } catch (error) {
        console.error('Error editing embedding key:', error);
        res.status(500).json({ error: 'Failed to edit embedding key.' });
    }
});

// Delete an embedding
router.delete('/delete-embedding', (req, res) => {
    const { key, fileName } = req.body;

    if (!key || !fileName) {
        return res.status(400).json({ error: 'Key and file name are required.' });
    }

    try {
        // Remove the key-value pair from embeddinglinks.json
        const embeddingLinks = JSON.parse(fs.readFileSync(embeddingLinksPath, 'utf8'));
        const updatedLinks = embeddingLinks.filter(link => link.key !== key);
        fs.writeFileSync(embeddingLinksPath, JSON.stringify(updatedLinks, null, 2));

        // Delete the embedding file
        const embeddingFilePath = path.join(embeddingsFolder, fileName);
        if (fs.existsSync(embeddingFilePath)) {
            fs.unlinkSync(embeddingFilePath);
        }

        res.json({ message: 'Embedding deleted successfully.' });
    } catch (error) {
        console.error('Error deleting embedding:', error);
        res.status(500).json({ error: 'Failed to delete embedding.' });
    }
});

module.exports = router;