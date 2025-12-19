from flask import Flask, render_template, request, jsonify, send_from_directory
import csv
import json
import os
import re
import urllib.request
from datetime import datetime
from werkzeug.utils import secure_filename

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'static/uploads'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size
app.config['ALLOWED_IMAGE_EXTENSIONS'] = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
app.config['ALLOWED_AUDIO_EXTENSIONS'] = {'mp3', 'wav', 'ogg', 'm4a'}

# Ensure uploads directory exists
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs('static/sounds', exist_ok=True)

STATE_FILE = 'state.json'
SAMPLE_CSV = 'sample_words.csv'

def allowed_image(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in app.config['ALLOWED_IMAGE_EXTENSIONS']

def allowed_audio(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in app.config['ALLOWED_AUDIO_EXTENSIONS']

def load_state():
    """Load game state from JSON file"""
    if os.path.exists(STATE_FILE):
        try:
            with open(STATE_FILE, 'r') as f:
                return json.load(f)
        except:
            pass
    return {
        'current_word_index': 0,
        'words': [],
        'team_a_score': 0,
        'team_b_score': 0,
        'current_team': 'A',
        'current_round': None,
        'steals_used_a': 0,
        'steals_used_b': 0,
        'word_revealed': False,  # Words hidden by default on display
        'bad_pp_mode': False,
        'word_images': {},
        'word_audio': {},
        'csv_url': None
    }

def save_state(state):
    """Save game state to JSON file"""
    with open(STATE_FILE, 'w') as f:
        json.dump(state, f, indent=2)

def parse_points_from_header(text):
    """Extract point value from round header like 'Round 2 (5 pt)' or 'F*** You (15 pt)'"""
    if not text:
        return 1
    match = re.search(r'\((\d+)\s*pt\)', text, re.IGNORECASE)
    if match:
        return int(match.group(1))
    return 1

def parse_csv_from_url(url):
    """Download and parse CSV from Google Sheets published URL"""
    try:
        response = urllib.request.urlopen(url)
        data = response.read().decode('utf-8')
        return parse_csv_data(data)
    except Exception as e:
        raise Exception(f"Failed to load CSV from URL: {str(e)}")

def parse_csv_file(filepath):
    """Parse CSV file from local path"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return parse_csv_data(f.read())
    except Exception as e:
        raise Exception(f"Failed to load CSV file: {str(e)}")

def parse_csv_data(csv_content):
    """Parse CSV content into structured word data"""
    reader = csv.DictReader(csv_content.splitlines())
    words = []
    current_round = None
    current_points = 1
    
    # Try to detect column names (case-insensitive)
    fieldnames = None
    for row in csv.DictReader(csv_content.splitlines()):
        if fieldnames is None:
            fieldnames = row.keys()
        break
    
    # Reset reader
    reader = csv.DictReader(csv_content.splitlines())
    
    # Find word and context columns (case-insensitive)
    word_col = None
    context_col = None
    for col in fieldnames:
        col_lower = col.lower()
        if 'word' in col_lower and word_col is None:
            word_col = col
        if 'context' in col_lower or 'sentence' in col_lower:
            context_col = col
    
    if not word_col:
        # Fallback: use first column
        word_col = list(fieldnames)[0] if fieldnames else 'Word'
    if not context_col:
        # Fallback: use second column if exists
        context_col = list(fieldnames)[1] if len(fieldnames) > 1 else 'Context'
    
    for row in reader:
        word_text = row.get(word_col, '').strip()
        context_text = row.get(context_col, '').strip()
        
        # Skip empty rows
        if not word_text:
            continue
        
        # Skip header rows (exact matches)
        if word_text.lower() in ['word', 'context', 'sentence', 'context/sentence']:
            continue
        
        # Check if this is a round header
        word_lower = word_text.lower()
        # Check for round headers: "Round X", "F*** You", "Fuck You", etc.
        is_round_header = (
            'round' in word_lower or 
            'f***' in word_lower or 
            'fuck' in word_lower or
            (word_lower.startswith('f') and 'you' in word_lower and '(' in word_text)
        )
        if is_round_header:
            current_points = parse_points_from_header(word_text)
            # Extract round name
            round_match = re.match(r'^([^(]+)', word_text)
            if round_match:
                current_round = round_match.group(1).strip()
            else:
                current_round = word_text
            continue
        
        # This is a word row
        # Handle pipe-separated format: "Word | Context"
        if '|' in word_text:
            parts = word_text.split('|', 1)
            word_text = parts[0].strip()
            if not context_text:
                context_text = parts[1].strip()
        
        # Parse context into definition and sentence
        # Format: "Definition. "Sentence in quotes.""
        definition = ''
        sentence = ''
        if context_text:
            # Look for quoted sentence (text inside double quotes)
            quote_match = re.search(r'"([^"]+)"', context_text)
            if quote_match:
                sentence = quote_match.group(1).strip()
                # Definition is everything before the quote
                definition = context_text[:quote_match.start()].strip()
                # Remove trailing period from definition if present
                if definition.endswith('.'):
                    definition = definition[:-1].strip()
            else:
                # No quote found, treat entire context as definition
                definition = context_text
        
        words.append({
            'word': word_text,
            'context': context_text,  # Keep original for backward compatibility
            'definition': definition,
            'sentence': sentence,
            'round': current_round or 'Round 1',
            'points': current_points
        })
    
    return words

@app.route('/')
def index():
    """Redirect to control view"""
    return render_template('control.html')

@app.route('/display')
def display():
    """Display view for TV"""
    return render_template('display.html')

@app.route('/control')
def control():
    """Control view for laptop"""
    return render_template('control.html')

@app.route('/api/state', methods=['GET'])
def get_state():
    """Get current game state"""
    state = load_state()
    return jsonify(state)

@app.route('/api/state', methods=['POST'])
def update_state():
    """Update game state"""
    state = load_state()
    data = request.json
    
    # Update allowed fields
    allowed_fields = [
        'current_word_index', 'team_a_score', 'team_b_score', 'current_team',
        'steals_used_a', 'steals_used_b', 'word_revealed', 'bad_pp_mode'
    ]
    for field in allowed_fields:
        if field in data:
            state[field] = data[field]
    
    # Update current_round if word index changed
    if 'current_word_index' in data:
        word_index = data['current_word_index']
        words = state.get('words', [])
        if 0 <= word_index < len(words):
            state['current_round'] = words[word_index]['round']
    
    save_state(state)
    return jsonify(state)

@app.route('/api/words', methods=['POST'])
def load_words():
    """Load words from CSV URL or file"""
    state = load_state()
    data = request.json
    
    csv_url = data.get('csv_url')
    csv_file = data.get('csv_file')
    
    try:
        if csv_url:
            words = parse_csv_from_url(csv_url)
            state['csv_url'] = csv_url
        elif csv_file:
            words = parse_csv_file(csv_file)
        else:
            # Try sample CSV
            if os.path.exists(SAMPLE_CSV):
                words = parse_csv_file(SAMPLE_CSV)
            else:
                return jsonify({'error': 'No CSV source provided'}), 400
        
        state['words'] = words
        state['current_word_index'] = 0
        state['current_round'] = words[0]['round'] if words else None
        state['steals_used_a'] = 0
        state['steals_used_b'] = 0
        
        save_state(state)
        return jsonify({'success': True, 'word_count': len(words)})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/word/<int:index>', methods=['POST'])
def update_word_image(index):
    """Update image for a word"""
    state = load_state()
    
    if index < 0 or index >= len(state['words']):
        return jsonify({'error': 'Invalid word index'}), 400
    
    data = request.json
    image_url = data.get('image_url')
    
    if image_url:
        state['word_images'][str(index)] = {'type': 'url', 'value': image_url}
        save_state(state)
        return jsonify({'success': True})
    
    return jsonify({'error': 'No image URL provided'}), 400

@app.route('/api/upload/<int:index>', methods=['POST'])
def upload_image(index):
    """Upload image file for a word"""
    state = load_state()
    
    if index < 0 or index >= len(state['words']):
        return jsonify({'error': 'Invalid word index'}), 400
    
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    if file and allowed_image(file.filename):
        filename = secure_filename(f"word_{index}_{datetime.now().timestamp()}.{file.filename.rsplit('.', 1)[1].lower()}")
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        
        state['word_images'][str(index)] = {'type': 'file', 'value': f'static/uploads/{filename}'}
        save_state(state)
        return jsonify({'success': True, 'image_path': f'static/uploads/{filename}'})
    
    return jsonify({'error': 'Invalid file type'}), 400

@app.route('/api/audio/<int:index>', methods=['POST'])
def set_word_audio(index):
    """Set audio URL for a word"""
    state = load_state()
    
    if index < 0 or index >= len(state['words']):
        return jsonify({'error': 'Invalid word index'}), 400
    
    data = request.json
    audio_url = data.get('audio_url')
    
    if audio_url:
        if 'word_audio' not in state:
            state['word_audio'] = {}
        state['word_audio'][str(index)] = {'type': 'url', 'value': audio_url}
        save_state(state)
        return jsonify({'success': True})
    
    return jsonify({'error': 'No audio URL provided'}), 400

@app.route('/api/upload-audio/<int:index>', methods=['POST'])
def upload_audio(index):
    """Upload audio file for a word"""
    state = load_state()
    
    if index < 0 or index >= len(state['words']):
        return jsonify({'error': 'Invalid word index'}), 400
    
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    if file and allowed_audio(file.filename):
        filename = secure_filename(f"audio_{index}_{datetime.now().timestamp()}.{file.filename.rsplit('.', 1)[1].lower()}")
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        
        if 'word_audio' not in state:
            state['word_audio'] = {}
        state['word_audio'][str(index)] = {'type': 'file', 'value': f'static/uploads/{filename}'}
        save_state(state)
        return jsonify({'success': True, 'audio_path': f'static/uploads/{filename}'})
    
    return jsonify({'error': 'Invalid file type. Use mp3, wav, ogg, or m4a'}), 400

@app.route('/api/reset', methods=['POST'])
def reset_game():
    """Reset game state"""
    state = load_state()
    words = state.get('words', [])
    csv_url = state.get('csv_url')
    
    new_state = {
        'current_word_index': 0,
        'words': words,
        'team_a_score': 0,
        'team_b_score': 0,
        'current_team': 'A',
        'current_round': words[0]['round'] if words else None,
        'steals_used_a': 0,
        'steals_used_b': 0,
        'word_revealed': False,  # Words hidden by default on display
        'bad_pp_mode': False,
        'word_images': state.get('word_images', {}),
        'word_audio': state.get('word_audio', {}),
        'csv_url': csv_url
    }
    
    save_state(new_state)
    return jsonify({'success': True})

@app.route('/api/mark-result', methods=['POST'])
def mark_result():
    """Mark word as correct or incorrect"""
    state = load_state()
    data = request.json
    
    result = data.get('result')  # 'correct' or 'incorrect'
    word_index = state['current_word_index']
    
    if word_index < 0 or word_index >= len(state['words']):
        return jsonify({'error': 'Invalid word index'}), 400
    
    word = state['words'][word_index]
    points = word['points']
    current_team = state['current_team']
    
    if result == 'correct':
        if current_team == 'A':
            state['team_a_score'] += points
        else:
            state['team_b_score'] += points
        # Switch teams
        state['current_team'] = 'B' if current_team == 'A' else 'A'
    elif result == 'incorrect':
        # Don't switch teams yet - wait for steal attempt
        pass
    
    save_state(state)
    return jsonify(state)

@app.route('/api/steal', methods=['POST'])
def handle_steal():
    """Handle steal attempt"""
    state = load_state()
    data = request.json
    
    success = data.get('success')  # True or False
    stealing_team = data.get('team')  # 'A' or 'B'
    
    word_index = state['current_word_index']
    if word_index < 0 or word_index >= len(state['words']):
        return jsonify({'error': 'Invalid word index'}), 400
    
    word = state['words'][word_index]
    points = word['points']
    current_round = word['round']
    
    # Check steal limit (2 per round)
    steals_key = f'steals_used_{stealing_team.lower()}'
    if state[steals_key] >= 2:
        return jsonify({'error': 'Steal limit reached for this round'}), 400
    
    if success:
        state[f'team_{stealing_team.lower()}_score'] += points
        state[steals_key] += 1
    
    # Switch to next team after steal attempt
    state['current_team'] = 'B' if stealing_team == 'A' else 'A'
    
    save_state(state)
    return jsonify(state)

@app.route('/api/start-round', methods=['POST'])
def start_round():
    """Reset steal counts for new round"""
    state = load_state()
    state['steals_used_a'] = 0
    state['steals_used_b'] = 0
    save_state(state)
    return jsonify(state)

@app.route('/static/uploads/<filename>')
def uploaded_file(filename):
    """Serve uploaded files"""
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

def auto_load_csv():
    """Auto-load the local CSV file if words are not loaded"""
    state = load_state()
    if not state.get('words') and os.path.exists(SAMPLE_CSV):
        try:
            words = parse_csv_file(SAMPLE_CSV)
            state['words'] = words
            state['current_round'] = words[0]['round'] if words else None
            save_state(state)
            print(f"Auto-loaded {len(words)} words from {SAMPLE_CSV}")
        except Exception as e:
            print(f"Failed to auto-load CSV: {e}")

if __name__ == '__main__':
    # Always try to load CSV if no words are loaded
    auto_load_csv()
    
    app.run(debug=True, host='0.0.0.0', port=5001)

