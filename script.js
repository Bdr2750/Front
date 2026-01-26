// DOM Elements
const robot = document.getElementById('robot');
const statusText = document.getElementById('status-text'); // Note: Text content is hidden, but element might be used for state
const voiceSelect = document.getElementById('voice-select');
const infoContainer = document.getElementById('info-container'); // Added for easy access
const fileLoadedBubble = document.getElementById('file-loaded-bubble'); // Added for file load indicator
const fileLoadedMessage = document.getElementById('file-loaded-message'); // Added for file load indicator message
const stopButton = document.getElementById('stop-button'); // Added via previous instruction
const sqlPromptButtons = document.querySelectorAll('.sql-prompt-suggestion'); // NEW: SQL prompt buttons
const fileIndicator = document.getElementById('file-indicator'); // NEW: File indicator element
const csvIndicatorSpan = document.getElementById('csv-file-indicator'); // NEW: CSV indicator span
const pdfIndicatorSpan = document.getElementById('pdf-file-indicator'); // NEW: PDF indicator span
const pptxIndicatorSpan = document.getElementById('pptx-file-indicator'); // New PowerPoint indicator
const docxIndicatorSpan = document.getElementById('docx-file-indicator'); // NEW: DOCX indicator span
const robotMouth = document.getElementById('stop-mouth');
const robotEarLeft = document.getElementById('robot-ear-left');
const robotEarRight = document.getElementById('robot-ear-right');


// Global Variables
let uploadInProgress = false;
let isAskMeMode = false;
let transcriptContent = "";
let transcriptFileName = "";
let questionCount = 0;
let answerCount = 0;
let qaBuffer = [];
let recognition = null;
let isListening = false;
let isSpeaking = false;
let isThinking = false;
let conversationHistory = [];
let voices = [];
let microphoneInitialized = false;
let lastUserQuery = ''; // Added global variable
let fileLoadBubbleTimeout = null; // Added for managing bubble timeout
let lastGeneratedSql = ''; // To store the last generated SQL query
window.sqlCodeForCloud = ''; // For storing SQL code without quotes for cloud upload
window.sqlCodeForLocal = ''; // For storing SQL code (now also without quotes) for local execution
let microphoneEnabled = false; // Add this line to initialize the microphone state
let autoRestartListening = false; // Also initialize this related variable
window.selectedFemaleVoice = null; // For storing the best female voice
let suggestionsLLM = null; // For the suggestions API
let suggestionsUpdateTimeout = null; // For debouncing suggestion updates
let lastSuggestionsUpdate = 0; // Timestamp of the last suggestion update
let selectedGoogleDriveFile = null;
const NORMAL_FOLDER_ID = '1zRS5g_L0uopVK1tsjRleCuLslJDmQGGi';
const SUPERUSER_FOLDER_ID = '1056jdfP4Kk0dH66AefJeqaFa4KujS8zJ';
const TRANSCRIPT_FOLDER_ID = '1056jdfP4Kk0dH66AefJeqaFa4KujS8zJ'; // NEW: All transcripts go here
let GOOGLE_DRIVE_UPLOAD_FOLDER_ID = '1zRS5g_L0uopVK1tsjRleCuLslJDmQGGi';
// Google Drive API configuration
const GOOGLE_DRIVE_API_KEY = 'YOUR_API_KEY';
const GOOGLE_DRIVE_FOLDER_ID = '1056jdfP4Kk0dH66AefJeqaFa4KujS8zJ';
// Star Rating System
let currentStarRating = 3; // Default rating
window.currentStarRating = 3; // Add this at the very top
// Ensure star rating is always available
if (typeof currentStarRating === 'undefined') {
    let currentStarRating = 3; // Default rating
}

// SIMPLE STAR RATING - ADD THIS AT THE TOP
window.currentStarRating = 3; // Make it truly global

// Simple function to always get a valid star rating
function getStars() {
    return window.currentStarRating || 3;
}

// Function to get current star rating safely
function getCurrentStarRating() {
    if (typeof currentStarRating === 'undefined' || currentStarRating === null) {
        return 3; // Default fallback
    }
    return currentStarRating;
}

// COMPLETE WORKING STAR RATING SYSTEM
function initializeStarRating() {
    window.currentStarRating = 3; // Set default

    const starButtons = document.querySelectorAll('.star-btn');

    if (starButtons.length === 0) {
        console.log('No star buttons found');
        return;
    }

    // Set initial display to 3 stars
    starButtons.forEach((star, index) => {
        if (index < 3) {
            star.classList.add('active');
        } else {
            star.classList.remove('active');
        }
    });

    // Add click handlers
    starButtons.forEach((star, index) => {
        star.addEventListener('click', () => {
            window.currentStarRating = index + 1;
            console.log(`⭐ Rating changed to: ${window.currentStarRating} stars`);

            // Update visual display - remove all active classes first
            starButtons.forEach(s => s.classList.remove('active'));

            // Add active class to selected stars
            for (let i = 0; i <= index; i++) {
                starButtons[i].classList.add('active');
            }
        });

        // Add hover effects
        star.addEventListener('mouseenter', () => {
            starButtons.forEach(s => s.classList.remove('hover-active'));
            for (let i = 0; i <= index; i++) {
                starButtons[i].classList.add('hover-active');
            }
        });

        star.addEventListener('mouseleave', () => {
            starButtons.forEach(s => s.classList.remove('hover-active'));
        });
    });

    console.log(`Star rating initialized: ${starButtons.length} buttons found, default rating: ${window.currentStarRating}`);
}

function updateStarDisplay(rating) {
    const starButtons = document.querySelectorAll('.star-btn');
    starButtons.forEach((star, index) => {
        star.classList.remove('active', 'hover-active');
        if (index < rating) {
            star.classList.add('active');
        }
    });
}

function highlightStars(rating, isHover = false) {
    const starButtons = document.querySelectorAll('.star-btn');
    starButtons.forEach((star, index) => {
        star.classList.remove('active', 'hover-active');
        if (index < rating) {
            star.classList.add(isHover ? 'hover-active' : 'active');
        } else if (index < currentStarRating) {
            star.classList.add('active');
        }
    });
}

// Modified addQA function to include stars
function addQA(role, content) {
    if (role === 'user') {
        questionCount++;
        qaBuffer.push(`Q${questionCount}: ${content} STARS : ${getStars()}`);
    } else if (role === 'assistant') {
        answerCount++;
        qaBuffer.push(`A${answerCount}: ${content}`);
    }
    console.log(`Added ${role}: Q${questionCount}/A${answerCount} ${role === 'user' ? `(⭐${getStars()})` : ''}`);
}

// Enhanced conversation export function
function addToConversationExport(role, content) {
    const stars = window.currentStarRating || 3; // Simple fallback

    if (role === 'user') {
        conversationExport.push({
            question: content,
            stars: stars,
            timestamp: new Date().toISOString()
        });
    } else if (role === 'assistant' && conversationExport.length > 0) {
        const lastEntry = conversationExport[conversationExport.length - 1];
        if (!lastEntry.answer) {
            lastEntry.answer = content;
            lastEntry.answerTimestamp = new Date().toISOString();
        }
    }
}

// Updated export function to include stars
function exportConversationToTxt() {
    if (uploadInProgress || conversationExport.length === 0 || isSuperUser) return;

    uploadInProgress = true;

    const fileInfo = getLoadedFileInfo();

    let txtContent = `SESSION: ${sessionId}\n`;
    txtContent += `Date: ${new Date().toISOString().slice(0, 19).replace('T', ' ')}\n`;
    if (fileInfo.length > 0) {
        txtContent += `Files Used: ${fileInfo.join(', ')}\n`;
    }
    txtContent += '\n';

    conversationExport.forEach((entry, index) => {
        const stars = (typeof entry.stars !== 'undefined' && entry.stars !== null) ? entry.stars : 3;
        txtContent += `Q${index + 1}: ${entry.question} STARS : ${stars}\n`;
        txtContent += `A${index + 1}: ${entry.answer || 'No answer'}\n`;
        if (index < conversationExport.length - 1) txtContent += '\n';
    });

    const params = new URLSearchParams({
        sessionId: sessionId,
        content: txtContent,
        fileInfo: JSON.stringify(fileInfo)
    });

    navigator.sendBeacon(`${BACKEND_API_URL}/api/upload-session-simple?${params}`);

    setTimeout(() => { uploadInProgress = false; }, 2000);
}

function initializeAskMeMode() {
    const askMeButton = document.getElementById('ask-me-button');
    if (askMeButton) {
        askMeButton.addEventListener('click', toggleAskMeMode);
    }
}
function toggleAskMeMode() {
    const askMeButton = document.getElementById('ask-me-button');

    if (!askMeButton) return;

    isAskMeMode = !isAskMeMode;

    if (isAskMeMode) {
        askMeButton.classList.add('active');
        askMeButton.textContent = 'Exit Ask Me';

        // Send initial ask me message
        sendAskMeMessage("Hello! I'm ready to help you explore your documents. What would you like to know?");
    } else {
        askMeButton.classList.remove('active');
        askMeButton.innerHTML = '<span class="ask-me-icon">?</span>Ask Me';
    }
}

function initializeSuperUserButton() {
    const superUserBtn = document.getElementById('super-user-btn');
    const superUserTitle = document.getElementById('super-user-title');

    if (superUserBtn) {
        superUserBtn.addEventListener('click', function () {
            isSuperUser = !isSuperUser;

            if (isSuperUser) {
                // Switch to Super User mode
                superUserBtn.innerHTML = '<span class="button-text">User</span>';
                superUserBtn.classList.add('active');
                superUserTitle.style.display = 'block';

                // Clear all loaded files
                clearAllFiles();

                // Clear clinical trials data
                clearClinicalTrialsData();
                document.getElementById('google-drive-upload-btn').innerHTML = '<span class="upload-icon"></span> Load Transcripts from Cloud';


                // Change robot appearance
                const robotContainer = document.querySelector('.robot-container');
                if (robotContainer) {
                    robotContainer.classList.add('super-user');
                }

                // Update folder ID for Google Drive
                GOOGLE_DRIVE_UPLOAD_FOLDER_ID = SUPERUSER_FOLDER_ID;

                updateStatus('Super User mode activated. Click on Load Transcripts from cloud then ask me questions.');
                window.speakText("Super User mode activated. Click on Load Transcripts from Cloud then ask me questions.");

            } else {
                // Exit Super User mode
                superUserBtn.innerHTML = '<span class="button-text">Super User</span>';
                superUserBtn.classList.remove('active');
                superUserTitle.style.display = 'none';
                document.getElementById('google-drive-upload-btn').innerHTML = '<span class="upload-icon"></span> Load from Cloud';


                // Clear all loaded files
                clearAllFiles();

                // Clear clinical trials data
                clearClinicalTrialsData();

                // Change robot appearance
                const robotContainer = document.querySelector('.robot-container');
                if (robotContainer) {
                    robotContainer.classList.remove('super-user');
                }

                // Update folder ID for Google Drive
                GOOGLE_DRIVE_UPLOAD_FOLDER_ID = NORMAL_FOLDER_ID;

                updateStatus('User mode activated. All data cleared.');
                window.speakText("User mode activated. All data cleared.");
            }

            // Update file indicators
            updateFileIndicator();
            updateKnowledgeIndicator();

            // Hide galleries
            hidePromptGalleries();

            // Reset info panel
            initializeInfoPanel();

            // Clear chat
            clearChatTranscript();
        });
    }
}
function clearAllFiles() {
    // Clear regular files
    csvData = null;
    pdfContent = "";
    pptxData = null;
    docxContent = "";
    csvFileName = "";
    pdfFileName = "";
    pptxFileName = "";
    docxFileName = "";
    fullData = "";
    transcriptContent = "";
    transcriptFileName = "";

    // Clear clinical trials data
    clearClinicalTrialsData();

    // Update indicators
    updateFileIndicator();
    updateKnowledgeIndicator();

    console.log("All files cleared including clinical trials data.");
}
function displayGoogleDriveFiles(files) {
    const loadingDiv = document.getElementById('google-drive-loading');
    const filesDiv = document.getElementById('google-drive-files');

    loadingDiv.style.display = 'none';
    filesDiv.style.display = 'block';

    // Filter for supported file types
    const supportedFiles = files.filter(file => {
        const name = file.name.toLowerCase();
        return name.endsWith('.csv') || name.endsWith('.pdf') ||
            name.endsWith('.pptx') || name.endsWith('.docx') || name.endsWith('.doc');
    });

    if (supportedFiles.length === 0) {
        filesDiv.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: #666;">
                No supported files found in the folder.<br>
                Supported formats: CSV, PDF, PPTX, DOCX, DOC
            </div>
        `;
        return;
    }

    let filesHTML = '';
    supportedFiles.forEach(file => {
        const fileIcon = getGoogleDriveFileIcon(file.mimeType);
        const fileSize = formatFileSize(file.size);
        const modifiedDate = file.modifiedTime ? formatGoogleDate(file.modifiedTime) : 'Unknown';

        filesHTML += `
            <div class="google-drive-file-item" onclick="${isSuperUser ? 'toggleGoogleDriveFileSelection' : 'selectGoogleDriveFile'}(this, '${file.id}', '${file.name}', '${file.webViewLink || ''}')">
                <div class="google-drive-file-icon">${fileIcon}</div>
                <div class="google-drive-file-info">
                    <div class="google-drive-file-name">${file.name}</div>
                    <div class="google-drive-file-details">${fileSize} • Modified: ${modifiedDate}</div>
                </div>
                ${isSuperUser ? '<div class="selection-indicator" style="display: none;">✓</div>' : ''}
            </div>
        `;
    });

    const buttonText = isSuperUser ? 'Upload Selected Files' : 'Upload Selected File';
    filesHTML += `
        <div class="google-drive-picker-actions">
            <button onclick="closeGoogleDrivePicker()" style="background: #666; color: white; border: none; border-radius: 20px; padding: 8px 16px; cursor: pointer;">Cancel</button>
            <button id="upload-selected-btn" class="google-drive-upload-selected-btn" onclick="${isSuperUser ? 'uploadSelectedGoogleDriveFiles' : 'uploadSelectedGoogleDriveFile'}()" disabled>${buttonText}</button>
        </div>
    `;

    filesDiv.innerHTML = filesHTML;
}
function toggleGoogleDriveFileSelection(element, fileId, fileName, webViewLink) {
    const isSelected = element.classList.contains('selected');
    const indicator = element.querySelector('.selection-indicator');

    if (isSelected) {
        // Deselect
        element.classList.remove('selected');
        indicator.style.display = 'none';
        selectedGoogleDriveFiles = selectedGoogleDriveFiles.filter(file => file.id !== fileId);
    } else {
        // Select
        element.classList.add('selected');
        indicator.style.display = 'block';
        selectedGoogleDriveFiles.push({
            id: fileId,
            name: fileName,
            webViewLink: webViewLink
        });
    }

    // Update upload button
    const uploadBtn = document.getElementById('upload-selected-btn');
    if (uploadBtn) {
        uploadBtn.disabled = selectedGoogleDriveFiles.length === 0;
    }
}
async function sendAskMeMessage(message, isUserMessage = false) {
    if (isUserMessage) {
        addMessageToChat(message, 'user');
        conversationHistory.push({ role: 'user', content: message });
    }

    try {
        startThinking();

        const requestBody = {
            message: isUserMessage ? message : "I want to learn about my documents",
            pptxContext: window.allPptxContext || '',
            csvData: window.allCsvData || '',
            pdfContent: window.allPdfContent || '',
            docxContent: window.allDocxContent || '',
            conversationHistory: conversationHistory
        };

        const response = await fetch(`${BACKEND_API_URL}/api/ask-me-mode`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.error) {
            throw new Error(data.error);
        }

        const aiResponse = data.response;
        addMessageToChat(aiResponse, 'assistant');
        conversationHistory.push({ role: 'assistant', content: aiResponse });

        stopThinking();

    } catch (error) {
        console.error('Error in ask me mode:', error);
        stopThinking();
        addMessageToChat(`Sorry, I encountered an error: ${error.message}`, 'assistant');
    }
}

async function uploadSelectedGoogleDriveFiles() {
    if (selectedGoogleDriveFiles.length === 0) return;

    const uploadBtn = document.getElementById('upload-selected-btn');
    if (uploadBtn) {
        uploadBtn.textContent = 'Uploading...';
        uploadBtn.disabled = true;
    }

    try {
        for (const file of selectedGoogleDriveFiles) {
            await uploadSingleGoogleDriveFile(file);
        }

        closeGoogleDrivePicker();
        const fileCount = selectedGoogleDriveFiles.length;
        selectedGoogleDriveFiles = [];
        updateStatus(`Successfully uploaded ${fileCount} files.`);

    } catch (error) {
        console.error('Upload error:', error);
        showGoogleDriveError(`Failed to upload files: ${error.message}`);
    }

    if (uploadBtn) {
        uploadBtn.textContent = 'Upload Selected Files';
        uploadBtn.disabled = selectedGoogleDriveFiles.length === 0;
    }
}

async function uploadSingleGoogleDriveFile(file) {
    console.log('Uploading file:', file);

    if (!file.id || !file.name) {
        throw new Error('File ID and name are required');
    }

    const fileExtension = file.name.toLowerCase().split('.').pop();
    let endpoint = `${BACKEND_API_URL}/api/download-and-process-drive-file`;

    // Use special endpoint for txt files in superuser mode
    if (fileExtension === 'txt' && isSuperUser) {
        // First download and process the txt file
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                fileId: file.id,
                fileName: file.name
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Server error: ${response.status} - ${errorText}`);
        }

        const result = await response.json();

        // Create a txt result format
        const txtResult = {
            success: true,
            type: 'txt',
            fileName: file.name,
            content: result.content || result.data || 'No content found'
        };

        await processGoogleDriveFileDataBatch(txtResult);
        return;
    }

    // Regular file processing
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify({
            fileId: file.id,
            fileName: file.name
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();

    if (result.error) {
        throw new Error(result.error);
    }

    if (result.success !== false && (result.type || result.data || result.content || result.slides)) {
        await processGoogleDriveFileDataBatch(result);
    } else {
        throw new Error('Processing failed - invalid response format');
    }
}
function uploadToGoogleDrive(txtContent, filename) {
    const metadata = {
        name: filename,
        parents: [GOOGLE_DRIVE_FOLDER_ID]
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', new Blob([txtContent], { type: 'text/plain' }));

    fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${getAccessToken()}`
        },
        body: form
    });
}

// Session management variables - FIXED VERSION
let sessionFolderId = null;
let conversationBuffer = []; // Local buffer for conversation
let isSuperUser = false;
let selectedGoogleDriveFiles = [];

// Conversation export functionality
let sessionId = Date.now() + '_' + Math.random().toString(36).substr(2, 9);
let conversationExport = [];

// Function to mute microphone input
function muteMicrophone() {
    console.log("Muting microphone input...");

    // Stop recognition if active
    if (isListening && recognition) {
        try {
            recognition.stop();
            isListening = false;
        } catch (e) {
            console.error("Error stopping recognition during mute:", e);
        }
    }

    // Disable microphone
    microphoneEnabled = false;
    autoRestartListening = false;

    // Update robot UI
    if (robot) {
        robot.classList.remove('listening');
    }

    // Update robot mic button
    const robotMicBtn = document.getElementById('robot-mic-btn');
    if (robotMicBtn) {
        robotMicBtn.classList.remove('active');
    }

    // Update start listening button
    const startListeningBtn = document.getElementById('start-listening-btn');
    if (startListeningBtn) {
        startListeningBtn.disabled = true;
        startListeningBtn.style.opacity = '0.6';
        startListeningBtn.style.cursor = 'not-allowed';
        startListeningBtn.title = 'Loading file...';
        startListeningBtn.style.display = 'inline-flex';
    }

    updateStatus('Microphone muted during file loading...');
    console.log("Microphone muted successfully");
}


function exportConversationToTxt() {
    if (conversationExport.length === 0) return;
    if (isSuperUser) return; // Don't send if in super user mode

    const fileInfo = getLoadedFileInfo();

    let txtContent = `SESSION: ${sessionId}\n`;
    txtContent += `Date: ${new Date().toISOString().slice(0, 19).replace('T', ' ')}\n`;
    if (fileInfo.length > 0) {
        txtContent += `Files Used: ${fileInfo.join(', ')}\n`;
    }
    txtContent += '\n';

    conversationExport.forEach((entry, index) => {
        const stars = (typeof entry.stars !== 'undefined' && entry.stars !== null) ? entry.stars : 3;
        txtContent += `Q${index + 1}: ${entry.question} STARS : ${stars}\n`;
        txtContent += `A${index + 1}: ${entry.answer || 'No answer'}\n`;
        if (index < conversationExport.length - 1) txtContent += '\n';
    });

    const params = new URLSearchParams({
        sessionId: sessionId,
        content: txtContent,
        fileInfo: JSON.stringify(fileInfo)
    });

    navigator.sendBeacon(`${BACKEND_API_URL}/api/upload-session-simple?${params}`);
}

// Export on page unload
window.addEventListener('beforeunload', function (e) {
    exportConversationToTxt();
});

// Export on page visibility change (covers most mobile scenarios)

// Initialize session on page load
function initializeSession() {
    if (!sessionId) {
        sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
        // Change this line:
        sessionFolderId = TRANSCRIPT_FOLDER_ID; // ALL transcripts go to the same folder
        console.log(`🔄 Session initialized: ${sessionId}`);
    }
}
function getLoadedFileInfo() {
    const files = [];
    if (csvData) files.push(csvFileName || 'CSV file');
    if (pdfContent) files.push(pdfFileName || 'PDF file');
    if (docxContent) files.push(docxFileName || 'DOCX file');
    if (pptxData) files.push(pptxFileName || 'PPTX file');
    return files;
}

// Enhanced conversation buffer management
function addToConversationBuffer(role, content) {
    const stars = window.currentStarRating || 3; // Simple fallback

    const entry = {
        role: role,
        content: role === 'user' ? `${content} STARS : ${stars}` : content,
        timestamp: new Date().toISOString(),
        stars: role === 'user' ? stars : undefined
    };

    conversationBuffer.push(entry);
    console.log(`📝 Added to buffer: ${content.substring(0, 50)}${content.length > 50 ? '...' : ''} ${role === 'user' ? `(⭐${stars})` : ''}`);

    if (conversationBuffer.length > 100) {
        conversationBuffer.shift();
    }
}
// Send to backend instead of direct upload
function sendSessionToBackend() {
    if (conversationBuffer.length === 0) return;

    fetch(`${BACKEND_API_URL}/api/store-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            sessionId: sessionId,
            conversation: conversationBuffer,
            fileInfo: getLoadedFileInfo()  // ADD THIS LINE
        })
    }).catch(error => console.error('Failed to store session:', error));
}
function addQA(role, content) {
    if (role === 'user') {
        questionCount++;
        qaBuffer.push(`Q${questionCount}: ${content}`);
    } else if (role === 'assistant') {
        answerCount++;
        qaBuffer.push(`A${answerCount}: ${content}`);
    }
    console.log(`Added ${role}: Q${questionCount}/A${answerCount}`);
}
async function uploadQASession() {
    if (qaBuffer.length === 0) {
        console.log('No Q&A to upload');
        return;
    }

    const fileInfo = getLoadedFileInfo();

    let sessionContent = `SESSION: ${sessionId}\n`;
    sessionContent += `Date: ${new Date().toISOString().slice(0, 19).replace('T', ' ')}\n`;
    if (fileInfo.length > 0) {
        sessionContent += `Files Used: ${fileInfo.join(', ')}\n`;
    }
    sessionContent += '\n';
    sessionContent += qaBuffer.join('\n') + '\n';

    try {
        const response = await fetch(`${BACKEND_API_URL}/api/upload-simple-transcript`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionId: sessionId,
                conversation: conversationBuffer,
                fileInfo: getLoadedFileInfo(),
                content: sessionContent
            })
        });

        if (response.ok) {
            console.log('✅ Q&A session uploaded successfully');
            qaBuffer = [];
        } else {
            console.error('❌ Failed to upload Q&A session');
        }
    } catch (error) {
        console.error('❌ Error uploading Q&A:', error);
    }
}

function uploadQABeacon() {
    if (qaBuffer.length === 0) return;

    const fileInfo = getLoadedFileInfo();

    let sessionContent = `SESSION: ${sessionId}\n`;
    sessionContent += `Date: ${new Date().toISOString().slice(0, 19).replace('T', ' ')}\n`;
    if (fileInfo.length > 0) {
        sessionContent += `Files Used: ${fileInfo.join(', ')}\n`;
    }
    sessionContent += '\n';
    sessionContent += qaBuffer.join('\n') + '\n';

    const payload = JSON.stringify({
        sessionId: sessionId,
        content: sessionContent,
        fileInfo: fileInfo
    });

    navigator.sendBeacon(
        `${BACKEND_API_URL}/api/upload-session-simple`,
        new Blob([payload], { type: 'application/json' })
    );
    console.log('📡 Q&A uploaded via beacon with stars');
}

