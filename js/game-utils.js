/**
 * Gameatica - Shared Game Utilities
 * Leaderboards, score management, and common game functions
 * Integrated with Auth system
 */

const GameUtils = {
    // Storage prefix for all games
    prefix: 'gameatica_',
    
    // Get current player name (from Auth or localStorage)
    getPlayerName() {
        // First check if user is logged in via Auth
        if (typeof Auth !== 'undefined' && Auth.isLoggedIn()) {
            const user = Auth.getCurrentUser();
            return user.displayName || user.username;
        }
        // Fall back to localStorage player name
        let name = localStorage.getItem(this.prefix + 'playerName');
        if (!name) {
            name = 'Guest';
            localStorage.setItem(this.prefix + 'playerName', name);
        }
        return name;
    },
    
    // Get current username
    getUsername() {
        if (typeof Auth !== 'undefined' && Auth.isLoggedIn()) {
            return Auth.getCurrentUser().username;
        }
        return null;
    },
    
    // Check if user is logged in
    isLoggedIn() {
        return typeof Auth !== 'undefined' && Auth.isLoggedIn();
    },
    
    // Set player name (for guests)
    setPlayerName(name) {
        localStorage.setItem(this.prefix + 'playerName', name);
    },
    
    // Get high scores for a game (from Storage if available, else localStorage)
    getHighScores(gameId, limit = 10) {
        // Use Storage module if available
        if (typeof Storage !== 'undefined' && Storage.getTopScores) {
            return Storage.getTopScores(gameId, limit);
        }
        // Fall back to localStorage
        const scores = JSON.parse(localStorage.getItem(this.prefix + gameId + '_scores') || '[]');
        return scores.sort((a, b) => b.score - a.score).slice(0, limit);
    },
    
    // Save a high score
    saveHighScore(gameId, score, extraData = {}) {
        const playerName = this.getPlayerName();
        
        // If logged in, use Storage module
        if (this.isLoggedIn() && typeof Storage !== 'undefined') {
            Storage.submitScore(gameId, score, extraData);
        }
        
        // Also save to localStorage for local leaderboard
        const scores = JSON.parse(localStorage.getItem(this.prefix + gameId + '_scores') || '[]');
        const entry = {
            name: playerName,
            displayName: playerName,
            username: this.getUsername() || 'guest',
            score: score,
            date: new Date().toISOString(),
            ...extraData
        };
        scores.push(entry);
        scores.sort((a, b) => b.score - a.score);
        localStorage.setItem(this.prefix + gameId + '_scores', JSON.stringify(scores.slice(0, 100)));
        
        // Also submit to cloud if available
        this.submitToCloud(gameId, entry);
        
        return entry;
    },
    
    // Submit score to CloudDB
    async submitToCloud(gameId, scoreData) {
        if (typeof CloudDB !== 'undefined' && CloudDB.isEnabled()) {
            try {
                await CloudDB.submit('SCORE', {
                    username: scoreData.username || scoreData.name,
                    displayName: scoreData.displayName || scoreData.name,
                    score: scoreData.score,
                    correct: scoreData.correct || 0,
                    wrong: scoreData.wrong || 0,
                    streak: scoreData.streak || 0,
                    mode: gameId,
                    timestamp: scoreData.date
                });
                console.log('☁️ Score synced to cloud');
            } catch (e) {
                console.log('Cloud sync failed:', e);
            }
        }
    },
    
    // Get personal best for a game
    getPersonalBest(gameId) {
        const username = this.getUsername();
        
        // If logged in, check Storage
        if (username && typeof Storage !== 'undefined') {
            return Storage.getUserBestScore(gameId, username);
        }
        
        // Fall back to localStorage
        const name = this.getPlayerName();
        const scores = JSON.parse(localStorage.getItem(this.prefix + gameId + '_scores') || '[]');
        const personal = scores.filter(s => s.name === name || s.username === username);
        return personal.length > 0 ? Math.max(...personal.map(s => s.score)) : 0;
    },
    
    // Format time (seconds to MM:SS)
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    },
    
    // Format large numbers
    formatNumber(num) {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toString();
    },
    
    // Render leaderboard HTML
    renderLeaderboard(gameId, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        const scores = this.getHighScores(gameId, 10);
        const playerName = this.getPlayerName();
        const username = this.getUsername();
        
        if (scores.length === 0) {
            container.innerHTML = `
                <p style="color:#888;text-align:center;padding:20px;">
                    No scores yet. Be the first!
                    ${!this.isLoggedIn() ? '<br><a href="../index.html" style="color:var(--primary);">Login to save scores</a>' : ''}
                </p>
            `;
            return;
        }
        
        const medals = ['🥇', '🥈', '🥉'];
        let html = '<div class="leaderboard-list">';
        
        scores.forEach((score, i) => {
            const isPlayer = score.name === playerName || score.username === username;
            const medal = medals[i] || `#${i + 1}`;
            const displayName = score.displayName || score.name;
            html += `
                <div class="leaderboard-entry ${isPlayer ? 'is-player' : ''}">
                    <span class="rank">${medal}</span>
                    <span class="name">${displayName}</span>
                    <span class="score">${this.formatNumber(score.score)}</span>
                </div>
            `;
        });
        
        html += '</div>';
        
        // Add login prompt if not logged in
        if (!this.isLoggedIn()) {
            html += '<p style="color:#888;font-size:0.8rem;text-align:center;margin-top:10px;"><a href="../index.html" style="color:var(--primary);">Login</a> to save your scores!</p>';
        }
        
        container.innerHTML = html;
    },
    
    // Create game over overlay
    showGameOver(score, gameId, options = {}) {
        const personalBest = this.getPersonalBest(gameId);
        const isNewRecord = score > personalBest;
        
        // Save the score
        this.saveHighScore(gameId, score, options.extraData || {});
        
        // Create overlay
        const overlay = document.createElement('div');
        overlay.className = 'game-over-overlay';
        overlay.innerHTML = `
            <div class="game-over-modal">
                <h2>${isNewRecord ? '🎉 New High Score!' : 'Game Over!'}</h2>
                <div class="final-score">${this.formatNumber(score)}</div>
                ${isNewRecord ? '<p class="new-record">You beat your personal best!</p>' : ''}
                <p class="personal-best">Personal Best: ${this.formatNumber(Math.max(score, personalBest))}</p>
                ${!this.isLoggedIn() ? '<p class="login-prompt" style="color:#888;font-size:0.9rem;"><a href="../index.html" style="color:var(--primary);">Login</a> to save to global leaderboard!</p>' : ''}
                <div class="game-over-buttons">
                    <button onclick="location.reload()" class="btn btn-primary">Play Again</button>
                    <a href="../index.html" class="btn btn-secondary">Back to Arcade</a>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        
        // Add animation
        requestAnimationFrame(() => overlay.classList.add('visible'));
    },
    
    // Touch/swipe detection for mobile games
    enableSwipeControls(element, callbacks) {
        let touchStartX = 0;
        let touchStartY = 0;
        const minSwipe = 30;
        
        element.addEventListener('touchstart', (e) => {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
        }, { passive: true });
        
        element.addEventListener('touchend', (e) => {
            const touchEndX = e.changedTouches[0].clientX;
            const touchEndY = e.changedTouches[0].clientY;
            const diffX = touchEndX - touchStartX;
            const diffY = touchEndY - touchStartY;
            
            if (Math.abs(diffX) > Math.abs(diffY)) {
                if (diffX > minSwipe && callbacks.right) callbacks.right();
                else if (diffX < -minSwipe && callbacks.left) callbacks.left();
            } else {
                if (diffY > minSwipe && callbacks.down) callbacks.down();
                else if (diffY < -minSwipe && callbacks.up) callbacks.up();
            }
        }, { passive: true });
    },
    
    // Vibrate (mobile feedback)
    vibrate(pattern = 50) {
        if (navigator.vibrate) {
            navigator.vibrate(pattern);
        }
    },
    
    // Play sound effect (if sounds enabled)
    playSound(type) {
        if (localStorage.getItem(this.prefix + 'soundEnabled') === 'false') return;
        
        // Create audio context on demand
        if (!this.audioCtx) {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        
        const ctx = this.audioCtx;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        switch(type) {
            case 'point':
                osc.frequency.value = 600;
                gain.gain.value = 0.1;
                osc.start();
                osc.stop(ctx.currentTime + 0.1);
                break;
            case 'levelup':
                osc.frequency.value = 400;
                gain.gain.value = 0.1;
                osc.start();
                osc.frequency.linearRampToValueAtTime(800, ctx.currentTime + 0.2);
                osc.stop(ctx.currentTime + 0.2);
                break;
            case 'gameover':
                osc.frequency.value = 200;
                gain.gain.value = 0.1;
                osc.start();
                osc.frequency.linearRampToValueAtTime(100, ctx.currentTime + 0.3);
                osc.stop(ctx.currentTime + 0.3);
                break;
        }
    }
};

// Auto-init
document.addEventListener('DOMContentLoaded', () => {
    // Initialize CloudDB if present
    if (typeof CloudDB !== 'undefined') {
        CloudDB.init({ siteName: 'Gameatica' });
    }
});
