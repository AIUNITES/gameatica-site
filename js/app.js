/**
 * Gameatica Main App
 * UI logic, authentication, and app state management
 */

function togglePassword(inputId, btn) {
  const input = document.getElementById(inputId);
  if (input.type === 'password') {
    input.type = 'text';
    btn.textContent = '🙈';
  } else {
    input.type = 'password';
    btn.textContent = '👁️';
  }
}

// Game emoji lookup
const GAME_EMOJIS = {
  snake: '🐍', tetris: '🧱', breakout: '🧱', flappy: '🐦', pong: '🏓', asteroids: '☄️',
  '2048': '🔢', memory: '🧠', minesweeper: '💣', sudoku: '9️⃣', sliding: '🧩', match3: '💎',
  typing: '⌨️', reaction: '⚡', simon: '🎨', trivia: '❓', wordguess: '📝', blackjack: '🃏',
  startrader: '🚀', algebra: '🔤', calculus: '∫', trig: '📐', mathspeed: '⚡',
  geometry: '📏', fractions: '🥧', statistics: '📊', prealgebra: '🔢', numbertheory: '🔍',
  matrices: '🔲', wordproblems: '📝', mathfacts: '✖️', grammar: '📖', spelling: '🐝',
  punctuation: '✏️', literature: '📚'
};

