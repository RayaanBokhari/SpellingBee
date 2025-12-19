// Display view - polls state and updates UI
let currentState = null;
let lastWordIndex = -1;
let slideAudio = null;  // Current slide's audio
let slideAudioTimeout = null;
let currentImageSrc = null;  // Track current image to avoid flashing
let forceImageUpdate = false;  // Force image update on slide change

// Sound effects (placeholders - user can add actual files)
const sounds = {
    next: new Audio('static/sounds/next.mp3'),
    correct: new Audio('static/sounds/funny.mp3'),  // Funny sound for correct answers
    wrong: new Audio('static/sounds/fart.mp3'),     // Fart sound for wrong answers
    steal: new Audio('static/sounds/steal.mp3')
};

// Set up error handlers for sounds (in case files don't exist)
Object.values(sounds).forEach(sound => {
    sound.addEventListener('error', () => {
        // Silently fail if sound files don't exist
    });
});

// Bad PowerPoint transition effects
const transitions = ['zoom', 'spin', 'bounce', 'wipe', 'dissolve'];

function playSound(name) {
    const sound = sounds[name];
    if (sound && !sound.paused) {
        sound.currentTime = 0;
    }
    sound.play().catch(() => {
        // Ignore errors if sound files don't exist
    });
}

function playSlideAudio(audioSrc) {
    // Stop any existing slide audio
    if (slideAudio) {
        slideAudio.pause();
        slideAudio = null;
    }
    if (slideAudioTimeout) {
        clearTimeout(slideAudioTimeout);
        slideAudioTimeout = null;
    }
    
    if (!audioSrc) return;
    
    // Create and play new audio
    slideAudio = new Audio(audioSrc);
    slideAudio.play().catch(() => {
        // Silently fail if audio can't play
    });
    
    // Stop after 3 seconds
    slideAudioTimeout = setTimeout(() => {
        if (slideAudio) {
            slideAudio.pause();
            slideAudio = null;
        }
    }, 3000);
}

function applyTransition(wordCard, badPPMode) {
    if (!badPPMode) {
        wordCard.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
        return;
    }

    // Remove previous transition classes
    transitions.forEach(t => {
        wordCard.classList.remove(`bad-pp-transition-${t}`);
    });

    // Add random transition
    const randomTransition = transitions[Math.floor(Math.random() * transitions.length)];
    wordCard.classList.add(`bad-pp-transition-${randomTransition}`);

    // Remove after animation completes
    setTimeout(() => {
        wordCard.classList.remove(`bad-pp-transition-${randomTransition}`);
    }, 800);
}

function updateDisplay(state) {
    const words = state.words || [];
    const currentIndex = state.current_word_index || 0;
    const wordRevealed = state.word_revealed === true;
    const badPPMode = state.bad_pp_mode === true;

    // Update scores
    // Format scores - show .5 for half points, otherwise whole number
    const formatScore = (score) => {
        if (score % 1 === 0) return score;
        return score.toFixed(1);
    };
    document.getElementById('score-a').textContent = formatScore(state.team_a_score || 0);
    document.getElementById('score-b').textContent = formatScore(state.team_b_score || 0);

    // Get DOM elements
    const wordCard = document.getElementById('word-card');
    const wordDisplay = document.getElementById('word-display');
    const wordText = document.getElementById('word-text');
    const contextDisplay = document.getElementById('context-display');
    const roundInfo = document.getElementById('round-info');
    const imageContainer = document.getElementById('image-container');
    const wordProgress = document.getElementById('word-progress');

    // Update word
    if (words.length > 0 && currentIndex < words.length) {
        const word = words[currentIndex];

        // Check if word changed (for transitions and audio)
        if (currentIndex !== lastWordIndex) {
            applyTransition(wordCard, badPPMode);
            if (currentIndex > lastWordIndex) {
                playSound('next');
            }
            
            // Play slide-specific audio (if any) for 3 seconds
            const audioData = state.word_audio && state.word_audio[currentIndex.toString()];
            if (audioData) {
                playSlideAudio(audioData.value);
            } else {
                // Stop any playing slide audio if no audio for this slide
                if (slideAudio) {
                    slideAudio.pause();
                    slideAudio = null;
                }
            }
            
            // Force image update on slide change
            forceImageUpdate = true;
            
            lastWordIndex = currentIndex;
        }

        // Update round info
        roundInfo.textContent = `${word.round} (${word.points} pt)`;

        // Word display: ONLY show when revealed, otherwise completely hidden
        if (wordRevealed) {
            wordText.textContent = word.word;
            wordDisplay.style.display = 'block';
            // Show context only when word is revealed
            if (word.context) {
                contextDisplay.textContent = `"${word.context}"`;
                contextDisplay.style.display = 'block';
            } else {
                contextDisplay.style.display = 'none';
            }
        } else {
            // Hide word and context completely
            wordDisplay.style.display = 'none';
            contextDisplay.style.display = 'none';
        }

        // Update image - only if source changed OR slide changed (prevents flashing)
        const imageData = state.word_images && state.word_images[currentIndex.toString()];
        const newImageSrc = imageData ? imageData.value : null;
        
        if (forceImageUpdate || newImageSrc !== currentImageSrc) {
            forceImageUpdate = false;
            currentImageSrc = newImageSrc;
            
            if (imageData) {
                const img = document.createElement('img');
                img.src = imageData.value;
                img.onerror = () => {
                    imageContainer.innerHTML = '<div class="placeholder">Image not found</div>';
                    currentImageSrc = null;
                };
                imageContainer.innerHTML = '';
                imageContainer.appendChild(img);
            } else {
                // Show placeholder if no image
                imageContainer.innerHTML = '<div class="placeholder">Add an image for this word</div>';
            }
        }

        // Update progress
        wordProgress.textContent = `Word ${currentIndex + 1} of ${words.length}`;
    } else {
        // No words loaded
        wordDisplay.style.display = 'none';
        roundInfo.textContent = 'No words loaded';
        contextDisplay.style.display = 'none';
        wordProgress.textContent = 'Click "Load Sample" in the Control Panel';
        imageContainer.innerHTML = '<div class="placeholder">No words loaded yet</div>';
    }
}

function pollState() {
    fetch('/api/state')
        .then(response => response.json())
        .then(state => {
            currentState = state;
            updateDisplay(state);
        })
        .catch(error => {
            console.error('Error fetching state:', error);
        });
}

// Poll every 500ms
setInterval(pollState, 500);

// Initial load
pollState();