// Upload complete conversation with better error handling
async function uploadCompleteConversation() {
    if (!conversationBuffer || conversationBuffer.length === 0) {
        console.log('📭 No conversation to upload');
        return;
    }

    if (uploadInProgress) {
        console.log('⏳ Upload already in progress, skipping...');
        return;
    }

    uploadInProgress = true;

    try {
        console.log(`📤 Uploading ${conversationBuffer.length} conversation entries...`);

        // Enhanced payload with star ratings
        const enhancedTranscript = conversationBuffer.map(entry => {
            if (entry.role === 'user') {
                return {
                    ...entry,
                    content: `${entry.content} STARS : ${currentStarRating}`,
                    stars: currentStarRating
                };
            }
            return entry;
        });

        const payload = {
            transcript: enhancedTranscript,
            sessionFolderId: sessionFolderId,
            sessionId: sessionId,
            defaultStarRating: currentStarRating
        };

        const response = await fetch(`${BACKEND_API_URL}/api/upload-complete-transcript`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        console.log('✅ Complete conversation uploaded successfully:', data);

        conversationBuffer = [];
        uploadInProgress = false;

    } catch (error) {
        console.error('❌ Failed to upload complete conversation:', error);
        uploadInProgress = false;
    }
}

// Use sendBeacon for reliable delivery during page unload
function uploadConversationBeacon() {
    if (!conversationBuffer || conversationBuffer.length === 0) {
        console.log('📭 No conversation for beacon upload');
        return;
    }

    console.log(`📡 Using sendBeacon to upload ${conversationBuffer.length} entries...`);

    const payload = JSON.stringify({
        transcript: conversationBuffer,
        sessionFolderId: sessionFolderId,
        sessionId: sessionId
    });

    try {
        const success = navigator.sendBeacon(
            `${BACKEND_API_URL}/api/upload-complete-transcript`,
            new Blob([payload], { type: 'application/json' })
        );

        if (success) {
            console.log('✅ Beacon upload initiated successfully');
        } else {
            console.warn('⚠️ Beacon upload may have failed');
        }
    } catch (error) {
        console.error('❌ Beacon upload error:', error);
    }
}

// CSV and PDF Data
let csvData = null; // Will hold { headers: [], data: [], raw: "" }
let pdfContent = ""; // Will hold text content from PDF
let csvFileName = "";
let pdfFileName = "";
let fullData = ""; // Will hold the raw CSV content for the prompt
let pptxData = null; // Will hold slides content from PowerPoint
let pptxFileName = ""; // Will hold PowerPoint filename
let docxContent = "";
let docxFileName = "";

// Global variables for clinical trials knowledge
let clinicalTrialsCSV = null; // Will hold { headers: [], data: [], raw: "" }
let clinicalTrialsSynopsis = ""; // Will hold text content from DOCX
let clinicalTrialsLoaded = false;
let knowledgeLoadingInProgress = false;

// Sound effects
let thinkingSound = null;

// Backend API URL - CHANGE THIS TO YOUR FLASK BACKEND URL
const BACKEND_API_URL = "https://back-v3cj.onrender.com";

// Gemini API Configuration
const GEMINI_API_KEY = "YOUR_GEMINI_API_KEY"; //  less relevant bevause backend handles API calls
const DEFAULT_MODEL = "gemini-2.0-flash";
const MODEL_TEMPERATURE = 1.9; // Adjust as needed (0.0 to 2.0, often unstable > 1.0)
const SQL_API_KEY = "YOUR_SQL_API_KEY"; // less relevant because backend handles API calls

// Global variables for popups
let activePopup = null;

// Clean folder IDs (removed URL parameters)
const INBOX_FOLDER_ID = '19GqH__mZqjR3DafWgGOiGLzsGCETuG4P';
const OUTPUT_FOLDER_ID = '1_h33FOmGIfD6elLTG8hLFOnEZEwIek';


function toggleSuperUser() {
    isSuperUser = !isSuperUser;
    GOOGLE_DRIVE_UPLOAD_FOLDER_ID = isSuperUser ? SUPERUSER_FOLDER_ID : NORMAL_FOLDER_ID;

    // Keep transcript folder the same for ALL users:
    sessionFolderId = TRANSCRIPT_FOLDER_ID; // Don't change this based on user type

    const button = document.getElementById('superuser-btn');
    button.textContent = isSuperUser ? 'User' : 'Superuser';

    if (isSuperUser) {
        resetAllFiles();

        if (conversationBuffer && conversationBuffer.length > 0) {
            uploadCompleteConversation();
        }

        conversationBuffer = [];
    }
}
function unloadAllFiles() {
    console.log("Unloading all previously loaded files and data...");
    document.querySelectorAll('.file-size-warning').forEach(w => w.remove());

    // Clear regular file data
    csvData = null;
    pdfContent = "";
    pptxData = null;
    docxContent = "";
    csvFileName = "";
    pdfFileName = "";
    pptxFileName = "";
    docxFileName = "";
    fullData = "";

    // Clear transcript data
    transcriptContent = "";
    transcriptFileName = "";

    // Clear clinical trials data
    clinicalTrialsCSV = null;
    clinicalTrialsSynopsis = "";
    clinicalTrialsLoaded = false;
    knowledgeLoadingInProgress = false;

    // Reset knowledge loading flag
    window.knowledgeLoading = false;

    // Update file indicators
    updateFileIndicator();
    updateKnowledgeIndicator();

    // Clear info cards and reset to welcome state
    clearInfoCards();
    initializeInfoPanel();

    // Hide prompt galleries
    hidePromptGalleries();

    // Update robot appearance - remove clinical loaded state
    const robotContainer = document.querySelector('.robot-container');
    if (robotContainer) {
        robotContainer.classList.remove('clinical-loaded', 'loading-knowledge');
    }

    // Clear any active visualizations or SQL results
    const infoContainer = document.getElementById('info-container');
    if (infoContainer) {
        const cardsToRemove = infoContainer.querySelectorAll('.info-card:not(#welcome-card)');
        cardsToRemove.forEach(card => card.remove());
    }

    // Reset Start Listening button state
    const startListeningBtn = document.getElementById('start-listening-btn');
    if (startListeningBtn) {
        startListeningBtn.disabled = true;
        startListeningBtn.style.opacity = '0.6';
        startListeningBtn.style.cursor = 'not-allowed';
        startListeningBtn.title = 'Upload a file first';
    }

    // Clear last generated SQL
    lastGeneratedSql = '';
    window.sqlCodeForCloud = '';
    window.sqlCodeForLocal = '';

    console.log("All files and data unloaded successfully");
    updateStatus('All files cleared. Ready for new data.');
}
function resetAllFiles() {
    csvData = null;
    pdfContent = "";
    csvFileName = "";
    pdfFileName = "";
    fullData = "";
    pptxData = null;
    pptxFileName = "";
    docxContent = "";
    docxFileName = "";
    clinicalTrialsCSV = null;

    updateStatus("All files reset.");
    displayQueryResult('info', 'All loaded files have been cleared');
}

// Function to clear chat transcript (MOVED TO GLOBAL SCOPE)
function clearChatTranscript() {
    const chatMessages = document.getElementById('chat-messages');
    if (chatMessages) {
        // Remove all message elements
        while (chatMessages.firstChild) {
            chatMessages.removeChild(chatMessages.firstChild);
        }

        // Add back the placeholder message
        const placeholder = document.createElement('div');
        placeholder.className = 'transcript-placeholder';
        // Updated placeholder text to match HTML
        placeholder.textContent = 'Type a message below or use the robot microphone for voice.';
        chatMessages.appendChild(placeholder);

        console.log("Chat transcript cleared");
    } else {
        console.error("Could not find chat-messages element");
    }
}

function addAdditionalStyles() {
    const style = document.createElement('style');
    style.textContent = `
        /* Ensure cards are visible by default if they don't rely on 'show' for initial display */
        .info-card.query-result, .info-card.sql-code-info-card, .info-card.visualization, .info-card.sql-results {
            opacity: 1; /* Start visible */
            transform: translateY(0);
            transition: opacity 0.3s ease, transform 0.3s ease;
        }
        .info-card.show { /* This class is added for entry animation */
            opacity: 1 !important;
            transform: translateY(0) !important;
        }
        /* These might be redundant if the above covers it, but ensures visibility */
        .info-card.query-result.type-recipient,
        .info-card.query-result.type-drug,
        .info-card.query-result.type-index,
        .info-card.query-result.type-count,
        .info-card.sql-code-info-card,
        .info-card.visualization,
        .info-card.sql-results {
            opacity: 1;
            transform: translateY(0);
            visibility: visible;
        }

        /* Chat Loading Animation */
        .chat-loading {
            display: flex;
            align-items: center;
            justify-content: flex-start; /* Align to left for assistant messages */
            padding: 0px 15px 10px 15px; /* Adjusted padding to align with chat messages */
            opacity: 0;
            transform: translateY(10px);
            transition: opacity 0.3s ease, transform 0.3s ease;
            width: 100%; /* Ensure it takes full width to align content properly */
            box-sizing: border-box;
        }
        .chat-loading.show {
            opacity: 1;
            transform: translateY(0);
        }
        .chat-loading.fade-out {
            opacity: 0;
            transform: translateY(10px);
        }
        .chat-loading-content {
            display: inline-flex; /* Use inline-flex to wrap content tightly */
            align-items: center;
            background-color: #f0f0f0; /* Match assistant bubble color */
            padding: 8px 12px;
            border-radius: 18px 18px 18px 0; /* Match assistant bubble shape */
        }
        .thinking-dots-chat {
            display: flex;
            align-items: center;
            margin-right: 8px;
        }
        .thinking-dots-chat .dot {
            width: 6px;
            height: 6px;
            background-color: #888;
            border-radius: 50%;
            margin: 0 2px;
            animation: chatDotBounce 1.4s infinite ease-in-out both;
        }
        .thinking-dots-chat .dot:nth-child(1) { animation-delay: -0.32s; }
        .thinking-dots-chat .dot:nth-child(2) { animation-delay: -0.16s; }
        @keyframes chatDotBounce {
            0%, 80%, 100% { transform: scale(0); }
            40% { transform: scale(1.0); }
        }
        .loading-text {
            font-size: 0.9em;
            color: #555;
            font-style: italic;
        }
    `;
    document.head.appendChild(style);
}

function addFixedCardStyles() {
    const style = document.createElement('style');
    style.textContent = `
        .info-card.query-result, .info-card.sql-code-info-card, .info-card.visualization, .info-card.sql-results {
            opacity: 1 !important; /* Ensure they are visible by default */
            transform: translateY(0) !important;
            transition: opacity 0.5s ease, transform 0.5s ease; /* For removal animation */
        }
        .info-card.query-result.removing, .info-card.sql-code-info-card.removing, .info-card.visualization.removing, .info-card.sql-results.removing {
            opacity: 0 !important;
            transform: translateY(20px) !important;
        }
        .info-card .event-tag {
            display: inline-block;
            padding: 0.2rem 0.6rem;
            border-radius: 100px; /* Pill shape */
            font-size: 0.65rem; /* Smaller font for tags */
            font-weight: 600;
            letter-spacing: 1px; /* Wider spacing for uppercase */
            text-transform: uppercase;
            /* Colors are set per-tag type in displayQueryResult/displaySQLInInfoTab */
        }
        .info-card.query-result .query-content {
            font-size: 2rem; /* Large font for the result itself */
            font-weight: 600;
            margin-top: 0.5rem;
            word-break: break-word; /* Prevent overflow */
        }
    `;
    document.head.appendChild(style);
}

function addLayoutStyles() {
    const style = document.createElement('style');
    style.textContent = `
        body { height: 100vh; display: flex; flex-direction: column; }
        .main-container { flex: 1; min-height: 0; margin-bottom: 1rem; /* Ensure it takes remaining space */ }
        .prompt-gallery, .sql-prompt-gallery { margin-top: 0; margin-bottom: 1rem; padding: 1rem; }
        .robot-message { position: fixed; top: 120px; z-index: 1000; } /* Ensure it's above other elements */
        .controls { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; margin-top: 1rem; }
        .upload-controls { display: flex; gap: 1rem; }
        #file-indicator { margin-left: auto; /* Pushes to the right in flex container */ }
    `;
    document.head.appendChild(style);
}

function addFileIndicatorStyles() {
    const style = document.createElement('style');
    style.id = 'file-indicator-styles'; // Add an ID to prevent duplicate styles
    style.textContent = `
        #file-indicator {
            font-size: 0.8rem; padding: 0.3rem 0.6rem; border-radius: 6px;
            background-color: rgba(0, 0, 0, 0.05); border: 1px solid rgba(0, 0, 0, 0.1);
            display: flex; flex-direction: column; gap: 0.2rem; align-items: flex-start;
            opacity: 0; visibility: hidden; transition: opacity 0.3s ease, visibility 0.3s ease;
            max-width: 200px; /* Limit width */
            overflow: hidden; /* Hide overflow */
        }
        #file-indicator.visible { opacity: 1; visibility: visible; }
        .file-indicator-item { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%; line-height: 1.4; }
        .file-indicator-item .file-icon { width: 12px; height: 12px; margin-right: 4px; vertical-align: middle; display: inline-block; background-size: contain; background-repeat: no-repeat; background-position: center; }
        .file-icon.csv-icon { background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%232196F3" width="18px" height="18px"><path d="M0 0h24v24H0z" fill="none"/><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm-1 11h-2v2h2v-2zm-2-4h2v3h-2V9zM8 11H6v2h2v-2zm0-4h2v3H8V7zm4 0h2v3h-2V7z"/></svg>'); }
        .file-icon.pdf-icon { background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23F44336" width="18px" height="18px"><path d="M0 0h24v24H0z" fill="none"/><path d="M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8.5 7.5c0 .83-.67 1.5-1.5 1.5H9v2H7.5V7H10c.83 0 1.5.67 1.5 1.5v1zm5 2c0 .83-.67 1.5-1.5 1.5h-2.5V7H15c.83 0 1.5.67 1.5 1.5v3zm4-3H19v1h1.5V11H19v2h-1.5V7h3v1.5zM9 9.5h1v-1H9v1zM4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm11 5.5h1.5v-3H15v3z"/></svg>'); }
        .file-icon.pptx-icon { background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23FF9800" width="18px" height="18px"><path d="M0 0h24v24H0z" fill="none"/><path d="M4 3h16c1.1 0 2 .9 2 2v14c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V5c0-1.1.9-2 2-2zm4.13 6.87c0-.73.6-1.33 1.33-1.33.74 0 1.34.6 1.34 1.33 0 .74-.6 1.34-1.34 1.34-.73 0-1.33-.6-1.33-1.34zm4 0c0-.73.6-1.33 1.33-1.33.74 0 1.34.6 1.34 1.33 0 .74-.6 1.34-1.34 1.34-.73 0-1.33-.6-1.33-1.34zm4 0c0-.73.6-1.33 1.33-1.33.74 0 1.34.6 1.34 1.33 0 .74-.6 1.34-1.34 1.34-.73 0-1.33-.6-1.33-1.34zm-8.87 5.63h10.74v1.5H7.26v-1.5z"/></svg>'); }
        .file-icon.docx-icon { background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%232D72D2" width="18px" height="18px"><path d="M0 0h24v24H0z" fill="none"/><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm-2.06 11.44L10.5 16H9l1.88-4.21c.26-.59.79-1.01 1.44-1.16.93-.21 1.77.1 2.3.76.49.6.78 1.37.78 2.18v.43c0 1.08-.53 1.98-1.34 2.45l1.88 4.21h-1.5l-1.44-3.56zM11.5 11.9c-.17 0-.34.03-.5.1-.41.17-.68.51-.78.91-.13.5.04 1.01.42 1.34.38.33.88.5 1.36.5.17 0 .34-.03-.5-.1.41-.17.68.51.78-.91.13-.5-.04-1.01-.42-1.34-.38-.33-.88-.5-1.36-.5z"/></svg>'); }

    `;
    if (!document.getElementById('file-indicator-styles')) document.head.appendChild(style);
}

function addPromptAnimationStyles() {
    const style = document.createElement('style');
    style.id = 'prompt-animation-styles'; // Add an ID to prevent duplicate styles
    style.textContent = `
        .prompt-gallery, .sql-prompt-gallery {
            opacity: 0; transform: translateY(20px);
            transition: opacity 0.5s ease, transform 0.5s ease;
            display: flex; flex-wrap: wrap; gap: 0.5rem; /* Ensure they are flex containers */
        }
        .sql-prompt-gallery { display: block; } /* Override if needed for SQL gallery layout */

        .prompt-gallery.visible, .sql-prompt-gallery.visible { opacity: 1; transform: translateY(0); }

        .prompt-suggestion, .sql-prompt-suggestion {
            opacity: 0; transform: translateX(-20px); /* Start off-screen to the left */
            transition: opacity 0.3s ease, transform 0.3s ease; /* Individual button transition */
        }
        .prompt-suggestion.visible, .sql-prompt-suggestion.visible { opacity: 1; transform: translateX(0); }

        /* Clinical Trials Loaded Robot Styling */
        .robot-container.clinical-loaded .robot-head { background: linear-gradient(135deg, #8e44ad, #9b59b6); border: 4px solid #6f42c1; box-shadow: 0 0 20px rgba(142, 68, 173, 0.4); }
        .robot-container.clinical-loaded .robot-body { background: linear-gradient(135deg, #9b59b6, #8e44ad); border: 4px solid #6f42c1; box-shadow: 0 0 20px rgba(142, 68, 173, 0.4); }
        .robot-container.clinical-loaded .robot-antenna { background-color: #6f42c1; }
        .robot-container.clinical-loaded .robot-antenna-dot { background-color: #8e44ad; box-shadow: 0 0 15px rgba(142, 68, 173, 0.8); }
        .robot-container.clinical-loaded .robot-eye { background-color: #6f42c1; box-shadow: 0 0 15px rgba(111, 66, 193, 0.8); }
        .robot-container.clinical-loaded .robot-indicator { background-color: #6f42c1; box-shadow: 0 0 10px rgba(111, 66, 193, 0.8); }
        .robot-container.clinical-loaded .pattern-dot { background-color: #8e44ad; box-shadow: 0 0 10px rgba(142, 68, 173, 0.5); }
    `;
    if (!document.getElementById('prompt-animation-styles')) document.head.appendChild(style);
}

function addCloudButtonStyles() {
    const style = document.createElement('style');
    style.id = 'cloud-button-styles'; // Add an ID to prevent duplicate styles
    style.textContent = `
        .sql-action-button.cloud { background-color: #4285F4 !important; color: white !important; }
        .sql-action-button.cloud:hover { background-color: #3367D6 !important; transform: translateY(-1px) !important; box-shadow: 0 2px 5px rgba(66, 133, 244, 0.3) !important; }
    `;
    if (!document.getElementById('cloud-button-styles')) document.head.appendChild(style);
}

function initSoundEffects() {
    thinkingSound = new Audio('https://freesound.org/data/previews/274/274649_4386954-lq.mp3');
    thinkingSound.loop = true;
    thinkingSound.volume = 0.5;
}

// IMPROVED WELCOME SCREEN
function initializeInfoPanel() {
    if (!infoContainer) return;

    const existingCards = infoContainer.querySelectorAll('.info-card:not(#welcome-card)');
    existingCards.forEach(card => card.remove());

    let welcomeCard = document.getElementById('welcome-card');
    if (!welcomeCard) {
        welcomeCard = document.createElement('div');
        welcomeCard.className = 'info-card welcome';
        welcomeCard.id = 'welcome-card';
        infoContainer.insertBefore(welcomeCard, infoContainer.firstChild);
    }

    const hasFiles = csvData || pdfContent || pptxData || docxContent;
    const startListeningBtn = document.getElementById('start-listening-btn');

    if (hasFiles) {
        welcomeCard.innerHTML = `
            <div class="welcome-content">
                <h3>How can I help you?</h3>
                <p>Ask me questions about your loaded data.</p>
                <p class="upload-hint">Click "Start Listening" below the robot when ready.</p>
            </div>
        `;
        if (startListeningBtn) {
            startListeningBtn.disabled = false;
            startListeningBtn.style.opacity = '1';
            startListeningBtn.style.cursor = 'pointer';
            startListeningBtn.title = 'Start listening for commands';
        }
    } else {
        welcomeCard.innerHTML = `
            <div class="welcome-content">
                <h3>Upload Data to Begin</h3>
                <p class="upload-hint">Click the 'Upload Data' button below to start.</p>
            </div>
        `;
        if (startListeningBtn) {
            startListeningBtn.disabled = true;
            startListeningBtn.style.opacity = '0.6';
            startListeningBtn.style.cursor = 'not-allowed';
            startListeningBtn.title = 'Upload a file first';
        }

        // Hide galleries when no files
        hidePromptGalleries();
    }

    welcomeCard.style.display = 'block';
    setTimeout(() => {
        welcomeCard.classList.add('show');
    }, 50);
}

function showFileLoadedBubble(message) {
    if (!fileLoadedBubble || !fileLoadedMessage) return;
    if (fileLoadBubbleTimeout) clearTimeout(fileLoadBubbleTimeout);
    const hasFiles = csvData || pdfContent || pptxData || docxContent;
    fileLoadedBubble.innerHTML = '';
    const messageSpan = document.createElement('span');
    messageSpan.id = 'file-loaded-message';
    messageSpan.textContent = message;
    fileLoadedBubble.appendChild(messageSpan);
    if (hasFiles && !microphoneInitialized) {
        const startButton = document.createElement('button');
        startButton.className = 'bubble-button';
        startButton.textContent = 'Start Listening';
        startButton.style.marginLeft = '10px';
        startButton.style.padding = '3px 8px';
        startButton.style.borderRadius = '12px';
        startButton.style.backgroundColor = 'white';
        startButton.style.color = '#4CAF50';
        startButton.style.border = '1px solid white';
        startButton.style.cursor = 'pointer';
        startButton.style.fontWeight = '500';
        startButton.style.fontSize = '0.8rem';
        startButton.addEventListener('click', function () {
            manualStartMicrophone();
            fileLoadedBubble.classList.remove('show-bubble');
            setTimeout(() => { fileLoadedBubble.style.display = 'none'; }, 500);
        });
        fileLoadedBubble.appendChild(startButton);
    }
    fileLoadedBubble.style.display = 'block';
    void fileLoadedBubble.offsetWidth;
    fileLoadedBubble.classList.add('show-bubble');
    fileLoadBubbleTimeout = setTimeout(() => {
        fileLoadedBubble.classList.remove('show-bubble');
        setTimeout(() => {
            if (fileLoadedBubble.style.display !== 'none') {
                fileLoadedBubble.style.display = 'none';
            }
        }, 500);
    }, 10000);
}

// Complete function to initialize file upload functionality
// Complete function to initialize file upload functionality - FIXED VERSION
function initializeFileUpload() {
    // Google Drive upload button
    const googleDriveUploadBtn = document.getElementById('google-drive-upload-btn');
    if (googleDriveUploadBtn && !googleDriveUploadBtn.hasAttribute('data-listener-added')) {
        googleDriveUploadBtn.addEventListener('click', openGoogleDrivePicker);
        googleDriveUploadBtn.setAttribute('data-listener-added', 'true');
    }

    // Local file upload button
    const localFileUploadBtn = document.getElementById('local-file-upload-btn');
    if (localFileUploadBtn && !localFileUploadBtn.hasAttribute('data-listener-added')) {
        localFileUploadBtn.addEventListener('click', () => {
            const unifiedUpload = document.getElementById('unified-upload');
            if (unifiedUpload) {
                unifiedUpload.click();
            }
        });
        localFileUploadBtn.setAttribute('data-listener-added', 'true');
    }

    // Unified upload input handler - PREVENT DUPLICATE LISTENERS
    const unifiedUpload = document.getElementById('unified-upload');
    if (unifiedUpload && typeof handleUnifiedFileUpload === 'function' && !unifiedUpload.hasAttribute('data-listener-added')) {
        unifiedUpload.addEventListener('change', handleUnifiedFileUpload);
        unifiedUpload.setAttribute('data-listener-added', 'true');
    }
}


function handleUnifiedFileUpload(event) {
    muteMicrophone();
    const file = event.target.files[0];
    if (!file) return;

    const fileType = file.name.split('.').pop().toLowerCase();
    updateStatus(`Processing ${fileType.toUpperCase()} file: ${file.name}`);

    if (isListening || microphoneInitialized) {
        if (typeof stopAI === 'function') stopAI();

        if (isListening && recognition) {
            try {
                recognition.stop();
                isListening = false;
            } catch (e) {
                console.error("Error stopping recognition during file upload:", e);
            }
        }
        microphoneInitialized = false;

        const startListeningBtn = document.getElementById('start-listening-btn');
        if (startListeningBtn) {
            startListeningBtn.disabled = false;
            startListeningBtn.style.opacity = '1';
            startListeningBtn.style.cursor = 'pointer';
            startListeningBtn.title = 'Click to start voice interaction';
            startListeningBtn.style.display = 'inline-flex';
        }

        if (isSuperUser && !microphoneInitialized) {
            setTimeout(() => {
                manualStartMicrophone();
            }, 1000);
        }
    }

    switch (fileType) {
        case 'csv': handleCSVFile(file); break;
        case 'pdf': handlePDFFile(file); break;
        case 'pptx': handlePPTXFile(file); break;
        case 'docx': handleDOCXFile(file); break;
        case 'doc': handleDOCFile(file); break;
        default:
            updateStatus('Unsupported file type');
            alert('Unsupported file type. Please upload a CSV, PDF, PPTX, DOC, or DOCX file.');
            event.target.value = null;
            initializeInfoPanel();
    }

    // Reset file input to allow same file to be selected again
    event.target.value = null;
}

function validateFileSize(file) {
    const maxSize = 250 * 1024; // 250KB in bytes
    if (file.size > maxSize) {
        const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
        showFileSizeWarning(`File size (${sizeMB}MB) exceeds the 250KB recommendation for the beta. You may reach our LLM quotas for this demo. Please consider reducing the file size or splitting it into smaller parts.`);
    }
}

function showFileSizeWarning(message) {
    const warningDiv = document.createElement('div');
    warningDiv.className = 'file-size-warning';
    warningDiv.textContent = message;
    warningDiv.style.backgroundColor = '#fff3cd';
    warningDiv.style.color = '#856404';
    warningDiv.style.padding = '10px';
    warningDiv.style.margin = '10px 0';
    warningDiv.style.border = '1px solid #ffeeba';
    warningDiv.style.borderRadius = '4px';
    warningDiv.style.textAlign = 'center';

    const infoDisplay = document.getElementById('info-display'); // As per prompt
    if (infoDisplay) {
        infoDisplay.appendChild(warningDiv);
        setTimeout(() => {
            if (warningDiv.parentNode) {
                warningDiv.parentNode.removeChild(warningDiv);
            }
        }, 5000000);
    } else {
        // Fallback to infoContainer if info-display is not found
        const infoContainerFallback = document.getElementById('info-container');
        if (infoContainerFallback) {
            infoContainerFallback.insertBefore(warningDiv, infoContainerFallback.firstChild);
            setTimeout(() => {
                if (warningDiv.parentNode) {
                    warningDiv.parentNode.removeChild(warningDiv);
                }
            }, 5000000);
        } else {
            console.warn("Could not find #info-display or #info-container to show file size warning.");
        }
    }
}


function handleCSVFile(file) {
    unloadAllFiles();
    if (!file) return;
    csvFileName = file.name;
    validateFileSize(file);
    updateStatus(`Processing database: ${file.name}`);
    const reader = new FileReader();
    reader.onload = function (e) {
        const content = e.target.result;
        try {
            parseCSVPandas(content);
            fullData = content;
            displayQueryResult('success', `${file.name} loaded`);
            updateStatus(`Database loaded: ${csvData.data.length} rows, ${csvData.headers.length} columns. Ready for questions.`);
            showFileLoadedBubble(`Database "${file.name}" loaded!`);
            setTimeout(() => {
                initializeInfoPanel();
                showPromptGalleries();
                console.log("File loaded, generating both suggestion types...");
                generateDynamicSuggestions();
                generateDynamicSQLSuggestions();
            }, 100);
            updateFileIndicator();
        } catch (error) {
            console.error('Error parsing CSV:', error);
            updateStatus('Error parsing database file');
            displayQueryResult('error', 'Failed to load database');
            csvFileName = "";
            fullData = "";
            csvData = null;
            updateFileIndicator();
            initializeInfoPanel();
        }
    };
    reader.onerror = function () {
        console.error('Error reading CSV file');
        updateStatus('Error reading database file');
        displayQueryResult('error', 'Failed to load database');
        csvFileName = "";
        fullData = "";
        csvData = null;
        updateFileIndicator();
        initializeInfoPanel();
    };
    reader.readAsText(file);
}

function showPromptGalleries() {
    const hasAnyFile = csvData || pdfContent || pptxData || docxContent;
    const promptGallery = document.querySelector('.prompt-gallery');
    const sqlPromptGallery = document.querySelector('.sql-prompt-gallery');

    if (hasAnyFile && promptGallery) {
        promptGallery.classList.add('show-gallery');
        promptGallery.style.display = 'flex';
        promptGallery.style.visibility = 'visible';
        promptGallery.style.opacity = '1';
        requestAnimationFrame(() => { promptGallery.classList.add('visible'); });
    } else if (promptGallery) {
        promptGallery.classList.remove('show-gallery', 'visible');
    }

    if (csvData && sqlPromptGallery) {
        sqlPromptGallery.classList.add('show-gallery');
        sqlPromptGallery.style.display = 'flex';
        sqlPromptGallery.style.visibility = 'visible';
        sqlPromptGallery.style.opacity = '1';
        requestAnimationFrame(() => {
            setTimeout(() => {
                sqlPromptGallery.classList.add('visible');
            }, 200);
        });
    } else if (sqlPromptGallery) {
        sqlPromptGallery.classList.remove('show-gallery', 'visible');
    }

    const promptButtons = document.querySelectorAll('.prompt-suggestion');
    const sqlButtons = document.querySelectorAll('.sql-prompt-suggestion');

    if (hasAnyFile && promptGallery && promptGallery.classList.contains('show-gallery')) {
        promptButtons.forEach(btn => {
            btn.classList.remove('visible');
            btn.style.transitionDelay = '0ms';
            btn.style.display = 'block';
            btn.style.opacity = '1';
        });
        promptButtons.forEach((btn, index) => {
            setTimeout(() => {
                btn.style.transitionDelay = `${index * 100}ms`;
                btn.classList.add('visible');
            }, 50);
        });
    }

    if (csvData && sqlPromptGallery && sqlPromptGallery.classList.contains('show-gallery')) {
        sqlButtons.forEach(btn => {
            btn.classList.remove('visible');
            btn.style.transitionDelay = '0ms';
            btn.style.display = 'block';
            btn.style.opacity = '1';
        });
        sqlButtons.forEach((btn, index) => {
            const sqlStartDelay = (promptButtons.length * 100) + 200 + 50;
            setTimeout(() => {
                btn.style.transitionDelay = `${index * 100}ms`;
                btn.classList.add('visible');
            }, sqlStartDelay);
        });
    }
}

// Update handlePDFFile function
function handlePDFFile(file) {
    unloadAllFiles();
    if (!file) return;
    pdfFileName = file.name;
    validateFileSize(file);
    updateStatus(`Processing PDF: ${file.name}`);

    // Create FormData to send the file to backend for proper extraction
    const formData = new FormData();
    formData.append('file', file);

    fetch(`${BACKEND_API_URL}/api/process-pdf`, {
        method: 'POST',
        body: formData
    })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.error) throw new Error(data.error);
            pdfContent = data.content; // This should now contain the actual extracted text

            // Log the first 100 characters to verify content was extracted
            console.log(`PDF content loaded: ${pdfContent.substring(0, 100)}...`);

            displayQueryResult('success', `${file.name} loaded`);
            showFileLoadedBubble(`PDF "${file.name}" loaded!`);
            updateStatus(`PDF loaded: ${file.name}. Ready for questions.`);
            setTimeout(() => {
                initializeInfoPanel();
                if (!csvData && !pptxData && !docxContent) { // Only show prompts if this is the first/only file
                    showPromptGalleries();
                }
                console.log("File loaded, generating dynamic suggestions...");
                generateDynamicSuggestions();
            }, 100);
            updateFileIndicator();
        })
        .catch(error => {
            console.error('Error processing PDF:', error);
            updateStatus(`Error processing PDF: ${error.message}`);
            displayQueryResult('error', 'Failed to load PDF');
            pdfFileName = "";
            pdfContent = "";
            updateFileIndicator();
            initializeInfoPanel();
        });
}

function handlePPTXFile(file) {
    unloadAllFiles();
    if (!file) return;
    pptxFileName = file.name;
    validateFileSize(file);
    updateStatus(`Processing PowerPoint: ${file.name}`);

    const formData = new FormData();
    formData.append('file', file);

    fetch(`${BACKEND_API_URL}/api/process-pptx`, {
        method: 'POST',
        body: formData
    })
        .then(response => {
            if (!response.ok) {
                return response.json().then(errData => {
                    throw new Error(errData.error || `HTTP error! status: ${response.status}`);
                }).catch(() => { // Catch if response.json() itself fails
                    throw new Error(`HTTP error! status: ${response.status}`);
                });
            }
            return response.json();
        })
        .then(data => {
            if (data.error) throw new Error(data.error);
            pptxData = data.slides; // Assuming backend returns { slides: [{ slide_number: ..., text: ... }, ...] }
            displayQueryResult('success', `${file.name} loaded`);
            showFileLoadedBubble(`PowerPoint "${file.name}" loaded!`);
            updateStatus(`PowerPoint loaded: ${file.name}. Ready for questions.`);
            setTimeout(() => {
                initializeInfoPanel();
                if (!csvData && !pdfContent && !docxContent) { // Only show prompts if this is the first/only file
                    showPromptGalleries();
                }
                console.log("File loaded, generating dynamic suggestions...");
                generateDynamicSuggestions();
            }, 100);
            updateFileIndicator();
        })
        .catch(error => {
            console.error('Error processing PowerPoint:', error);
            updateStatus(`Error processing PowerPoint: ${error.message}`);
            displayQueryResult('error', 'Failed to load PowerPoint');
            pptxFileName = "";
            pptxData = null;
            updateFileIndicator();
            initializeInfoPanel();
        });
}

function handleDOCXFile(file) {
    unloadAllFiles();
    if (!file) return;
    docxFileName = file.name;
    validateFileSize(file);
    updateStatus(`Processing Word document: ${file.name}`);

    const formData = new FormData();
    formData.append('file', file);

    fetch(`${BACKEND_API_URL}/api/process-docx`, {
        method: 'POST',
        body: formData
    })
        .then(response => {
            if (!response.ok) {
                return response.json().then(errData => {
                    throw new Error(errData.error || `HTTP error! status: ${response.status}`);
                }).catch(() => {
                    throw new Error(`HTTP error! status: ${response.status}`);
                });
            }
            return response.json();
        })
        .then(data => {
            if (data.error) throw new Error(data.error);
            docxContent = data.content; // Assuming backend returns { content: "extracted text" }
            displayQueryResult('success', `${file.name} loaded`);
            showFileLoadedBubble(`Word document "${file.name}" loaded!`);
            updateStatus(`Word document loaded: ${file.name}. Ready for questions.`);
            setTimeout(() => {
                initializeInfoPanel();
                if (!csvData && !pdfContent && !pptxData) { // Only show prompts if this is the first/only file
                    showPromptGalleries();
                }
                console.log("File loaded, generating dynamic suggestions...");
                generateDynamicSuggestions();
            }, 100);
            updateFileIndicator();
        })
        .catch(error => {
            console.error('Error processing Word document:', error);
            updateStatus(`Error processing Word document: ${error.message}`);
            displayQueryResult('error', 'Failed to load Word document');
            docxFileName = "";
            docxContent = "";
            updateFileIndicator();
            initializeInfoPanel();
        });
}
function parseCSVPandas(content) {
    if (!content || typeof content !== 'string') {
        throw new Error('Invalid CSV content');
    }

    const lines = content.split('\n').filter(line => line.trim());
    if (lines.length === 0) {
        throw new Error('Empty CSV file');
    }

    // Parse headers
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const csvRows = [];

    // Parse data rows
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
        if (values.length === headers.length) {
            const row = {};
            headers.forEach((header, index) => {
                row[header] = values[index];
            });
            csvRows.push(row);
        }
    }

    // Set global csvData variable
    csvData = {
        headers: headers,
        data: csvRows,
        raw: content
    };

    console.log(`CSV parsed: ${csvRows.length} rows, ${headers.length} columns`);
}

function handleDOCFile(file) {
    unloadAllFiles();
    if (!file) return;
    docxFileName = file.name; // Store in docxFileName for consistency
    validateFileSize(file);
    updateStatus(`Processing Word document (DOC): ${file.name}`);

    const formData = new FormData();
    formData.append('file', file);

    fetch(`${BACKEND_API_URL}/api/process-doc`, { // Use /api/process-doc endpoint
        method: 'POST',
        body: formData
    })
        .then(response => {
            if (!response.ok) {
                return response.json().then(errData => {
                    throw new Error(errData.error || `HTTP error! status: ${response.status}`);
                }).catch(() => {
                    throw new Error(`HTTP error! status: ${response.status}`);
                });
            }
            return response.json();
        })
        .then(data => {
            if (data.error) throw new Error(data.error);
            docxContent = data.content; // Store extracted content in docxContent
            displayQueryResult('success', `${file.name} loaded`);
            showFileLoadedBubble(`Word document "${file.name}" loaded!`);
            updateStatus(`Word document loaded: ${file.name}. Ready for questions.`);
            setTimeout(() => {
                initializeInfoPanel();
                // Only show prompts if this is the first/only file (considering all types)
                if (!csvData && !pdfContent && !pptxData && !docxContent /* check docxContent as it's now populated */) {
                    showPromptGalleries();
                }
                console.log("File loaded, generating dynamic suggestions...");
                generateDynamicSuggestions();
            }, 100);
            updateFileIndicator();
        })
        .catch(error => {
            console.error('Error processing Word document (DOC):', error);
            updateStatus(`Error processing Word document: ${error.message}`);
            displayQueryResult('error', 'Failed to load Word document');
            docxFileName = ""; // Clear docxFileName on error
            docxContent = "";  // Clear docxContent on error
            updateFileIndicator();
            initializeInfoPanel();
        });
}


