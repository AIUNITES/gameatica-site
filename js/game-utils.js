/**
 * Gameatica - Shared Game Utilities
 * Leaderboards, score management, and common game functions
 * Integrated with Auth system and SQL Database
 */

const GameUtils = {
    // Storage prefix for all games
    prefix: 'gameatica_',
    
    // Get current player name (from Auth or localStorage)
    getPlayerName() {
        if (typeof Auth !== 'undefined' && Auth.isLoggedIn()) {
            const user = Auth.getCurrentUser();
            return user.displayName || user.username;
        }
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
    
    // ==================== SCORE MANAGEMENT ====================
    
    /**
     * Get high scores for a game
     * Priority: SQL Database > localStorage fallback
     */
    getHighScores(gameId, limit = 10) {
        // Try SQL Database first
        if (typeof SQLDatabase !== 'undefined' && SQLDatabase.isLoaded) {
            const sqlScores = SQLDatabase.getTopScores(gameId, limit);
            if (sqlScores.length > 0) {
                return sqlScores;
            }
        }
        
        // Fall back to localStorage
        const scores = JSON.parse(localStorage.getItem(this.prefix + gameId + '_scores') || '[]');
        return scores.sort((a, b) => b.score - a.score).slice(0, limit);
    },
    
    /**
     * Save a high score
     * Saves to both SQL Database (if available) and localStorage
     */
    saveHighScore(gameId, score, extraData = {}) {
        const playerName = this.getPlayerName();
        const username = this.getUsername() || 'guest_' + Date.now();
        
        const entry = {
            name: playerName,
            displayName: playerName,
            username: username,
            score: score,
            date: new Date().toISOString(),
            level: extraData.level || 1,
            duration: extraData.duration || null,
            ...extraData
        };
        
        // Save to SQL Database (if logged in and DB available)
        if (this.isLoggedIn() && typeof SQLDatabase !== 'undefined' && SQLDatabase.isLoaded) {
            SQLDatabase.submitScore(gameId, username, playerName, score, extraData);
            console.log('💾 Score saved to SQL Database');
        }
        
        // Always save to localStorage as backup
        this.saveToLocalStorage(gameId, entry);
        
        // Also submit to CloudDB if available
        this.submitToCloud(gameId, entry);
        
        // Update total play count
        this.incrementTotalPlays();
        
        return entry;
    },
    
    /**
     * Save score to localStorage
     */
    saveToLocalStorage(gameId, entry) {
        const scores = JSON.parse(localStorage.getItem(this.prefix + gameId + '_scores') || '[]');
        scores.push(entry);
        scores.sort((a, b) => b.score - a.score);
        localStorage.setItem(this.prefix + gameId + '_scores', JSON.stringify(scores.slice(0, 100)));
    },
    
    /**
     * Submit score to CloudDB (Google Forms/Sheets)
     */
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
    
    /**
     * Get personal best for a game
     */
    getPersonalBest(gameId) {
        const username = this.getUsername();
        
        // Try SQL Database first
        if (username && typeof SQLDatabase !== 'undefined' && SQLDatabase.isLoaded) {
            const sqlBest = SQLDatabase.getPersonalBest(gameId, username);
            if (sqlBest > 0) return sqlBest;
        }
        
        // Fall back to localStorage
        const name = this.getPlayerName();
        const scores = JSON.parse(localStorage.getItem(this.prefix + gameId + '_scores') || '[]');
        const personal = scores.filter(s => s.name === name || s.username === username);
        return personal.length > 0 ? Math.max(...personal.map(s => s.score)) : 0;
    },
    
    /**
     * Get user's total stats
     */
    getUserStats() {
        const username = this.getUsername();
        
        // Try SQL Database
        if (username && typeof SQLDatabase !== 'undefined' && SQLDatabase.isLoaded) {
            return SQLDatabase.getUserStats(username);
        }
        
        // Fall back to localStorage calculation
        return this.getLocalStorageStats();
    },
    
    /**
     * Calculate stats from localStorage
     */
    getLocalStorageStats() {
        let totalPlays = 0;
        let totalScore = 0;
        const gamesPlayed = {};
        const playerName = this.getPlayerName();
        
        // Scan all game scores in localStorage
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(this.prefix) && key.endsWith('_scores')) {
                const gameId = key.replace(this.prefix, '').replace('_scores', '');
                const scores = JSON.parse(localStorage.getItem(key) || '[]');
                const myScores = scores.filter(s => s.name === playerName);
                
                if (myScores.length > 0) {
                    totalPlays += myScores.length;
                    totalScore += myScores.reduce((sum, s) => sum + s.score, 0);
                    gamesPlayed[gameId] = {
                        plays: myScores.length,
                        bestScore: Math.max(...myScores.map(s => s.score))
                    };
                }
            }
        }
        
        return { totalPlays, totalScore, gamesPlayed };
    },
    
    /**
     * Increment total play count (global counter)
     */
    incrementTotalPlays() {
        let total = parseInt(localStorage.getItem(this.prefix + 'totalPlays') || '0');
        total++;
        localStorage.setItem(this.prefix + 'totalPlays', total.toString());
        
        // Update display if on main page
        const el = document.getElementById('totalPlays');
        if (el) el.textContent = total;
    },
    
    // ==================== FORMATTING UTILITIES ====================
    
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    },
    
    formatNumber(num) {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toLocaleString();
    },
    
    // ==================== LEADERBOARD RENDERING ====================
    
    /**
     * Render leaderboard HTML
     */
    renderLeaderboard(gameId, containerId, options = {}) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        const limit = options.limit || 10;
        const scores = this.getHighScores(gameId, limit);
        const playerName = this.getPlayerName();
        const username = this.getUsername();
        
        if (scores.length === 0) {
            container.innerHTML = `
                <div class="leaderboard-empty">
                    <p>🏆 No scores yet. Be the first!</p>
                    ${!this.isLoggedIn() ? '<p class="login-hint"><a href="../index.html">Login</a> to save scores globally</p>' : ''}
                </div>
            `;
            return;
        }
        
        const medals = ['🥇', '🥈', '🥉'];
        let html = '<div class="leaderboard-list">';
        
        scores.forEach((score, i) => {
            const isPlayer = score.name === playerName || score.username === username || score.displayName === playerName;
            const medal = medals[i] || `<span class="rank-num">#${i + 1}</span>`;
            const displayName = score.displayName || score.name || score.username;
            
            html += `
                <div class="leaderboard-entry ${isPlayer ? 'is-player' : ''}">
                    <span class="rank">${medal}</span>
                    <span class="name">${this.escapeHtml(displayName)}</span>
                    <span class="score">${this.formatNumber(score.score)}</span>
                </div>
            `;
        });
        
        html += '</div>';
        
        // Personal best and login prompt
        const personalBest = this.getPersonalBest(gameId);
        if (personalBest > 0) {
            html += `<div class="personal-best-badge">Your Best: ${this.formatNumber(personalBest)}</div>`;
        }
        
        if (!this.isLoggedIn()) {
            html += '<p class="login-hint"><a href="../index.html">Login</a> to save scores globally!</p>';
        }
        
        container.innerHTML = html;
    },
    
    /**
     * Render compact leaderboard (for sidebar/modal)
     */
    renderCompactLeaderboard(gameId, containerId, limit = 5) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        const scores = this.getHighScores(gameId, limit);
        
        if (scores.length === 0) {
            container.innerHTML = '<p class="no-scores">No scores yet</p>';
            return;
        }
        
        let html = '';
        scores.forEach((score, i) => {
            const medal = ['🥇', '🥈', '🥉'][i] || `#${i + 1}`;
            html += `
                <div class="mini-score">
                    <span>${medal} ${this.escapeHtml(score.displayName || score.name)}</span>
                    <span>${this.formatNumber(score.score)}</span>
                </div>
            `;
        });
        
        container.innerHTML = html;
    },
    
    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },
    
    // ==================== GAME OVER MODAL ====================
    
    /**
     * Show game over overlay with score
     */
    showGameOver(score, gameId, options = {}) {
        const personalBest = this.getPersonalBest(gameId);
        const isNewRecord = score > personalBest;
        
        // Save the score
        this.saveHighScore(gameId, score, options.extraData || {});
        
        // Get rank
        const scores = this.getHighScores(gameId, 100);
        const rank = scores.findIndex(s => s.score <= score) + 1 || scores.length + 1;
        
        // Create overlay
        const overlay = document.createElement('div');
        overlay.className = 'game-over-overlay';
        overlay.innerHTML = `
            <div class="game-over-modal">
                <h2>${isNewRecord ? '🎉 New High Score!' : '🎮 Game Over!'}</h2>
                <div class="final-score">${this.formatNumber(score)}</div>
                ${isNewRecord ? '<p class="new-record-text">You beat your personal best!</p>' : ''}
                <div class="score-details">
                    <div class="detail"><span>Personal Best</span><span>${this.formatNumber(Math.max(score, personalBest))}</span></div>
                    <div class="detail"><span>Leaderboard Rank</span><span>#${rank}</span></div>
                    ${options.extraData?.level ? `<div class="detail"><span>Level</span><span>${options.extraData.level}</span></div>` : ''}
                    ${options.extraData?.duration ? `<div class="detail"><span>Time</span><span>${this.formatTime(options.extraData.duration)}</span></div>` : ''}
                </div>
                ${!this.isLoggedIn() ? '<p class="login-prompt"><a href="../index.html">Login</a> to save to global leaderboard!</p>' : ''}
                <div class="game-over-buttons">
                    <button onclick="location.reload()" class="btn btn-primary">🔄 Play Again</button>
                    <a href="../index.html" class="btn btn-secondary">🏠 Back to Arcade</a>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        
        // Play sound
        this.playSound('gameover');
        
        // Add animation
        requestAnimationFrame(() => overlay.classList.add('visible'));
    },
    
    // ==================== MOBILE & INPUT ====================
    
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
    
    vibrate(pattern = 50) {
        if (navigator.vibrate) {
            navigator.vibrate(pattern);
        }
    },
    
    // ==================== SOUND EFFECTS ====================
    
    playSound(type) {
        if (localStorage.getItem(this.prefix + 'soundEnabled') === 'false') return;
        
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
            case 'correct':
                osc.frequency.value = 523;
                gain.gain.value = 0.08;
                osc.start();
                osc.frequency.setValueAtTime(659, ctx.currentTime + 0.1);
                osc.stop(ctx.currentTime + 0.15);
                break;
            case 'wrong':
                osc.frequency.value = 200;
                gain.gain.value = 0.08;
                osc.start();
                osc.stop(ctx.currentTime + 0.2);
                break;
        }
    }
};

// Auto-init CloudDB
document.addEventListener('DOMContentLoaded', () => {
    if (typeof CloudDB !== 'undefined') {
        CloudDB.init({ siteName: 'Gameatica' });
    }
});
