// Control view - manages game state manually
let currentState = null;
let stealModeActive = false;

// Sound effects
const sounds = {
    next: new Audio('static/sounds/next.mp3'),
    correct: new Audio('static/sounds/funny.mp3'),
    wrong: new Audio('static/sounds/fart.mp3'),
    steal: new Audio('static/sounds/steal.mp3')
};

Object.values(sounds).forEach(sound => {
    sound.addEventListener('error', () => {});
});

function playSound(name) {
    const sound = sounds[name];
    if (sound) {
        sound.currentTime = 0;
        sound.play().catch(() => {});
    }
}

function loadState() {
    return fetch('/api/state')
        .then(response => response.json())
        .then(state => {
            currentState = state;
            updateUI(state);
            return state;
        });
}

function updateState(updates) {
    return fetch('/api/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
    })
    .then(response => response.json())
    .then(state => {
        currentState = state;
        updateUI(state);
        return state;
    });
}

function updateUI(state) {
    const words = state.words || [];
    const currentIndex = state.current_word_index || 0;

    // Update word display (always show word on control panel)
    if (words.length > 0 && currentIndex < words.length) {
        const word = words[currentIndex];
        document.getElementById('round-badge').textContent = `${word.round} (${word.points} pt)`;
        document.getElementById('word-text-control').textContent = word.word;
        
        // Update definition and sentence
        const definitionText = document.getElementById('definition-text');
        const sentenceText = document.getElementById('sentence-text');
        
        if (word.definition) {
            definitionText.textContent = word.definition;
        } else {
            definitionText.textContent = '—';
        }
        
        if (word.sentence) {
            sentenceText.textContent = `"${word.sentence}"`;
        } else {
            sentenceText.textContent = '—';
        }

        // Update image preview
        const imagePreview = document.getElementById('image-preview');
        const imageData = state.word_images && state.word_images[currentIndex.toString()];
        if (imageData) {
            imagePreview.innerHTML = `<img src="${imageData.value}" onerror="this.parentElement.innerHTML='<div class=\\'placeholder\\'>Image not found</div>'">`;
        } else {
            imagePreview.innerHTML = '<div class="placeholder">No image</div>';
        }

        // Update audio preview
        const audioStatus = document.getElementById('audio-status');
        const previewBtn = document.getElementById('preview-audio-btn');
        const audioData = state.word_audio && state.word_audio[currentIndex.toString()];
        if (audioData) {
            audioStatus.textContent = '🔊 Audio loaded';
            audioStatus.classList.add('has-audio');
            previewBtn.style.display = 'inline-block';
            previewBtn.dataset.audioSrc = audioData.value;
        } else {
            audioStatus.textContent = 'No audio';
            audioStatus.classList.remove('has-audio');
            previewBtn.style.display = 'none';
        }

        document.getElementById('word-counter').textContent = `${currentIndex + 1} / ${words.length}`;
    } else {
        document.getElementById('word-text-control').textContent = 'No words loaded';
        document.getElementById('round-badge').textContent = '';
        document.getElementById('definition-text').textContent = '—';
        document.getElementById('sentence-text').textContent = '—';
        document.getElementById('audio-status').textContent = 'No audio';
        document.getElementById('preview-audio-btn').style.display = 'none';
        document.getElementById('word-counter').textContent = '0 / 0';
    }

    // Update scores
    document.getElementById('score-display-a').textContent = state.team_a_score || 0;
    document.getElementById('score-display-b').textContent = state.team_b_score || 0;

    // Update current team indicators
    const currentTeam = state.current_team || 'A';
    document.getElementById('current-a').classList.toggle('active', currentTeam === 'A');
    document.getElementById('current-b').classList.toggle('active', currentTeam === 'B');
    document.getElementById('set-team-a-btn').classList.toggle('active', currentTeam === 'A');
    document.getElementById('set-team-b-btn').classList.toggle('active', currentTeam === 'B');

    // Update steal counts
    document.getElementById('steals-a').textContent = state.steals_used_a || 0;
    document.getElementById('steals-b').textContent = state.steals_used_b || 0;

    // Update Bad PP Mode toggle
    document.getElementById('bad-pp-toggle').checked = state.bad_pp_mode === true;

    // Update reveal button text
    const revealBtn = document.getElementById('reveal-btn');
    if (state.word_revealed === true) {
        revealBtn.textContent = 'Hide Word from Screen';
        revealBtn.classList.remove('btn-primary');
        revealBtn.classList.add('btn-secondary');
    } else {
        revealBtn.textContent = 'Show Word on Screen';
        revealBtn.classList.remove('btn-secondary');
        revealBtn.classList.add('btn-primary');
    }
}