// Update validateFileLoaded function
function validateFileLoaded(fileType, fileData) {
    if (!fileData) {
        console.error(`Empty ${fileType} data detected`);
        displayQueryResult('error', `Error: ${fileType} file appears to be empty. Please try uploading again.`);
        window.speakText(`I couldn't properly read the ${fileType} file you uploaded. It appears to be empty or corrupted. Could you try uploading it again?`);
        return false;
    }

    // For PDF content, ensure it's not just the placeholder
    if (fileType === 'PDF' && typeof fileData === 'string' &&
        (fileData.startsWith('Content from PDF:') || fileData.length < 100)) {
        console.error(`PDF content appears to be placeholder text only`);
        displayQueryResult('error', `Error: PDF content wasn't properly extracted. Please try uploading again.`);
        window.speakText(`I couldn't properly extract the content from the PDF file. Please try uploading it again.`);
        return false;
    }

    console.log(`${fileType} data validated: ${typeof fileData === 'string' ? fileData.substring(0, 50) + '...' : 'Object data present'}`);
    return true;
}

function createKeyInfoCard(infoItems) {
    const infoContainer = document.getElementById('info-container');
    if (!infoContainer) return;

    // Remove existing non-welcome cards
    const existingCards = infoContainer.querySelectorAll('.info-card:not(#welcome-card)');
    existingCards.forEach(card => card.remove());

    // Hide welcome card if it exists
    const welcomeCard = document.getElementById('welcome-card');
    if (welcomeCard) welcomeCard.style.display = 'none';

    // Limit to 5 items
    const itemsToShow = infoItems.slice(0, 5);

    const card = document.createElement('div');
    card.className = 'info-card key-info'; // Added 'key-info' for specific styling if needed
    card.innerHTML = `
        <span class="event-tag info">KEY INSIGHTS</span>
        <h3>Quick Data Highlights</h3>
        <ul class="key-info-list">
            ${itemsToShow.map(item => `<li class="info-item ${item.type}">${item.value}</li>`).join('')}
        </ul>
    `;
    infoContainer.insertBefore(card, infoContainer.firstChild); // Add to top
    setTimeout(() => { card.classList.add('show'); }, 50); // Animation
}

function createDataVisualization(data, type = 'bar') {
    if (!data || !data.labels || !data.values) return null;

    const chartContainer = document.createElement('div');
    chartContainer.className = 'chart-container';
    chartContainer.style.height = '380px'; // Increased height for better readability

    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");
    svg.setAttribute("viewBox", "0 0 600 350"); // Adjusted viewBox
    svg.style.overflow = "visible"; // Allow labels to overflow slightly if needed

    // Define gradients
    const defs = document.createElementNS(svgNS, "defs");
    const gradientId = "mainGradient" + Math.random().toString(36).substring(2, 9);
    const hoverGradientId = "hoverGradient" + Math.random().toString(36).substring(2, 9);
    const areaGradientId = "areaGradient" + Math.random().toString(36).substring(2, 9);

    const gradient = document.createElementNS(svgNS, "linearGradient");
    gradient.setAttribute("id", gradientId); gradient.setAttribute("y2", "100%");
    const stop1 = document.createElementNS(svgNS, "stop"); stop1.setAttribute("offset", "0%"); stop1.setAttribute("stop-color", "#0071e3"); // Apple Blue
    const stop2 = document.createElementNS(svgNS, "stop"); stop2.setAttribute("offset", "100%"); stop2.setAttribute("stop-color", "#60a5fa"); // Lighter Apple Blue
    gradient.appendChild(stop1); gradient.appendChild(stop2); defs.appendChild(gradient);

    const hoverGradient = document.createElementNS(svgNS, "linearGradient");
    hoverGradient.setAttribute("id", hoverGradientId); hoverGradient.setAttribute("y2", "100%");
    const hoverStop1 = document.createElementNS(svgNS, "stop"); hoverStop1.setAttribute("offset", "0%"); hoverStop1.setAttribute("stop-color", "#005bb5"); // Darker for hover
    const hoverStop2 = document.createElementNS(svgNS, "stop"); hoverStop2.setAttribute("offset", "100%"); hoverStop2.setAttribute("stop-color", "#3d85d8");
    hoverGradient.appendChild(hoverStop1); hoverGradient.appendChild(hoverStop2); defs.appendChild(hoverGradient);

    const areaGradient = document.createElementNS(svgNS, "linearGradient");
    areaGradient.setAttribute("id", areaGradientId); areaGradient.setAttribute("y2", "100%");
    const areaStop1 = document.createElementNS(svgNS, "stop"); areaStop1.setAttribute("offset", "0%"); areaStop1.setAttribute("stop-color", "rgba(0, 113, 227, 0.6)");
    const areaStop2 = document.createElementNS(svgNS, "stop"); areaStop2.setAttribute("offset", "100%"); areaStop2.setAttribute("stop-color", "rgba(0, 113, 227, 0.0)");
    areaGradient.appendChild(areaStop1); areaGradient.appendChild(areaStop2); defs.appendChild(areaGradient);

    svg.appendChild(defs);

    const marginTop = 50, marginRight = 30, marginBottom = 70, marginLeft = 70; // Adjusted margins
    const chartWidth = 600 - marginLeft - marginRight;
    const chartHeight = 350 - marginTop - marginBottom;

    if (type === 'pie') {
        const total = data.values.reduce((sum, val) => sum + val, 0);
        let currentAngle = -90; // Start at the top
        const centerX = 300, centerY = 175; // Center of the viewBox
        const radius = Math.min(chartWidth, chartHeight) / 2 * 0.8; // 80% of available space

        const pieGroup = document.createElementNS(svgNS, "g");
        pieGroup.setAttribute("transform", `translate(${centerX}, ${centerY})`);

        data.values.forEach((value, index) => {
            const percentage = value / total;
            const angle = percentage * 360;
            const endAngle = currentAngle + angle;

            const startX = radius * Math.cos(currentAngle * Math.PI / 180);
            const startY = radius * Math.sin(currentAngle * Math.PI / 180);
            const endX = radius * Math.cos(endAngle * Math.PI / 180);
            const endY = radius * Math.sin(endAngle * Math.PI / 180);

            const largeArcFlag = angle > 180 ? 1 : 0;

            const path = document.createElementNS(svgNS, "path");
            path.setAttribute("d", `M 0 0 L ${startX} ${startY} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${endX} ${endY} Z`);
            const hue = (index * 45) % 360; // Distribute hues
            path.setAttribute("fill", `hsl(${hue}, 75%, 65%)`);
            path.setAttribute("stroke", "#fff"); path.setAttribute("stroke-width", "2");
            path.setAttribute("class", "pie-segment"); // For potential CSS styling/selection
            path.setAttribute("data-label", data.labels[index]);
            path.setAttribute("data-value", value);
            path.setAttribute("data-percentage", `(${(percentage * 100).toFixed(1)}%)`);


            path.addEventListener("mouseover", function (e) {
                this.setAttribute("transform", "scale(1.05)");
                const formattedValue = formatCurrency(parseFloat(this.getAttribute("data-value")));
                showTooltip(e, `${this.getAttribute("data-label")}: ${formattedValue} ${this.getAttribute("data-percentage")}`);
            });
            path.addEventListener("mouseout", function () {
                this.setAttribute("transform", "scale(1)"); hideTooltip();
            });
            pieGroup.appendChild(path);

            // Add labels inside segments if space allows
            if (angle > 25) { // Only label larger segments
                const labelAngle = currentAngle + angle / 2;
                const labelRadius = radius * 0.65; // Position label inside segment
                const labelX = labelRadius * Math.cos(labelAngle * Math.PI / 180);
                const labelY = labelRadius * Math.sin(labelAngle * Math.PI / 180);

                const label = document.createElementNS(svgNS, "text");
                label.setAttribute("x", labelX); label.setAttribute("y", labelY + 5); // +5 for vertical centering
                label.setAttribute("text-anchor", "middle"); label.setAttribute("fill", "#fff");
                label.setAttribute("font-size", "12px"); label.setAttribute("font-weight", "bold");
                label.setAttribute("pointer-events", "none"); // So label doesn't interfere with mouse events on segment
                label.style.textShadow = "0 0 3px rgba(0,0,0,0.5)"; // Make text more readable

                const displayValue = formatCompactNumber(value);
                label.textContent = `${percentage > 0.1 ? data.labels[index] : ''} ${percentage > 0.07 ? displayValue : ''}`.trim();
                pieGroup.appendChild(label);
            }
            currentAngle = endAngle;
        });
        svg.appendChild(pieGroup);

    } else if (type === 'line') {
        const maxValue = Math.max(0, ...data.values) * 1.1; // Add 10% padding at top
        const minValue = Math.min(0, ...data.values) * 1.1; // Handle negative values, add 10% padding
        const range = maxValue - minValue;
        const xStep = chartWidth / (data.values.length - 1 || 1); // Prevent division by zero for single point
        const yScale = range === 0 ? 1 : chartHeight / range; // Prevent division by zero if all values are same

        // Grid lines and Y-axis labels
        const grid = document.createElementNS(svgNS, "g");
        grid.setAttribute("class", "grid"); grid.setAttribute("transform", `translate(${marginLeft}, ${marginTop})`);
        const numYGridLines = 5;
        for (let i = 0; i <= numYGridLines; i++) {
            const yValue = minValue + (range * i / numYGridLines);
            const y = chartHeight - (yValue - minValue) * yScale;
            const gridLine = document.createElementNS(svgNS, "line");
            gridLine.setAttribute("x1", 0); gridLine.setAttribute("y1", y); gridLine.setAttribute("x2", chartWidth); gridLine.setAttribute("y2", y);
            gridLine.setAttribute("stroke", "#eee"); gridLine.setAttribute("stroke-width", "1"); grid.appendChild(gridLine);
            const label = document.createElementNS(svgNS, "text");
            label.setAttribute("x", -10); label.setAttribute("y", y + 4); label.setAttribute("text-anchor", "end");
            label.setAttribute("font-size", "11px"); label.setAttribute("fill", "#999");
            label.textContent = formatCurrency(yValue); grid.appendChild(label);
        }
        // X-axis line
        const xAxisLine = document.createElementNS(svgNS, "line");
        xAxisLine.setAttribute("x1", 0); xAxisLine.setAttribute("y1", chartHeight); xAxisLine.setAttribute("x2", chartWidth); xAxisLine.setAttribute("y2", chartHeight);
        xAxisLine.setAttribute("stroke", "#ccc"); xAxisLine.setAttribute("stroke-width", "1"); grid.appendChild(xAxisLine);
        svg.appendChild(grid);

        const lineGroup = document.createElementNS(svgNS, "g");
        lineGroup.setAttribute("transform", `translate(${marginLeft}, ${marginTop})`);

        let pathData = ""; let areaPathData = `M 0 ${chartHeight}`; // Start area path from bottom-left
        data.values.forEach((value, index) => {
            const x = index * xStep;
            const y = chartHeight - (value - minValue) * yScale;
            if (index === 0) { pathData += `M ${x} ${y}`; areaPathData += ` L ${x} ${y}`; }
            else { pathData += ` L ${x} ${y}`; areaPathData += ` L ${x} ${y}`; }

            // Data points
            const point = document.createElementNS(svgNS, "circle");
            point.setAttribute("cx", x); point.setAttribute("cy", y); point.setAttribute("r", "4");
            point.setAttribute("fill", "#0071e3"); point.setAttribute("stroke", "#fff"); point.setAttribute("stroke-width", "2");
            point.style.cursor = "pointer";
            point.setAttribute("data-label", data.labels[index]); point.setAttribute("data-value", value);
            point.addEventListener("mouseover", function (e) {
                this.setAttribute("r", "6");
                const formattedValue = formatCurrency(parseFloat(this.getAttribute("data-value")));
                showTooltip(e, `${this.getAttribute("data-label")}: ${formattedValue}`);
            });
            point.addEventListener("mouseout", function () { this.setAttribute("r", "4"); hideTooltip(); });
            lineGroup.appendChild(point);

            // X-axis labels
            const label = document.createElementNS(svgNS, "text");
            label.setAttribute("x", x); label.setAttribute("y", chartHeight + 15); label.setAttribute("text-anchor", "end");
            label.setAttribute("font-size", "11px"); label.setAttribute("fill", "#666");
            label.setAttribute("transform", `rotate(-45, ${x}, ${chartHeight + 15})`);
            let displayLabel = data.labels[index];
            if (displayLabel.length > 12) displayLabel = displayLabel.substring(0, 10) + '...'; // Truncate long labels
            label.textContent = displayLabel; lineGroup.appendChild(label);
        });

        areaPathData += ` L ${chartWidth} ${chartHeight} Z`; // Close area path to bottom-right
        const area = document.createElementNS(svgNS, "path");
        area.setAttribute("d", areaPathData); area.setAttribute("fill", `url(#${areaGradientId})`); area.setAttribute("opacity", "0.7");
        lineGroup.appendChild(area);

        const path = document.createElementNS(svgNS, "path");
        path.setAttribute("d", pathData); path.setAttribute("fill", "none"); path.setAttribute("stroke", "#0071e3");
        path.setAttribute("stroke-width", "3"); path.setAttribute("stroke-linecap", "round"); path.setAttribute("stroke-linejoin", "round");
        lineGroup.appendChild(path);
        svg.appendChild(lineGroup);

    } else { // Default: BAR CHART
        const maxValue = Math.max(0, ...data.values) * 1.1; // Add 10% padding at top, ensure non-negative
        const barWidth = chartWidth / data.values.length;
        const barSpacing = barWidth * 0.15; // 15% spacing
        const adjustedBarWidth = Math.max(1, barWidth - barSpacing); // Ensure bar width is at least 1px

        // Grid lines and Y-axis labels
        const gridGroup = document.createElementNS(svgNS, "g");
        gridGroup.setAttribute("transform", `translate(${marginLeft}, ${marginTop})`);
        const numYGridLines = 5;
        for (let i = 0; i <= numYGridLines; i++) {
            const yValue = maxValue * i / numYGridLines;
            const y = chartHeight - (yValue / maxValue) * chartHeight;
            const gridLine = document.createElementNS(svgNS, "line");
            gridLine.setAttribute("x1", 0); gridLine.setAttribute("y1", y); gridLine.setAttribute("x2", chartWidth); gridLine.setAttribute("y2", y);
            gridLine.setAttribute("stroke", "#eee"); gridLine.setAttribute("stroke-width", "1"); gridGroup.appendChild(gridLine);
            const label = document.createElementNS(svgNS, "text");
            label.setAttribute("x", -10); label.setAttribute("y", y + 4); label.setAttribute("text-anchor", "end");
            label.setAttribute("font-size", "11px"); label.setAttribute("fill", "#999");
            label.textContent = formatCurrency(yValue); gridGroup.appendChild(label);
        }
        // X-axis line
        const xAxisLine = document.createElementNS(svgNS, "line");
        xAxisLine.setAttribute("x1", 0); xAxisLine.setAttribute("y1", chartHeight); xAxisLine.setAttribute("x2", chartWidth); xAxisLine.setAttribute("y2", chartHeight);
        xAxisLine.setAttribute("stroke", "#ccc"); xAxisLine.setAttribute("stroke-width", "1"); gridGroup.appendChild(xAxisLine);
        svg.appendChild(gridGroup);

        const barGroup = document.createElementNS(svgNS, "g");
        barGroup.setAttribute("transform", `translate(${marginLeft}, ${marginTop})`);

        data.values.forEach((value, index) => {
            const barHeight = Math.max(0, (value / maxValue) * chartHeight); // Ensure non-negative height
            const x = index * barWidth + barSpacing / 2;
            const y = chartHeight - barHeight;

            const bar = document.createElementNS(svgNS, "rect");
            bar.setAttribute("x", x); bar.setAttribute("y", y); bar.setAttribute("width", adjustedBarWidth); bar.setAttribute("height", barHeight);
            bar.setAttribute("rx", "4"); bar.setAttribute("ry", "4"); // Rounded corners
            bar.setAttribute("fill", `url(#${gradientId})`);
            bar.setAttribute("class", "bar"); // For potential CSS styling/selection
            bar.setAttribute("data-label", data.labels[index]); bar.setAttribute("data-value", value);

            bar.addEventListener("mouseover", function (e) {
                this.setAttribute("fill", `url(#${hoverGradientId})`);
                const formattedValue = formatCurrency(parseFloat(this.getAttribute("data-value")));
                showTooltip(e, `${this.getAttribute("data-label")}: ${formattedValue}`);
            });
            bar.addEventListener("mouseout", function () { this.setAttribute("fill", `url(#${gradientId})`); hideTooltip(); });
            barGroup.appendChild(bar);

            // X-axis labels
            const label = document.createElementNS(svgNS, "text");
            const labelX = x + adjustedBarWidth / 2; const labelY = chartHeight + 15;
            label.setAttribute("x", labelX); label.setAttribute("y", labelY); label.setAttribute("text-anchor", "end");
            label.setAttribute("font-size", "11px"); label.setAttribute("fill", "#666");
            label.setAttribute("transform", `rotate(-45, ${labelX}, ${labelY})`);
            let displayLabel = data.labels[index];
            if (displayLabel.length > 15) displayLabel = displayLabel.substring(0, 12) + '...'; // Truncate long labels
            label.textContent = displayLabel; barGroup.appendChild(label);

            // Value labels on top of bars (if space allows)
            if (barHeight > 25) { // Only if bar is tall enough
                const valueLabel = document.createElementNS(svgNS, "text");
                valueLabel.setAttribute("x", x + adjustedBarWidth / 2); valueLabel.setAttribute("y", y - 5); // Position above bar
                valueLabel.setAttribute("text-anchor", "middle"); valueLabel.setAttribute("font-size", "11px");
                valueLabel.setAttribute("fill", "#666"); valueLabel.textContent = formatCompactNumber(value);
                barGroup.appendChild(valueLabel);
            }
        });
        svg.appendChild(barGroup);
    }

    // Chart Title
    if (data.title) {
        const titleText = document.createElementNS(svgNS, "text");
        titleText.setAttribute("x", "300"); titleText.setAttribute("y", "30"); // Centered at top
        titleText.setAttribute("text-anchor", "middle"); titleText.setAttribute("font-size", "16px");
        titleText.setAttribute("font-weight", "bold"); titleText.setAttribute("fill", "#333");
        titleText.textContent = data.title; svg.appendChild(titleText);
    }

    chartContainer.appendChild(svg);
    return chartContainer;
}

function formatCurrency(value) {
    if (typeof value !== 'number' || isNaN(value)) {
        // Try to parse if it's a string that looks like a number
        if (typeof value === 'string') {
            const parsedValue = parseFloat(value.replace(/[^0-9.-]+/g, ''));
            if (!isNaN(parsedValue)) value = parsedValue;
            else return String(value); // Return original string if not parsable
        } else return String(value); // Return as string if not number or parsable string
    }

    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
    return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatCompactNumber(value) {
    if (typeof value !== 'number' || isNaN(value)) return String(value);
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
    return `$${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`; // No decimals for compact general numbers
}

function showTooltip(event, text) {
    let tooltip = document.getElementById('chart-tooltip');
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.id = 'chart-tooltip';
        tooltip.style.position = 'absolute';
        tooltip.style.backgroundColor = 'rgba(33, 33, 33, 0.9)';
        tooltip.style.color = 'white';
        tooltip.style.padding = '8px 12px';
        tooltip.style.borderRadius = '6px';
        tooltip.style.fontSize = '12px';
        tooltip.style.pointerEvents = 'none'; // Important
        tooltip.style.zIndex = '1000';
        tooltip.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.2)';
        tooltip.style.transition = 'opacity 0.2s ease-in-out, transform 0.2s ease-in-out';
        tooltip.style.opacity = '0';
        tooltip.style.transform = 'translateY(10px)';
        document.body.appendChild(tooltip);
    }
    tooltip.textContent = text;
    tooltip.style.display = 'block'; // Make it visible before positioning
    // Position tooltip near mouse, adjusting for page scroll and tooltip size
    tooltip.style.left = (event.pageX + 10) + 'px';
    tooltip.style.top = (event.pageY - 30) + 'px';

    // Ensure it's visible
    setTimeout(() => {
        tooltip.style.opacity = '1';
        tooltip.style.transform = 'translateY(0)';
    }, 10); // Small delay for transition
}

function hideTooltip() {
    const tooltip = document.getElementById('chart-tooltip');
    if (tooltip) {
        tooltip.style.opacity = '0';
        tooltip.style.transform = 'translateY(10px)';
        setTimeout(() => {
            if (tooltip && tooltip.style.opacity === '0') { // Check if it's still hidden before setting display none
                tooltip.style.display = 'none';
            }
        }, 200); // Match transition duration
    }
}

function createVisualizationCard(title, chartElement) {
    if (!chartElement) return;
    const infoContainer = document.getElementById('info-container');
    if (!infoContainer) return;

    // Remove existing visualization cards to show only one at a time
    const existingCards = infoContainer.querySelectorAll('.info-card.visualization');
    existingCards.forEach(card => card.remove());

    const welcomeCard = document.getElementById('welcome-card');
    if (welcomeCard) welcomeCard.style.display = 'none'; // Hide welcome card

    const card = document.createElement('div');
    card.className = 'info-card visualization';
    card.innerHTML = `<h3>${title}</h3>`;
    card.appendChild(chartElement);

    infoContainer.insertBefore(card, infoContainer.firstChild); // Add to top
    setTimeout(() => { card.classList.add('show'); }, 50); // Animation

    // Auto-remove card after 15 seconds
    setTimeout(() => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        setTimeout(() => {
            if (card.parentNode) {
                card.parentNode.removeChild(card);
                // If no other cards, show welcome card again
                const remainingCards = infoContainer.querySelectorAll('.info-card:not(#welcome-card)');
                if (remainingCards.length === 0 && welcomeCard) {
                    welcomeCard.style.display = 'block';
                    setTimeout(() => welcomeCard.classList.add('show'), 50);
                }
            }
        }, 500); // Wait for fade out animation
    }, 150000); // 15 seconds
    return card;
}

function clearInfoCards() {
    const infoContainer = document.getElementById('info-container');
    if (infoContainer) {
        const cardsToClear = infoContainer.querySelectorAll('.info-card:not(#welcome-card)');
        cardsToClear.forEach(card => card.remove());

        // If only welcome card remains, ensure it's visible
        const welcomeCard = document.getElementById('welcome-card');
        if (welcomeCard && infoContainer.children.length === 1) { // If only welcome card is left
            welcomeCard.style.display = 'block';
            setTimeout(() => { welcomeCard.classList.add('show'); }, 50);
        }
    }
}

function initSpeechSynthesis() {
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
        // When voices change, trigger the same robust loading mechanism
        window.speechSynthesis.onvoiceschanged = () => {
            console.log("onvoiceschanged event fired. Re-running voice loading logic.");
            if (typeof forceLoadVoices === 'function') { // Check if forceLoadVoices is defined
                if (typeof voiceLoadAttempts !== 'undefined') voiceLoadAttempts = 0; // Reset attempts for a fresh load cycle
                forceLoadVoices();
            } else {
                populateVoiceList(); // Fallback if forceLoadVoices isn't ready
            }
        };
    }
    // The initial load is handled by setTimeout(forceLoadVoices, 1000) in DOMContentLoaded
}
function getLoadedFileInfo() {
    const files = [];
    if (csvData) files.push(csvFileName || 'CSV file');
    if (pdfContent) files.push(pdfFileName || 'PDF file');
    if (docxContent) files.push(docxFileName || 'DOCX file');
    if (pptxData) files.push(pptxFileName || 'PPTX file');
    return files;
}

// UPDATED populateVoiceList with debugging
// UPDATED populateVoiceList with forced voice selection
function populateVoiceList() {
    voices = window.speechSynthesis.getVoices();
    console.log("Available voices:", voices.map(v => `${v.name} (Lang: ${v.lang}, Local: ${v.localService})`));

    if (voices.length === 0) {
        console.log("No voices loaded yet, retrying populateVoiceList...");
        setTimeout(populateVoiceList, 500);
        return;
    }

    // FORCE: Find and set the specific Google US English voice
    window.selectedFemaleVoice = findBestFemaleVoice();
    console.log("FORCED selected voice:", window.selectedFemaleVoice ? `${window.selectedFemaleVoice.name} (Lang: ${window.selectedFemaleVoice.lang}, Local: ${window.selectedFemaleVoice.localService})` : "None found");

    if (!voiceSelect) return;

    voiceSelect.innerHTML = '';
    voices.forEach((voice, index) => {
        if (voice.lang.startsWith('en')) {
            const option = document.createElement('option');
            option.textContent = `${voice.name} (${voice.lang})`;
            option.setAttribute('data-voice-uri', voice.voiceURI);
            option.setAttribute('data-lang', voice.lang);
            option.value = index;
            voiceSelect.appendChild(option);
        }
    });

    // FORCE: Set the select to show our forced voice
    if (window.selectedFemaleVoice) {
        const voiceIndex = voices.findIndex(v => v.voiceURI === window.selectedFemaleVoice.voiceURI);
        if (voiceIndex >= 0) {
            for (let i = 0; i < voiceSelect.options.length; i++) {
                if (voiceSelect.options[i].value == voiceIndex) {
                    voiceSelect.selectedIndex = i;
                    break;
                }
            }
        }
    }
}

// NEW function to find best female voice
function findBestFemaleVoice() {
    if (!voices || voices.length === 0) return null;

    const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
    const isEdge = /Edg/.test(navigator.userAgent);
    const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);

    console.log(`Browser detected: Chrome: ${isChrome}, Edge: ${isEdge}, Safari: ${isSafari}`);

    if (isEdge) {
        console.log("Searching for Zira voice...");

        for (let i = 0; i < voices.length; i++) {
            const v = voices[i];
            console.log(`Checking voice ${i}: "${v.name}" (Lang: ${v.lang})`);
            console.log(`  - includes Zira: ${v.name.includes("Zira")}`);
            console.log(`  - includes English: ${v.name.includes("English")}`);
            console.log(`  - lang matches: ${v.lang === "en-US"}`);

            if (v.name.includes("Zira") && v.name.includes("English") && v.lang === "en-US") {
                console.log(`FORCED Edge voice found: ${v.name}`);
                return v;
            }
        }

        console.log("Zira not found, trying any Zira...");
        const anyZira = voices.find(v => v.name.includes("Zira"));
        if (anyZira) {
            console.log(`FORCED Edge any Zira: ${anyZira.name}`);
            return anyZira;
        }
    }

    if (isChrome) {
        const forcedVoice = voices.find(v =>
            v.name === "Google US English" &&
            v.lang === "en-US" &&
            v.localService === false
        );

        if (forcedVoice) {
            console.log(`FORCED Chrome voice: ${forcedVoice.name}`);
            return forcedVoice;
        }
    }

    if (isSafari) {
        const forcedVoice = voices.find(v =>
            v.name === "Samantha" &&
            v.lang === "en-US"
        );

        if (forcedVoice) {
            console.log(`FORCED Safari voice: ${forcedVoice.name}`);
            return forcedVoice;
        }
    }

    const fallback = voices.find(v => v.lang.startsWith('en'));
    console.log(`Final fallback: ${fallback ? fallback.name : 'None'}`);
    return fallback;
}

// This function is now replaced by findBestFemaleVoice
// Keep for compatibility but it's not needed
function selectBestFemaleVoice() {
    // This function is now replaced by findBestFemaleVoice
    // Keep for compatibility but it's not needed
}


function autoInitializeMicrophone() {
    // This function is now effectively disabled in favor of manual start
    console.log("Auto initialization disabled - waiting for user to load files and click 'Start Listening'");
}

// Replace the manualStartMicrophone function
function manualStartMicrophone() {
    if (microphoneInitialized) {
        console.log("Microphone already initialized.");
        if (!isListening && recognition && microphoneEnabled) {
            try {
                recognition.start();
                isListening = true;
                console.log("Restarting listening manually...");
            } catch (error) {
                console.error('Error restarting speech recognition:', error);
                updateStatus('Error restarting microphone.');
            }
        }
        return;
    }

    // FORCE: Super User mode bypasses ALL file checks
    if (!isSuperUser) {
        // Check if any file is loaded - ONLY for regular users
        if (!csvData && !pdfContent && !pptxData && !docxContent) {
            showFileLoadedBubble("Please load at least one data file first!");
            const startListeningBtn = document.getElementById('start-listening-btn');
            if (startListeningBtn) {
                startListeningBtn.disabled = true;
                startListeningBtn.style.opacity = '0.6';
                startListeningBtn.style.cursor = 'not-allowed';
                startListeningBtn.title = 'Upload a file first';
            }
            return;
        }
    } else {
        // FORCE: Super User mode - always allow microphone
        console.log("FORCE: Super User mode - bypassing all file checks for microphone");
    }

    console.log("FORCE: Initializing microphone...");
    updateStatus('Initializing microphone...');

    window.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!window.SpeechRecognition) {
        updateStatus('Speech recognition not supported in your browser');
        return;
    }

    recognition = new window.SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    setupRecognitionHandlers();

    try {
        recognition.start();
        console.log("FORCE: Starting speech recognition...");
        microphoneInitialized = true;
        isListening = true;
        if (stopButton) stopButton.style.display = 'inline-flex';

        const startListeningBtn = document.getElementById('start-listening-btn');
        if (startListeningBtn) startListeningBtn.style.display = 'none';

        autoRestartListening = true;
        microphoneEnabled = true;

        const robotMicBtn = document.getElementById('robot-mic-btn');
        if (robotMicBtn) robotMicBtn.classList.add('active');

        // FORCE: Update robot UI
        if (robot) robot.classList.add('listening');

    } catch (error) {
        console.error('FORCE: Error starting speech recognition:', error);
        let message = 'Error starting recognition. Please try again.';
        if (error.name === 'not-allowed') message = 'Microphone access denied. Please allow access.';
        else if (error.name === 'service-not-allowed') message = 'Speech recognition service denied. Check browser settings.';
        else if (error.name === 'network') message = 'Network error during speech recognition.';
        updateStatus(message);
        if (error.name === 'not-allowed' || error.name === 'service-not-allowed') {
            alert(message + ' Reload the page after granting permission.');
        }
        microphoneInitialized = false;
        isListening = false;
        if (robot) robot.classList.remove('listening');

        const robotMicBtn = document.getElementById('robot-mic-btn');
        if (robotMicBtn) robotMicBtn.classList.remove('active');
    }
}
// FORCE MICROPHONE INITIALIZATION FOR SUPER USER
function forceSuperUserMicrophone() {
    if (!isSuperUser) return;

    console.log("FORCE: Attempting Super User microphone initialization...");

    // Force enable microphone state
    microphoneEnabled = true;
    autoRestartListening = true;

    // Force initialize if not already done
    if (!microphoneInitialized) {
        console.log("FORCE: Microphone not initialized, forcing initialization...");
        manualStartMicrophone();
    }

    // If still not working, try again after a delay
    setTimeout(() => {
        if (isSuperUser && !microphoneInitialized) {
            console.log("FORCE: Second attempt at microphone initialization...");
            manualStartMicrophone();
        }
    }, 1000);

    // Final attempt
    setTimeout(() => {
        if (isSuperUser && !microphoneInitialized) {
            console.log("FORCE: Final attempt at microphone initialization...");

            // Force the start listening button to be available
            const startListeningBtn = document.getElementById('start-listening-btn');
            if (startListeningBtn) {
                startListeningBtn.disabled = false;
                startListeningBtn.style.opacity = '1';
                startListeningBtn.style.cursor = 'pointer';
                startListeningBtn.title = 'Click to start voice interaction';
                startListeningBtn.style.display = 'inline-flex';
            }

            manualStartMicrophone();
        }
    }, 2000);
}

function updateStatus(text) {
    // statusText.textContent = text; // UI element is hidden, but log for debugging
    console.log("Status (hidden from UI): " + text);

    // Update visual status indicator (e.g., a dot or icon)
    const statusIndicator = document.getElementById('status-indicator');
    if (!statusIndicator) return;

    statusIndicator.classList.remove('listening', 'speaking', 'thinking', 'idle');
    if (text.includes('Listening')) statusIndicator.classList.add('listening');
    else if (text.includes('Speaking') || text.includes('said') || text.includes('speech stopped')) statusIndicator.classList.add('speaking');
    else if (text.includes('Processing') || text.includes('Thinking') || text.includes('Generating')) statusIndicator.classList.add('thinking');
    else statusIndicator.classList.add('idle');
}