const App = {
  /**
   * Initialize the app
   */
  init() {
    this.bindEvents();
    this.checkAuth();
    this.updatePlayCount();
    this.loadGlobalLeaderboards();
  },

  /**
   * Check authentication status and update UI
   */
  checkAuth() {
    if (Auth.isLoggedIn()) {
      this.showLoggedInUI();
    } else {
      this.showGuestUI();
    }
  },

  /**
   * Show logged-in user interface
   */
  showLoggedInUI() {
    const user = Auth.getCurrentUser();
    
    // Update player section
    document.getElementById('playerName').textContent = user.displayName;
    document.getElementById('playerAvatar').textContent = user.displayName.charAt(0).toUpperCase();
    
    // Show user menu, hide login buttons
    document.getElementById('guest-buttons').style.display = 'none';
    document.getElementById('user-menu').style.display = 'flex';
    document.getElementById('user-display-name').textContent = user.displayName;
    document.getElementById('user-avatar').textContent = user.displayName.charAt(0).toUpperCase();
    
    // Show admin link if admin
    const adminLink = document.getElementById('admin-link');
    if (adminLink) {
      adminLink.style.display = user.isAdmin ? 'block' : 'none';
    }
    
    // Update stats - try SQL first, then localStorage
    let stats;
    if (typeof SQLDatabase !== 'undefined' && SQLDatabase.isLoaded) {
      stats = SQLDatabase.getUserStats(user.username);
    } else {
      stats = Storage.getUserStats(user.username);
    }
    document.getElementById('playerStats').textContent = `${stats.totalPlays} games played • ${stats.totalScore.toLocaleString()} total points`;
  },

  /**
   * Show guest user interface
   */
  showGuestUI() {
    document.getElementById('playerName').textContent = 'Guest';
    document.getElementById('playerAvatar').textContent = '👤';
    document.getElementById('playerStats').textContent = 'Login to save your scores!';
    
    document.getElementById('guest-buttons').style.display = 'flex';
    document.getElementById('user-menu').style.display = 'none';
  },

  /**
   * Bind all event listeners
   */
  bindEvents() {
    // Auth buttons
    document.getElementById('login-btn')?.addEventListener('click', () => this.openAuthModal('login'));
    document.getElementById('signup-btn')?.addEventListener('click', () => this.openAuthModal('signup'));
    document.getElementById('nav-login-btn')?.addEventListener('click', () => this.openAuthModal('login'));

    // Auth tabs
    document.querySelectorAll('.auth-tab').forEach(tab => {
      tab.addEventListener('click', (e) => this.switchAuthTab(e.target.dataset.tab));
    });

    // Auth forms
    document.getElementById('login-form')?.addEventListener('submit', (e) => this.handleLogin(e));
    document.getElementById('signup-form')?.addEventListener('submit', (e) => this.handleSignup(e));
    document.getElementById('demo-login-btn')?.addEventListener('click', () => this.loginAsDemo());

    // User menu
    document.querySelector('.user-menu')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleUserMenu();
    });
    document.getElementById('logout-link')?.addEventListener('click', (e) => this.handleLogout(e));
    document.getElementById('settings-link')?.addEventListener('click', (e) => this.openSettings(e));
    document.getElementById('admin-link')?.addEventListener('click', (e) => this.openAdminPanel(e));
    document.getElementById('profile-link')?.addEventListener('click', (e) => this.openProfile(e));

    // Modal closes
    document.getElementById('close-auth-modal')?.addEventListener('click', () => this.closeAuthModal());
    document.getElementById('close-settings-modal')?.addEventListener('click', () => this.closeSettingsModal());
    document.getElementById('close-admin-modal')?.addEventListener('click', () => this.closeAdminModal());
    document.getElementById('close-profile-modal')?.addEventListener('click', () => this.closeProfileModal());

    // Settings form
    document.getElementById('user-settings-form')?.addEventListener('submit', (e) => this.handleSettingsSubmit(e));
    document.getElementById('cancel-settings')?.addEventListener('click', () => this.closeSettingsModal());
    document.getElementById('backup-data-btn')?.addEventListener('click', () => this.backupData());

    // Admin tabs
    document.querySelectorAll('.admin-tab').forEach(tab => {
      tab.addEventListener('click', (e) => this.switchAdminTab(e.target.dataset.adminTab));
    });
    document.getElementById('export-all-data-btn')?.addEventListener('click', () => this.exportAllData());
    document.getElementById('reset-all-data-btn')?.addEventListener('click', () => this.resetAllData());

    // Close dropdowns on outside click
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.user-menu')) {
        document.getElementById('user-dropdown')?.classList.remove('active');
      }
    });

    // Close modals on escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeAuthModal();
        this.closeSettingsModal();
        this.closeAdminModal();
        this.closeProfileModal();
      }
    });

    // Modal backdrop clicks
    ['auth-modal', 'settings-modal', 'admin-modal', 'profile-modal'].forEach(id => {
      document.getElementById(id)?.addEventListener('click', (e) => {
        if (e.target.id === id) {
          if (id === 'auth-modal') this.closeAuthModal();
          if (id === 'settings-modal') this.closeSettingsModal();
          if (id === 'admin-modal') this.closeAdminModal();
          if (id === 'profile-modal') this.closeProfileModal();
        }
      });
    });
  },

  // ==================== LEADERBOARDS ====================

  /**
   * Load and display global leaderboards on main page
   */
  loadGlobalLeaderboards() {
    const container = document.getElementById('leaderboards-grid');
    if (!container) return;
    
    // Popular games to show leaderboards for
    const popularGames = ['snake', 'tetris', '2048', 'typing', 'trivia', 'mathspeed'];
    
    // Wait for SQLDatabase to initialize
    setTimeout(() => {
      let hasScores = false;
      let html = '';
      
      popularGames.forEach(gameId => {
        let scores = [];
        
        // Try SQL Database first
        if (typeof SQLDatabase !== 'undefined' && SQLDatabase.isLoaded) {
          scores = SQLDatabase.getTopScores(gameId, 5);
        }
        
        // Fall back to localStorage
        if (scores.length === 0 && typeof GameUtils !== 'undefined') {
          scores = GameUtils.getHighScores(gameId, 5);
        }
        
        if (scores.length > 0) {
          hasScores = true;
          const emoji = GAME_EMOJIS[gameId] || '🎮';
          const gameName = this.formatGameName(gameId);
          
          html += `
            <div class="leaderboard-card">
              <h3><span class="game-emoji">${emoji}</span> ${gameName}</h3>
              <div class="leaderboard-list">
                ${scores.map((s, i) => this.renderLeaderboardEntry(s, i)).join('')}
              </div>
            </div>
          `;
        }
      });
      
      if (!hasScores) {
        html = `
          <div class="no-leaderboards">
            <p>🏆 No scores yet! Be the first to set a record.</p>
            <p style="margin-top:10px;font-size:0.9rem;">Play any game to appear on the leaderboard.</p>
          </div>
        `;
      }
      
      container.innerHTML = html;
    }, 500); // Wait for DB to load
  },
  
  /**
   * Render a single leaderboard entry
   */
  renderLeaderboardEntry(score, index) {
    const medals = ['🥇', '🥈', '🥉'];
    const medal = medals[index] || `<span class="rank-num">#${index + 1}</span>`;
    const displayName = score.displayName || score.name || score.username || 'Player';
    const isPlayer = this.isCurrentPlayer(score);
    
    return `
      <div class="leaderboard-entry ${isPlayer ? 'is-player' : ''}">
        <span class="rank">${medal}</span>
        <span class="name">${this.escapeHtml(displayName)}</span>
        <span class="score">${this.formatNumber(score.score)}</span>
      </div>
    `;
  },
  
  /**
   * Check if score belongs to current user
   */
  isCurrentPlayer(score) {
    if (!Auth.isLoggedIn()) return false;
    const user = Auth.getCurrentUser();
    return score.username === user.username || score.name === user.displayName;
  },
  
  /**
   * Format game ID to display name
   */
  formatGameName(gameId) {
    const names = {
      snake: 'Snake', tetris: 'Tetris', '2048': '2048', typing: 'Typing Test',
      trivia: 'Trivia Quiz', mathspeed: 'Math Speed', memory: 'Memory Match',
      minesweeper: 'Minesweeper', sudoku: 'Sudoku', breakout: 'Breakout',
      flappy: 'Flappy', pong: 'Pong', asteroids: 'Asteroids', simon: 'Simon Says',
      reaction: 'Reaction Test', wordguess: 'Word Guess', blackjack: 'Blackjack',
      match3: 'Match 3', sliding: 'Sliding Puzzle', startrader: 'Star Trader',
      algebra: 'Algebra Quest', calculus: 'Calculus', trig: 'Trig Master',
      geometry: 'Geometry Pro', fractions: 'Fractions', statistics: 'Statistics',
      prealgebra: 'Pre-Algebra', numbertheory: 'Number Theory', matrices: 'Matrix Math',
      wordproblems: 'Word Problems', mathfacts: 'Math Facts', grammar: 'Grammar Galaxy',
      spelling: 'Spelling Bee', punctuation: 'Punctuation Pro', literature: 'Literary Legends'
    };
    return names[gameId] || gameId.charAt(0).toUpperCase() + gameId.slice(1);
  },
  
  /**
   * Format large numbers
   */
  formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toLocaleString();
  },

  // ==================== AUTH ====================

  openAuthModal(tab = 'login') {
    document.getElementById('auth-modal').classList.add('active');
    this.switchAuthTab(tab);
  },

  closeAuthModal() {
    document.getElementById('auth-modal')?.classList.remove('active');
    document.getElementById('login-error').textContent = '';
    document.getElementById('signup-error').textContent = '';
  },

  switchAuthTab(tab) {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`.auth-tab[data-tab="${tab}"]`)?.classList.add('active');
    
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
    document.getElementById(`${tab}-form`)?.classList.add('active');
  },

  handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;

    try {
      Auth.login(username, password);
      this.closeAuthModal();
      this.showToast('Welcome back!', 'success');
      this.checkAuth();
      this.loadGlobalLeaderboards(); // Refresh to highlight user
    } catch (error) {
      document.getElementById('login-error').textContent = error.message;
    }
  },

  handleSignup(e) {
    e.preventDefault();
    const displayName = document.getElementById('signup-name').value.trim();
    const username = document.getElementById('signup-username').value.trim();
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value;
    const confirm = document.getElementById('signup-confirm').value;

    if (password !== confirm) {
      document.getElementById('signup-error').textContent = 'Passwords do not match';
      return;
    }

    try {
      Auth.signup(displayName, username, email, password);
      this.closeAuthModal();
      this.showToast('Welcome to Gameatica!', 'success');
      this.checkAuth();
    } catch (error) {
      document.getElementById('signup-error').textContent = error.message;
    }
  },

  loginAsDemo() {
    try {
      Auth.loginDemo();
      this.closeAuthModal();
      this.showToast('Welcome! Playing as Demo User.', 'success');
      this.checkAuth();
    } catch (error) {
      this.showToast('Demo login failed', 'error');
    }
  },

  handleLogout(e) {
    e.preventDefault();
    Auth.logout();
    document.getElementById('user-dropdown')?.classList.remove('active');
    this.showToast('Logged out successfully', 'success');
    this.checkAuth();
    this.loadGlobalLeaderboards();
  },

  toggleUserMenu() {
    document.getElementById('user-dropdown')?.classList.toggle('active');
  },

  // ==================== SETTINGS ====================

  openSettings(e) {
    e?.preventDefault();
    const user = Auth.getCurrentUser();
    if (!user) return;

    document.getElementById('settings-name').value = user.displayName;
    document.getElementById('settings-email').value = user.email || '';

    document.getElementById('settings-modal').classList.add('active');
    document.getElementById('user-dropdown')?.classList.remove('active');
  },

  closeSettingsModal() {
    document.getElementById('settings-modal')?.classList.remove('active');
  },

  handleSettingsSubmit(e) {
    e.preventDefault();
    const displayName = document.getElementById('settings-name').value.trim();
    const email = document.getElementById('settings-email').value.trim();

    try {
      Auth.updateProfile({ displayName, email });
      this.closeSettingsModal();
      this.showToast('Settings saved!', 'success');
      this.checkAuth();
    } catch (error) {
      this.showToast(error.message, 'error');
    }
  },

  backupData() {
    const data = Storage.exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `gameatica-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
    this.showToast('Backup downloaded!', 'success');
  },

  // ==================== PROFILE ====================

  openProfile(e) {
    e?.preventDefault();
    const user = Auth.getCurrentUser();
    if (!user) return;

    // Try SQL stats first
    let stats;
    if (typeof SQLDatabase !== 'undefined' && SQLDatabase.isLoaded) {
      stats = SQLDatabase.getUserStats(user.username);
    } else {
      stats = Storage.getUserStats(user.username);
    }
    
    document.getElementById('profile-display-name').textContent = user.displayName;
    document.getElementById('profile-username').textContent = '@' + user.username;
    document.getElementById('profile-avatar').textContent = user.displayName.charAt(0).toUpperCase();
    document.getElementById('profile-total-plays').textContent = stats.totalPlays;
    document.getElementById('profile-total-score').textContent = stats.totalScore.toLocaleString();
    document.getElementById('profile-games-count').textContent = Object.keys(stats.gamesPlayed).length;
    
    // Load game stats
    const gamesList = document.getElementById('profile-games-list');
    const games = Object.entries(stats.gamesPlayed);
    
    if (games.length === 0) {
      gamesList.innerHTML = '<p style="color:var(--gray);text-align:center;padding:20px;">No games played yet!</p>';
    } else {
      games.sort((a, b) => b[1].bestScore - a[1].bestScore);
      gamesList.innerHTML = games.slice(0, 10).map(([gameId, data]) => `
        <div class="profile-game-item">
          <span class="game-name">${GAME_EMOJIS[gameId] || '🎮'} ${this.formatGameName(gameId)}</span>
          <span class="game-best">Best: ${this.formatNumber(data.bestScore)}</span>
          <span class="game-plays">${data.plays} plays</span>
        </div>
      `).join('');
    }

    document.getElementById('profile-modal').classList.add('active');
    document.getElementById('user-dropdown')?.classList.remove('active');
  },

  closeProfileModal() {
    document.getElementById('profile-modal')?.classList.remove('active');
  },

  // ==================== ADMIN ====================

  openAdminPanel(e) {
    e?.preventDefault();
    const user = Auth.getCurrentUser();
    if (!user?.isAdmin) {
      this.showToast('Admin access required', 'error');
      return;
    }

    this.loadAdminStats();
    this.loadAdminUsers();
    this.loadAdminLeaderboards();
    this.loadChangelog();
    
    document.getElementById('admin-modal').classList.add('active');
    document.getElementById('user-dropdown')?.classList.remove('active');
  },

  closeAdminModal() {
    document.getElementById('admin-modal')?.classList.remove('active');
  },

  switchAdminTab(tab) {
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`.admin-tab[data-admin-tab="${tab}"]`)?.classList.add('active');

    document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById(`admin-${tab}-tab`)?.classList.add('active');
  },

  loadAdminStats() {
    // Try SQL Database first
    if (typeof SQLDatabase !== 'undefined' && SQLDatabase.isLoaded) {
      const stats = SQLDatabase.getGlobalStats();
      document.getElementById('admin-stat-users').textContent = Storage.getUsers() ? Object.keys(Storage.getUsers()).length : 0;
      document.getElementById('admin-stat-scores').textContent = stats.totalScores;
    } else {
      // Fall back to localStorage
      const users = Storage.getUsers();
      const scores = Storage.getAllScores();
      const totalScores = Object.values(scores).reduce((sum, arr) => sum + arr.length, 0);
      
      document.getElementById('admin-stat-users').textContent = Object.keys(users).length;
      document.getElementById('admin-stat-scores').textContent = totalScores;
    }
    
    document.getElementById('admin-version').textContent = 'v' + APP_CONFIG.version;
  },

  loadAdminUsers() {
    const users = Storage.getUsers();
    const userList = Object.values(users);
    
    document.getElementById('users-count').textContent = `${userList.length} users`;
    
    const table = document.getElementById('users-table');
    table.innerHTML = userList.map(user => {
      // Get stats from SQL if available
      let stats = user.stats || { totalPlays: 0, totalScore: 0 };
      if (typeof SQLDatabase !== 'undefined' && SQLDatabase.isLoaded) {
        const sqlStats = SQLDatabase.getUserStats(user.username);
        if (sqlStats.totalPlays > 0) stats = sqlStats;
      }
      
      return `
        <div class="user-row">
          <div class="user-info">
            <div class="user-avatar-small">${user.displayName.charAt(0).toUpperCase()}</div>
            <div>
              <div class="user-row-name">${this.escapeHtml(user.displayName)}</div>
              <div class="user-row-username">@${user.username} ${user.isAdmin ? '🛡️' : ''}</div>
            </div>
          </div>
          <div class="user-meta">
            <span>${stats.totalPlays} plays</span>
            <span>${this.formatNumber(stats.totalScore)} pts</span>
          </div>
        </div>
      `;
    }).join('');
  },

  loadAdminLeaderboards() {
    const container = document.getElementById('admin-leaderboards');
    
    // Try SQL Database first
    if (typeof SQLDatabase !== 'undefined' && SQLDatabase.isLoaded) {
      const leaderboards = SQLDatabase.getAllLeaderboards(3);
      const games = Object.keys(leaderboards);
      
      if (games.length === 0) {
        container.innerHTML = '<p style="color:var(--gray);text-align:center;">No scores recorded yet</p>';
        return;
      }
      
      container.innerHTML = games.slice(0, 6).map(gameId => {
        const scores = leaderboards[gameId];
        return `
          <div class="admin-game-leaderboard">
            <h4>${GAME_EMOJIS[gameId] || '🎮'} ${this.formatGameName(gameId)}</h4>
            ${scores.map((s, i) => `
              <div class="mini-score">
                <span>${['🥇','🥈','🥉'][i]} ${this.escapeHtml(s.displayName || s.username)}</span>
                <span>${this.formatNumber(s.score)}</span>
              </div>
            `).join('')}
          </div>
        `;
      }).join('');
    } else {
      // Fall back to localStorage
      const scores = Storage.getAllScores();
      const games = Object.keys(scores);
      
      if (games.length === 0) {
        container.innerHTML = '<p style="color:var(--gray);text-align:center;">No scores recorded yet</p>';
        return;
      }
      
      container.innerHTML = games.slice(0, 6).map(gameId => {
        const topScores = scores[gameId].slice(0, 3);
        return `
          <div class="admin-game-leaderboard">
            <h4>${GAME_EMOJIS[gameId] || '🎮'} ${this.formatGameName(gameId)}</h4>
            ${topScores.map((s, i) => `
              <div class="mini-score">
                <span>${['🥇','🥈','🥉'][i]} ${this.escapeHtml(s.displayName || s.username)}</span>
                <span>${this.formatNumber(s.score)}</span>
              </div>
            `).join('')}
          </div>
        `;
      }).join('');
    }
  },

  loadChangelog() {
    const container = document.getElementById('changelog-content');
    if (!container || !APP_CONFIG.changelog) return;

    container.innerHTML = APP_CONFIG.changelog.map(entry => `
      <div class="changelog-version">
        <h4>${entry.version} <span style="color:var(--gray);font-size:0.85rem;">${entry.date}</span></h4>
        <ul>
          ${entry.changes.map(change => `<li>${change}</li>`).join('')}
        </ul>
      </div>
    `).join('');
  },

  exportAllData() {
    const data = Storage.exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `gameatica-full-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
    this.showToast('Full export downloaded!', 'success');
  },

  resetAllData() {
    if (!confirm('⚠️ Reset ALL data? This cannot be undone.')) return;
    
    const password = prompt('Enter admin password:');
    if (password !== APP_CONFIG.defaultAdmin.password) {
      this.showToast('Incorrect password', 'error');
      return;
    }

    Storage.clearAll();
    Auth.logout();
    this.closeAdminModal();
    this.showToast('All data reset!', 'success');
    this.checkAuth();
  },

  // ==================== UTILITIES ====================

  updatePlayCount() {
    let totalPlays = parseInt(localStorage.getItem('gameatica_totalPlays') || '0');
    document.getElementById('totalPlays').textContent = totalPlays;
  },

  showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${type === 'success' ? '✅' : '❌'}</span>
      <span class="toast-message">${this.escapeHtml(message)}</span>
    `;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'slideIn 0.3s ease reverse';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  },

  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
};

// Initialize when DOM ready
document.addEventListener('DOMContentLoaded', () => App.init());