// Navigation
document.getElementById('prev-btn').addEventListener('click', () => {
    if (!currentState || !currentState.words) return;
    const newIndex = Math.max(0, (currentState.current_word_index || 0) - 1);
    updateState({ current_word_index: newIndex, word_revealed: false });
    playSound('next');
});

document.getElementById('next-btn').addEventListener('click', () => {
    if (!currentState || !currentState.words) return;
    const words = currentState.words;
    const newIndex = Math.min(words.length - 1, (currentState.current_word_index || 0) + 1);
    updateState({ current_word_index: newIndex, word_revealed: false });
    playSound('next');
});

// Reveal word toggle
document.getElementById('reveal-btn').addEventListener('click', () => {
    const currentlyRevealed = currentState && currentState.word_revealed === true;
    updateState({ word_revealed: !currentlyRevealed });
});

// Sound effect buttons
document.getElementById('correct-sound-btn').addEventListener('click', () => {
    playSound('correct');
});

document.getElementById('wrong-sound-btn').addEventListener('click', () => {
    playSound('wrong');
});

// Team selection
document.getElementById('set-team-a-btn').addEventListener('click', () => {
    updateState({ current_team: 'A' });
});

document.getElementById('set-team-b-btn').addEventListener('click', () => {
    updateState({ current_team: 'B' });
});

// Steal mode toggle
document.getElementById('toggle-steal-btn').addEventListener('click', () => {
    stealModeActive = !stealModeActive;
    const indicator = document.getElementById('steal-indicator');
    const btn = document.getElementById('toggle-steal-btn');
    if (stealModeActive) {
        indicator.style.display = 'block';
        btn.textContent = 'Exit Steal Mode';
        btn.classList.add('btn-warning');
    } else {
        indicator.style.display = 'none';
        btn.textContent = 'Toggle Steal Mode';
        btn.classList.remove('btn-warning');
    }
});

// Score buttons - add points
document.querySelectorAll('.btn-score-add').forEach(btn => {
    btn.addEventListener('click', () => {
        const team = btn.dataset.team;
        const points = parseInt(btn.dataset.points);
        const currentScore = team === 'A' ? currentState.team_a_score : currentState.team_b_score;
        const newScore = currentScore + points;
        
        const update = {};
        update[`team_${team.toLowerCase()}_score`] = newScore;
        updateState(update);
        playSound('correct');
    });
});

// Score buttons - decrease
document.querySelectorAll('.btn-score.btn-minus').forEach(btn => {
    btn.addEventListener('click', () => {
        const team = btn.dataset.team;
        const currentScore = team === 'A' ? currentState.team_a_score : currentState.team_b_score;
        const newScore = Math.max(0, currentScore - 1);
        
        const update = {};
        update[`team_${team.toLowerCase()}_score`] = newScore;
        updateState(update);
    });
});

// Steal count adjustments
document.querySelectorAll('.btn-steal-adjust').forEach(btn => {
    btn.addEventListener('click', () => {
        const team = btn.dataset.team;
        const action = btn.dataset.action;
        const currentSteals = team === 'A' ? currentState.steals_used_a : currentState.steals_used_b;
        const newSteals = action === 'increase' ? currentSteals + 1 : Math.max(0, currentSteals - 1);
        
        const update = {};
        update[`steals_used_${team.toLowerCase()}`] = newSteals;
        updateState(update);
    });
});

// Reset steals
document.getElementById('reset-steals-btn').addEventListener('click', () => {
    updateState({ steals_used_a: 0, steals_used_b: 0 });
});

// Bad PP Mode toggle
document.getElementById('bad-pp-toggle').addEventListener('change', (e) => {
    updateState({ bad_pp_mode: e.target.checked });
});

// Reload CSV
document.getElementById('reload-csv-btn').addEventListener('click', () => {
    fetch('/api/words', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv_file: 'sample_words.csv' })
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            alert('Error: ' + data.error);
        } else {
            loadState();
            alert(`Reloaded ${data.word_count} words from CSV!`);
        }
    });
});

