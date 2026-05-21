/**
 * Voice Notes Premium Engine
 * Refactored to Senior Frontend Standards:
 * - Centralized State Management
 * - Modular Recognition Engine
 * - Optimized DOM Interactions
 * - Robust Error Handling
 */

"use strict";

// --- 1. Configuration & Constants ---
const CONFIG = {
    LANGUAGES: ['en-US', 'hi-IN'],
    STORAGE_KEYS: {
        HTML: 'voice_notes_html',
        LANG: 'voice_notes_lang',
        THEME: 'voice_notes_theme'
    },
    CONFIDENCE_THRESHOLD: 0.85,
    AUTO_SCROLL_BEHAVIOR: 'smooth'
};

// --- 2. Application State ---
const State = {
    isActuallySpeaking: false,
    isManuallyStopped: false,
    currentParagraph: null,
    currentSpan: null,
    recognition: null,
    
    // UI References
    ui: {
        transcriptBox: document.getElementById('transcript-box'),
        emptyState: document.getElementById('empty-state'),
        editorSurface: document.getElementById('editor-container'),
        wordCount: document.getElementById('word-count'),
        charCount: document.getElementById('char-count'),
        liveTime: document.getElementById('live-time'),
        visualizer: document.getElementById('visualizer'),
        langSelect: document.getElementById('lang-select'),
        themeToggle: document.getElementById('theme-toggle'),
        btnToggle: document.getElementById('btn-toggle'),
        toggleText: document.getElementById('toggle-text'),
        btnCopy: document.getElementById('btn-copy'),
        btnDownload: document.getElementById('btn-download'),
        btnClear: document.getElementById('btn-clear')
    }
};

// --- 3. Core Engine Logic ---

/**
 * Initializes the Speech Recognition API.
 * Handles cross-browser compatibility and sets up the event pipeline.
 */
function initSpeechEngine() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
        alert("Web Speech API not supported. Please use Chrome or Edge.");
        return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = State.ui.langSelect.value || 'en-US';

    // Set up lifecycle hooks
    recognition.onstart = () => console.log('Engine Active');
    recognition.onerror = (e) => console.error('Recognition Error:', e.error);
    
    recognition.onresult = handleRecognitionResult;
    recognition.onend = handleRecognitionEnd;

    State.recognition = recognition;
}

/**
 * Main handler for speech results.
 * Manages both interim (real-time) and final (committed) transcript segments.
 * Refactored to prevent duplication by processing results independently.
 * @param {SpeechRecognitionEvent} event 
 */
function handleRecognitionResult(event) {
    State.isActuallySpeaking = true;
    updateUIFeedback();

    let interimResult = '';

    // Iterate through current results batch starting from resultIndex
    for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i][0];
        const transcript = result.transcript;
        const isFinal = event.results[i].isFinal;

        if (isFinal) {
            // Process final results immediately into their own spans
            if (!State.currentSpan) State.currentSpan = createNewSpan();
            State.currentSpan.textContent = transcript;
            State.currentSpan.className = `sentence final ${result.confidence < CONFIG.CONFIDENCE_THRESHOLD ? 'low-confidence' : ''}`;
            State.currentSpan = null; // Mark as done to prevent future duplication
        } else {
            // Accumulate interim results for the current "live" segment
            interimResult += transcript;
        }
    }

    // Update the interim span if there is live "thinking" text
    if (interimResult) {
        if (!State.currentSpan) State.currentSpan = createNewSpan();
        State.currentSpan.textContent = interimResult;
        State.currentSpan.className = 'sentence interim';
    }

    // State feedback update
    if (!interimResult && event.results[event.results.length - 1].isFinal) {
        State.isActuallySpeaking = false;
    }

    syncState();
}

/**
 * Manages engine persistence.
 * Automatically restarts recognition if it drops, unless the user clicked 'Stop'.
 */
function handleRecognitionEnd() {
    State.isActuallySpeaking = false;
    setTimeout(updateUIFeedback, 1000);

    if (!State.isManuallyStopped && State.recognition) {
        try {
            State.recognition.start();
        } catch (err) {
            // Prevent error spam if starting while already active
            if (err.name !== 'InvalidStateError') console.error('Restart Failed:', err);
        }
    }
}

// --- 4. UI & Utility Functions ---

function updateClock() {
    State.ui.liveTime.textContent = new Date().toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
}

function updateStatistics() {
    const text = State.ui.transcriptBox.innerText.trim();
    const chars = text.length;
    const words = text === '' ? 0 : text.split(/\s+/).length;

    State.ui.wordCount.textContent = `${words} word${words !== 1 ? 's' : ''}`;
    State.ui.charCount.textContent = `${chars} char${chars !== 1 ? 's' : ''}`;
}

function updateUIFeedback() {
    const hasContent = State.ui.transcriptBox.innerText.trim().length > 0;
    const shouldHideEmpty = hasContent || State.isActuallySpeaking;
    
    State.ui.emptyState.style.opacity = shouldHideEmpty ? '0' : '1';
    State.ui.emptyState.style.visibility = shouldHideEmpty ? 'hidden' : 'visible';
    
    if (shouldHideEmpty) {
        State.ui.editorSurface.scrollTo({
            top: State.ui.editorSurface.scrollHeight,
            behavior: CONFIG.AUTO_SCROLL_BEHAVIOR
        });
    }
}

