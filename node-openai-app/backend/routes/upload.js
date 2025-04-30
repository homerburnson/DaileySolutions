const openai = require('../openai');
const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { RecursiveCharacterTextSplitter } = require('langchain/text_splitter');
const { OpenAIEmbeddings } = require('langchain/embeddings/openai');
const { QdrantClient } = require('@qdrant/js-client-rest');
const { v4: uuidv4 } = require('uuid'); // Import UUID library

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

// Qdrant client setup
const qdrantClient = new QdrantClient({
    url: process.env.CLUSTERURL, // Qdrant instance URL
    apiKey: process.env.DBSECRET, // Optional API key if authentication is enabled
});

// Collection name in Qdrant
const COLLECTION_NAME = process.env.COLLECTION_NAME || 'default_collection'; // Default collection name

// Ensure the collection exists in Qdrant
async function ensureCollection() {
    const collections = await qdrantClient.getCollections();
    if (!collections.collections.some(c => c.name === COLLECTION_NAME)) {
        await qdrantClient.createCollection(COLLECTION_NAME, {
            vectors: {
                size: 1536, // Size of OpenAI embeddings
                distance: 'Cosine', // Use cosine similarity for vector search
            },
        });
        console.log(`Collection "${COLLECTION_NAME}" created in Qdrant.`);
    }
}
ensureCollection();

// Chunk documents using LangChain
async function chunkDocument(content) {
    console.log('Starting document chunking...');
    const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000, // Maximum size of each chunk
        chunkOverlap: 100, // Overlap between chunks
    });

    const chunks = await splitter.createDocuments([content]);
    console.log(`Document chunked into ${chunks.length} chunks.`);
    return chunks.map(chunk => chunk.pageContent); // Extract chunk content
}

// Generate embeddings for chunks
async function generateEmbeddings(chunks) {
    console.log('Initializing OpenAI embeddings...');
    const embeddings = new OpenAIEmbeddings({
        openAIApiKey: process.env.OPENAI_API_KEY, // Your OpenAI API key
    });

    const chunkEmbeddings = [];
    for (const [index, chunk] of chunks.entries()) {
        console.log(`Generating embedding for chunk ${index + 1}/${chunks.length}`);
        const embedding = await embeddings.embedQuery(chunk);
        chunkEmbeddings.push(embedding);
    }

    console.log('Finished generating embeddings for all chunks.');
    return chunkEmbeddings;
}

// Store embeddings in Qdrant
async function storeEmbeddingsInQdrant(key, chunks, embeddings) {
    console.log(`Storing embeddings in Qdrant for key: ${key}`);
    const points = chunks.map((chunk, index) => {
        const pointId = uuidv4(); // Generate a valid UUID for the point ID
        console.log(`Generated point ID: ${pointId} for chunk index: ${index}`);
        return {
            id: pointId, // Use UUID as the point ID
            vector: embeddings[index], // Embedding vector
            payload: {
                key, // User-provided key
                chunk_id: index, // Chunk ID
                chunk_text: chunk, // Original chunk text
            },
        };
    });

    try {
        console.log(`Upserting ${points.length} points into Qdrant collection: ${COLLECTION_NAME}`);
        await qdrantClient.upsert(COLLECTION_NAME, { points });
        console.log(`Successfully stored embeddings in Qdrant for key: ${key}`);
    } catch (error) {
        console.error('Error storing embeddings in Qdrant:', error);
        throw error;
    }
}

// Generate embeddings for selected files and store in Qdrant
router.post('/generate-multi-embedding', async (req, res) => {
    const { files, key } = req.body;

    if (!files || !Array.isArray(files) || files.length === 0) {
        console.error('No files specified for embedding generation.');
        return res.status(400).json({ error: 'No files specified.' });
    }

    if (!key) {
        console.error('Key is required for embedding generation.');
        return res.status(400).json({ error: 'Key is required.' });
    }

    try {
        console.log(`Starting embedding generation for key: ${key}`);
        let combinedContent = '';
        const fileNames = [];

        // Read and combine content from all specified files
        for (const { folder, fileName } of files) {
            const folderPath = path.join(__dirname, `../texts/${folder}`);
            const filePath = path.join(folderPath, fileName);

            if (!fs.existsSync(filePath)) {
                console.error(`File not found: ${fileName} in folder: ${folder}`);
                return res.status(404).json({ error: `File not found: ${fileName} in ${folder}` });
            }

            console.log(`Reading file: ${fileName} from folder: ${folder}`);
            const fileContent = fs.readFileSync(filePath, 'utf8');
            combinedContent += fileContent + '\n';
            fileNames.push(fileName);
        }

        console.log('Finished reading and combining file content.');
        console.log('Starting document chunking...');
        const chunks = await chunkDocument(combinedContent);
        console.log(`Document chunked into ${chunks.length} chunks.`);

        console.log('Starting embedding generation for chunks...');
        const embeddings = await generateEmbeddings(chunks);
        console.log(`Generated embeddings for ${embeddings.length} chunks.`);

        console.log('Storing embeddings in Qdrant...');
        await storeEmbeddingsInQdrant(key, chunks, embeddings);

        console.log('Embedding generation and storage completed successfully.');
        res.json({ message: 'Embeddings generated and stored successfully.', key });
    } catch (error) {
        console.error('Error generating embeddings:', error);
        res.status(500).json({ error: 'Failed to generate embeddings.' });
    }
});