// Replace the setupRecognitionHandlers function
function setupRecognitionHandlers() {
    if (!recognition) {
        console.error("Cannot setup handlers: recognition object is null");
        return;
    }

    recognition.continuous = true; // Ensure continuous is set

    // Optional: More detailed event logging if supported by browser
    if (typeof recognition.addEventListener === 'function') {
        try {
            recognition.addEventListener('audiostart', () => console.log("Audio capture started by API"));
            recognition.addEventListener('soundstart', () => {
                if (microphoneEnabled) { // Only show if mic is supposed to be on
                    console.log("Sound detected by API");
                    showVoiceDetected(true);
                }
            });
            recognition.addEventListener('soundend', () => {
                console.log("Sound ended by API");
                showVoiceDetected(false);
            });
            // recognition.addEventListener('speechstart', () => console.log("Speech detected by API"));
            // recognition.addEventListener('speechend', () => console.log("Speech ended by API"));
        } catch (e) {
            console.log("Browser doesn't support speech events:", e);
        }
    }

    recognition.onstart = () => {
        console.log("Recognition started successfully.");
        isListening = true;
        updateStatus('Listening...');
        if (robot && microphoneEnabled) robot.classList.add('listening'); // Check microphoneEnabled
        // if (stopButton) stopButton.style.display = 'inline-flex'; // Stop button is for stopping speech/thinking, not listening
    };


    recognition.onerror = (event) => {
        console.error('Recognition error:', event.error);
        showVoiceDetected(false);
        if (event.error === 'no-speech') {
            updateStatus('No speech detected. Listening...');
            // Continuous mode should restart it, or onend will handle.
        } else if (event.error === 'audio-capture') {
            updateStatus('Microphone error. Check connection.');
            // Try to restart if appropriate
            setTimeout(() => {
                if (microphoneEnabled && autoRestartListening && !isListening && !isSpeaking && !isThinking) {
                    try {
                        recognition.start();
                        console.log("Attempting to restart after audio-capture error");
                    } catch (e) {
                        console.error("Failed to restart after audio-capture error:", e);
                    }
                }
            }, 2000);
        } else if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
            updateStatus('Microphone access denied.');
            microphoneEnabled = false; // Disable mic features
            autoRestartListening = false;
            const robotMicBtn = document.getElementById('robot-mic-btn');
            if (robotMicBtn) robotMicBtn.classList.remove('active');
            // Potentially show "Start Listening" button again if files are loaded
        } else if (event.error === 'aborted') {
            console.log("Recognition aborted (likely intentional).");
            // This can happen if recognition.stop() is called.
        } else {
            updateStatus(`Error: ${event.error}. Try again.`);
        }
    };

    recognition.onresult = (event) => {
        if (!microphoneEnabled) {
            console.log("onresult: Ignoring input (microphone disabled)");
            return;
        }
        if (isSpeaking || isThinking) {
            console.log("onresult: Ignoring input (speaking/thinking)");
            return;
        }

        let currentFinalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
            if (event.results[i].isFinal) currentFinalTranscript += event.results[i][0].transcript;
        }

        if (currentFinalTranscript) {
            currentFinalTranscript = currentFinalTranscript.trim();
            console.log(`>>> Final transcript: "${currentFinalTranscript}"`);
            showVoiceDetected(false);

            try {
                if (typeof window.processUserInput === 'function' && microphoneEnabled) {
                    console.log("Calling processUserInput with voice input:", currentFinalTranscript);
                    window.processUserInput(currentFinalTranscript);
                } else if (!microphoneEnabled) {
                    console.log("Ignoring speech input because microphone is disabled");
                } else {
                    console.error("processUserInput function not found for general query!");
                    window.speakText("I'm sorry, I couldn't process your request. Please try again.");
                }
            } catch (error) {
                console.error("Error in processUserInput:", error);
                if (microphoneEnabled) {
                    window.speakText("I encountered an error processing your request. Please try again.");
                }
            }
        }
    };


    recognition.onend = () => {
        console.log("Recognition ended.");
        showVoiceDetected(false);
        isListening = false; // Mark as not listening

        // Only restart if microphone is enabled, autoRestart is true, and AI is not speaking/thinking
        if (microphoneEnabled && autoRestartListening && !isSpeaking && !isThinking) {
            console.log("Automatically restarting listening after onend...");
            setTimeout(() => { // Add a small delay before restarting
                if (!isListening && !isSpeaking && !isThinking && microphoneInitialized &&
                    microphoneEnabled && autoRestartListening) { // Re-check conditions
                    try {
                        recognition.start();
                        isListening = true; // Set after successful start
                        if (robot) robot.classList.add('listening');
                        updateStatus('Listening...');
                        console.log("Recognition restarted automatically.");
                    } catch (error) {
                        console.error("Error auto-restarting recognition in onend:", error);
                        updateStatus('Error restarting microphone.');
                        // Attempt one more restart after a longer delay if the first auto-restart fails
                        setTimeout(() => {
                            if (!isListening && !isSpeaking && !isThinking &&
                                microphoneEnabled && autoRestartListening) {
                                try {
                                    recognition.start();
                                    isListening = true;
                                    if (robot) robot.classList.add('listening');
                                    updateStatus('Listening...');
                                    console.log("Recognition restarted after second attempt.");
                                } catch (e2) {
                                    console.error("Second restart attempt failed:", e2);
                                }
                            }
                        }, 1000);
                    }
                }
            }, 300); // 300ms delay
        } else {
            console.log(`Not restarting listening: micEnabled=${microphoneEnabled}, autoRestart=${autoRestartListening}, speaking=${isSpeaking}, thinking=${isThinking}`);
            if (!isSpeaking && !isThinking) { // If not restarting, update status to idle
                updateStatus('Ready for questions');
                if (robot && !microphoneEnabled) robot.classList.remove('listening'); // Ensure listening class is off if mic disabled
            }
        }
    };
}

function showVoiceDetected(show) {
    const statusIndicator = document.getElementById('status-indicator');
    if (!statusIndicator) return;

    if (show) {
        // Only add class if listening and not already present
        if (isListening && !statusIndicator.classList.contains('voice-detected')) {
            statusIndicator.classList.add('voice-detected');
            // Optional: Add a subtle animation
            statusIndicator.style.animation = 'jiggle 0.2s';
            setTimeout(() => {
                statusIndicator.style.animation = '';
            }, 250);
        }
    } else {
        statusIndicator.classList.remove('voice-detected');
        // Clear animation if it was applied
        if (statusIndicator.style.animation.includes('jiggle')) {
            statusIndicator.style.animation = '';
        }
    }
}

// Modify the toggleMicrophone function to update the UI
// This is a modification of the existing function
function toggleMicrophone() {
    console.log("toggleMicrophone called, current state:", microphoneEnabled);

    // Toggle the state
    microphoneEnabled = !microphoneEnabled;
    console.log("New microphoneEnabled state:", microphoneEnabled);

    // Update the robot container class for ear animation
    if (robot) {
        if (microphoneEnabled) {
            robot.classList.add('listening');
        } else {
            robot.classList.remove('listening');
        }
    }

    if (microphoneEnabled) {
        // ENABLE microphone
        autoRestartListening = true;

        // Start listening if initialized
        if (microphoneInitialized && recognition) {
            try {
                recognition.start();
                isListening = true;
                console.log("Recognition started in toggleMicrophone");
                updateStatus('Listening...');
            } catch (e) {
                console.error("Error starting recognition in toggleMicrophone:", e);
                // Try to restart after a short delay
                setTimeout(() => {
                    try {
                        if (!isListening) {
                            recognition.start();
                            isListening = true;
                            console.log("Recognition started after delay");
                            if (robot) robot.classList.add('listening');
                        }
                    } catch (e2) {
                        console.error("Second start attempt failed:", e2);
                    }
                }, 300);
            }
        } else if (!microphoneInitialized) {
            // Initialize if needed
            console.log("Initializing microphone in toggleMicrophone");
            manualStartMicrophone();
        }
    } else {
        // DISABLE microphone but KEEP TEXT CHAT WORKING
        autoRestartListening = false;

        // Stop listening if active
        if (isListening && recognition) {
            try {
                recognition.stop();
                isListening = false;
                console.log("Recognition stopped in toggleMicrophone");
                updateStatus('Microphone disabled. You can still use text chat.');
            } catch (e) {
                console.error("Error stopping recognition in toggleMicrophone:", e);
                try {
                    recognition.abort();
                    isListening = false;
                } catch (e2) {
                    console.error("Error aborting recognition:", e2);
                }
            }
        }
    }
}

function showThoughtBubble(text) {
    const thoughtContainer = document.querySelector('.thought-bubble-container');
    if (!thoughtContainer) return;
    const thoughtContent = document.getElementById('thought-content');
    if (thoughtContent) thoughtContent.textContent = text;
    thoughtContainer.style.display = 'block';
    thoughtContainer.classList.add('thinking-animation'); // Add class for CSS animation
}

function hideThoughtBubble() {
    const thoughtContainer = document.querySelector('.thought-bubble-container');
    if (!thoughtContainer) return;
    thoughtContainer.style.display = 'none';
    thoughtContainer.classList.remove('thinking-animation'); // Remove class
}