function createNewParagraph() {
    const p = document.createElement('p');
    State.ui.transcriptBox.appendChild(p);
    State.currentParagraph = p;
    State.currentSpan = null;
}

function createNewSpan() {
    if (!State.currentParagraph) createNewParagraph();
    const span = document.createElement('span');
    span.className = 'sentence interim';
    State.currentParagraph.appendChild(span);
    State.currentParagraph.appendChild(document.createTextNode(' '));
    return span;
}

/**
 * Synchronizes the app state to the UI and LocalStorage.
 * Should be called whenever content or settings change.
 */
function syncState() {
    updateStatistics();
    updateUIFeedback();
    
    localStorage.setItem(CONFIG.STORAGE_KEYS.HTML, State.ui.transcriptBox.innerHTML);
    localStorage.setItem(CONFIG.STORAGE_KEYS.LANG, State.ui.langSelect.value);
    localStorage.setItem(CONFIG.STORAGE_KEYS.THEME, document.body.classList.contains('light-theme') ? 'light' : 'dark');
}

/**
 * Restores previous session data from LocalStorage.
 */
function loadPersistence() {
    const savedHTML = localStorage.getItem(CONFIG.STORAGE_KEYS.HTML);
    const savedLang = localStorage.getItem(CONFIG.STORAGE_KEYS.LANG);
    const savedTheme = localStorage.getItem(CONFIG.STORAGE_KEYS.THEME);

    if (savedHTML?.trim()) {
        State.ui.transcriptBox.innerHTML = savedHTML;
        
        // Clean up any interim results from the previous session to prevent duplication
        const interims = State.ui.transcriptBox.querySelectorAll('.sentence.interim');
        interims.forEach(el => el.remove());

        // Re-attach currentParagraph to the last saved paragraph
        State.currentParagraph = State.ui.transcriptBox.querySelector('p:last-child');
    }
    
    if (savedLang) State.ui.langSelect.value = savedLang;
    if (savedTheme === 'light') document.body.classList.add('light-theme');
    
    syncState();
}

// --- 5. Event Listeners ---

function bindEvents() {
    // Microphone Toggle
    State.ui.btnToggle.addEventListener('click', () => {
        if (!State.recognition) return;

        if (State.isManuallyStopped) {
            State.isManuallyStopped = false;
            try { State.recognition.start(); } catch (e) {}
            State.ui.btnToggle.classList.remove('stopped');
            State.ui.toggleText.textContent = 'Stop Listening';
            State.ui.visualizer.classList.remove('paused');
        } else {
            State.isManuallyStopped = true;
            State.recognition.stop();
            State.ui.btnToggle.classList.add('stopped');
            State.ui.toggleText.textContent = 'Start Listening';
            State.ui.visualizer.classList.add('paused');
        }
    });

    // Editor Sync
    State.ui.transcriptBox.addEventListener('input', () => {
        if (!State.ui.transcriptBox.innerText.trim()) {
            State.currentParagraph = null;
            State.currentSpan = null;
        }
        syncState();
    });

    // Theme & Language
    State.ui.themeToggle.addEventListener('click', () => {
        document.body.classList.toggle('light-theme');
        syncState();
    });

    State.ui.langSelect.addEventListener('change', () => {
        if (State.recognition) {
            State.recognition.stop();
            State.recognition.lang = State.ui.langSelect.value;
            if (!State.isManuallyStopped) setTimeout(() => State.recognition.start(), 300);
        }
        syncState();
    });

    // Actions (Clear, Copy, Download)
    State.ui.btnClear.addEventListener('click', () => {
        State.ui.transcriptBox.innerHTML = '';
        State.currentParagraph = null;
        State.currentSpan = null;
        createNewParagraph();
        syncState();
    });

    State.ui.btnCopy.addEventListener('click', async () => {
        const text = State.ui.transcriptBox.innerText;
        if (!text.trim()) return;
        try {
            await navigator.clipboard.writeText(text);
            const original = State.ui.btnCopy.innerHTML;
            State.ui.btnCopy.innerHTML = '<span>Copied!</span>';
            setTimeout(() => State.ui.btnCopy.innerHTML = original, 2000);
        } catch (err) { console.error('Copy Failed', err); }
    });

    State.ui.btnDownload.addEventListener('click', () => {
        const text = State.ui.transcriptBox.innerText;
        if (!text.trim()) return;
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `VoiceNote_${new Date().toISOString().slice(0,10)}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    });

    // Shortcuts
    window.addEventListener('keydown', (e) => {
        if (e.ctrlKey) {
            const key = e.key.toLowerCase();
            if (key === 'm') { e.preventDefault(); State.ui.btnToggle.click(); }
            if (key === 's') { e.preventDefault(); State.ui.btnDownload.click(); }
            if (key === 'shift' && key === 'c') { e.preventDefault(); State.ui.btnCopy.click(); }
        }
    });
}

// --- 6. Initialization ---

document.addEventListener('DOMContentLoaded', () => {
    loadPersistence();
    initSpeechEngine();
    bindEvents();
    
    if (!State.currentParagraph) createNewParagraph();
    if (State.recognition && !State.isManuallyStopped) State.recognition.start();

    setInterval(updateClock, 1000);
    updateClock();
});