// Save embedding with a key-value pair in Qdrant
router.post('/save-embedding', async (req, res) => {
    const { key, chunks, embeddings } = req.body;

    console.log('Incoming request:', req.body); // Log the request body

    if (!key || !chunks || !embeddings || chunks.length !== embeddings.length) {
        console.error('Invalid request data');
        return res.status(400).json({ error: 'Key, chunks, and embeddings are required, and their lengths must match.' });
    }

    try {
        // Ensure the collection exists in Qdrant
        const collectionName = `${key}`;
        const collections = await qdrantClient.getCollections();
        if (!collections.collections.some(c => c.name === collectionName)) {
            await qdrantClient.createCollection(collectionName, {
                vectors: {
                    size: 1536, // Size of OpenAI embeddings
                    distance: 'Cosine', // Use cosine similarity for vector search
                },
            });
            console.log(`Collection "${collectionName}" created in Qdrant.`);
        }

        // Prepare points for Qdrant
        const points = chunks.map((chunk, index) => ({
            id: `${key}-${index}`, // Unique ID for each chunk
            vector: embeddings[index], // Embedding vector
            payload: {
                key, // User-provided key
                chunk_id: index, // Chunk ID
                chunk_text: chunk, // Original chunk text
            },
        }));

        // Insert points into Qdrant
        await qdrantClient.upsert(collectionName, { points });
        console.log(`Embeddings stored in Qdrant for key: ${key}`);

        res.json({ message: 'Embedding saved successfully in Qdrant.', key });
    } catch (error) {
        console.error('Error saving embedding in Qdrant:', error);
        res.status(500).json({ error: 'Failed to save embedding in Qdrant.' });
    }
});

// Get all embedding collections from Qdrant
router.get('/embedding-links', async (req, res) => {
    try {
        const collections = await qdrantClient.getCollections();
        const embeddingLinks = collections.collections.map(collection => ({
            key: collection.name,
            collectionName: collection.name,
        }));

        res.json(embeddingLinks);
    } catch (error) {
        console.error('Error fetching embedding collections from Qdrant:', error);
        res.status(500).json({ error: 'Failed to load embedding collections.' });
    }
});

// Rename an embedding collection in Qdrant
router.put('/edit-embedding-key', async (req, res) => {
    const { oldKey, newKey } = req.body;

    if (!oldKey || !newKey) {
        return res.status(400).json({ error: 'Both oldKey and newKey must be provided.' });
    }

    const oldCollectionName = `${oldKey}`;
    const newCollectionName = `${newKey}`;

    try {
        const collections = await qdrantClient.getCollections();
        if (!collections.collections.some(c => c.name === oldCollectionName)) {
            return res.status(404).json({ error: `Collection "${oldCollectionName}" does not exist.` });
        }

        if (collections.collections.some(c => c.name === newCollectionName)) {
            return res.status(400).json({ error: `Collection "${newCollectionName}" already exists.` });
        }

        const points = await qdrantClient.scroll(oldCollectionName, {});

        await qdrantClient.createCollection(newCollectionName, {
            vectors: {
                size: 1536,
                distance: 'Cosine',
            },
        });

        await qdrantClient.upsert(newCollectionName, { points: points.result });
        await qdrantClient.deleteCollection(oldCollectionName);

        res.json({ message: `Collection renamed successfully from "${oldKey}" to "${newKey}".` });
    } catch (error) {
        console.error('Error renaming embedding collection in Qdrant:', error);
        res.status(500).json({ error: 'Failed to rename embedding collection.' });
    }
});

// Delete an embedding
router.delete('/delete-embedding', async (req, res) => {
    const { key } = req.body;

    if (!key) {
        return res.status(400).json({ error: 'Key is required.' });
    }

    const collectionName = `${key}`;

    try {
        const collections = await qdrantClient.getCollections();
        if (!collections.collections.some(c => c.name === collectionName)) {
            return res.status(404).json({ error: `Collection "${collectionName}" does not exist.` });
        }

        await qdrantClient.deleteCollection(collectionName);
        res.json({ message: `Collection "${key}" deleted successfully.` });
    } catch (error) {
        console.error('Error deleting embedding collection in Qdrant:', error);
        res.status(500).json({ error: 'Failed to delete embedding collection.' });
    }
});

module.exports = router;