// Function to show loading animation in chat
function showChatLoading() {
    const chatMessages = document.getElementById('chat-messages');
    if (!chatMessages) return;

    // Remove placeholder if exists
    const placeholder = chatMessages.querySelector('.transcript-placeholder');
    if (placeholder) {
        placeholder.style.display = 'none';
    }

    // Check if loading already exists to prevent duplicates
    if (chatMessages.querySelector('.chat-loading')) return;

    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'chat-message assistant chat-loading'; // Added 'assistant' for styling consistency
    loadingDiv.innerHTML = `
        <div class="chat-loading-content">
            <div class="thinking-dots-chat">
                <span class="dot"></span>
                <span class="dot"></span>
                <span class="dot"></span>
            </div>
            <div class="loading-text">Thinking...</div>
        </div>
    `;

    chatMessages.appendChild(loadingDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    // Add entrance animation
    setTimeout(() => {
        loadingDiv.classList.add('show');
    }, 50);
}

// Function to hide loading animation in chat
function hideChatLoading() {
    const chatMessages = document.getElementById('chat-messages');
    if (!chatMessages) return;

    const loadingElement = chatMessages.querySelector('.chat-loading');
    if (loadingElement) {
        loadingElement.classList.add('fade-out');
        setTimeout(() => {
            if (loadingElement.parentNode) {
                loadingElement.parentNode.removeChild(loadingElement);
            }
        }, 300); // Match CSS transition duration
    }
}

function startThinking() {
    isThinking = true;
    if (robot) {
        robot.classList.remove('listening', 'talking');
        robot.classList.add('thinking');
    }
    if (stopButton) stopButton.style.display = 'inline-flex';

    // Show chat loading animation
    showChatLoading();

    const startListeningBtn = document.getElementById('start-listening-btn');
    if (startListeningBtn) startListeningBtn.style.display = 'none';

    if (thinkingSound) {
        thinkingSound.currentTime = 0; // Rewind to start
        thinkingSound.play().catch(e => console.log('Could not play thinking sound:', e));
    }
    // showThoughtBubble("Processing..."); // Optional: show text bubble
}

function stopThinking() {
    console.log("Explicitly stopping thinking state");
    isThinking = false;
    hideThoughtBubble(); // Hide text bubble

    // Hide chat loading animation
    hideChatLoading();

    if (thinkingSound) thinkingSound.pause();
    if (robot) robot.classList.remove('thinking');
    // Do not automatically show "Start Listening" button here, let other logic handle it
    // Do not hide stopButton here, it's hidden when speech/thinking actually stops.
}

// Modified stopAI function - only stops the robot talking, not the microphone
function stopAI() {
    console.log("stopAI called - ONLY STOPPING SPEECH");

    // Stop the speech synthesis
    window.speechSynthesis.cancel();
    isSpeaking = false;
    window.knowledgeLoading = false; // Reset knowledge loading flag if speech is interrupted

    // Stop thinking state if active
    if (isThinking) stopThinking(); // This will also hide chat loading

    // Update UI
    if (robot) robot.classList.remove('talking', 'thinking');
    updateStatus('Stopped AI speech'); // Or a more neutral status like 'Ready'

    // Hide stop button after stopping
    if (stopButton) stopButton.style.display = 'none';

    // Don't change microphone state or show start button
    // The microphone state (enabled/disabled, listening/idle) should remain as it was
    // If it was listening, it might restart due to onend handlers if autoRestartListening is true
    // If it was idle, it stays idle.

    // Reset any temporary state variables affected by speech
    lastUserQuery = ''; // Clear last query as it was interrupted
    lastGeneratedSql = ''; // Clear last SQL as it might be related to interrupted speech
}

// UPDATED sanitizeSpeechForVoice
function sanitizeSpeechForVoice(text) {
    if (!text) return "";
    let sanitized = text;

    // Expand common contractions for more natural speech
    sanitized = sanitized
        .replace(/I've/gi, 'I have')
        .replace(/I'm/gi, 'I am')
        .replace(/you're/gi, 'you are')
        .replace(/we're/gi, 'we are')
        .replace(/they're/gi, 'they are')
        .replace(/he's/gi, 'he is')
        .replace(/she's/gi, 'she is')
        .replace(/it's/gi, 'it is')
        .replace(/can't/gi, 'cannot')
        .replace(/won't/gi, 'will not')
        .replace(/don't/gi, 'do not')
        .replace(/didn't/gi, 'did not')
        .replace(/isn't/gi, 'is not')
        .replace(/aren't/gi, 'are not')
        .replace(/wasn't/gi, 'was not')
        .replace(/weren't/gi, 'were not')
        .replace(/hasn't/gi, 'has not')
        .replace(/haven't/gi, 'have not')
        .replace(/hadn't/gi, 'had not')
        .replace(/doesn't/gi, 'does not')
        .replace(/let's/gi, 'let us');

    // Make units sound more natural
    sanitized = sanitized
        .replace(/(\d+)%/g, '$1 percent') // 10% -> 10 percent
        .replace(/(\d+)px/gi, '$1 pixels') // 100px -> 100 pixels
        .replace(/\$(\d{1,3}(,\d{3})*(\.\d+)?)(K)?(M)?(B)?/g, (match, amount, _, __, k, m, b) => { // $10K, $1.5M, $200
            let num = parseFloat(amount.replace(/,/g, ''));
            if (k) num *= 1000;
            if (m) num *= 1000000;
            if (b) num *= 1000000000;
            return `${num.toLocaleString()} dollars`;
        })
        .replace(/(\d+)K/gi, '$1 thousand') // 10K -> 10 thousand (if not preceded by $)
        .replace(/(\d+)M/gi, '$1 million')  // 10M -> 10 million (if not preceded by $)
        .replace(/(\d+)B/gi, '$1 billion'); // 10B -> 10 billion (if not preceded by $)


    // Improve pronunciation of technical terms (case-insensitive)
    sanitized = sanitized
        .replace(/\bSQL\b/gi, 'sequel')
        .replace(/\bAPI\b/gi, 'A P I')
        .replace(/\bJSON\b/gi, 'Jason')
        .replace(/\bCSV\b/gi, 'C S V')
        .replace(/\bHTML\b/gi, 'H T M L')
        .replace(/\bCSS\b/gi, 'C S S')
        .replace(/\bURL\b/gi, 'U R L')
        .replace(/\bGemini\b/gi, 'Jemini') // Common pronunciation for the AI
        .replace(/\bAI\b/gi, 'A I');


    // Ensure punctuation has a space after it for natural TTS pausing
    // This helps the TTS engine identify sentence and clause boundaries.
    sanitized = sanitized
        .replace(/([.,?!:;])(?=\S)/g, '$1 '); // Add space after punctuation if not already there

    // Remove special characters that might be mispronounced, but keep sentence structure
    // Keep .,?!:; for sentence structure.
    sanitized = sanitized.replace(/[`~@#%^*()_|+\=\[\]{}\\\/<>]/g, ' '); // Replace with space

    // Normalize whitespace (multiple spaces to single, trim)
    sanitized = sanitized.replace(/\s+/g, ' ').trim();

    return sanitized;
}


// UPDATED window.speakText with forced female voice
// UPDATED window.speakText with FORCED voice override
window.speakText = function (text) {
    window.speechSynthesis.cancel();
    let sanitizedText = typeof sanitizeSpeechForVoice === 'function' ? sanitizeSpeechForVoice(text) : text;
    updateStatus('Speaking...');
    isSpeaking = true;
    if (robot) {
        robot.classList.remove('listening');
        robot.classList.add('talking');
    }
    if (stopButton) stopButton.style.display = 'inline-flex';

    if (isListening && recognition) {
        try {
            recognition.stop();
            console.log("Recognition stopped because AI is speaking.");
        } catch (e) {
            console.error("Error stopping recognition before speech:", e);
        }
    }

    const utterance = new SpeechSynthesisUtterance(sanitizedText);

    // FORCE: Always get the exact voice for current browser
    const currentVoices = window.speechSynthesis.getVoices();
    const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
    const isEdge = /Edg/.test(navigator.userAgent);
    const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);

    if (currentVoices.length > 0) {
        let forcedVoice = null;

        if (isChrome) {
            // FORCE: Google US English for Chrome
            forcedVoice = currentVoices.find(v =>
                v.name === "Google US English" &&
                v.lang === "en-US" &&
                v.localService === false
            );
        } else if (isEdge) {
            // FORCE: Microsoft Zira for Edge
            forcedVoice = currentVoices.find(v =>
                v.name === "Microsoft Zira - English (United States)" &&
                v.lang === "en-US"
            );

            if (!forcedVoice) {
                forcedVoice = currentVoices.find(v =>
                    v.name.includes("Zira") &&
                    v.lang.startsWith('en')
                );
            }
        } else if (isSafari) {
            // FORCE: Samantha for Safari
            forcedVoice = currentVoices.find(v =>
                v.name === "Samantha" &&
                v.lang === "en-US"
            );

            if (!forcedVoice) {
                forcedVoice = currentVoices.find(v =>
                    v.name === "Samantha" &&
                    v.lang.startsWith('en')
                );
            }
        }

        if (forcedVoice) {
            utterance.voice = forcedVoice;
            window.selectedFemaleVoice = forcedVoice;
            console.log(`FORCED voice: ${forcedVoice.name} (Lang: ${forcedVoice.lang}, Local: ${forcedVoice.localService})`);
        } else if (window.selectedFemaleVoice) {
            utterance.voice = window.selectedFemaleVoice;
            console.log(`FORCED fallback voice: ${window.selectedFemaleVoice.name}`);
        }
    }

    // Voice parameters optimized for each browser's forced voice
    if (isChrome) {
        utterance.rate = 1;
        utterance.pitch = 1.0;
        utterance.volume = 1;
    } else if (isEdge) {
        utterance.rate = 0.9;
        utterance.pitch = 1.0;
        utterance.volume = 1;
    } else if (isSafari) {
        utterance.rate = 0.8;
        utterance.pitch = 1.2;
        utterance.volume = 0.9;
    } else {
        utterance.rate = 0.9;
        utterance.pitch = 1.1;
        utterance.volume = 0.9;
    }

    let speechTimeout = setTimeout(() => {
        if (isSpeaking) {
            console.log("Speech timeout triggered");
            window.speechSynthesis.cancel();
        }
    }, 90000);

    utterance.onend = () => {
        console.log("Speech finished normally");
        clearTimeout(speechTimeout);
        isSpeaking = false;
        if (robot) robot.classList.remove('talking');

        if (window.knowledgeLoading && text.includes("clinical trials")) {
            window.knowledgeLoading = false;
            setTimeout(() => {
                if (typeof loadClinicalTrialsKnowledge === 'function') loadClinicalTrialsKnowledge();
                if (microphoneEnabled && autoRestartListening) {
                    resumeListeningAfterSpeech();
                }
            }, 500);
        } else {
            if (microphoneEnabled && autoRestartListening) {
                resumeListeningAfterSpeech();
            }
        }
    };

    utterance.onerror = (e) => {
        clearTimeout(speechTimeout);
        console.error('Speech error:', e);
        isSpeaking = false;
        if (robot) robot.classList.remove('talking');
        window.knowledgeLoading = false;
        updateStatus('Error speaking. Please try again.');

        if (microphoneEnabled && autoRestartListening) {
            resumeListeningAfterSpeech();
        }
    };

    setTimeout(() => {
        if (isSpeaking) {
            console.log(`About to speak with FORCED voice: ${utterance.voice ? utterance.voice.name : 'default'}`);
            window.speechSynthesis.speak(utterance);
        }
    }, 100);
};


// Helper function for restarting listening
function resumeListeningAfterSpeech() {
    console.log("Attempting to resume listening after speech...");
    if (!microphoneInitialized) {
        console.log("Cannot restart listening: microphone not initialized");
        return;
    }

    isSpeaking = false; // Ensure isSpeaking is false
    if (robot) robot.classList.remove('talking'); // Ensure talking class is removed

    setTimeout(() => { // Add a small delay to ensure speech synthesis has fully released resources
        if (isSpeaking || isThinking) { // Double check, should be false for isSpeaking
            console.log("Skipping listening restart: still speaking or thinking");
            return;
        }

        if (!isListening && recognition && microphoneEnabled && autoRestartListening) {
            console.log("Restarting listening now...");
            updateStatus('Listening...');
            if (robot) robot.classList.add('listening');
            // if (stopButton) stopButton.style.display = 'inline-flex'; // Stop button is for speech/thinking

            try {
                recognition.start();
                isListening = true; // Set after successful start
            } catch (error) {
                console.error("Error starting recognition in resumeListeningAfterSpeech:", error);
                isListening = false; // Ensure isListening is false on error
                if (robot) robot.classList.remove('listening');
                // Attempt a delayed restart if the first one fails
                setTimeout(() => {
                    if (recognition && !isListening && !isSpeaking && !isThinking && microphoneEnabled && autoRestartListening) {
                        try {
                            console.log("Attempting second recognition start...");
                            recognition.start();
                            isListening = true;
                            if (robot) robot.classList.add('listening');
                            updateStatus('Listening...');
                        } catch (e2) {
                            console.error("Second recognition start attempt failed:", e2);
                            updateStatus('Ready for questions'); // Fallback status
                            if (robot) robot.classList.remove('listening');
                        }
                    }
                }, 500); // Longer delay for the second attempt
            }
        } else {
            console.log(`Not restarting listening: isListening=${isListening}, recognition=${!!recognition}, micEnabled=${microphoneEnabled}, autoRestart=${autoRestartListening}`);
            if (!isListening && !isSpeaking && !isThinking) { // If not restarting, ensure correct idle state
                updateStatus('Ready for questions');
                if (robot && !microphoneEnabled) robot.classList.remove('listening'); // If mic is off, ensure no listening animation
            }
        }
    }, 250); // Small delay to ensure speech synthesis has fully released resources
}

function speakTextWithoutAutoRestart(text) {
    window.speechSynthesis.cancel(); // Cancel any ongoing speech
    const sanitizedText = typeof sanitizeSpeechForVoice === 'function' ? sanitizeSpeechForVoice(text) : text;
    updateStatus('Speaking...');
    isSpeaking = true;
    if (robot) { robot.classList.remove('listening'); robot.classList.add('talking'); }
    if (stopButton) stopButton.style.display = 'inline-flex';

    // Stop listening while speaking
    if (isListening && recognition) {
        try {
            recognition.stop();
            console.log("Recognition stopped because AI is speaking (speakTextWithoutAutoRestart).");
        } catch (e) {
            console.error("Error stopping recognition before speech (speakTextWithoutAutoRestart):", e);
        }
    }

    const utterance = new SpeechSynthesisUtterance(sanitizedText);

    // Force use our selected female voice (same logic as speakText)
    if (window.selectedFemaleVoice) {
        utterance.voice = window.selectedFemaleVoice;
    } else {
        const currentVoices = window.speechSynthesis.getVoices();
        if (currentVoices.length > 0) {
            voices = currentVoices;
            window.selectedFemaleVoice = findBestFemaleVoice();
            if (window.selectedFemaleVoice) {
                utterance.voice = window.selectedFemaleVoice;
            }
        }
    }
    // Apply female voice parameters
    utterance.rate = 0.8;
    utterance.pitch = 1.2;
    utterance.volume = 0.9;


    let speechTimeout = null;
    const maxSpeechDuration = 90000; // 30 seconds
    speechTimeout = setTimeout(() => {
        if (isSpeaking) {
            console.log("Speech timeout triggered - speech was taking too long (speakTextWithoutAutoRestart)");
            window.speechSynthesis.cancel();
        }
    }, maxSpeechDuration);

    let keepAliveTimer = null;
    utterance.onend = () => {
        if (keepAliveTimer) clearInterval(keepAliveTimer);
        if (speechTimeout) clearTimeout(speechTimeout);
        console.log("Speech finished normally (speakTextWithoutAutoRestart)");
        isSpeaking = false;
        if (robot) robot.classList.remove('talking');
        // if (stopButton) stopButton.style.display = 'none'; // Hide stop button

        if (window.knowledgeLoading && text.includes("clinical trials")) {
            window.knowledgeLoading = false; // Reset flag
            console.log("Speech ended, triggering clinical trials load after delay (speakTextWithoutAutoRestart).");
            setTimeout(() => {
                if (typeof loadClinicalTrialsKnowledge === 'function') loadClinicalTrialsKnowledge();
                // Do NOT auto-restart listening here. Update UI to allow manual start.
                if (!isThinking && !isListening) { // If idle
                    updateStatus('Ready for questions');
                    // if (stopButton) stopButton.style.display = 'none'; // Stop button is for active speech/thinking
                    const startListeningBtn = document.getElementById('start-listening-btn');
                    if (startListeningBtn && microphoneInitialized) { // Only if mic was ever initialized
                        startListeningBtn.style.display = 'inline-flex';
                        startListeningBtn.disabled = !(csvData || pdfContent || pptxData || docxContent); // Enable if files loaded
                        startListeningBtn.style.opacity = startListeningBtn.disabled ? '0.6' : '1';
                        startListeningBtn.style.cursor = startListeningBtn.disabled ? 'not-allowed' : 'pointer';
                        startListeningBtn.title = startListeningBtn.disabled ? 'Upload a file first' : 'Start listening for commands';
                    }
                }
            }, 500);
        } else {
            // Speech ended, not loading knowledge. Update UI for manual start.
            if (!isThinking && !isListening) { // If idle
                updateStatus('Ready for questions');
                // if (stopButton) stopButton.style.display = 'none';
                const startListeningBtn = document.getElementById('start-listening-btn');
                if (startListeningBtn && microphoneInitialized) { // Only show if mic was init'd
                    startListeningBtn.style.display = 'inline-flex';
                    startListeningBtn.disabled = !(csvData || pdfContent || pptxData || docxContent);
                    startListeningBtn.style.opacity = startListeningBtn.disabled ? '0.6' : '1';
                    startListeningBtn.style.cursor = startListeningBtn.disabled ? 'not-allowed' : 'pointer';
                    startListeningBtn.title = startListeningBtn.disabled ? 'Upload a file first' : 'Start listening for commands';
                }
            }
        }
    };
    utterance.onerror = (e) => {
        if (keepAliveTimer) clearInterval(keepAliveTimer);
        if (speechTimeout) clearTimeout(speechTimeout);
        console.error('Speech error (speakTextWithoutAutoRestart):', e);
        isSpeaking = false;
        if (robot) robot.classList.remove('talking');
        // if (stopButton) stopButton.style.display = 'none';
        window.knowledgeLoading = false; // Reset flag
        updateStatus('Error speaking. Please try again.');
        // Update UI for manual start even on error
        if (!isThinking && !isListening) {
            updateStatus('Ready for questions');
            // if (stopButton) stopButton.style.display = 'none';
            const startListeningBtn = document.getElementById('start-listening-btn');
            if (startListeningBtn && microphoneInitialized) {
                startListeningBtn.style.display = 'inline-flex';
                startListeningBtn.disabled = !(csvData || pdfContent || pptxData || docxContent);
                startListeningBtn.style.opacity = startListeningBtn.disabled ? '0.6' : '1';
                startListeningBtn.style.cursor = startListeningBtn.disabled ? 'not-allowed' : 'pointer';
                startListeningBtn.title = startListeningBtn.disabled ? 'Upload a file first' : 'Start listening for commands';
            }
        }
    };

    setTimeout(() => {
        if (isSpeaking) {
            try {
                console.log(`About to speak (no auto restart) with voice: ${utterance.voice ? utterance.voice.name : 'default'}`);
                window.speechSynthesis.speak(utterance);
                if (window.speechSynthesis && utterance.voice && utterance.voice.localService) {
                    const speechKeepAliveInterval = 10000;
                    keepAliveTimer = setInterval(() => {
                        if (isSpeaking) { window.speechSynthesis.pause(); window.speechSynthesis.resume(); console.log("Speech synthesis keep-alive triggered (speakTextWithoutAutoRestart)"); }
                        else clearInterval(keepAliveTimer);
                    }, speechKeepAliveInterval);
                }
            } catch (e) {
                console.error("Error speaking (speakTextWithoutAutoRestart):", e);
                utterance.onerror(new SpeechSynthesisErrorEvent('error', { error: e, utterance: utterance }));
            }
        } else {
            console.log("Speech cancelled before utterance.speak() called (speakTextWithoutAutoRestart)");
            window.knowledgeLoading = false;
            if (keepAliveTimer) clearInterval(keepAliveTimer);
            if (speechTimeout) clearTimeout(speechTimeout);
            if (!isThinking && !isListening) {
                updateStatus('Ready for questions');
                // if (stopButton) stopButton.style.display = 'none';
                const startListeningBtn = document.getElementById('start-listening-btn');
                if (startListeningBtn && microphoneInitialized) {
                    startListeningBtn.style.display = 'inline-flex';
                    startListeningBtn.disabled = !(csvData || pdfContent || pptxData || docxContent);
                    startListeningBtn.style.opacity = startListeningBtn.disabled ? '0.6' : '1';
                    startListeningBtn.style.cursor = startListeningBtn.disabled ? 'not-allowed' : 'pointer';
                    startListeningBtn.title = startListeningBtn.disabled ? 'Upload a file first' : 'Start listening for commands';
                }
            }
        }
    }, 100);
}

function processVisualizationRequest(query, focus = 'recipient') {
    if (!csvData || !csvData.data || csvData.data.length === 0) {
        const response = "Please upload a database file first for visualization.";
        addToConversationHistory('assistant', response);
        window.speakText(response);
        stopThinking();
        return;
    }

    startThinking(); // Ensure thinking state is active
    let chartType = 'bar'; // Default to bar chart, can be made dynamic

    try {
        // Determine columns based on focus and common Open Payments field names
        let amountColumn = 'Total_Amount_of_Payment_USDollars';
        let groupColumn, chartTitle;

        switch (focus) {
            case 'drug':
                groupColumn = 'Name_of_Drug_or_Biological_or_Device_or_Medical_Supply_1';
                chartTitle = 'Payment Amount by Drug/Device';
                break;
            case 'recipient':
            default:
                groupColumn = 'Covered_Recipient_Last_Name'; // Could combine with First_Name
                chartTitle = 'Payment Amount by Recipient';
                break;
        }

        // Validate column existence and find alternatives if necessary
        if (!csvData.headers.includes(amountColumn)) {
            amountColumn = csvData.headers.find(h => h.toLowerCase().includes('amount') || h.toLowerCase().includes('payment'));
            if (!amountColumn) throw new Error("Could not find payment amount column.");
        }
        if (!csvData.headers.includes(groupColumn)) {
            const alternatives = { 'drug': ['Drug_Name', 'Product_Name', 'Name_of_Drug'], 'recipient': ['Recipient_Name', 'Physician_Name', 'Covered_Recipient_First_Name'] };
            const altOptions = alternatives[focus] || [];
            for (const alt of altOptions) {
                const match = csvData.headers.find(h => h.includes(alt)); // Simple includes match
                if (match) { groupColumn = match; break; }
            }
            if (!csvData.headers.includes(groupColumn)) throw new Error(`Could not find appropriate column for ${focus} visualization.`);
        }


        const groupedData = {};
        let firstNameColumn = null;
        if (focus === 'recipient' && groupColumn === 'Covered_Recipient_Last_Name') {
            firstNameColumn = csvData.headers.find(h => h.includes('First_Name'));
        }


        csvData.data.forEach(row => {
            let groupKey = row[groupColumn] || 'Unknown';
            if (firstNameColumn && row[firstNameColumn] && focus === 'recipient') {
                groupKey = `${row[firstNameColumn]} ${groupKey}`; // Combine first and last name
            }
            if (typeof groupKey === 'string') groupKey = groupKey.trim();
            if (groupKey === '') groupKey = 'Unknown';


            if (!groupedData[groupKey]) groupedData[groupKey] = 0;
            let amount = 0;
            if (typeof row[amountColumn] === 'number') amount = row[amountColumn];
            else if (typeof row[amountColumn] === 'string') amount = parseFloat(row[amountColumn].replace(/[^0-9.-]+/g, '')) || 0;
            groupedData[groupKey] += amount;
        });

        // Sort and take top N entries
        let entries = Object.entries(groupedData)
            .filter(entry => entry[0] !== 'Unknown' && entry[0] !== '' && entry[1] > 0) // Filter out unknowns and zero amounts
            .sort((a, b) => b[1] - a[1]);

        const maxEntries = 12; // Max bars/segments for readability
        let chartEntries = entries.slice(0, maxEntries);

        const labels = chartEntries.map(entry => {
            let label = String(entry[0]);
            return label.length > 20 ? label.substring(0, 18) + '...' : label; // Truncate long labels
        });
        const values = chartEntries.map(entry => Math.round(entry[1] * 100) / 100); // Round to 2 decimal places

        const chartData = { labels, values, title: chartTitle };
        const chartElement = createDataVisualization(chartData, chartType);

        if (chartElement) {
            createVisualizationCard(chartTitle, chartElement);
            const response = `Here's a chart showing ${chartTitle.toLowerCase()}.`;
            addToConversationHistory('assistant', response);
            stopThinking(); // Stop thinking after chart is ready
            window.speakText(response);
        } else {
            throw new Error("Failed to generate chart.");
        }

    } catch (error) {
        console.error('Visualization error:', error);
        const response = `I couldn't create that visualization. ${error.message || 'Please try a different request.'}`;
        addToConversationHistory('assistant', response);
        stopThinking();
        window.speakText(response);
    }
    stopThinking(); // Ensure thinking stops even if an early return happened
}

function handleGraphRequest(query) {
    if (!csvData || !csvData.data || csvData.data.length === 0) {
        const response = "Please upload a database file first for visualization.";
        addToConversationHistory('assistant', response);
        window.speakText(response);
        stopThinking();
        return;
    }

    startThinking();

    // First, get intelligent column suggestions
    fetch(`${BACKEND_API_URL}/api/intelligent-chart-columns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            csvData: fullData || csvData.raw,
            userRequest: query
        })
    })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Column analysis failed: ${response.status}`);
            }
            return response.json();
        })
        .then(columnData => {
            // Now create the chart with the intelligent suggestions
            return fetch(`${BACKEND_API_URL}/api/create-graph`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    csvData: fullData || csvData.raw,
                    chartType: columnData.chartType,
                    columnX: columnData.columnX,
                    columnY: columnData.columnY,
                    title: columnData.title,
                    limit: 15,
                    aggregate: 'sum'
                })
            });
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Chart creation failed: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            stopThinking();

            const graphContainer = document.createElement('div');
            graphContainer.className = 'chart-container';
            graphContainer.style.width = '100%';
            graphContainer.style.textAlign = 'center';

            const graphImage = document.createElement('img');
            graphImage.src = 'data:image/png;base64,' + data.image;
            graphImage.style.maxWidth = '100%';
            graphImage.style.height = 'auto';
            graphImage.style.maxHeight = '500px';
            graphImage.style.objectFit = 'contain';
            graphImage.style.display = 'inline-block';
            graphImage.alt = data.title || "Data Visualization";

            graphImage.onerror = function () {
                console.error("Failed to load graph image");
                while (graphContainer.firstChild) {
                    graphContainer.removeChild(graphContainer.firstChild);
                }
                const errorMsg = document.createElement('p');
                errorMsg.textContent = "Error displaying graph. Please try again.";
                errorMsg.style.color = 'red';
                graphContainer.appendChild(errorMsg);
            };

            graphContainer.appendChild(graphImage);
            createVisualizationCard(data.title || "Generated Visualization", graphContainer);

            const displayTitle = data.title || "the data";
            const displayChartType = data.chart_type || "generated";
            const response = `Here's a ${displayChartType} chart showing ${displayTitle.toLowerCase()}.`;
            addToConversationHistory('assistant', response);
            window.speakText(response);
        })
        .catch(error => {
            console.error('Intelligent chart creation error:', error);
            stopThinking();

            // Fallback to original logic if intelligent analysis fails
            const fallbackResponse = `I couldn't create that visualization. ${error.message}`;
            addToConversationHistory('assistant', fallbackResponse);
            window.speakText(fallbackResponse);
        });
}

// Enhanced SQL cleaning function
function cleanSQLCode(sqlCode) {
    return sqlCode
        .replace(/```sql\n?|```/g, '') // Remove markdown
        .replace(/^['"]|['"]$/g, '') // Remove quotes
        .replace(/--.*sqlite.*$/gmi, '') // Remove sqlite comments
        .replace(/\/\*.*sqlite.*\*\//gmi, '') // Remove sqlite block comments
        .replace(/^\s*sqlite\s+/gmi, '') // Remove leading sqlite keywords
        .replace(/\bsqlite\b(?!\w)/gi, '') // Remove standalone sqlite words
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();
}
function sendToTranscriptAnalyzer(userMessage) {
    console.log("Sending to Transcript Analyzer...");

    if (!transcriptContent) {
        const response = "No transcript data is currently loaded. Please load transcript files first.";
        addToConversationHistory('assistant', response);
        window.speakText(response);
        stopThinking();
        return;
    }

    startThinking();
    const recentHistory = conversationHistory.slice(-5);

    fetch(`${BACKEND_API_URL}/api/analyze-transcripts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            message: userMessage,
            transcriptContent: transcriptContent,
            conversationHistory: recentHistory
        })
    })
        .then(response => {
            stopThinking();
            if (!response.ok) {
                return response.json().then(errData => {
                    throw new Error(errData.error || `API Error: ${response.statusText}`);
                }).catch(() => {
                    throw new Error(`API Error: ${response.status} ${response.statusText}`);
                });
            }
            return response.json();
        })
        .then(responseData => {
            if (responseData.error) throw new Error(responseData.error);
            let aiResponse = responseData.response || "";
            aiResponse = aiResponse.trim();
            addToConversationHistory('assistant', aiResponse);
            window.speakText(aiResponse);
        })
        .catch(error => {
            console.error('Error calling Transcript Analyzer:', error);
            updateStatus(`Error: ${error.message}`);
            stopThinking();
            const fallbackResponse = "Sorry, I encountered an issue analyzing the transcripts.";
            addToConversationHistory('assistant', fallbackResponse);
            window.speakText(fallbackResponse);
            displayQueryResult('error', 'Transcript Analysis Error');
        });
}
function sendToGeminiForSQL(userMessage) {
    if (!csvData || !csvData.headers) {
        console.error("CSV data or headers missing for SQL generation.");
        updateStatus("Error: Load data before generating SQL.");
        stopThinking();
        displaySQLInInfoTab("-- Error: Please load a database file first.", "Error Generating SQL");
        window.speakText("Please load a database file before asking for SQL queries.");
        return;
    }

    updateStatus("Generating SQL query...");
    startThinking();

    const sampleData = csvData.data ? csvData.data.slice(0, 3) : [];

    fetch(`${BACKEND_API_URL}/api/sql`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            message: userMessage,
            headers: csvData.headers,
            sampleData: sampleData
        })
    })
        .then(response => {
            if (!response.ok) {
                return response.json().then(errData => {
                    throw new Error(errData.error || `SQL API Error: ${response.statusText}`);
                }).catch(() => {
                    throw new Error(`SQL API Error: ${response.status} ${response.statusText}`);
                });
            }
            return response.json();
        })
        .then(data => {
            stopThinking();
            if (data.error) throw new Error(data.error);

            const sqlResponse = data.sql || "-- No SQL generated";
            const cleanedSqlResponse = cleanSQLCode(sqlResponse);
            lastGeneratedSql = cleanedSqlResponse;

            displaySQLInInfoTab(cleanedSqlResponse, "Generated SQL for: " + userMessage);
            updateStatus('SQL query generated and executing...');
            window.speakText("I've generated the SQL query. Now executing it.");
            console.log("Executing SQL (clean) without confirmation");

            // Store the SQL query for the response
            window.currentSQLQuery = cleanedSqlResponse;

            executeSQLQuery(window.sqlCodeForLocal);
        })
        .catch(error => {
            console.error('Error generating SQL via Backend API:', error);
            updateStatus(`Error generating SQL: ${error.message}`);
            stopThinking();
            lastGeneratedSql = '';

            let errorMessage = `-- Error generating SQL: ${error.message}`;
            if (csvData && csvData.headers) {
                errorMessage += `\n\n-- Available columns in your data:\n-- ${csvData.headers.join(', ')}`;
            }

            displaySQLInInfoTab(errorMessage, "Error Generating SQL");

            // Add SQL error as response
            const errorResponse = `SQL generation failed: ${error.message}`;
            addToConversationHistory('assistant', errorResponse);

            window.speakText(`Sorry, I had trouble generating the SQL query. Please try rephrasing your request using the actual column names from your data.`);
        });
}

function displaySQLInInfoTab(sqlCode, queryTitle = "Generated SQL Query") {
    const infoContainer = document.getElementById('info-container');
    if (!infoContainer) return;

    // Use enhanced cleaning
    let cleanSqlCode = cleanSQLCode(sqlCode);
    window.sqlCodeForCloud = cleanSqlCode;
    window.sqlCodeForLocal = cleanSqlCode;

    // Remove any existing SQL code cards to show only the latest one
    const existingSQLCards = infoContainer.querySelectorAll('.info-card.sql-code-info-card');
    existingSQLCards.forEach(card => card.remove());

    const welcomeCard = document.getElementById('welcome-card');
    if (welcomeCard) welcomeCard.style.display = 'none'; // Hide welcome card

    const card = document.createElement('div');
    card.className = 'info-card sql-code-info-card'; // Specific class for SQL code

    const tag = document.createElement('span'); tag.className = 'event-tag sql'; tag.textContent = 'SQL QUERY';
    tag.style.backgroundColor = 'rgba(0, 113, 227, 0.15)'; tag.style.color = '#0071e3';

    const title = document.createElement('h3'); title.textContent = queryTitle;
    const codeDisplay = document.createElement('pre'); codeDisplay.className = 'sql-code-display'; codeDisplay.textContent = cleanSqlCode;

    const buttonContainer = document.createElement('div');
    buttonContainer.style.marginTop = '0.5rem'; buttonContainer.style.display = 'flex'; buttonContainer.style.gap = '0.5rem';

    const copyButton = document.createElement('button');
    copyButton.className = 'sql-action-button'; copyButton.innerHTML = '<span class="button-icon copy-icon"></span> Copy Code';
    copyButton.style.cssText = 'padding: 0.4rem 0.8rem; font-size: 0.8rem; border-radius: 6px; background-color: #0071e3; color: white; border: none; cursor: pointer;';
    copyButton.addEventListener('click', () => {
        navigator.clipboard.writeText(cleanSqlCode).then(() => {
            const originalText = copyButton.innerHTML; copyButton.innerHTML = '<span class="button-icon"></span> Copied!';
            setTimeout(() => { copyButton.innerHTML = originalText; }, 2000);
        }).catch(err => { console.error('Failed to copy text: ', err); alert('Failed to copy SQL code'); });
    });

    const executeButton = document.createElement('button');
    executeButton.className = 'sql-action-button execute'; executeButton.innerHTML = '<span class="button-icon execute-icon"></span> Execute';
    executeButton.style.cssText = 'padding: 0.4rem 0.8rem; font-size: 0.8rem; border-radius: 6px; background-color: #28a745; color: white; border: none; cursor: pointer;';
    executeButton.addEventListener('click', () => executeSQLQuery(window.sqlCodeForLocal));

    const cloudButton = document.createElement('button');
    cloudButton.className = 'sql-action-button cloud'; cloudButton.innerHTML = '<span class="button-icon cloud-icon"></span> Upload to Cloud';
    cloudButton.style.cssText = 'padding: 0.4rem 0.8rem; font-size: 0.8rem; border-radius: 6px; background-color: #4285F4; color: white; border: none; cursor: pointer;';
    cloudButton.addEventListener('click', () => uploadSQLToCloud(window.sqlCodeForCloud));

    // Ensure cloud icon SVG style is present
    if (!document.getElementById('cloud-icon-style')) {
        const cloudIconStyle = document.createElement('style'); cloudIconStyle.id = 'cloud-icon-style';
        cloudIconStyle.textContent = `.sql-action-button .cloud-icon { background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z"></path></svg>'); width: 16px; height: 16px; display: inline-block; background-size: contain; background-repeat: no-repeat; background-position: center; vertical-align: middle; margin-right: 4px; }`;
        document.head.appendChild(cloudIconStyle);
    }


    card.appendChild(tag); card.appendChild(title); card.appendChild(codeDisplay);
    buttonContainer.appendChild(copyButton); buttonContainer.appendChild(executeButton); buttonContainer.appendChild(cloudButton);
    card.appendChild(buttonContainer);

    infoContainer.insertBefore(card, infoContainer.firstChild); // Add to top
    setTimeout(() => { card.classList.add('show'); }, 50); // Animation
}

function executeSQLQuery(sqlCode) {
    if (!sqlCode || !fullData) {
        console.error("Missing SQL or data");
        window.speakText("I need SQL code and data to execute.");
        return;
    }
    console.log("Executing SQL:", sqlCode);
    startThinking();
    updateStatus("Executing SQL query...");

    const executeButton = document.querySelector('.sql-action-button.execute');
    if (executeButton) {
        executeButton.innerHTML = '<span class="button-icon execute-icon"></span> Executing...';
        executeButton.disabled = true; executeButton.style.opacity = '0.7'; executeButton.style.cursor = 'wait';
    }

    fetch(`${BACKEND_API_URL}/api/execute-sql`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql: sqlCode, csvData: fullData, csvFileName: csvFileName })
    })
        .then(response => {
            const responseClone = response.clone();

            if (!response.ok) {
                return responseClone.text().then(textResponse => {
                    let errorMessage;
                    try {
                        const errorData = JSON.parse(textResponse);
                        errorMessage = errorData.error || `SQL Execution Error: ${response.status} ${response.statusText}`;
                    } catch (e) {
                        errorMessage = textResponse || `SQL Execution Error: ${response.status} ${response.statusText}`;
                    }
                    throw new Error(errorMessage);
                });
            }

            return response.json();
        })
        .then(data => {
            stopThinking();
            if (data.error) throw new Error(data.error);

            displaySQLResults(data.results);
            const rowCount = data.results.rowCount || 0;
            // Status message removed as requested

            // Create complete SQL response for transcript
            let sqlResponse = `Generated SQL: ${window.currentSQLQuery || sqlCode}. `;
            sqlResponse += `Results: ${rowCount} rows returned`;
            if (data.results.columns && data.results.columns.length > 0) {
                sqlResponse += ` with columns: ${data.results.columns.join(', ')}`;
            }
            if (rowCount > 0 && data.results.data && data.results.data.length > 0) {
                const firstRow = data.results.data[0];
                const sampleValues = Object.values(firstRow).slice(0, 3).join(', ');
                sqlResponse += `. Sample values: ${sampleValues}`;
            }

            addToConversationHistory('assistant', sqlResponse);

            // Success message removed as requested
        })
        .catch(error => {
            stopThinking();
            console.error("SQL execution error:", error);
            updateStatus(`Error: ${error.message}`);
            displaySQLResults({ error: error.message, columns: [], data: [], rowCount: 0 });

            // Add complete SQL error response for transcript
            let errorResponse = `Generated SQL: ${window.currentSQLQuery || sqlCode}. `;
            errorResponse += `Execution failed: ${error.message}`;
            addToConversationHistory('assistant', errorResponse);

            window.speakText(`Sorry, there was an error executing the query: ${error.message}`);
        })
        .finally(() => {
            if (executeButton) {
                executeButton.innerHTML = '<span class="button-icon execute-icon"></span> Execute';
                executeButton.disabled = false; executeButton.style.opacity = '1'; executeButton.style.cursor = 'pointer';
            }
            lastGeneratedSql = '';
            window.currentSQLQuery = ''; // Clear the stored query
        });
}

function uploadSQLToCloud(sqlCode) {
    const cloudButton = document.querySelector('.sql-action-button.cloud');
    if (cloudButton) {
        cloudButton.innerHTML = '<span class="button-icon cloud-icon"></span> Uploading...';
        cloudButton.disabled = true; cloudButton.style.opacity = '0.7'; cloudButton.style.cursor = 'wait';
    }

    let sqlTitle = "SQL Query"; // Default title
    const cardTitle = document.querySelector('.sql-code-info-card h3');
    if (cardTitle) sqlTitle = cardTitle.textContent || "SQL Query";

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-'); // Create a safe timestamp
    const filename = `${sqlTitle.replace(/[^a-zA-Z0-9 _-]/g, '')}_${timestamp}.txt`; // Sanitize title for filename

    // Ensure SQL code is clean (remove potential quotes if any were missed)
    const cleanSqlCodeForUpload = sqlCode.replace(/^['"]+|['"]+$/g, '').trim();


    fetch(`${BACKEND_API_URL}/api/upload-to-drive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql: cleanSqlCodeForUpload, filename: filename })
    })
        .then(response => {
            if (!response.ok) {
                return response.text().then(text => { // Get text for better error diagnosis
                    try {
                        const errData = JSON.parse(text); // Try to parse as JSON
                        throw new Error(errData.error || `Upload Error: ${response.status} ${response.statusText}`);
                    } catch (jsonError) { // If not JSON, use the text itself
                        throw new Error(text || `Upload Error: ${response.status} ${response.statusText}`);
                    }
                });
            }
            return response.json();
        })
        .then(data => {
            if (cloudButton) {
                cloudButton.innerHTML = '<span class="button-icon cloud-icon"></span> Upload to Cloud';
                cloudButton.disabled = false; cloudButton.style.opacity = '1'; cloudButton.style.cursor = 'pointer';
            }
            // Display success message near the button
            const successMessage = document.createElement('div');
            successMessage.className = 'upload-success-message';
            successMessage.innerHTML = `
            <span style="color: #28a745; font-weight: bold;">✓</span>
            SQL query uploaded successfully!
        `;
            successMessage.style.marginTop = '0.5rem';
            successMessage.style.padding = '0.5rem';
            successMessage.style.backgroundColor = 'rgba(40, 167, 69, 0.1)';
            successMessage.style.borderRadius = '4px';
            successMessage.style.textAlign = 'center';

            const buttonContainer = cloudButton.parentNode;
            if (buttonContainer) {
                buttonContainer.appendChild(successMessage);
                setTimeout(() => {
                    if (successMessage.parentNode) {
                        successMessage.parentNode.removeChild(successMessage);
                    }
                }, 5000); // Remove after 5 seconds
            }

            window.speakText(`The SQL query has been successfully uploaded".`);
            displayQueryResult('success', 'SQL query uploadedto the server successfully.');
        })
        .catch(error => {
            console.error("Error uploading to cloud:", error);
            if (cloudButton) {
                cloudButton.innerHTML = '<span class="button-icon cloud-icon"></span> Upload to Server';
                cloudButton.disabled = false; cloudButton.style.opacity = '1'; cloudButton.style.cursor = 'pointer';
            }
            // Display error message near the button
            const errorMessage = document.createElement('div');
            errorMessage.className = 'upload-error-message';
            errorMessage.innerHTML = `
            <span style="color: #dc3545; font-weight: bold;">✗</span>
            Upload failed: ${error.message}
        `;
            errorMessage.style.marginTop = '0.5rem';
            errorMessage.style.padding = '0.5rem';
            errorMessage.style.backgroundColor = 'rgba(220, 53, 69, 0.1)';
            errorMessage.style.borderRadius = '4px';
            errorMessage.style.textAlign = 'center';

            const buttonContainer = cloudButton.parentNode;
            if (buttonContainer) {
                buttonContainer.appendChild(errorMessage);
                setTimeout(() => {
                    if (errorMessage.parentNode) {
                        errorMessage.parentNode.removeChild(errorMessage);
                    }
                }, 8000); // Remove after 8 seconds
            }
            window.speakText(`Sorry, there was an error uploading: ${error.message}`);
            displayQueryResult('error', `Upload failed: ${error.message}`);
        });
}

function displaySQLResults(results) {
    const infoContainer = document.getElementById('info-container');
    if (!infoContainer || !results) return;

    // Remove existing SQL results card
    const existingResultCard = document.querySelector('.info-card.sql-results');
    if (existingResultCard) existingResultCard.remove();

    const card = document.createElement('div');
    card.className = 'info-card sql-results'; // Specific class for SQL results
    card.style.cssText = 'text-align: left; padding: 1rem; margin-bottom: 1rem; border-radius: 12px; max-width: 100%; overflow-x: auto;';


    if (results.error) {
        card.style.borderLeft = '5px solid #f44336'; card.style.backgroundColor = '#fff0f0'; // Error styling
        const tag = document.createElement('span'); tag.className = 'event-tag error'; tag.textContent = 'EXECUTION ERROR';
        tag.style.backgroundColor = 'rgba(231, 76, 60, 0.15)'; tag.style.color = '#e74c3c';
        const title = document.createElement('h3'); title.textContent = `Query Execution Failed`; title.style.color = '#e74c3c';
        const errorMsg = document.createElement('p'); errorMsg.textContent = results.error;
        errorMsg.style.cssText = 'color: #a94442; margin-top: 0.5rem; white-space: pre-wrap;';
        card.appendChild(tag); card.appendChild(title); card.appendChild(errorMsg);
    } else {
        card.style.borderLeft = '5px solid #28a745'; card.style.backgroundColor = '#f8f9fa'; // Success styling
        const tag = document.createElement('span'); tag.className = 'event-tag success'; tag.textContent = 'SQL RESULTS';
        tag.style.backgroundColor = 'rgba(40, 167, 69, 0.15)'; tag.style.color = '#28a745';
        const title = document.createElement('h3'); title.textContent = `Query Results`;
        title.style.cssText = 'font-size: 1rem; font-weight: 500; color: #333; margin-bottom: 0.5rem;';

        const table = document.createElement('table'); table.className = 'sql-results-table';
        table.style.cssText = 'width: 100%; border-collapse: collapse; margin-top: 0.5rem; font-size: 0.85rem;';

        const thead = document.createElement('thead'); const headerRow = document.createElement('tr');
        results.columns.forEach(column => {
            const th = document.createElement('th'); th.textContent = column;
            th.style.cssText = 'padding: 0.5rem; background-color: #e9ecef; border-bottom: 2px solid #dee2e6; font-weight: 600; text-align: left;';
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow); table.appendChild(thead);

        const tbody = document.createElement('tbody');
        const rowsData = results.data || []; // Ensure data is an array
        rowsData.forEach((rowObject, rowIndex) => { // rowObject is expected to be an object
            const tr = document.createElement('tr'); tr.style.backgroundColor = rowIndex % 2 === 0 ? '#fff' : '#f8f9fa';
            results.columns.forEach((columnName, cellIndex) => {
                const td = document.createElement('td');
                let cellValue = rowObject[columnName]; // Access by column name
                if (cellValue === null || cellValue === undefined) cellValue = '-';
                else if (typeof cellValue === 'number') {
                    // Check if column name suggests it's a currency
                    if (columnName.toLowerCase().includes('amount') || columnName.toLowerCase().includes('payment') || columnName.toLowerCase().includes('cost') || columnName.toLowerCase().includes('usd')) {
                        cellValue = formatCurrency(cellValue);
                    } else {
                        cellValue = cellValue.toLocaleString(); // Format other numbers with commas
                    }
                }
                td.textContent = cellValue; td.style.cssText = 'padding: 0.5rem; border-bottom: 1px solid #dee2e6;';
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });
        table.appendChild(tbody);

        // Export to CSV button
        const exportButton = document.createElement('button'); exportButton.className = 'sql-action-button export';
        exportButton.innerHTML = '<span class="button-icon"></span> Export to CSV';
        exportButton.style.cssText = 'padding: 0.4rem 0.8rem; font-size: 0.8rem; border-radius: 6px; background-color: #17a2b8; color: white; border: none; cursor: pointer; margin-top: 1rem;';
        // Ensure export icon SVG style is present
        if (!document.getElementById('export-icon-style')) {
            const exportStyle = document.createElement('style'); exportStyle.id = 'export-icon-style';
            exportStyle.textContent = `.sql-action-button.export .button-icon { background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>'); width: 16px; height: 16px; display: inline-block; background-size: contain; background-repeat: no-repeat; background-position: center; vertical-align: middle; margin-right: 4px; }`;
            document.head.appendChild(exportStyle);
        }
        exportButton.addEventListener('click', () => {
            let csv = results.columns.join(',') + '\n';
            rowsData.forEach(rowObject => {
                csv += results.columns.map(columnName => {
                    const cell = rowObject[columnName];
                    if (cell === null || cell === undefined) return '';
                    const cellStr = String(cell);
                    // Escape quotes and handle commas/newlines
                    return (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) ? `"${cellStr.replace(/"/g, '""')}"` : cellStr;
                }).join(',') + '\n';
            });
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' }); const url = URL.createObjectURL(blob);
            const link = document.createElement('a'); link.setAttribute('href', url); link.setAttribute('download', 'sql_results.csv');
            link.style.display = 'none'; document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url);
        });

        card.appendChild(tag); card.appendChild(title);
        if (results.rowCount === 0) {
            const noResults = document.createElement('p'); noResults.textContent = 'No results returned.';
            noResults.style.cssText = 'font-style: italic; color: #6c757d; margin-top: 1rem;';
            card.appendChild(noResults);
        } else {
            card.appendChild(table);
        }
        if (results.rowCount > 0) card.appendChild(exportButton); // Only show export if there are results
    }

    // Insert the results card after the SQL code card if it exists, otherwise at the top
    const sqlCodeCard = infoContainer.querySelector('.info-card.sql-code-info-card');
    if (sqlCodeCard && sqlCodeCard.nextSibling) infoContainer.insertBefore(card, sqlCodeCard.nextSibling);
    else infoContainer.insertBefore(card, infoContainer.firstChild);

    setTimeout(() => { card.classList.add('show'); }, 50); // Animation
}


function displayQueryResult(queryType, result) {
    const infoContainer = document.getElementById('info-container');
    if (!infoContainer) return;

    console.log(`Displaying ${queryType}: ${result}`);

    const card = document.createElement('div');
    card.className = `info-card query-result type-${queryType}`; // Add type-specific class
    // Basic styling, can be enhanced in CSS
    card.style.cssText = 'opacity: 1; transform: translateY(0); display: block; visibility: visible; background-color: white; border-radius: 12px; padding: 1.5rem; margin: 1rem auto; max-width: 400px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06); text-align: center; transition: opacity 0.5s ease, transform 0.5s ease; z-index: 100;';


    // Color-coding based on query type
    switch (queryType) {
        case 'index': card.style.borderLeft = '5px solid #9c27b0'; break; // Purple
        case 'count': card.style.borderLeft = '5px solid #3498db'; break; // Blue
        case 'drug': card.style.borderLeft = '5px solid #9b59b6'; break; // Amethyst
        case 'recipient': card.style.borderLeft = '5px solid #e67e22'; break; // Orange
        case 'amount': card.style.borderLeft = '5px solid #2ecc71'; break; // Green
        case 'error': card.style.borderLeft = '5px solid #f44336'; break; // Red
        case 'success': card.style.borderLeft = '5px solid #4caf50'; break; // Dark Green
        default: card.style.borderLeft = '5px solid #0071e3'; // Default Apple Blue
    }

    let tagText = queryType.toUpperCase();
    let formattedResult = result;

    // Format count results with commas
    if (queryType === 'count' && !isNaN(parseInt(formattedResult))) {
        formattedResult = parseInt(formattedResult).toLocaleString();
    }
    // Format amount if it's not already a $ string
    if (queryType === 'amount' && !formattedResult.startsWith('$') && !isNaN(parseFloat(formattedResult.replace(/[$,]/g, '')))) {
        formattedResult = '$' + parseFloat(formattedResult.replace(/[$,]/g, '')).toLocaleString();
    }


    const tag = document.createElement('span'); tag.className = `event-tag result-tag ${queryType}`; tag.textContent = tagText;
    tag.style.display = 'none'; // Hide the tag for now, main content is more prominent

    const content = document.createElement('div'); content.className = 'query-content'; content.textContent = formattedResult;
    content.style.cssText = 'font-size: 2rem; font-weight: 600; margin-top: 0.5rem; word-break: break-word;';

    // Color content based on type for emphasis
    switch (queryType) {
        case 'recipient': content.style.color = '#e67e22'; break;
        case 'drug': content.style.color = '#9b59b6'; break;
        case 'amount': content.style.color = '#2ecc71'; break;
        case 'count': content.style.color = '#3498db'; break;
        case 'index': content.style.color = '#9c27b0'; break;
        default: content.style.color = '#2c3e50'; // Dark text for default/success/error
    }


    card.appendChild(tag); // Tag is there but hidden by default style
    card.appendChild(content);

    infoContainer.insertBefore(card, infoContainer.firstChild); // Add to top

    const welcomeCard = document.getElementById('welcome-card');
    if (welcomeCard) welcomeCard.style.display = 'none'; // Hide welcome card

    card.classList.add('show'); // Trigger animation

    // Auto-remove card after 15 seconds
    setTimeout(() => {
        card.style.opacity = '0'; card.style.transform = 'translateY(20px)';
        setTimeout(() => {
            if (card.parentNode) {
                card.parentNode.removeChild(card);
                // If no other cards, show welcome card again
                const remainingCards = infoContainer.querySelectorAll('.info-card:not(#welcome-card)');
                if (remainingCards.length === 0 && welcomeCard) {
                    welcomeCard.style.display = 'block';
                    setTimeout(() => welcomeCard.classList.add('show'), 50);
                }
            }
        }, 500); // Wait for fade out animation
    }, 15000); // 15 seconds
    return card;
}

// Original global function, will be wrapped by DOMContentLoaded
// Replace the original processUserInput function with this fixed version
function processUserInput(text) {
    if (!text || isThinking || isSpeaking) {
        console.log(`Original processUserInput: Ignoring input (text: ${!!text}, thinking: ${isThinking}, speaking: ${isSpeaking})`);
        return;
    }
    console.log("Original processUserInput received:", text);
    logRecognitionState("Inside ORIGINAL processUserInput start");

    lastUserQuery = text;
    updateStatus(`Processing: "${text}"`);
    addToConversationHistory('user', text); // This is now the wrapped version that updates chat UI

    if (recognition && isListening) {
        try {
            // Do not stop recognition here if we want continuous listening until AI speaks
            // recognition.stop();
            // console.log("Recognition stopped by processUserInput before processing new query.");
        } catch (error) {
            console.error('Error stopping recognition:', error);
        }
    }

    // Route to appropriate handler based on context and content
    const isVizRequest = detectVisualizationRequest(text);
    const isSQLRequest = detectSQLRequest(text);

    if (isSQLRequest && csvData && csvData.headers) {
        console.log("Original processUserInput: Routing to SQL handler...");
        sendToGeminiForSQL(text);
        return;
    }

    if (isVizRequest && typeof handleGraphRequest === 'function') {
        console.log("Original processUserInput: Routing to visualization handler...");
        handleGraphRequest(text);
        return;
    }

    // Default routing logic
    if (csvData || pdfContent || pptxData || docxContent) {
        console.log("Original processUserInput: Routing to sendToGemini...");
        sendToGemini(text);
    } else {
        console.log("Original processUserInput: No data loaded, providing help message...");
        const response = "I'd be happy to help! Please load some data files first so I can assist you with analysis. You can upload CSV, PDF, Word, or PowerPoint files.";
        addToConversationHistory('assistant', response);
        window.speakText(response);
        updateStatus('Waiting for file upload...');
    }
}

// Original global function, will be wrapped by DOMContentLoaded
function addToConversationHistory(role, content) {
    conversationHistory.push({ role, content });
    if (conversationHistory.length > 10) conversationHistory.shift(); // Keep last 5 user + 5 assistant messages
}

// Original global function, will be wrapped by DOMContentLoaded
function sendToGemini(userMessage) {
    console.log("Original sendToGemini: Sending to backend API (no clinical trials)...");

    // Validate that we have actual file data before proceeding
    let hasValidData = false;
    if (pptxData) hasValidData = validateFileLoaded('PowerPoint', pptxData);
    if (csvData) hasValidData = validateFileLoaded('CSV', csvData) || hasValidData;
    if (pdfContent) hasValidData = validateFileLoaded('PDF', pdfContent) || hasValidData;
    if (docxContent) hasValidData = validateFileLoaded('Word', docxContent) || hasValidData;

    if (!hasValidData && !(pptxData || csvData || pdfContent || docxContent)) { // Check if ANY file was ever loaded
        addToConversationHistory('assistant', "I don't see any files loaded. Please upload a file for me to analyze.");
        window.speakText("I don't see any files loaded. Please upload a file for me to analyze.");
        stopThinking();
        return;
    } else if (!hasValidData) { // Files were loaded, but validation failed (e.g. empty)
        // The validateFileLoaded function already speaks an error message.
        stopThinking();
        return;
    }


    startThinking();
    let pptxContext = "";
    if (pptxData && pptxData.length > 0) {
        pptxData.forEach(slide => {
            const slideText = slide.text || "[No text found on slide]";
            pptxContext += `Slide ${slide.slide_number}: ${slideText}\n\n`;
        });
    }

    // Add conversation history to the request
    const recentHistory = conversationHistory.slice(-5); // Last 5 exchanges (approx 2-3 full turns)

    fetch(`${BACKEND_API_URL}/api/gemini`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            message: userMessage,
            pptxContext: pptxContext,
            csvData: fullData || (csvData ? csvData.raw : ""), // Send raw CSV content
            pdfContent: pdfContent, // Send extracted PDF text
            docxContent: docxContent, // Send extracted DOCX text
            conversationHistory: recentHistory // Add this line to include conversation history
        })
    })
        .then(response => {
            stopThinking();
            if (!response.ok) {
                return response.json().then(errData => { // Try to parse error from backend
                    throw new Error(errData.error || `API Error: ${response.statusText}`);
                }).catch(() => { // Fallback if response.json() fails
                    throw new Error(`API Error: ${response.status} ${response.statusText}`);
                });
            }
            return response.json();
        })
        .then(responseData => {
            if (responseData.error) throw new Error(responseData.error);
            let aiResponse = responseData.response || "";
            aiResponse = aiResponse.trim(); // Trim whitespace
            addToConversationHistory('assistant', aiResponse);

            // Handle merged suggestions if present
            if (responseData.suggestions && Array.isArray(responseData.suggestions)) {
                console.log("Using merged suggestions from backend:", responseData.suggestions);
                updatePromptSuggestions(responseData.suggestions);
            }

            window.speakText(aiResponse);
        })
        .catch(error => {
            console.error('Error calling Backend API for Gemini (original):', error);
            updateStatus(`Error: ${error.message}`);
            stopThinking();
            const fallbackResponse = error.message.includes("API Error")
                ? `Sorry, there was an issue communicating with the AI service (${error.message}).`
                : "Sorry, I encountered an issue trying to process that. Could you please try again?";
            addToConversationHistory('assistant', fallbackResponse);
            window.speakText(fallbackResponse);
            displayQueryResult('error', 'Processing Error');
        });
}

// Original global function, will be wrapped by DOMContentLoaded
function updateFileIndicator() {
    let csvLoaded = false, pdfLoaded = false, pptxLoaded = false, docxLoaded = false, transcriptLoaded = false;
    const fileIndicatorEl = document.getElementById('file-indicator');
    const csvSpanEl = document.getElementById('csv-file-indicator');
    const pdfSpanEl = document.getElementById('pdf-file-indicator');
    const pptxSpanEl = document.getElementById('pptx-file-indicator');
    const docxSpanEl = document.getElementById('docx-file-indicator');

    if (csvFileName && csvSpanEl) {
        csvSpanEl.innerHTML = `<span class="file-icon csv-icon"></span> ${csvFileName}`;
        csvSpanEl.style.display = 'block';
        csvLoaded = true;
    } else if (csvSpanEl) {
        csvSpanEl.style.display = 'none';
    }

    if (pdfFileName && pdfSpanEl) {
        pdfSpanEl.innerHTML = `<span class="file-icon pdf-icon"></span> ${pdfFileName}`;
        pdfSpanEl.style.display = 'block';
        pdfLoaded = true;
    } else if (pdfSpanEl) {
        pdfSpanEl.style.display = 'none';
    }

    if (pptxFileName && pptxSpanEl) {
        pptxSpanEl.innerHTML = `<span class="file-icon pptx-icon"></span> ${pptxFileName}`;
        pptxSpanEl.style.display = 'block';
        pptxLoaded = true;
    } else if (pptxSpanEl) {
        pptxSpanEl.style.display = 'none';
    }

    if (docxFileName && docxSpanEl) {
        docxSpanEl.innerHTML = `<span class="file-icon docx-icon"></span> ${docxFileName}`;
        docxSpanEl.style.display = 'block';
        docxLoaded = true;
    } else if (docxSpanEl) {
        docxSpanEl.style.display = 'none';
    }

    // Handle transcript files in superuser mode
    if (isSuperUser && transcriptFileName) {
        transcriptLoaded = true;
        // You can add a transcript indicator if you have one in your HTML
    }

    // Only show file indicator if at least one file is loaded
    if (fileIndicatorEl && (csvLoaded || pdfLoaded || pptxLoaded || docxLoaded || transcriptLoaded)) {
        fileIndicatorEl.classList.add('visible');
    } else if (fileIndicatorEl) {
        fileIndicatorEl.classList.remove('visible');
    }
}

function loadClinicalTrialsKnowledge() {
    if (isSuperUser) {
        return;
    }

    muteMicrophone();
    unloadAllFiles();
    if (clinicalTrialsLoaded || knowledgeLoadingInProgress) {
        console.log("Clinical trials knowledge already loaded or loading in progress");
        return;
    }
    knowledgeLoadingInProgress = true;
    updateStatus('Loading clinical trials knowledge...');
    console.log("Starting 5-second clinical trials knowledge load simulation...");

    // Visual cue for loading knowledge
    const robotContainer = robot ? robot.closest('.robot-container') : null;
    if (robotContainer) {
        robotContainer.classList.add('loading-knowledge');
        robotContainer.classList.remove('clinical-loaded');
    }
    const knowledgeLoadingIndicator = document.querySelector('.knowledge-loading-indicator');
    if (knowledgeLoadingIndicator) knowledgeLoadingIndicator.style.display = 'flex';

    setTimeout(() => {
        console.log("5-second delay finished. Fetching clinical trials files...");

        fetch(`${BACKEND_API_URL}/api/load-clinical-trials`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Failed to load clinical trials (Status: ${response.status})`);
                }
                return response.json();
            })
            .then(data => {
                if (!data.success) {
                    throw new Error(data.error || 'Failed to load clinical trials data');
                }

                // Process CSV data if loaded
                // Process CSV data if loaded
                if (data.csv_loaded && data.csv_content) {
                    try {
                        // Parse CSV content directly without parseCSVPandas
                        const lines = data.csv_content.split('\n').filter(line => line.trim());
                        if (lines.length > 0) {
                            const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
                            const csvRows = [];

                            for (let i = 1; i < lines.length; i++) {
                                const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
                                if (values.length === headers.length) {
                                    const row = {};
                                    headers.forEach((header, index) => {
                                        row[header] = values[index];
                                    });
                                    csvRows.push(row);
                                }
                            }

                            clinicalTrialsCSV = {
                                headers: headers,
                                data: csvRows,
                                raw: data.csv_content
                            };
                            console.log(`Clinical trials CSV loaded: ${clinicalTrialsCSV.data.length} rows`);
                        }
                    } catch (error) {
                        console.error("Error parsing clinical trials CSV:", error);
                        throw new Error(`Error parsing clinical trials CSV: ${error.message}`);
                    }
                } else {
                    console.warn("Clinical trials CSV not loaded:", data.csv_error);
                }

                // Process DOCX data if loaded
                if (data.docx_loaded && data.docx_content) {
                    clinicalTrialsSynopsis = data.docx_content;
                    console.log("Clinical trials synopsis loaded successfully.");
                } else {
                    console.warn("Clinical trials synopsis not loaded:", data.docx_error);
                }

                // Mark as loaded if at least one file was loaded
                if (data.csv_loaded || data.docx_loaded) {
                    clinicalTrialsLoaded = true;
                    knowledgeLoadingInProgress = false;
                    updateKnowledgeIndicator();
                    if (robotContainer) {
                        robotContainer.classList.remove('loading-knowledge');
                        robotContainer.classList.add('clinical-loaded');
                    }
                    if (knowledgeLoadingIndicator) knowledgeLoadingIndicator.style.display = 'none';
                    updateStatus('Clinical trials knowledge loaded successfully.');
                    window.speakText("Done loading. All ears!");
                } else {
                    throw new Error('No clinical trials files could be loaded');
                }
            })
            .catch(error => {
                console.error("Error loading clinical trials knowledge:", error);
                knowledgeLoadingInProgress = false;
                if (robotContainer) {
                    robotContainer.classList.remove('loading-knowledge');
                    robotContainer.classList.remove('clinical-loaded');
                }
                if (knowledgeLoadingIndicator) knowledgeLoadingIndicator.style.display = 'none';
                updateStatus(`Failed to load clinical trials knowledge: ${error.message}`);
                window.speakText("I am sorry, but I could not load the clinical trials information. Let us continue with what we have.");
                clinicalTrialsCSV = null;
                clinicalTrialsSynopsis = "";
                clinicalTrialsLoaded = false;
                updateKnowledgeIndicator();
            });
    }, 5000); // 5-second delay
}

function updateKnowledgeIndicator() {
    const knowledgeIndicator = document.getElementById('knowledge-indicator');
    const clinicalTrialsIndicator = document.getElementById('clinical-trials-indicator');

    if (!knowledgeIndicator || !clinicalTrialsIndicator) return;

    if (clinicalTrialsLoaded) {
        knowledgeIndicator.classList.add('visible');
        clinicalTrialsIndicator.style.display = 'block'; // Or 'inline-block' / 'flex'
    } else {
        knowledgeIndicator.classList.remove('visible');
        clinicalTrialsIndicator.style.display = 'none';
    }
}

// --- NEW FUNCTIONS START HERE ---
// Function to get file icon based on file type
function getFileIcon(fileType) {
    const iconMap = {
        'pdf': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#dc3545" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M10.29 13.71a2.43 2.43 0 0 1 0-3.42 2.43 2.43 0 0 1 3.42 0"></path><path d="M13.71 17.12a2.43 2.43 0 0 1-3.42 0 2.43 2.43 0 0 1 0-3.42"></path></svg>',
        'csv': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#28a745" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="8" y1="13" x2="16" y2="13"></line><line x1="8" y1="17" x2="16" y2="17"></line><line x1="8" y1="9" x2="10" y2="9"></line></svg>',
        'xlsx': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#28a745" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="8" y1="13" x2="16" y2="13"></line><line x1="8" y1="17" x2="16" y2="17"></line><line x1="8" y1="9" x2="10" y2="9"></line></svg>',
        'docx': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2b579a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="8" y1="13" x2="16" y2="13"></line><line x1="8" y1="17" x2="16" y2="17"></line><line x1="8" y1="9" x2="16" y2="9"></line></svg>',
        'pptx': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#d14424" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><rect x="8" y="12" width="8" height="6" rx="1"></rect></svg>',
        'txt': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6c757d" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><line x1="10" y1="9" x2="8" y2="9"></line></svg>',
        'gdoc': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4285f4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><line x1="10" y1="9" x2="8" y2="9"></line></svg>',
        'gsheet': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#34a853" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="8" y1="13" x2="16" y2="13"></line><line x1="8" y1="17" x2="16" y2="17"></line><line x1="8" y1="9" x2="10" y2="9"></line></svg>',
        'gslides': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fbbc04" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><rect x="8" y="12" width="8" height="6" rx="1"></rect></svg>',
        'default': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6c757d" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>'
    };
    return iconMap[fileType] || iconMap.default;
}

// Function to format file size
function formatFileSize(bytes) {
    if (!bytes || bytes === '0' || isNaN(parseInt(bytes))) return 'Unknown size';
    bytes = parseInt(bytes);
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

// Function to format date
function formatDate(dateString) {
    if (!dateString) return 'Unknown date';
    const date = new Date(dateString);
    return date.toLocaleString();
}

// Function to open file in Google Drive
function openDriveFile(webViewLink) {
    if (webViewLink) {
        window.open(webViewLink, '_blank');
    }
}

// Function to download file from Google Drive
async function downloadDriveFile(fileId, fileName) {
    try {
        const response = await fetch(`${BACKEND_API_URL}/api/download-drive-file/${fileId}`);
        if (!response.ok) {
            throw new Error(`Download failed: ${response.status}`);
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Error downloading file:', error);
        alert(`Error downloading file: ${error.message}`);
    }
}
// --- NEW FUNCTIONS END HERE ---


function showKnowledgePrompt() {
    window.knowledgeLoading = true;
    console.log("showKnowledgePrompt called, setting knowledgeLoading=true");

    // ADD USER INPUT TO CONVERSATION HISTORY FIRST
    if (lastUserQuery && lastUserQuery.trim() !== '') {
        addToConversationHistory('user', lastUserQuery);
    }

    const response = "I can see you're talking about clinical trials. Let me load some data about it";
    addToConversationHistory('assistant', response);
    window.speakText(response);
}

function detectClinicalTrialsMention(text) {
    if (isSuperUser) { return; }
    if (!text) return false;
    const clinicalTrialsKeywords = [
        'clinical trial', 'clinical trials', 'medical study', 'medical studies',
        'drug trial', 'drug trials', 'clinicaltrials.gov', 'trial data',
        'medical research', 'patient trials', 'study participants', 'medical testing',
        'phase trial', 'NCT', // Common acronym for clinical trial numbers
        'trial registry'
        // Add more specific terms if needed
    ];
    const normalizedText = text.toLowerCase();
    return clinicalTrialsKeywords.some(keyword => normalizedText.includes(keyword.toLowerCase()));
}

function detectVisualizationRequest(text) {
    const vizPatterns = [
        /\b(chart|graph|plot|visualiz|visual)\b/i,
        /\b(bar chart|pie chart|line chart|scatter plot)\b/i,
        /\bshow me.*chart\b/i,
        /\bcreate.*graph\b/i,
        /\bmake.*visualization\b/i
    ];

    return vizPatterns.some(pattern => pattern.test(text));
}

function logRecognitionState(label = "Check") {
    console.log(`\n=== ${label} ===`);
    console.log(`Microphone Initialized: ${microphoneInitialized}`);
    console.log(`isListening: ${isListening}`);
    console.log(`isSpeaking: ${isSpeaking}`);
    console.log(`isThinking: ${isThinking}`);
    console.log(`knowledgeLoading: ${window.knowledgeLoading}`); // Check the global flag
    console.log(`recognition exists: ${!!recognition}`);
    console.log("================\n");
}

function hidePromptGalleries() {
    const promptGallery = document.querySelector('.prompt-gallery');
    const sqlPromptGallery = document.querySelector('.sql-prompt-gallery');

    if (promptGallery) {
        promptGallery.classList.remove('show-gallery', 'visible');
    }
    if (sqlPromptGallery) {
        sqlPromptGallery.classList.remove('show-gallery', 'visible');
    }
    // Also hide individual buttons immediately if galleries are hidden
    document.querySelectorAll('.prompt-suggestion, .sql-prompt-suggestion').forEach(btn => {
        btn.classList.remove('visible');
    });
}


// Function to clear both the info display and chat transcript
function clearDisplays() {
    console.log("Clearing info display only");

    // Clear info display
    clearInfoCards(); // This function already exists and handles info cards
    // conversationHistory is intentionally NOT cleared here to maintain context.
}

// Function to open a popup - Updated version
function openPopup(popupId) {
    // Close any open popup first
    closePopup();

    // Show overlay
    const overlay = document.querySelector('.popup-overlay');
    if (overlay) {
        overlay.classList.add('active');
    }

    // Show popup
    const popup = document.getElementById(popupId);
    if (popup) {
        popup.classList.add('active');
        activePopup = popup;

        // Load content based on popup type
        if (popupId === 'file-explorer-popup') {
            loadKnowledgeFiles(); // Changed to load Knowledge folder
        } else if (popupId === 'inbox-popup') {
            loadInboxFiles();
        } else if (popupId === 'output-popup') {
            loadOutputFiles();
        }
    }
}


// Function to close popup
function closePopup() {
    // Hide overlay
    const overlay = document.querySelector('.popup-overlay');
    if (overlay) {
        overlay.classList.remove('active');
    }

    // Hide active popup
    if (activePopup) {
        activePopup.classList.remove('active');
        activePopup = null;
    }
}

// Initialize the file explorer (this version is for the local Knowledge folder)
function initFileExplorer() {
    console.log("initFileExplorer called, but content is now loaded by loadKnowledgeFiles().");
}


// Refresh file explorer content
function refreshFileExplorer() {
    loadKnowledgeFiles(); // Re-run the initialization logic for knowledge files
}

// Function to simulate a system folder open (in production this would use a different approach)
function openSystemFolder(path) {
    console.log(`Would open system folder: ${path}`);
    alert(`This would open the folder: ${path}`);
}

// Function to manually reset conversation history
function resetConversation() {
    conversationHistory = [];
    console.log("Conversation history has been reset.");
    clearChatTranscript(); // Also clear the visual chat transcript from the UI
    window.speakText("I've cleared our conversation history. We can start fresh.");
}


// Function to load Knowledge folder files - Fixed with View buttons
async function loadKnowledgeFiles() {
    const fileExplorerFiles = document.querySelector('#file-explorer-popup .file-explorer-files');
    if (!fileExplorerFiles) {
        console.error("Element .file-explorer-files not found in #file-explorer-popup");
        return;
    }

    fileExplorerFiles.innerHTML = '<div>Loading Knowledge folder...</div>';

    try {
        const response = await fetch(`${BACKEND_API_URL}/api/list-drive-folder`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ folderId: '1LqbF2zYC807iXZIvzaiC-Z2h3BHAz8zC' })
        });
        const data = await response.json();

        if (data.success && data.files && data.files.length > 0) {
            let fileList = '<div style="padding:10px; max-height: 400px; overflow-y: auto;">';
            fileList += '<div style="font-weight: bold; margin-bottom: 5px;">Knowledge Folder Files:</div>';
            fileList += '<ul style="list-style: none; padding: 0;">';

            data.files.forEach(file => {
                const modifiedDate = file.modifiedTime ? formatGoogleDate(file.modifiedTime) : 'Unknown';
                const fileSize = file.size ? formatFileSize(file.size) : 'Unknown';
                const viewButton = file.webViewLink ?
                    `<button onclick="window.open('${file.webViewLink}', '_blank')" style="
                        background-color: #0071e3;
                        color: white;
                        border: none;
                        padding: 4px 8px;
                        border-radius: 4px;
                        font-size: 0.8rem;
                        cursor: pointer;
                        margin-left: 10px;
                    ">View</button>` : '';

                fileList += `
                    <li style="margin: 8px 0; padding: 8px; border: 1px solid #eee; border-radius: 4px; background-color: #f9f9f9;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <strong>${file.name}</strong><br>
                                <small style="color: #666;">
                                    Size: ${fileSize} | Modified: ${modifiedDate}
                                </small>
                            </div>
                            ${viewButton}
                        </div>
                    </li>
                `;
            });
            fileList += '</ul></div>';
            fileExplorerFiles.innerHTML = fileList;
        } else if (data.success && data.files && data.files.length === 0) {
            fileExplorerFiles.innerHTML = `
                <div style="padding:10px;">
                    <div>Knowledge folder is empty</div>
                    <div style="font-size: 0.8em; color: #666; margin-top: 10px;">
                        No files found in the Google Drive folder.
                    </div>
                </div>
            `;
        } else {
            fileExplorerFiles.innerHTML = `
                <div style="color: red; padding:10px;">
                    <strong>Error:</strong> ${data.error || 'Unknown error loading knowledge files.'}
                    <div style="margin-top: 10px; padding: 10px; background-color: #f0f8ff; border: 1px solid #cce5ff; border-radius: 4px;">
                        <strong>Note:</strong> Make sure the Google Drive folder is shared with the service account.
                    </div>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading Knowledge folder:', error);
        fileExplorerFiles.innerHTML = `
            <div style="color: red; padding:10px;">
                <strong>Network Error:</strong> ${error.message}<br>
                <small>Make sure your backend server is running and accessible at ${BACKEND_API_URL}.</small>
            </div>
        `;
    }
}

// Updated function to load inbox files with timestamps - WITH VIEW BUTTONS
async function loadInboxFiles() {
    const inboxMessagesContainer = document.querySelector('#inbox-popup .popup-content .inbox-messages'); // Target specific container
    if (!inboxMessagesContainer) {
        console.error("Element .inbox-messages not found in #inbox-popup .popup-content");
        const popupContent = document.querySelector('#inbox-popup .popup-content');
        if (popupContent) popupContent.innerHTML = '<div style="color: red; padding:10px;">Error: Inbox container not found.</div>';
        return;
    }

    inboxMessagesContainer.innerHTML = '<div style="padding:10px;">Loading inbox files...</div>';

    try {
        const response = await fetch(`${BACKEND_API_URL}/api/list-drive-folder`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ folderId: INBOX_FOLDER_ID })
        });

        const data = await response.json();

        if (data.success && data.files && data.files.length > 0) {
            let fileList = '<div style="font-weight: bold; margin-bottom: 5px; padding:0 10px;">Inbox Files:</div><ul style="list-style: none; padding: 0 10px; max-height: 380px; overflow-y: auto;">';
            data.files.forEach(file => {
                const addedDate = formatGoogleDate(file.createdTime); // Uses global formatGoogleDate
                const fileSize = file.size ? formatFileSize(file.size) : 'Unknown'; // Uses global formatFileSize
                const viewButton = file.webViewLink ?
                    `<button onclick="window.open('${file.webViewLink}', '_blank')" style="
                        background-color: #0071e3;
                        color: white;
                        border: none;
                        padding: 4px 8px;
                        border-radius: 4px;
                        font-size: 0.8rem;
                        cursor: pointer;
                        margin-left: 10px;
                    ">View</button>` : '';

                fileList += `
                    <li style="margin: 8px 0; padding: 8px; border: 1px solid #eee; border-radius: 4px; background-color: #f9f9f9;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <strong style="color: #333;">${file.name}</strong><br>
                                <small style="color: #666;">Size: ${fileSize} | Added: ${addedDate}</small>
                            </div>
                            ${viewButton}
                        </div>
                    </li>
                `;
            });
            fileList += '</ul>';
            inboxMessagesContainer.innerHTML = fileList;
        } else if (data.success && (!data.files || data.files.length === 0)) {
            inboxMessagesContainer.innerHTML = '<div style="padding:10px;">No files found in inbox.</div>';
        } else {
            inboxMessagesContainer.innerHTML = `<div style="color: red; padding:10px;">Error loading inbox: ${data.error || 'Unknown error'}</div>`;
        }
    } catch (error) {
        console.error('Error loading inbox:', error);
        inboxMessagesContainer.innerHTML = `<div style="color: red; padding:10px;">Network Error: ${error.message}</div>`;
    }
}

// Updated function to load output files with timestamps - WITH VIEW BUTTONS
async function loadOutputFiles() {
    const outputItemsContainer = document.querySelector('#output-popup .popup-content .output-items'); // Target specific container
    if (!outputItemsContainer) {
        console.error("Element .output-items not found in #output-popup .popup-content");
        const popupContent = document.querySelector('#output-popup .popup-content');
        if (popupContent) popupContent.innerHTML = '<div style="color: red; padding:10px;">Error: Output container not found.</div>';
        return;
    }

    outputItemsContainer.innerHTML = '<div style="padding:10px;">Loading output files...</div>';

    try {
        const response = await fetch(`${BACKEND_API_URL}/api/list-drive-folder`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ folderId: OUTPUT_FOLDER_ID })
        });

        const data = await response.json();

        if (data.success && data.files && data.files.length > 0) {
            let fileList = '<div style="font-weight: bold; margin-bottom: 5px; padding:0 10px;">Output Files:</div><ul style="list-style: none; padding: 0 10px; max-height: 380px; overflow-y: auto;">';
            data.files.forEach(file => {
                const addedDate = formatGoogleDate(file.createdTime); // Uses global formatGoogleDate
                const fileSize = file.size ? formatFileSize(file.size) : 'Unknown'; // Uses global formatFileSize
                const viewButton = file.webViewLink ?
                    `<button onclick="window.open('${file.webViewLink}', '_blank')" style="
                        background-color: #0071e3;
                        color: white;
                        border: none;
                        padding: 4px 8px;
                        border-radius: 4px;
                        font-size: 0.8rem;
                        cursor: pointer;
                        margin-left: 10px;
                    ">View</button>` : '';

                fileList += `
                    <li style="margin: 8px 0; padding: 8px; border: 1px solid #eee; border-radius: 4px; background-color: #f9f9f9;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <strong style="color: #333;">${file.name}</strong><br>
                                <small style="color: #666;">Size: ${fileSize} | Added: ${addedDate}</small>
                            </div>
                            ${viewButton}
                        </div>
                    </li>
                `;
            });
            fileList += '</ul>';
            outputItemsContainer.innerHTML = fileList;
        } else if (data.success && (!data.files || data.files.length === 0)) {
            outputItemsContainer.innerHTML = '<div style="padding:10px;">No files found in output folder.</div>';
        } else {
            outputItemsContainer.innerHTML = `<div style="color: red; padding:10px;">Error loading output: ${data.error || 'Unknown error'}</div>`;
        }
    } catch (error) {
        console.error('Error loading output:', error);
        outputItemsContainer.innerHTML = `<div style="color: red; padding:10px;">Network Error: ${error.message}</div>`;
    }
}

// Helper function to format Google Drive dates
function formatGoogleDate(dateString) {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    return date.toLocaleString(); // Or any other preferred format
}

// Function to display files in the popup (This is a generic helper, not directly used by the above load functions)
function displayFiles(container, files, folderType) {
    container.innerHTML = ''; // Clear previous content

    if (!files || files.length === 0) {
        container.innerHTML = `<div style="text-align: center; padding: 20px; color: #888;">No files in ${folderType}.</div>`;
        return;
    }

    files.forEach(file => {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item'; // Ensure this class is styled in your CSS
        fileItem.style.cssText = `
            display: flex;
            align-items: center;
            padding: 8px 12px;
            border-radius: 6px;
            cursor: pointer;
            transition: background-color 0.2s ease;
            margin-bottom: 4px;
            border-bottom: 1px solid #f0f0f0;
        `;
        fileItem.onmouseover = () => fileItem.style.backgroundColor = '#f0f0f5';
        fileItem.onmouseout = () => fileItem.style.backgroundColor = 'transparent';


        const iconSvg = getFileIcon(file.type || file.name.split('.').pop()); // Use global getFileIcon

        const fileIcon = document.createElement('div');
        fileIcon.className = 'file-item-icon';
        fileIcon.style.cssText = 'margin-right: 10px; width: 24px; height: 24px; flex-shrink: 0;';
        fileIcon.innerHTML = iconSvg;

        const fileInfo = document.createElement('div');
        fileInfo.className = 'file-item-info';
        fileInfo.style.cssText = 'flex-grow: 1; min-width: 0;'; // For text overflow

        const fileName = document.createElement('div');
        fileName.className = 'file-item-name';
        fileName.style.cssText = 'font-size: 0.95rem; font-weight: 500; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';
        fileName.textContent = file.name;
        fileName.title = file.name; // Tooltip for full name

        const fileDetails = document.createElement('div');
        fileDetails.className = 'file-item-details';
        fileDetails.style.cssText = 'font-size: 0.8rem; color: #666;';

        const size = file.size ? formatFileSize(parseInt(file.size)) : 'Unknown size'; // Use global formatFileSize
        const modifiedDate = file.modifiedTime ? formatGoogleDate(file.modifiedTime) : (file.modified ? formatDate(file.modified) : 'Unknown date');
        fileDetails.textContent = `${size} • Modified ${modifiedDate}`;

        fileInfo.appendChild(fileName);
        fileInfo.appendChild(fileDetails);
        fileItem.appendChild(fileIcon);
        fileItem.appendChild(fileInfo);

        if (file.webViewLink) {
            fileItem.addEventListener('click', () => window.open(file.webViewLink, '_blank'));
        } else if (folderType === 'Knowledge' && file.name) { // For local knowledge files
            fileItem.addEventListener('click', () => window.open(`${BACKEND_API_URL}/knowledge-files/${encodeURIComponent(file.name)}`, '_blank'));
        } else {
            fileItem.style.cursor = 'default';
            fileItem.title = "No direct view link available for this file.";
        }
        container.appendChild(fileItem);
    });
}

// Global variable for voice loading attempts, to be used by forceLoadVoices
let voiceLoadAttempts = 0;
const maxVoiceLoadAttempts = 10; // Can be adjusted

// Function to force load voices, to be defined before DOMContentLoaded or globally if needed by initSpeechSynthesis
// UPDATED forceLoadVoices with forced voice targeting
function forceLoadVoices() {
    voiceLoadAttempts++;
    const currentVoices = window.speechSynthesis.getVoices();

    if (currentVoices.length > 0) {
        console.log(`Voices loaded on attempt ${voiceLoadAttempts}`);
        voices = currentVoices;

        // FORCE: Immediately look for the specific Google US English voice
        window.selectedFemaleVoice = findBestFemaleVoice();
        populateVoiceList();

        console.log("FORCED final selected voice:", window.selectedFemaleVoice ?
            `${window.selectedFemaleVoice.name} (Lang: ${window.selectedFemaleVoice.lang}, Local: ${window.selectedFemaleVoice.localService})` : "None");
    } else if (voiceLoadAttempts < maxVoiceLoadAttempts) {
        console.log(`Voice loading attempt ${voiceLoadAttempts}, retrying...`);
        setTimeout(forceLoadVoices, 500);
    } else {
        console.log("Max voice loading attempts reached, no voices loaded.");
    }
}

// Function to generate dynamic suggestions - DISABLED FOR QUOTA OPTIMIZATION
async function generateDynamicSuggestions() {
    console.log("generateDynamicSuggestions: Disabled to save quota. Suggestions are now merged in main response.");
    return;
}

// Function to generate dynamic SQL suggestions - DISABLED FOR QUOTA OPTIMIZATION
async function generateDynamicSQLSuggestions() {
    console.log("generateDynamicSQLSuggestions: Disabled to save quota. SQL Suggestions are now merged in main response.");
    return;
}

// Function to show loading animation for SQL suggestions
function showSQLSuggestionsLoading() {
    const sqlContainer = document.querySelector('.sql-prompt-suggestions');
    if (!sqlContainer) return;

    // Clear existing suggestions
    sqlContainer.innerHTML = '';

    // Create loading animation
    for (let i = 0; i < 3; i++) {
        const loadingItem = document.createElement('div');
        loadingItem.className = 'sql-suggestion-loading';
        loadingItem.innerHTML = `
            <div class="loading-dots">
                <span class="dot"></span>
                <span class="dot"></span>
                <span class="dot"></span>
            </div>
        `;
        sqlContainer.appendChild(loadingItem);
    }
}

// Function to show loading animation for regular suggestions
function showSuggestionsLoading() {
    const container = document.querySelector('.prompt-suggestions');
    if (!container) return;

    // Clear existing suggestions
    container.innerHTML = '';

    // Create loading animation - using same dots as SQL suggestions since that works
    for (let i = 0; i < 3; i++) {
        const loadingItem = document.createElement('div');
        loadingItem.className = 'suggestion-loading';
        loadingItem.innerHTML = `
            <div class="loading-dots">
                <span class="dot"></span>
                <span class="dot"></span>
                <span class="dot"></span>
            </div>
        `;
        container.appendChild(loadingItem);
    }
}

// Function to update SQL suggestions in the UI
function updateSQLSuggestions(newSuggestions) {
    console.log("Updating SQL suggestions with:", newSuggestions);
    const sqlContainer = document.querySelector('.sql-prompt-suggestions');

    if (!sqlContainer) {
        console.error("SQL suggestions container not found");
        return;
    }

    // Clear loading animations
    sqlContainer.innerHTML = '';

    // Force a DOM reflow
    sqlContainer.offsetHeight;

    // Add timestamp to ensure uniqueness
    const timestamp = Date.now();

    // Create new SQL suggestions with animation
    newSuggestions.forEach((suggestionText, index) => {
        const button = document.createElement('button');
        button.className = `sql-prompt-suggestion dynamic-sql-suggestion-${timestamp}`;
        button.textContent = suggestionText;
        button.setAttribute('data-sql-suggestion-id', `${timestamp}-${index}`);

        // Enhanced styling for dynamic SQL suggestions
        button.style.cssText = `
            background-color: #e6f3ff !important;
            color: #0056b3 !important;
            border: 2px solid #007bff !important;
            border-radius: 20px !important;
            padding: 0.5rem 0.75rem !important;
            font-size: 0.8rem !important;
            font-weight: 600 !important;
            cursor: pointer !important;
            transition: all 0.3s ease !important;
            text-align: left !important;
            width: 100% !important;
            margin-bottom: 0.5rem !important;
            display: block !important;
            opacity: 0 !important;
            transform: translateX(-20px) !important;
            box-shadow: 0 2px 4px rgba(0, 123, 255, 0.2) !important;
        `;

        // Add event listener - FIX: Add to conversation history
        button.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            console.log("Dynamic SQL suggestion clicked:", suggestionText);
            if (suggestionText && typeof sendToGeminiForSQL === 'function') {
                // Add user input to conversation history before processing
                addToConversationHistory('user', suggestionText);
                sendToGeminiForSQL(suggestionText);
            }
        });

        sqlContainer.appendChild(button);

        // Animate in with stagger
        setTimeout(() => {
            button.style.opacity = '1';
            button.style.transform = 'translateX(0)';
        }, (index * 100) + 100);

        // Hover effects
        button.addEventListener('mouseenter', function () {
            this.style.backgroundColor = '#cce7ff !important';
            this.style.transform = 'translateY(-2px) !important';
            this.style.boxShadow = '0 4px 8px rgba(0, 123, 255, 0.3) !important';
        });

        button.addEventListener('mouseleave', function () {
            this.style.backgroundColor = '#e6f3ff !important';
            this.style.transform = 'translateY(0) !important';
            this.style.boxShadow = '0 2px 4px rgba(0, 123, 255, 0.2) !important';
        });
    });

    // Force gallery visibility
    const sqlGallery = document.querySelector('.sql-prompt-gallery');
    if (sqlGallery) {
        sqlGallery.style.opacity = '1';
        sqlGallery.classList.add('visible');
    }

    console.log("SQL suggestions update completed");
}


// Function to update the prompt suggestions in the UI - FORCE UPDATE
function updatePromptSuggestions(newSuggestions) {
    console.log("FORCING updatePromptSuggestions with:", newSuggestions);
    const promptSuggestionsContainer = document.querySelector('.prompt-suggestions');

    if (!promptSuggestionsContainer) {
        console.error("Prompt suggestions container not found");
        return;
    }

    // FORCE clear all existing content
    promptSuggestionsContainer.innerHTML = '';

    // Force a DOM reflow
    promptSuggestionsContainer.offsetHeight;

    // Add timestamp to ensure uniqueness
    const timestamp = Date.now();

    // Create completely new suggestions with force update
    newSuggestions.forEach((suggestionText, index) => {
        const button = document.createElement('button');
        button.className = `prompt-suggestion dynamic-suggestion-${timestamp}`;
        button.textContent = suggestionText;
        button.setAttribute('data-suggestion-id', `${timestamp}-${index}`);

        // Force immediate styling
        button.style.cssText = `
            background-color: #e8f4fd !important;
            color: #1565c0 !important;
            border: 2px solid #2196f3 !important;
            border-radius: 20px !important;
            padding: 0.5rem 0.75rem !important;
            font-size: 0.8rem !important;
            font-weight: 600 !important;
            cursor: pointer !important;
            transition: all 0.2s ease !important;
            text-align: left !important;
            width: 100% !important;
            margin-bottom: 0.5rem !important;
            display: block !important;
            opacity: 0 !important;
            transform: translateX(-20px) !important;
        `;

        // Force event listener
        button.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            console.log("FORCE: Dynamic suggestion clicked:", suggestionText);
            if (suggestionText && typeof window.processUserInput === 'function') {
                // Ensure microphone is ready if needed
                if (!microphoneInitialized && (csvData || pdfContent || pptxData || docxContent)) {
                    manualStartMicrophone(); // Start mic if not already
                    // Wait a bit for mic to initialize before processing
                    setTimeout(() => window.processUserInput(suggestionText), 300);
                } else if (microphoneInitialized || !(csvData || pdfContent || pptxData || docxContent)) {
                    // If mic is already init, or no files (so mic not strictly needed for this action)
                    window.processUserInput(suggestionText);
                } else {
                    alert("Please load a file and ensure microphone is accessible.");
                }
            }
        });

        promptSuggestionsContainer.appendChild(button);

        // Force animate in
        setTimeout(() => {
            button.style.opacity = '1';
            button.style.transform = 'translateX(0)';
        }, (index * 100) + 50);

        // Force hover effects
        button.addEventListener('mouseenter', function () {
            this.style.backgroundColor = '#bbdefb !important';
            this.style.transform = 'translateY(-1px) !important';
        });

        button.addEventListener('mouseleave', function () {
            this.style.backgroundColor = '#e8f4fd !important';
            this.style.transform = 'translateY(0) !important';
        });
    });

    // Force gallery visibility
    const promptGallery = document.querySelector('.prompt-gallery');
    if (promptGallery) {
        promptGallery.style.opacity = '1';
        promptGallery.style.display = 'flex'; // Assuming it's a flex container
        promptGallery.classList.add('visible');
    }

    console.log("FORCED prompt suggestions update completed");
}

// Helper function to ensure suggestions work after dynamic updates
function ensurePromptSuggestionsWork() {
    const promptSuggestionButtons = document.querySelectorAll('.prompt-suggestion');
    promptSuggestionButtons.forEach(button => {
        // Remove any existing listeners to avoid duplicates
        const newButton = button.cloneNode(true);
        button.parentNode.replaceChild(newButton, button);

        // Add fresh event listener
        newButton.addEventListener('click', () => {
            const promptText = newButton.textContent;
            if (promptText) {
                if (!microphoneInitialized && (csvData || pdfContent || pptxData || docxContent)) {
                    manualStartMicrophone();
                    setTimeout(() => window.processUserInput(promptText), 200);
                } else if (microphoneInitialized) {
                    window.processUserInput(promptText);
                } else {
                    alert("Please load a file and ensure microphone is accessible.");
                }
            }
        });
    });
}

async function autoLoadAllFilesUserMode() {
    const loadingDiv = document.getElementById('google-drive-loading');
    const filesDiv = document.getElementById('google-drive-files');

    try {
        loadingDiv.innerHTML = '<div style="padding: 2rem; text-align: center;">Loading all files automatically...</div>';

        const response = await fetch(`${BACKEND_API_URL}/api/list-drive-folder`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ folderId: GOOGLE_DRIVE_UPLOAD_FOLDER_ID })
        });

        const data = await response.json();

        if (data.success && data.files) {
            // Filter for supported file types - include .txt in superuser mode
            const supportedFiles = data.files.filter(file => {
                const name = file.name.toLowerCase();
                const basicSupport = name.endsWith('.csv') || name.endsWith('.pdf') ||
                    name.endsWith('.pptx') || name.endsWith('.docx') || name.endsWith('.doc');
                const transcriptSupport = isSuperUser && name.endsWith('.txt');
                return basicSupport || transcriptSupport;
            });

            if (supportedFiles.length === 0) {
                const supportedFormats = isSuperUser ?
                    "CSV, PDF, PPTX, DOCX, DOC, TXT" :
                    "CSV, PDF, PPTX, DOCX, DOC";
                filesDiv.innerHTML = `
                    <div style="text-align: center; padding: 2rem; color: #666;">
                        No supported files found in the folder.<br>
                        Supported formats: ${supportedFormats}
                    </div>
                `;
                loadingDiv.style.display = 'none';
                filesDiv.style.display = 'block';
                return;
            }

            // Process all files automatically
            await processAllFiles(supportedFiles);
        } else {
            showGoogleDriveError(data.error || 'Failed to load files');
        }
    } catch (error) {
        console.error('Error auto-loading files:', error);
        showGoogleDriveError('Network error loading files');
    }
}

async function processAllFiles(files) {
    muteMicrophone();
    unloadAllFiles();
    const loadingDiv = document.getElementById('google-drive-loading');
    const filesDiv = document.getElementById('google-drive-files');

    let processedCount = 0;
    const totalFiles = files.length;

    // Clear existing data first
    csvData = null;
    pdfContent = "";
    pptxData = null;
    docxContent = "";
    csvFileName = "";
    pdfFileName = "";
    pptxFileName = "";
    docxFileName = "";
    fullData = "";

    for (const file of files) {
        try {
            processedCount++;
            loadingDiv.innerHTML = `
                <div style="padding: 2rem; text-align: center;">
                    <div>Processing files automatically...</div>
                    <div style="margin: 1rem 0;">
                        <div style="font-weight: bold;">${file.name}</div>
                        <div style="color: #666; font-size: 0.9rem;">File ${processedCount} of ${totalFiles}</div>
                    </div>
                    <div style="background: #f0f0f0; border-radius: 10px; height: 8px; overflow: hidden;">
                        <div style="background: #0071e3; height: 100%; width: ${(processedCount / totalFiles) * 100}%; transition: width 0.3s ease;"></div>
                    </div>
                </div>
            `;

            const response = await fetch(`${BACKEND_API_URL}/api/download-and-process-drive-file`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fileId: file.id,
                    fileName: file.name
                })
            });

            if (!response.ok) {
                console.error(`Failed to process ${file.name}: HTTP ${response.status}`);
                continue;
            }

            const result = await response.json();

            if (result.success !== false && (result.type || result.data || result.content || result.slides)) {
                await processGoogleDriveFileDataBatch(result);
            }
        } catch (error) {
            console.error(`Error processing ${file.name}:`, error);
            continue;
        }
    }

    // Show completion
    loadingDiv.innerHTML = `
        <div style="padding: 2rem; text-align: center;">
            <div style="color: #28a745; font-size: 1.2rem; margin-bottom: 1rem;">✓ All Files Loaded</div>
            <div style="color: #666;">Successfully processed ${processedCount} files</div>
            <button onclick="closeGoogleDrivePicker()" style="
                margin-top: 1rem;
                background: #0071e3;
                color: white;
                border: none;
                border-radius: 20px;
                padding: 0.75rem 1.5rem;
                cursor: pointer;
                font-size: 1rem;
            ">Continue</button>
        </div>
    `;

    loadingDiv.style.display = 'block';
    filesDiv.style.display = 'none';

    // Update UI elements
    updateFileIndicator();
    initializeInfoPanel();
    showPromptGalleries();

    // Generate suggestions for all loaded content
    setTimeout(() => {
        generateDynamicSuggestions();
        if (csvData) generateDynamicSQLSuggestions();
    }, 500);

    // Enable Start Listening button
    const startListeningBtn = document.getElementById('start-listening-btn');
    if (startListeningBtn) {
        startListeningBtn.disabled = false;
        startListeningBtn.style.opacity = '1';
        startListeningBtn.style.cursor = 'pointer';
        startListeningBtn.title = 'Click to start voice interaction';
        startListeningBtn.style.display = 'inline-flex';
    }

    // ADD THIS: Auto-initialize microphone in Super User mode when files are loaded
    if (isSuperUser && !microphoneInitialized) {
        setTimeout(() => {
            console.log("Auto-initializing microphone for Super User with loaded files...");
            manualStartMicrophone();
        }, 1000); // Small delay to ensure UI is ready
    }
}

async function processGoogleDriveFileDataBatch(result) {
    muteMicrophone();
    const fileType = result.type;
    const fileName = result.fileName;

    // Process each file type and add to existing data
    switch (fileType) {
        case 'csv':
            if (!csvData) {
                csvData = result.data;
                csvFileName = fileName;
                fullData = result.data.raw;
                displayQueryResult('success', `${fileName} loaded`);
            }
            break;

        case 'pdf':
            if (!pdfContent) {
                pdfContent = result.content;
                pdfFileName = fileName;
                displayQueryResult('success', `${fileName} loaded`);
            } else {
                pdfContent += "\n\n--- " + fileName + " ---\n" + result.content;
                pdfFileName += ", " + fileName;
            }
            break;

        case 'pptx':
            if (!pptxData) {
                pptxData = result.slides;
                pptxFileName = fileName;
                displayQueryResult('success', `${fileName} loaded`);
            } else {
                const startingSlideNumber = pptxData.length + 1;
                const newSlides = result.slides.map(slide => ({
                    ...slide,
                    slide_number: slide.slide_number + startingSlideNumber - 1,
                    source_file: fileName
                }));
                pptxData = pptxData.concat(newSlides);
                pptxFileName += ", " + fileName;
            }
            break;

        case 'docx':
        case 'doc':
            if (!docxContent) {
                docxContent = result.content;
                docxFileName = fileName;
                displayQueryResult('success', `${fileName} loaded`);
            } else {
                docxContent += "\n\n--- " + fileName + " ---\n" + result.content;
                docxFileName += ", " + fileName;
            }
            break;

        case 'txt':
            // Handle transcript files in superuser mode
            if (isSuperUser) {
                if (!transcriptContent) {
                    transcriptContent = result.content;
                    transcriptFileName = fileName;
                    displayQueryResult('success', `Transcript ${fileName} loaded`);
                } else {
                    transcriptContent += "\n\n--- " + fileName + " ---\n" + result.content;
                    transcriptFileName += ", " + fileName;
                }
            }
            break;
    }

    // ADD THIS: Auto-initialize microphone in Super User mode when files are being loaded
    if (isSuperUser && !microphoneInitialized && (csvData || pdfContent || pptxData || docxContent || transcriptContent)) {
        setTimeout(() => {
            console.log("Auto-initializing microphone for Super User after file processing...");
            manualStartMicrophone();
        }, 500); // Small delay after each file
    }
}
// --- Google Drive Picker Functions ---
// --- Google Drive Picker Functions ---
function openGoogleDrivePicker() {
    // MUTE MICROPHONE WHEN STARTING FILE LOAD
    muteMicrophone();

    // Close any open popup first
    closePopup();

    const modal = document.getElementById('google-drive-picker-modal');
    const loadingDiv = document.getElementById('google-drive-loading');
    const filesDiv = document.getElementById('google-drive-files');

    if (!modal) return;

    // Show overlay
    const overlay = document.querySelector('.popup-overlay');
    if (overlay) {
        overlay.classList.add('active');
    }

    // Show modal using the active class
    modal.classList.add('active');
    activePopup = modal;

    loadingDiv.style.display = 'block';
    filesDiv.style.display = 'none';
    selectedGoogleDriveFile = null;

    // Check if Super User mode - auto-load all files
    if (isSuperUser) {
        autoLoadAllFilesUserMode();
    } else {
        // User mode - show file selection
        loadGoogleDriveFiles();
    }
}

async function processAllFiles(files) {
    muteMicrophone(); // Ensure mic stays muted during processing
    unloadAllFiles();
    const loadingDiv = document.getElementById('google-drive-loading');
    const filesDiv = document.getElementById('google-drive-files');

    let processedCount = 0;
    const totalFiles = files.length;

    // Clear existing data first
    csvData = null;
    pdfContent = "";
    pptxData = null;
    docxContent = "";
    csvFileName = "";
    pdfFileName = "";
    pptxFileName = "";
    docxFileName = "";
    fullData = "";

    for (const file of files) {
        try {
            processedCount++;
            loadingDiv.innerHTML = `
                <div style="padding: 2rem; text-align: center;">
                    <div>Processing files automatically...</div>
                    <div style="margin: 1rem 0;">
                        <div style="font-weight: bold;">${file.name}</div>
                        <div style="color: #666; font-size: 0.9rem;">File ${processedCount} of ${totalFiles}</div>
                    </div>
                    <div style="background: #f0f0f0; border-radius: 10px; height: 8px; overflow: hidden;">
                        <div style="background: #0071e3; height: 100%; width: ${(processedCount / totalFiles) * 100}%; transition: width 0.3s ease;"></div>
                    </div>
                </div>
            `;

            const response = await fetch(`${BACKEND_API_URL}/api/download-and-process-drive-file`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fileId: file.id,
                    fileName: file.name
                })
            });

            if (!response.ok) {
                console.error(`Failed to process ${file.name}: HTTP ${response.status}`);
                continue;
            }

            const result = await response.json();

            if (result.success !== false && (result.type || result.data || result.content || result.slides)) {
                await processGoogleDriveFileDataBatch(result);
            }
        } catch (error) {
            console.error(`Error processing ${file.name}:`, error);
            continue;
        }
    }

    // Show completion
    loadingDiv.innerHTML = `
        <div style="padding: 2rem; text-align: center;">
            <div style="color: #28a745; font-size: 1.2rem; margin-bottom: 1rem;">✓ All Files Loaded</div>
            <div style="color: #666;">Successfully processed ${processedCount} files</div>
            <button onclick="closeGoogleDrivePicker()" style="
                margin-top: 1rem;
                background: #0071e3;
                color: white;
                border: none;
                border-radius: 20px;
                padding: 0.75rem 1.5rem;
                cursor: pointer;
                font-size: 1rem;
            ">Continue</button>
        </div>
    `;

    loadingDiv.style.display = 'block';
    filesDiv.style.display = 'none';

    // Update UI elements
    updateFileIndicator();
    initializeInfoPanel();
    showPromptGalleries();

    // Generate suggestions for all loaded content
    setTimeout(() => {
        generateDynamicSuggestions();
        if (csvData) generateDynamicSQLSuggestions();
    }, 500);

    // UNMUTE AND ENABLE MICROPHONE AFTER ALL FILES LOADED
    const startListeningBtn = document.getElementById('start-listening-btn');
    if (startListeningBtn) {
        startListeningBtn.disabled = false;
        startListeningBtn.style.opacity = '1';
        startListeningBtn.style.cursor = 'pointer';
        startListeningBtn.title = 'Click to start voice interaction';
        startListeningBtn.style.display = 'inline-flex';
    }

    // Auto-initialize microphone in Super User mode when files are loaded
    if (isSuperUser && !microphoneInitialized) {
        setTimeout(() => {
            console.log("Auto-initializing microphone for Super User with loaded files...");
            manualStartMicrophone();
        }, 1000); // Small delay to ensure UI is ready
    } else {
        // For regular users, just enable the microphone state but don't auto-start
        microphoneEnabled = true;
        console.log("Files loaded successfully, microphone enabled");
    }
}

