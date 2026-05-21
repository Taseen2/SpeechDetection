/**
 * Voice Notes Premium Engine
 * A robust integration of Web Speech API with a modern SaaS UI.
 */

// 1. Core API Initialization
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if (!SpeechRecognition) {
    alert("This browser doesn't support the Web Speech API. For the best experience, please use Google Chrome or Microsoft Edge.");
}

const recognition = new SpeechRecognition();
recognition.continuous = true; 
recognition.interimResults = true;
recognition.lang = 'en-US';

// 2. DOM Cache
const transcriptBox = document.getElementById('transcript-box');
const emptyState = document.getElementById('empty-state');
const editorSurface = document.getElementById('editor-container');
const wordCountEl = document.getElementById('word-count');
const charCountEl = document.getElementById('char-count');
const liveTimeEl = document.getElementById('live-time');
const visualizer = document.getElementById('visualizer');

// Buttons
const btnToggle = document.getElementById('btn-toggle');
const toggleText = document.getElementById('toggle-text');
const btnCopy = document.getElementById('btn-copy');
const btnDownload = document.getElementById('btn-download');
const btnClear = document.getElementById('btn-clear');

// 3. Application State
let currentParagraph = null;
let currentSpan = null;
let isActuallySpeaking = false;
let isManuallyStopped = false; // New state to control toggle

// 4. Utility Functions

function updateClock() {
    const now = new Date();
    liveTimeEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
setInterval(updateClock, 1000);
updateClock();

function updateStatistics() {
    const fullText = transcriptBox.innerText || '';
    const charCount = fullText.length;
    const wordCount = fullText.trim() === '' ? 0 : fullText.trim().split(/\s+/).length;
    
    wordCountEl.textContent = `${wordCount} word${wordCount !== 1 ? 's' : ''}`;
    charCountEl.textContent = `${charCount} char${charCount !== 1 ? 's' : ''}`;
}

function smoothAutoScroll() {
    editorSurface.scrollTo({
        top: editorSurface.scrollHeight,
        behavior: 'smooth'
    });
}

function handleEmptyState() {
    const hasContent = transcriptBox.innerText.trim().length > 0;
    if (hasContent || isActuallySpeaking) {
        emptyState.style.opacity = '0';
        emptyState.style.transform = 'translate(-50%, -60%)';
    } else {
        emptyState.style.opacity = '1';
        emptyState.style.transform = 'translate(-50%, -50%)';
    }
}

function createNewParagraph() {
    currentParagraph = document.createElement('p');
    transcriptBox.appendChild(currentParagraph);
    currentSpan = null; 
}

function createNewSpan() {
    if (!currentParagraph) createNewParagraph();
    const span = document.createElement('span');
    span.className = 'sentence interim';
    currentParagraph.appendChild(span);
    currentParagraph.appendChild(document.createTextNode(' '));
    return span;
}

function resetWorkspace() {
    transcriptBox.innerHTML = '';
    currentParagraph = null;
    currentSpan = null;
    createNewParagraph();
    updateStatistics();
    isActuallySpeaking = false;
    handleEmptyState();
}

// 5. Native Action Event Listeners

// TOGGLE VOICE RECOGNITION
btnToggle.addEventListener('click', () => {
    if (isManuallyStopped) {
        // Start Listening
        isManuallyStopped = false;
        recognition.start();
        btnToggle.classList.remove('stopped');
        toggleText.textContent = 'Stop Listening';
        visualizer.classList.remove('paused');
    } else {
        // Stop Listening
        isManuallyStopped = true;
        recognition.stop();
        btnToggle.classList.add('stopped');
        toggleText.textContent = 'Start Listening';
        visualizer.classList.add('paused');
    }
});

btnCopy.addEventListener('click', async () => {
    const text = transcriptBox.innerText;
    if (!text.trim()) return;
    try {
        await navigator.clipboard.writeText(text);
        const originalHTML = btnCopy.innerHTML;
        btnCopy.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> Copied';
        setTimeout(() => btnCopy.innerHTML = originalHTML, 2000);
    } catch (err) { console.error('Copy failed', err); }
});

btnDownload.addEventListener('click', () => {
    const text = transcriptBox.innerText;
    if (!text.trim()) return;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Voice_Note_${new Date().toISOString().slice(0,10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
});

btnClear.addEventListener('click', resetWorkspace);

// 6. Speech Recognition Event Pipeline

recognition.onstart = () => {
    console.log('Voice engine active');
};

recognition.onresult = (event) => {
    isActuallySpeaking = true;
    handleEmptyState();
    
    let interimResult = '';
    let finalResult = '';

    for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcriptSegment = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
            finalResult += transcriptSegment;
        } else {
            interimResult += transcriptSegment;
        }
    }

    if (!currentSpan) {
        currentSpan = createNewSpan();
    }

    if (finalResult !== '') {
        const cmd = finalResult.trim().toLowerCase();
        if (cmd === 'new paragraph' || cmd === 'new paragraph.' || cmd === 'next paragraph') {
            createNewParagraph();
            return;
        }
        if (cmd === 'clear transcript' || cmd === 'clear screen' || cmd === 'clear notes') {
            resetWorkspace();
            return;
        }

        currentSpan.textContent = finalResult;
        currentSpan.className = 'sentence final';
        currentSpan = null; 
        isActuallySpeaking = false;
    } else {
        currentSpan.textContent = interimResult;
    }

    updateStatistics();
    smoothAutoScroll();
};

recognition.onerror = (event) => {
    console.error('Recognition Error:', event.error);
};

recognition.onend = () => {
    isActuallySpeaking = false;
    setTimeout(handleEmptyState, 1000);
    
    // ONLY auto-restart if the user didn't manually click stop
    if (!isManuallyStopped) {
        try {
            recognition.start();
        } catch (err) {
            if (err.name !== 'InvalidStateError') console.error('Restart failed:', err);
        }
    }
};

// 8. Bootstrapping
createNewParagraph();
recognition.start();
handleEmptyState();
updateStatistics();
