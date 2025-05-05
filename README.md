# Node OpenAI App

This is a full-stack Node.js application that integrates with OpenAI's API to generate dynamic responses based on user input. The project includes a backend powered by Express.js and a frontend built with vanilla JavaScript and HTML. It incorporates a Qdrant database and uses a **Retrieval-Augmented Generation (RAG)** model to enhance responses with relevant context.

---

## Overview

- **Backend**: Manages API requests, file uploads, and communication with OpenAI.
- **Frontend**: Provides a user interface for querying the AI, uploading files, and interacting with the app.
- **Use Case**: Designed to showcase CVs, cover letters, and job application materials, with the ability to query OpenAI and manage content.

---

## Project Structure

```
node-openai-app/
├── backend/
│   ├── texts/                # Uploaded files: CVs, cover letters, job descriptions, and more
│   │   ├── bio/              # Biography files (e.g., bio.txt)
│   │   ├── covers/           # Cover letter files (e.g., Standard cover letter)
│   │   ├── cv/               # CV files (e.g., Standard CV)
│   │   ├── company/          # Company-specific files
│   │   ├── jobs/             # Job description files
│   │   └── user/             # User-specific files
│   ├── routes/               # Express route handlers
│   │   ├── api.js            # Handles OpenAI API requests and Qdrant interactions
│   │   └── upload.js         # Handles file uploads and management
│   ├── server.js             # Express server entry point
│   └── logger.js             # Centralized logging configuration
├── frontend/
│   ├── public/               # Public assets and frontend logic
│   │   ├── cv_public/        # Folder to insert publicly downloadable CV in .pdf form  
│   │   ├── index.html        # Main frontend UI
│   │   ├── upload.html       # Upload and file management page
│   │   ├── styles/           # CSS styling
│   │   │   └── App.css       # Main stylesheet
│   │   ├── images/           # Static assets
│   │   │   ├── profile.jpg   # Profile image
│   │   │   ├── background.png # Background image for the UI
│   │   │   └── background2.png # Background image for dark mode
│   │   └── favicon.ico       # Favicon for the app
│   └── views/                # EJS templates for dynamic rendering
│       ├── index.ejs         # Main page template
│       └── upload.ejs        # Upload page template
├── .env                      # Environment variables for the project
├── .env.example              # Example environment variables
├── package.json              # Combined dependencies and scripts for the entire project
├── package-lock.json         # Lockfile for dependencies
├── README.md                 # Project documentation
└── .gitignore                # Git ignore file
```

---

## Getting Started

### Requirements

- Node.js (v14 or newer)
- npm (Node package manager)

---

### **1. Installation**

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd node-openai-app
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

---

### **2. Environment Configuration**

1. **Configure Environment Variables**:
   - Copy the `.env.example` file to `.env`:
     ```bash
     cp backend/.env.example backend/.env
     ```
   - Update the `.env` file with the user's details:
     - `NAME`: The user's name.
     - `TITLE`: The user's title or role.
     - `BRAND`: The user's expertise or brand.
     - `LOCATION`: The user's location.
   - Update the `.env` file with keys and URLs requested.

---

### **3. Functional Implementation**

1. Open your browser and navigate to:
   ```
   http://localhost:3000/uploaddocs
   ```

2. **Prepare Required Files**:
   - At a minimum, the following files should be created and uploaded to the relevant folders in `backend/texts`:
     - `bio.txt` in the `bio` folder: A brief biography of the user.
     - A standard cover letter in the `covers` folder.
     - A standard CV in the `cv` folder.

3. **Optional Files**:
   - Additional files can be uploaded to the `company`, `jobs`, and `user` folders. These files can be tied together using a unique keyword.

4. **Bundle Documents with Keywords**:
   - To group documents for a specific context, insert the same unique keyword into the filenames or content of the files.

5. **Generate Embeddings Using Qdrant**:
   - After uploading the required files, embeddings need to be generated for the text content to enable similarity searches.
   - Ensure that the Qdrant cluster is running and properly configured in the `.env` file:
     ```env
     CLUSTERURL=your-qdrant-cluster-url
     DBSECRET=your-qdrant-api-key
     QDRANT_COLLECTION_NAME=document_embeddings
     ```

6. **Use Base64 Encoding for Keywords**:
   - Encode the keyword in Base64 and pass it as a query parameter in the URL:
     ```bash
     echo -n "TechCorp" | base64
     ```
   - Use the URL:
     ```
     http://localhost:3000/?state=VGVjaENvcnA=
     ```

7. **Dynamic Context Loading**:
   - When the app detects the `state` query parameter, it decodes the Base64 string and uses the keyword to load the relevant files into the OpenAI context window for that session.

---

## Usage

- Open your browser and navigate to `http://localhost:3000` to access the main interface.
- Use the `/uploaddocs` route to upload and manage `.txt` files.
- Pass a `state` query parameter in the URL to dynamically load specific bundles of embeddings into the OpenAI context.

---

## Future Potential

This application was built with flexibility in mind. While it currently showcases one individual’s professional profile, it is fully compatible with other CVs, cover letters, and job materials. This means other users can upload their own documents and leverage the app as a personal assistant for job seeking and professional interactions.

In the future, the app could:
- Serve as a dynamic, AI-powered portfolio or digital résumé for multiple users.
- Act as a personalized chatbot that role-plays as a job applicant, answering recruiter questions.
- Generate tailored application materials (e.g., cover letters) from uploaded job descriptions.
- Enable secure, shareable links for prospective employers to interact with a candidate’s chatbot persona.

---

## Feature Backlog

The following features are planned for future development but are currently on hold due to time and cost constraints:

1. **Voice Functionality**:
   - Add the ability for the app to interact with users via voice input and output.

2. **Voice Mimicry**:
   - Implement functionality to mimic a specific voice for the assistant, making interactions more personalized.

3. **Tone Mimicry in Writing**:
   - Enhance the assistant's ability to mimic specific tones or writing styles based on user preferences or context.

4. **Prompt Engineering**:
   - Refine prompts sent to the OpenAI API to ensure they are optimized for the app's use case.

5. **UI Cleanup for the Upload Page**:
   - Improve the design and usability of the `/uploaddocs` page to make it more user-friendly.

---

## License

This project is licensed under the MIT License.