async function processGoogleDriveFileData(result) {
    unloadAllFiles();
    const fileType = result.type;
    const fileName = result.fileName;
    // Mic is already muted from openGoogleDrivePicker()

    // Stop current AI activity if needed
    if (isListening || microphoneInitialized) {
        if (typeof stopAI === 'function') stopAI();

        if (isListening && recognition) {
            try {
                recognition.stop();
                isListening = false;
            } catch (e) {
                console.error("Error stopping recognition during Google Drive file upload:", e);
            }
        }
        microphoneInitialized = false;
    }

    // Update global variables based on file type
    switch (fileType) {
        case 'csv':
            csvData = result.data;
            csvFileName = fileName;
            fullData = result.data.raw;
            displayQueryResult('success', `${fileName} loaded`);
            updateStatus(`Database loaded: ${csvData.data.length} rows, ${csvData.headers.length} columns. Ready for questions.`);
            showPromptGalleries();
            break;

        case 'pdf':
            pdfContent = result.content;
            pdfFileName = fileName;
            displayQueryResult('success', `${fileName} loaded`);
            updateStatus(`PDF loaded: ${fileName}. Ready for questions.`);
            showPromptGalleries();
            break;

        case 'pptx':
            pptxData = result.slides;
            pptxFileName = fileName;
            displayQueryResult('success', `${fileName} loaded`);
            updateStatus(`PowerPoint loaded: ${fileName}. Ready for questions.`);
            showPromptGalleries();
            break;

        case 'docx':
        case 'doc':
            docxContent = result.content;
            docxFileName = fileName;
            displayQueryResult('success', `${fileName} loaded`);
            updateStatus(`Word document loaded: ${fileName}. Ready for questions.`);
            showPromptGalleries();
            break;

        default:
            displayQueryResult('error', 'Unsupported file type');
            return;
    }

    // Update file indicator
    updateFileIndicator();

    // Close Google Drive picker
    closeGoogleDrivePicker();

    // UNMUTE AND ENABLE MICROPHONE AFTER SINGLE FILE LOADED
    const startListeningBtn = document.getElementById('start-listening-btn');
    if (startListeningBtn) {
        startListeningBtn.disabled = false;
        startListeningBtn.style.opacity = '1';
        startListeningBtn.style.cursor = 'pointer';
        startListeningBtn.title = 'Click to start voice interaction';
        startListeningBtn.style.display = 'inline-flex';
    }

    // Enable microphone state
    microphoneEnabled = true;
    console.log("Single file loaded successfully, microphone enabled");

    // Auto-initialize microphone for better user experience
    setTimeout(() => {
        if (!microphoneInitialized) {
            manualStartMicrophone();
        }
    }, 500);
}