// Reset game
document.getElementById('reset-btn').addEventListener('click', () => {
    if (!confirm('Are you sure you want to reset the game? This will reset all scores and progress.')) {
        return;
    }
    
    fetch('/api/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    })
    .then(response => response.json())
    .then(() => {
        stealModeActive = false;
        document.getElementById('steal-indicator').style.display = 'none';
        document.getElementById('toggle-steal-btn').textContent = 'Toggle Steal Mode';
        document.getElementById('toggle-steal-btn').classList.remove('btn-warning');
        loadState();
        alert('Game reset!');
    });
});

// Image URL input
document.getElementById('set-image-url-btn').addEventListener('click', () => {
    const url = document.getElementById('image-url-input').value.trim();
    if (!url || !currentState || !currentState.words) return;
    
    const currentIndex = currentState.current_word_index || 0;
    fetch(`/api/word/${currentIndex}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_url: url })
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            alert('Error: ' + data.error);
        } else {
            loadState();
            document.getElementById('image-url-input').value = '';
        }
    });
});

// Image file upload
document.getElementById('upload-image-btn').addEventListener('click', () => {
    document.getElementById('image-file-input').click();
});

document.getElementById('image-file-input').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file || !currentState || !currentState.words) return;
    
    const currentIndex = currentState.current_word_index || 0;
    const formData = new FormData();
    formData.append('file', file);
    
    fetch(`/api/upload/${currentIndex}`, {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            alert('Error: ' + data.error);
        } else {
            loadState();
            e.target.value = '';
        }
    });
});

// Audio URL input
document.getElementById('set-audio-url-btn').addEventListener('click', () => {
    const url = document.getElementById('audio-url-input').value.trim();
    if (!url || !currentState || !currentState.words) return;
    
    const currentIndex = currentState.current_word_index || 0;
    fetch(`/api/audio/${currentIndex}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio_url: url })
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            alert('Error: ' + data.error);
        } else {
            loadState();
            document.getElementById('audio-url-input').value = '';
        }
    });
});

// Audio file upload
document.getElementById('upload-audio-btn').addEventListener('click', () => {
    document.getElementById('audio-file-input').click();
});

document.getElementById('audio-file-input').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file || !currentState || !currentState.words) return;
    
    const currentIndex = currentState.current_word_index || 0;
    const formData = new FormData();
    formData.append('file', file);
    
    fetch(`/api/upload-audio/${currentIndex}`, {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            alert('Error: ' + data.error);
        } else {
            loadState();
            e.target.value = '';
        }
    });
});

// Audio preview
let previewAudio = null;
document.getElementById('preview-audio-btn').addEventListener('click', (e) => {
    const src = e.target.dataset.audioSrc;
    if (!src) return;
    
    if (previewAudio) {
        previewAudio.pause();
    }
    previewAudio = new Audio(src);
    previewAudio.play().catch(() => alert('Could not play audio'));
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Ignore if typing in input fields
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
    }
    
    switch(e.key) {
        case 'ArrowRight':
            e.preventDefault();
            document.getElementById('next-btn').click();
            break;
        case 'ArrowLeft':
            e.preventDefault();
            document.getElementById('prev-btn').click();
            break;
        case 'r':
        case 'R':
            e.preventDefault();
            document.getElementById('reveal-btn').click();
            break;
        case 'a':
        case 'A':
            e.preventDefault();
            document.getElementById('set-team-a-btn').click();
            break;
        case 'b':
        case 'B':
            e.preventDefault();
            document.getElementById('set-team-b-btn').click();
            break;
        case 'c':
        case 'C':
            e.preventDefault();
            document.getElementById('correct-sound-btn').click();
            break;
        case 'x':
        case 'X':
            e.preventDefault();
            document.getElementById('wrong-sound-btn').click();
            break;
    }
});

// Initial load - auto-load CSV if no words
loadState().then(state => {
    if (!state.words || state.words.length === 0) {
        // Auto-load the local CSV
        fetch('/api/words', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ csv_file: 'sample_words.csv' })
        })
        .then(response => response.json())
        .then(data => {
            if (!data.error) {
                loadState();
            }
        });
    }
});