async function processGoogleDriveFileDataBatch(result) {
    // Don't call muteMicrophone() here since it's already muted
    const fileType = result.type;
    const fileName = result.fileName;

    // Process each file type and add to existing data
    switch (fileType) {
        case 'csv':
            if (!csvData) {
                csvData = result.data;
                csvFileName = fileName;
                fullData = result.data.raw;
                displayQueryResult('success', `${fileName} loaded`);
            }
            break;

        case 'pdf':
            if (!pdfContent) {
                pdfContent = result.content;
                pdfFileName = fileName;
                displayQueryResult('success', `${fileName} loaded`);
            } else {
                pdfContent += "\n\n--- " + fileName + " ---\n" + result.content;
                pdfFileName += ", " + fileName;
            }
            break;

        case 'pptx':
            if (!pptxData) {
                pptxData = result.slides;
                pptxFileName = fileName;
                displayQueryResult('success', `${fileName} loaded`);
            } else {
                const startingSlideNumber = pptxData.length + 1;
                const newSlides = result.slides.map(slide => ({
                    ...slide,
                    slide_number: slide.slide_number + startingSlideNumber - 1,
                    source_file: fileName
                }));
                pptxData = pptxData.concat(newSlides);
                pptxFileName += ", " + fileName;
            }
            break;

        case 'docx':
        case 'doc':
            if (!docxContent) {
                docxContent = result.content;
                docxFileName = fileName;
                displayQueryResult('success', `${fileName} loaded`);
            } else {
                docxContent += "\n\n--- " + fileName + " ---\n" + result.content;
                docxFileName += ", " + fileName;
            }
            break;

        case 'txt':
            // Handle transcript files in superuser mode
            if (isSuperUser) {
                if (!transcriptContent) {
                    transcriptContent = result.content;
                    transcriptFileName = fileName;
                    displayQueryResult('success', `Transcript ${fileName} loaded`);
                } else {
                    transcriptContent += "\n\n--- " + fileName + " ---\n" + result.content;
                    transcriptFileName += ", " + fileName;
                }
            }
            break;
    }

    // Note: Don't auto-initialize microphone here during batch processing
    // It will be handled after all files are processed in processAllFiles()
}

// NEW function to find the specific Google US English voice
function findBestFemaleVoice() {
    if (!voices || voices.length === 0) return null;

    const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
    const isEdge = /Edg/.test(navigator.userAgent);
    const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);

    if (isEdge) {
        // FORCE: Microsoft Ava for Edge
        const avaVoice = voices.find(v =>
            v.name.includes("Ava") &&
            v.name.includes("Microsoft") &&
            v.lang === "en-US"
        );

        if (avaVoice) {
            console.log(`FORCED Edge voice: ${avaVoice.name}`);
            return avaVoice;
        }
    }

    if (isChrome) {
        const forcedVoice = voices.find(v =>
            v.name === "Google US English" &&
            v.lang === "en-US" &&
            v.localService === false
        );

        if (forcedVoice) {
            console.log(`FORCED Chrome voice: ${forcedVoice.name}`);
            return forcedVoice;
        }
    }

    if (isSafari) {
        const forcedVoice = voices.find(v => v.name === "Samantha");

        if (forcedVoice) {
            console.log(`FORCED Safari voice: ${forcedVoice.name}`);
            return forcedVoice;
        }
    }

    const fallback = voices.find(v => v.lang.startsWith('en'));
    console.log(`Final fallback: ${fallback ? fallback.name : 'None'}`);
    return fallback;
}

function closeGoogleDrivePicker() {
    const modal = document.getElementById('google-drive-picker-modal');
    if (modal) {
        modal.classList.remove('active');
    }

    // Hide overlay
    const overlay = document.querySelector('.popup-overlay');
    if (overlay) {
        overlay.classList.remove('active');
    }

    activePopup = null;
    selectedGoogleDriveFile = null;
}

async function loadGoogleDriveFiles() {
    try {
        const response = await fetch(`${BACKEND_API_URL}/api/list-drive-folder`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ folderId: GOOGLE_DRIVE_UPLOAD_FOLDER_ID })
        });

        const data = await response.json();

        if (data.success && data.files) {
            displayGoogleDriveFiles(data.files);
        } else {
            showGoogleDriveError(data.error || 'Failed to load files');
        }
    } catch (error) {
        console.error('Error loading Google Drive files:', error);
        showGoogleDriveError('Network error loading files');
    }
}
function clearClinicalTrialsData() {
    console.log("Clearing clinical trials data...");
    clinicalTrialsCSV = null;
    clinicalTrialsSynopsis = "";
    clinicalTrialsLoaded = false;
    knowledgeLoadingInProgress = false;

    // Update UI indicators
    updateKnowledgeIndicator();

    // Update robot appearance
    const robotContainer = document.querySelector('.robot-container');
    if (robotContainer) {
        robotContainer.classList.remove('clinical-loaded');
        robotContainer.classList.remove('loading-knowledge');
    }

    console.log("Clinical trials data cleared successfully.");
}

function displayGoogleDriveFiles(files) {
    const loadingDiv = document.getElementById('google-drive-loading');
    const filesDiv = document.getElementById('google-drive-files');

    loadingDiv.style.display = 'none';
    filesDiv.style.display = 'block';

    // Filter for supported file types
    const supportedFiles = files.filter(file => {
        const name = file.name.toLowerCase();
        return name.endsWith('.csv') || name.endsWith('.pdf') ||
            name.endsWith('.pptx') || name.endsWith('.docx') || name.endsWith('.doc');
    });

    if (supportedFiles.length === 0) {
        filesDiv.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: #666;">
                No supported files found in the folder.<br>
                Supported formats: CSV, PDF, PPTX, DOCX, DOC
            </div>
        `;
        return;
    }

    let filesHTML = '';
    supportedFiles.forEach(file => {
        const fileIcon = getGoogleDriveFileIcon(file.mimeType);
        const fileSize = formatFileSize(file.size);
        const modifiedDate = file.modifiedTime ? formatGoogleDate(file.modifiedTime) : 'Unknown';

        filesHTML += `
            <div class="google-drive-file-item" onclick="selectGoogleDriveFile(this, '${file.id}', '${file.name}', '${file.webViewLink || ''}')">
                <div class="google-drive-file-icon">${fileIcon}</div>
                <div class="google-drive-file-info">
                    <div class="google-drive-file-name">${file.name}</div>
                    <div class="google-drive-file-details">${fileSize} • Modified: ${modifiedDate}</div>
                </div>
            </div>
        `;
    });

    filesHTML += `
        <div class="google-drive-picker-actions">
            <button onclick="closeGoogleDrivePicker()" style="background: #666; color: white; border: none; border-radius: 20px; padding: 8px 16px; cursor: pointer;">Cancel</button>
            <button id="upload-selected-btn" class="google-drive-upload-selected-btn" onclick="uploadSelectedGoogleDriveFile()" disabled>Upload Selected File</button>
        </div>
    `;

    filesDiv.innerHTML = filesHTML;
}

function selectGoogleDriveFile(element, fileId, fileName, webViewLink) {
    // Remove previous selection
    document.querySelectorAll('.google-drive-file-item').forEach(item => {
        item.classList.remove('selected');
    });

    // Add selection to clicked item
    element.classList.add('selected');

    // Store selected file info
    selectedGoogleDriveFile = {
        id: fileId,
        name: fileName,
        webViewLink: webViewLink
    };

    // Enable upload button
    const uploadBtn = document.getElementById('upload-selected-btn');
    if (uploadBtn) {
        uploadBtn.disabled = false;
    }
}

async function uploadSelectedGoogleDriveFile() {
    if (!selectedGoogleDriveFile) return;

    const uploadBtn = document.getElementById('upload-selected-btn');
    if (uploadBtn) {
        uploadBtn.textContent = 'Uploading...';
        uploadBtn.disabled = true;
    }

    try {
        const response = await fetch(`${BACKEND_API_URL}/api/download-and-process-drive-file`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fileId: selectedGoogleDriveFile.id,
                fileName: selectedGoogleDriveFile.name
            })
        });

        if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
        }

        const result = await response.json();
        console.log('Server response:', result); // Debug log

        if (result.success !== false && (result.type || result.data || result.content || result.slides)) {
            await processGoogleDriveFileData(result);
        } else {
            throw new Error(result.error || 'Processing failed');
        }

    } catch (error) {
        console.error('Upload error:', error);
        showGoogleDriveError(`Failed to upload file: ${error.message}`);
    }

    if (uploadBtn) {
        uploadBtn.textContent = 'Upload Selected File';
        uploadBtn.disabled = !selectedGoogleDriveFile;
    }
}

async function processGoogleDriveFileData(result) {
    unloadAllFiles();
    const fileType = result.type;
    const fileName = result.fileName;
    muteMicrophone();

    // Stop current AI activity if needed
    if (isListening || microphoneInitialized) {
        if (typeof stopAI === 'function') stopAI();

        if (isListening && recognition) {
            try {
                recognition.stop();
                isListening = false;
            } catch (e) {
                console.error("Error stopping recognition during Google Drive file upload:", e);
            }
        }
        microphoneInitialized = false;
    }

    // Update global variables based on file type
    switch (fileType) {
        case 'csv':
            csvData = result.data;
            csvFileName = fileName;
            fullData = result.data.raw;
            displayQueryResult('success', `${fileName} loaded`);
            updateStatus(`Database loaded: ${csvData.data.length} rows, ${csvData.headers.length} columns. Ready for questions.`);
            showPromptGalleries();
            break;

        case 'pdf':
            pdfContent = result.content;
            pdfFileName = fileName;
            displayQueryResult('success', `${fileName} loaded`);
            updateStatus(`PDF loaded: ${fileName}. Ready for questions.`);
            showPromptGalleries();
            break;

        case 'pptx':
            pptxData = result.slides;
            pptxFileName = fileName;
            displayQueryResult('success', `${fileName} loaded`);
            updateStatus(`PowerPoint loaded: ${fileName}. Ready for questions.`);
            showPromptGalleries();
            break;

        case 'docx':
        case 'doc':
            docxContent = result.content;
            docxFileName = fileName;
            displayQueryResult('success', `${fileName} loaded`);
            updateStatus(`Word document loaded: ${fileName}. Ready for questions.`);
            showPromptGalleries();
            break;

        default:
            displayQueryResult('error', 'Unsupported file type');
            return;
    }

    // Update file indicator
    updateFileIndicator();

    // Close Google Drive picker
    closeGoogleDrivePicker();

    // Enable Start Listening button
    const startListeningBtn = document.getElementById('start-listening-btn');
    if (startListeningBtn) {
        startListeningBtn.disabled = false;
        startListeningBtn.style.opacity = '1';
        startListeningBtn.style.cursor = 'pointer';
        startListeningBtn.title = 'Click to start voice interaction';
        startListeningBtn.style.display = 'inline-flex';
    }

    // Auto-initialize microphone for better user experience
    setTimeout(() => {
        if (!microphoneInitialized) {
            manualStartMicrophone();
        }
    }, 500);
}

function getGoogleDriveFileIcon(mimeType) {
    if (!mimeType) return '📄';
    if (mimeType.includes('csv') || mimeType.includes('spreadsheet')) return '📊';
    if (mimeType.includes('pdf')) return '📄';
    if (mimeType.includes('presentation')) return '📊';
    if (mimeType.includes('document') || mimeType.includes('word')) return '📝';
    return '📄';
}

function showGoogleDriveError(message) {
    const loadingDiv = document.getElementById('google-drive-loading');
    const filesDiv = document.getElementById('google-drive-files');

    loadingDiv.style.display = 'none';
    filesDiv.style.display = 'block';
    filesDiv.innerHTML = `
        <div style="text-align: center; padding: 2rem; color: #e74c3c;">
            <div style="font-size: 2rem; margin-bottom: 1rem;">⚠️</div>
            <div style="font-weight: bold; margin-bottom: 0.5rem;">Error Loading Files</div>
            <div style="font-size: 0.9rem;">${message}</div>
            <button onclick="loadGoogleDriveFiles()" style="
                margin-top: 1rem;
                background: #0071e3;
                color: white;
                border: none;
                border-radius: 20px;
                padding: 0.5rem 1rem;
                cursor: pointer;
            ">Retry</button>
        </div>
    `;
}
function sendToGeminiUserMode(userMessage) {
    console.log("Sending to User Mode Gemini API...");

    startThinking();
    let pptxContext = "";
    if (pptxData && pptxData.length > 0) {
        pptxData.forEach(slide => {
            const slideText = slide.text || "[No text found on slide]";
            pptxContext += `Slide ${slide.slide_number}: ${slideText}\n\n`;
        });
    }

    const recentHistory = conversationHistory.slice(-5);

    fetch(`${BACKEND_API_URL}/api/gemini-user-mode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            message: userMessage,
            pptxContext: pptxContext,
            csvData: fullData || (csvData ? csvData.raw : ""),
            pdfContent: pdfContent,
            docxContent: docxContent,
            clinicalTrialsCSV: clinicalTrialsCSV ? clinicalTrialsCSV.raw : "",
            clinicalTrialsSynopsis: clinicalTrialsSynopsis || "",
            conversationHistory: recentHistory
        })
    })
        .then(response => {
            stopThinking();
            if (!response.ok) {
                return response.json().then(errData => {
                    throw new Error(errData.error || `API Error: ${response.statusText}`);
                }).catch(() => {
                    throw new Error(`API Error: ${response.status} ${response.statusText}`);
                });
            }
            return response.json();
        })
        .then(responseData => {
            if (responseData.error) throw new Error(responseData.error);
            let aiResponse = responseData.response || "";
            aiResponse = aiResponse.trim();
            addToConversationHistory('assistant', aiResponse);
            window.speakText(aiResponse);
        })
        .catch(error => {
            console.error('Error calling User Mode Gemini API:', error);
            updateStatus(`Error: ${error.message}`);
            stopThinking();
            const fallbackResponse = "Sorry, I encountered an issue processing that request.";
            addToConversationHistory('assistant', fallbackResponse);
            window.speakText(fallbackResponse);
            displayQueryResult('error', 'Processing Error');
        });
}

// NEW function to set up robot part interactions
function setupRobotInteractions() {
    // Ear functionality - Toggles the microphone on/off
    if (robotEarLeft) {
        robotEarLeft.addEventListener('click', () => {
            console.log("Left ear clicked, toggling microphone.");
            // toggleMicrophone handles all the logic for starting/stopping listening
            // and updating the UI state (including the ear animation via the 'listening' class).
            toggleMicrophone();
        });
    }
    if (robotEarRight) {
        robotEarRight.addEventListener('click', () => {
            console.log("Right ear clicked, toggling microphone.");
            toggleMicrophone();
        });
    }

    // Mouth functionality - Stops the robot's current action (speaking/thinking)
    if (robotMouth) {
        robotMouth.addEventListener('click', () => {
            console.log("Mouth clicked, stopping AI output.");
            // stopAI is the correct function to stop speech/thinking, same as the main stop button.
            stopAI();
        });
    }
}


// Initialize
document.addEventListener('DOMContentLoaded', () => {
    window.knowledgeLoading = false; // Flag for clinical trials loading process
    initializeSuperUserButton();
    initializeSession();
    initializeStarRating(); // Add this line
    initializeFileUpload();

    addFixedCardStyles();
    addAdditionalStyles();
    addLayoutStyles();
    initSpeechSynthesis(); // Sets up onvoiceschanged
    initSoundEffects();
    initializeInfoPanel();
    addFileIndicatorStyles();
    addPromptAnimationStyles();
    const fileIndicator = document.getElementById('file-indicator');
    addCloudButtonStyles(); // Use cloud button styles

    // Hide galleries on initial load
    hidePromptGalleries();

    // NEW: Set up interactive robot parts
    setupRobotInteractions();

    // Start voice loading process
    setTimeout(forceLoadVoices, 1000); // Initial attempt to load voices

    // Also try on user interaction if voices haven't loaded
    document.addEventListener('click', function voiceLoadInteractionHandler() {
        if ((!voices || voices.length === 0) && (!window.selectedFemaleVoice)) {
            console.log("Attempting to load voices on user interaction...");
            const currentVoices = window.speechSynthesis.getVoices();
            if (currentVoices.length > 0) {
                voices = currentVoices;
                window.selectedFemaleVoice = findBestFemaleVoice();
                populateVoiceList(); // Re-populate and select
                console.log("Voice selected on user interaction:", window.selectedFemaleVoice ? window.selectedFemaleVoice.name : "None");
                // Remove listener after successful load on interaction if desired
                document.removeEventListener('click', voiceLoadInteractionHandler);
            }
        } else if (voices && voices.length > 0 && !window.selectedFemaleVoice) {
            // Voices loaded, but no specific female voice picked yet, try again
            window.selectedFemaleVoice = findBestFemaleVoice();
            populateVoiceList();
            console.log("Female voice selected on user interaction (post-load):", window.selectedFemaleVoice ? window.selectedFemaleVoice.name : "None");
        }
    }, { once: false }); // Keep listener if initial load fails, remove manually if needed


    // Add "Start Listening" button to UI
    const robotInterface = document.querySelector('.robot-interface');
    if (robotInterface) {
        const startListeningBtn = document.createElement('button');
        startListeningBtn.id = 'start-listening-btn';
        startListeningBtn.className = 'primary-button';
        startListeningBtn.innerHTML = '<span class="button-icon mic-icon"></span><span class="button-text">Start Listening</span>';
        startListeningBtn.style.display = 'inline-flex';
        startListeningBtn.style.marginBottom = '1rem';
        startListeningBtn.style.marginTop = '0.5rem';
        startListeningBtn.style.padding = '0.75rem 1.5rem';
        startListeningBtn.style.fontSize = '1rem';

        startListeningBtn.disabled = true;
        startListeningBtn.style.opacity = '0.6';
        startListeningBtn.style.cursor = 'not-allowed';
        startListeningBtn.title = 'Upload a file first';

        startListeningBtn.addEventListener('click', () => {
            manualStartMicrophone();
        });

        const controlsContainer = robotInterface.querySelector('.controls');
        if (controlsContainer) {
            robotInterface.insertBefore(startListeningBtn, controlsContainer);
        } else {
            robotInterface.appendChild(startListeningBtn);
        }
    }

    // Replace the unified upload handler with Google Drive Picker
    // Handle both Google Drive and local file uploads
    // Handle both Google Drive and local file uploads - FIXED VERSION
    const googleDriveUploadBtn = document.getElementById('google-drive-upload-btn');
    if (googleDriveUploadBtn) {
        googleDriveUploadBtn.addEventListener('click', openGoogleDrivePicker);
    }

    // Handle existing prompt suggestion buttons
    function attachPromptListeners() {
        const promptSuggestionButtons = document.querySelectorAll('.prompt-suggestion');
        promptSuggestionButtons.forEach(button => {
            button.addEventListener('click', () => {
                const promptText = button.textContent;
                if (promptText) {
                    if (!microphoneInitialized && (csvData || pdfContent || pptxData || docxContent)) {
                        manualStartMicrophone();
                        setTimeout(() => window.processUserInput(promptText), 200);
                    } else if (microphoneInitialized) {
                        window.processUserInput(promptText);
                    } else {
                        alert("Please load a file and ensure microphone is accessible.");
                    }
                }
            });
        });
    }

    // Call it initially
    attachPromptListeners();

    // Handle existing SQL prompt suggestion buttons
    sqlPromptButtons.forEach(button => {
        button.addEventListener('click', () => {
            const promptText = button.textContent;
            if (promptText) {
                if (typeof sendToGeminiForSQL === 'function') {
                    // Add user input to conversation history before processing
                    addToConversationHistory('user', promptText);
                    sendToGeminiForSQL(promptText);
                } else {
                    console.error("sendToGeminiForSQL function not available.");
                    alert("SQL generation function is not ready.");
                }
            }
        });
    });

    if (stopButton) {
        stopButton.addEventListener('click', stopAI);
    }

    const upgradeButton = document.getElementById('upgrade-button');
    if (upgradeButton) {
        upgradeButton.addEventListener('click', () => {
            const robotElement = document.getElementById('robot');
            if (robotElement) {
                robotElement.classList.add('upgraded');
            }
            const robotMessage = document.getElementById('robot-message');
            if (robotMessage) {
                robotMessage.style.display = 'block';
                setTimeout(() => {
                    robotMessage.style.display = 'none';
                }, 10000);
            }
            window.speakText("Thank you for your blessing. I am now ready to assist!");
        });
    }

    updateFileIndicator();
    updateKnowledgeIndicator(); // Initialize knowledge indicator state

    // --- processUserInput WRAPPER (Loads CT directly) ---
    // --- processUserInput WRAPPER (Updated for User Mode) ---
    // --- processUserInput WRAPPER (Updated for All Users) ---
    // --- processUserInput WRAPPER (Clinical Trials Priority for ALL Users) ---
    // --- processUserInput WRAPPER (Updated for All Users) ---
    // --- processUserInput WRAPPER (Updated for All Users) ---
    const originalProcessUserInput = window.processUserInput;
    window.processUserInput = function (text) {
        logRecognitionState("Entering WRAPPED processUserInput");

        // PRIORITY 1: Clinical trials detection for ALL users (before any other routing)
        if (!clinicalTrialsLoaded && !knowledgeLoadingInProgress && detectClinicalTrialsMention(text)) {
            console.log("Wrapper: Detected clinical trials mention, loading knowledge directly.");
            addToConversationHistory('user', text);
            loadClinicalTrialsKnowledge();
            const response = "I can see you're asking about clinical trials. Let me load some data about it";
            addToConversationHistory('assistant', response);
            window.speakText(response);
            return; // STOP here - don't continue to other routing
        }

        // Add user input to conversation history once here
        addToConversationHistory('user', text);

        // PRIORITY 2: Route based on user mode (only if clinical trials not detected)
        if (!isSuperUser) {
            // User Mode - use dedicated API
            const sqlPatterns = [/sql/i, /generate query/i, /write a query/i, /database query/i, /create query/i, /show me the query/i, /query the database/i, /generate sql/i, /sequel/i];
            const vizPatterns = [/visualize/i, /chart/i, /graph/i, /plot/i, /show me a (bar|pie|line|scatter)/i, /create a visualization/i, /make a chart/i, /generate a graph/i];

            const isSQLRequest = sqlPatterns.some(pattern => pattern.test(text.toLowerCase()));
            const isVizRequest = vizPatterns.some(pattern => pattern.test(text.toLowerCase()));

            if (isSQLRequest && typeof window.sendToGeminiForSQL === 'function') {
                console.log("User Mode: Routing to sendToGeminiForSQL");
                window.sendToGeminiForSQL(text);
            } else if (isVizRequest && typeof handleGraphRequest === 'function') {
                console.log("User Mode: Routing to handleGraphRequest");
                handleGraphRequest(text);
            } else {
                console.log("User Mode: Routing to sendToGeminiUserMode");
                sendToGeminiUserMode(text);
            }
        } else {
            // Super User Mode
            console.log("Super User Mode: Processing request");

            const sqlPatterns = [/sql/i, /generate query/i, /write a query/i, /database query/i, /create query/i, /show me the query/i, /query the database/i, /generate sql/i];
            const vizPatterns = [/visualize/i, /chart/i, /graph/i, /plot/i, /show me a (bar|pie|line|scatter)/i, /create a visualization/i, /make a chart/i, /generate a graph/i];

            const isSQLRequest = sqlPatterns.some(pattern => pattern.test(text.toLowerCase()));
            const isVizRequest = vizPatterns.some(pattern => pattern.test(text.toLowerCase()));

            // Handle SQL requests
            if (isSQLRequest && typeof window.sendToGeminiForSQL === 'function') {
                console.log("Super User Mode: Routing to sendToGeminiForSQL");
                window.sendToGeminiForSQL(text);
                return;
            }

            // Handle visualization requests
            if (isVizRequest && typeof handleGraphRequest === 'function') {
                console.log("Super User Mode: Routing to handleGraphRequest");
                handleGraphRequest(text);
                return;
            }

            // Handle transcript content if loaded
            if (transcriptContent && transcriptContent.trim()) {
                console.log("Super User Mode: Routing to transcript analyzer (transcript content available)");
                sendToTranscriptAnalyzer(text);
                return;
            }

            // Default: Call the original function but skip its addToConversationHistory call
            console.log("Super User Mode: Using original processUserInput logic");
            if (typeof originalProcessUserInput === 'function') {
                // Temporarily override the conversation history function to prevent double calls
                const tempAddToHistory = window.addToConversationHistory;
                window.addToConversationHistory = function (role, content) {
                    if (role === 'user' && content === text) {
                        // Skip this call since we already added it
                        return;
                    }
                    tempAddToHistory(role, content);
                };

                originalProcessUserInput(text);

                // Restore the original function
                window.addToConversationHistory = tempAddToHistory;
            } else {
                console.error("Original processUserInput function not found!");
                if (sendToGemini && typeof sendToGemini === 'function') {
                    sendToGemini(text);
                } else {
                    console.error("No fallback function available!");
                }
            }
        }
    };
    console.log("processUserInput function wrapped with PRIORITY clinical trials detection for ALL USERS.");
    console.log("processUserInput function wrapped for clinical trials detection (ALL USERS).");
    console.log("processUserInput function wrapped for clinical trials detection (ALL USERS).");
    console.log("processUserInput function wrapped for User/Super User modes.");
    // --- END: processUserInput WRAPPER ---
    console.log("processUserInput function wrapped.");
    // --- END: processUserInput WRAPPER ---

    // --- sendToGemini WRAPPER (Handles Clinical Trials Knowledge) ---
    const originalSendToGemini = window.sendToGemini; // The global one
    window.sendToGemini = function (userMessage) {
        logRecognitionState("Entering WRAPPED sendToGemini");
        if (clinicalTrialsLoaded) {
            console.log("Wrapped sendToGemini: Using clinical trials knowledge...");
            startThinking();
            let pptxContext = "";
            if (pptxData && pptxData.length > 0) {
                pptxData.forEach(slide => {
                    const slideText = slide.text || "[No text found on slide]";
                    pptxContext += `Slide ${slide.slide_number}: ${slideText}\n\n`;
                });
            }

            // Add conversation history to the request
            const recentHistory = conversationHistory.slice(-5); // Last 5 exchanges

            fetch(`${BACKEND_API_URL}/api/gemini`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: userMessage,
                    pptxContext: pptxContext,
                    csvData: fullData || (csvData ? csvData.raw : ""),
                    pdfContent: pdfContent || "",
                    docxContent: docxContent || "",
                    clinicalTrialsCSV: clinicalTrialsCSV ? clinicalTrialsCSV.raw : "",
                    clinicalTrialsSynopsis: clinicalTrialsSynopsis || "",
                    conversationHistory: recentHistory // Add this line to include conversation history
                })
            })
                .then(response => {
                    stopThinking();
                    if (!response.ok) {
                        return response.json().then(errData => {
                            throw new Error(errData.error || `API Error: ${response.statusText}`);
                        }).catch(() => {
                            throw new Error(`API Error: ${response.status} ${response.statusText}`);
                        });
                    }
                    return response.json();
                })
                .then(responseData => {
                    if (responseData.error) { throw new Error(responseData.error); }
                    let aiResponse = responseData.response || "";
                    aiResponse = aiResponse.trim();
                    addToConversationHistory('assistant', aiResponse);

                    window.speakText(aiResponse);
                })
                .catch(error => {
                    console.error('Error calling Backend API for Gemini (with clinical trials):', error);
                    updateStatus(`Error: ${error.message}`);
                    stopThinking();
                    const fallbackResponse = error.message.includes("API Error")
                        ? `Sorry, there was an issue communicating with the AI service (${error.message}).`
                        : "Sorry, I encountered an issue processing that with clinical trials data.";
                    addToConversationHistory('assistant', fallbackResponse);
                    window.speakText(fallbackResponse);
                    displayQueryResult('error', 'Processing Error');
                });
        }
        else {
            console.log("Wrapped sendToGemini: Calling ORIGINAL sendToGemini (no clinical trials).");
            if (typeof originalSendToGemini === 'function') {
                // originalSendToGemini (the global one) has already been updated to include history
                return originalSendToGemini(userMessage);
            } else {
                console.error("Original sendToGemini function not found, and clinical trials not loaded. Cannot send message.");
                updateStatus("Error: Cannot process request.");
                stopThinking();
                return;
            }
        }
    };
    if (originalSendToGemini && window.sendToGemini !== originalSendToGemini) {
        console.log("sendToGemini function wrapped successfully for clinical trials.");
    } else if (!originalSendToGemini) {
        console.warn("Original sendToGemini function was not found before wrapping.");
    } else {
        console.log("sendToGemini function was already wrapped or original not found initially.");
    }
    // --- END: sendToGemini WRAPPER ---

    // --- START OF NEW DOMContentLoaded LOGIC INTEGRATION ---
    // Flag to prevent duplicate messages
    let messageBeingProcessed = false;

    // Add event listener to refresh button
    const refreshButton = document.getElementById('refresh-info-btn');
    if (refreshButton) {
        console.log("Adding click listener to refresh-info-btn");
        refreshButton.addEventListener('click', clearDisplays);
    } else {
        console.error("Could not find refresh-info-btn element");
    }

    // Robot mic button
    const robotMicBtn = document.getElementById('robot-mic-btn');
    if (robotMicBtn) {
        console.log("Adding click listener to robot-mic-btn");
        robotMicBtn.addEventListener('click', function () {
            console.log("Robot mic button clicked");
            toggleMicrophone(); // This function will handle class toggling
        });
    } else {
        console.error("Could not find robot-mic-btn element");
    }

    // Chat send button
    const chatSendBtn = document.getElementById('chat-send-btn');
    const chatInput = document.getElementById('chat-input');

    if (chatSendBtn && chatInput) {
        chatSendBtn.addEventListener('click', function () {
            sendChatMessage();
        });

        chatInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                sendChatMessage();
            }
        });
    }

    // Function to send chat message (scoped to DOMContentLoaded)
    // Function to send chat message (scoped to DOMContentLoaded)
    function sendChatMessage() {
        const text = chatInput.value.trim();
        if (!text) return;
        messageBeingProcessed = true;

        if (typeof window.processUserInput === 'function') {
            window.processUserInput(text); // This will handle adding to conversation history
            setTimeout(() => {
                messageBeingProcessed = false;
            }, 100);
        } else {
            console.error("processUserInput function not available");
            messageBeingProcessed = false;
        }
        chatInput.value = '';
    }

    // Function to add message to chat with skipProcessing option (scoped to DOMContentLoaded)
    function addMessageToChat(content, sender, skipProcessing = false) {
        const chatMessages = document.getElementById('chat-messages');
        if (!chatMessages) return;

        if (sender === 'user' && messageBeingProcessed && !skipProcessing) {
            console.log("addMessageToChat: Skipping user message as messageBeingProcessed is true and skipProcessing is false.");
            return;
        }

        const placeholder = chatMessages.querySelector('.transcript-placeholder');
        if (placeholder) {
            placeholder.style.display = 'none';
        }

        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${sender}`;
        messageDiv.textContent = content;

        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // Enhanced addToConversationHistory wrapper - FIXED VERSION
    // Enhanced addToConversationHistory wrapper - UPDATED VERSION
    // Enhanced addToConversationHistory wrapper - FIXED VERSION
    const originalAddToConversationHistoryGlobal = window.addToConversationHistory;
    window.addToConversationHistory = function (role, content) {
        // Call the original global function to maintain conversation history
        if (typeof originalAddToConversationHistoryGlobal === 'function') {
            originalAddToConversationHistoryGlobal(role, content);
        }

        // Add to the local buffer for session management
        addToConversationBuffer(role, content);

        // Add to the Q&A buffer for simple transcript upload
        addQA(role, content);

        // Add to conversation export
        addToConversationExport(role, content);

        // Update chat UI - SKIP processing check to ensure messages always appear
        addMessageToChat(content, role, true);

        // Trigger suggestion updates after each turn
        if (suggestionsUpdateTimeout) clearTimeout(suggestionsUpdateTimeout);
        suggestionsUpdateTimeout = setTimeout(() => {
            const now = Date.now();
            if (now - lastSuggestionsUpdate > 1000) {
                // generateDynamicSuggestions(); // DISABLED: Now requested via merged backend call
                // generateDynamicSQLSuggestions(); // DISABLED: Now requested via merged backend call
                lastSuggestionsUpdate = now;
            }
        }, 500);
    };

    if (originalAddToConversationHistoryGlobal && window.addToConversationHistory !== originalAddToConversationHistoryGlobal) {
        console.log("addToConversationHistory function wrapped successfully for session management and suggestions.");
    } else if (!originalAddToConversationHistoryGlobal) {
        console.warn("Original global addToConversationHistory function was not found before wrapping for session management.");
    } else {
        console.log("addToConversationHistory function was already wrapped or original not found initially for session management.");
    }


    // Auto-initialize after a short delay when files are loaded (scoped to DOMContentLoaded)
    const autoInit = function () {
        const hasFiles = typeof csvData !== 'undefined' && csvData ||
            typeof pdfContent !== 'undefined' && pdfContent ||
            typeof pptxData !== 'undefined' && pptxData ||
            typeof docxContent !== 'undefined' && docxContent;

        if (hasFiles && typeof manualStartMicrophone === 'function' &&
            typeof microphoneInitialized !== 'undefined' && !microphoneInitialized) {
            console.log("Auto-initializing microphone based on file detection...");
        }
    };

    setTimeout(autoInit, 2000);

    // Ensure updateFileIndicator wrapper calls the new autoInit
    if (typeof window.updateFileIndicator === 'function') {
        const originalGlobalUpdateFileIndicator = window.updateFileIndicator;
        window.updateFileIndicator = function () {
            if (typeof originalGlobalUpdateFileIndicator === 'function') {
                originalGlobalUpdateFileIndicator();
            }
            setTimeout(autoInit, 1000);
        };
        console.log("Wrapped global updateFileIndicator to call new autoInit.");
    } else {
        console.log("Global updateFileIndicator not found for wrapping with new autoInit.");
    }

    // Add event listeners for new buttons
    const fileExplorerBtn = document.getElementById('file-explorer-btn');
    const inboxBtn = document.getElementById('inbox-btn');
    const outputBtn = document.getElementById('output-btn');

    if (fileExplorerBtn) {
        fileExplorerBtn.addEventListener('click', function () {
            openPopup('file-explorer-popup');
        });
    }

    if (inboxBtn) {
        inboxBtn.addEventListener('click', function () {
            openPopup('inbox-popup');
        });
    }

    if (outputBtn) {
        outputBtn.addEventListener('click', function () {
            openPopup('output-popup');
        });
    }

    // Add event listeners for popup close buttons
    const closeButtons = document.querySelectorAll('.popup-close-btn');
    closeButtons.forEach(button => {
        button.addEventListener('click', function () {
            closePopup();
        });
    });

    // Create overlay for popups
    const overlay = document.createElement('div');
    overlay.className = 'popup-overlay';
    document.body.appendChild(overlay);

    // Click on overlay closes popup
    overlay.addEventListener('click', function () {
        closePopup();
    });

    // Robot interaction feedback
    function showRobotFeedback(message, type) {
        let feedbackDiv = document.getElementById('robot-feedback');
        if (!feedbackDiv) {
            feedbackDiv = document.createElement('div');
            feedbackDiv.id = 'robot-feedback';
            feedbackDiv.className = 'robot-feedback';

            const underRobotIndicators = document.querySelector('.under-robot-indicators');
            if (underRobotIndicators) {
                underRobotIndicators.appendChild(feedbackDiv);
            } else {
                const robotInterface = document.querySelector('.robot-interface');
                if (robotInterface) {
                    robotInterface.appendChild(feedbackDiv);
                }
            }
        }

        feedbackDiv.textContent = message;
        feedbackDiv.className = `robot-feedback ${type}`;
        feedbackDiv.style.display = 'block';

        setTimeout(() => {
            feedbackDiv.style.display = 'none';
        }, 3000);
    }

    // Add ear click feedback
    if (robotEarLeft) {
        robotEarLeft.addEventListener('click', function () {
            if (microphoneEnabled) {
                showRobotFeedback("I'm hearing", 'listening');
            } else {
                showRobotFeedback("I can't hear", 'muted');
            }
        });
    }

    if (robotEarRight) {
        robotEarRight.addEventListener('click', function () {
            if (microphoneEnabled) {
                showRobotFeedback("I'm hearing", 'listening');
            } else {
                showRobotFeedback("I can't hear", 'muted');
            }
        });
    }

    // Add mouth click feedback
    if (robotMouth) {
        robotMouth.addEventListener('click', function () {
            showRobotFeedback("Stopping", 'stopping');
            stopAI();
        });
    }
    // Super User functionality
    const superUserBtn = document.getElementById('super-user-btn');
    const superUserTitle = document.getElementById('super-user-title');
    let isSuperUser = false;



    if (superUserBtn) {
        superUserBtn.addEventListener('click', function () {
            isSuperUser = !isSuperUser;

            if (isSuperUser) {
                // Enter Super User mode
                superUserBtn.innerHTML = '<span class="button-text">User</span>';
                superUserBtn.classList.add('active');
                superUserTitle.style.display = 'block';

                // Clear all loaded files
                csvData = null;
                pdfContent = "";
                pptxData = null;
                docxContent = "";
                csvFileName = "";
                pdfFileName = "";
                pptxFileName = "";
                docxFileName = "";
                fullData = "";

                // Update robot appearance
                const robotContainer = document.querySelector('.robot-container');
                if (robotContainer) {
                    robotContainer.classList.add('super-user');
                }

                // Update file indicators
                updateFileIndicator();

                // Hide galleries
                hidePromptGalleries();

                // Reset info panel
                initializeInfoPanel();

                // Clear chat
                clearChatTranscript();

            } else {
                // Exit Super User mode
                superUserBtn.innerHTML = '<span class="button-text">Super User</span>';
                superUserBtn.classList.remove('active');
                superUserTitle.style.display = 'none';

                // Remove robot styling
                const robotContainer = document.querySelector('.robot-container');
                if (robotContainer) {
                    robotContainer.classList.remove('super-user');
                }

                // Reset info panel
                initializeInfoPanel();
            }
        });
    }

    // Close picker when clicking outside
    window.addEventListener('click', (event) => {
        const modal = document.getElementById('google-drive-picker-modal');
        if (modal && event.target === modal) {
            closeGoogleDrivePicker();
        }
    });

    // Session initialization
    initializeSession();

    // Upload conversation on page unload - FIXED VERSION
    window.addEventListener('beforeunload', function (e) {
        const payload = JSON.stringify({ sessionId: sessionId });
        navigator.sendBeacon(
            `${BACKEND_API_URL}/api/session-disconnect`,
            // CHANGE THIS LINE:
            new Blob([payload], { type: 'application/json' }) // <-- Add this Blob wrapper
        );
    });

    // For visibilitychange:
    document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'hidden') {
            const payload = JSON.stringify({ sessionId: sessionId });
            // The fetch call also needs to be adjusted if it's the one sending it,
            // but the main issue is usually sendBeacon not setting the correct header.
            // Let's ensure the fetch call also sends correct headers for robustness,
            // although sendBeacon is more likely to trigger on unload.

            // Fix for fetch if you're keeping it:
            fetch(`${BACKEND_API_URL}/api/session-disconnect`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json' // <-- ADD THIS HEADER TO FETCH
                },
                body: payload // payload is already the JSON string
            }).catch(() => {
                // Fallback to sendBeacon if fetch fails or is interrupted
                navigator.sendBeacon(
                    `${BACKEND_API_URL}/api/session-disconnect`,
                    // CHANGE THIS LINE:
                    new Blob([payload], { type: 'application/json' }) // <-- Add this Blob wrapper
                );
            });
        }
    });
    // Add this to the end of your script.js file
    setTimeout(() => {
        const mouth = document.getElementById('stop-mouth') || document.querySelector('.robot-mouth');
        if (mouth) {
            mouth.addEventListener('click', () => {
                console.log('Mouth clicked - stopping speech');
                window.speechSynthesis.cancel();
                isSpeaking = false;
                isThinking = false;
                if (robot) robot.classList.remove('talking', 'thinking');
                if (stopButton) stopButton.style.display = 'none';
                updateStatus('Stopped');
            });
            mouth.style.cursor = 'pointer';
            mouth.style.zIndex = '999';
        }
    }, 500);

}); // --- END OF DOMContentLoaded ---

