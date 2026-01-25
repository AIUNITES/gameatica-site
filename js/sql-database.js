/**
 * Gameatica SQL Database Manager
 * ================================
 * Browser-based SQLite database using sql.js
 * Includes game scores and leaderboard management
 */

const SQLDatabase = {
  db: null,
  isLoaded: false,
  SQL: null,
  
  // Site identifier
  SITE_ID: 'Gameatica',
  
  // Storage keys
  STORAGE_KEY: 'gameatica_sqldb',
  LOCATION_KEY: 'gameatica_db_location',
  
  // Current location
  location: 'browser',
  locationConfig: {},
  
  // SHARED AIUNITES GitHub config
  DEFAULT_GITHUB_CONFIG: {
    owner: 'AIUNITES',
    repo: 'AIUNITES-database-sync',
    path: 'data/app.db',
    token: '',
    autoSync: false
  },
  
  LOCATIONS: {
    browser: { name: 'Browser', icon: '💻', requiresConfig: false },
    localServer: { name: 'Local Server', icon: '🖥️', requiresConfig: true },
    githubSync: { name: 'GitHub Sync', icon: '🐙', requiresConfig: true },
    supabase: { name: 'Supabase', icon: '⚡', requiresConfig: true },
    turso: { name: 'Turso', icon: '🚀', requiresConfig: true }
  },
  
  /**
   * Initialize sql.js
   */
  async init() {
    try {
      if (typeof initSqlJs === 'undefined') {
        console.log('[SQLDatabase] sql.js not loaded, skipping init');
        return;
      }
      
      this.SQL = await initSqlJs({
        locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/${file}`
      });
      
      console.log('[SQLDatabase] sql.js loaded');
      
      this.loadLocationConfig();
      await this.loadFromStorage();
      
      // Auto-load from GitHub if not on localhost and no local DB
      if (!this.isLoaded && !this.isLocalhost()) {
        console.log('[SQLDatabase] Attempting auto-load from GitHub...');
        await this.autoLoadFromGitHub();
      }
      
      // Ensure tables exist
      if (this.isLoaded) {
        this.ensureTables();
      }
      
      this.bindEvents();
      this.updateStatus();
      this.updateLocationUI();
      
    } catch (error) {
      console.error('[SQLDatabase] Init failed:', error);
    }
  },
  
  isLocalhost() {
    const host = window.location.hostname;
    return host === 'localhost' || host === '127.0.0.1' || window.location.protocol === 'file:';
  },
  
  /**
   * Ensure required tables exist
   */
  ensureTables() {
    if (!this.db) return;
    
    try {
      // Create game_scores table
      this.db.run(`
        CREATE TABLE IF NOT EXISTS game_scores (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          game_id TEXT NOT NULL,
          username TEXT NOT NULL,
          display_name TEXT,
          score INTEGER NOT NULL,
          level INTEGER DEFAULT 1,
          duration_seconds INTEGER,
          extra_data TEXT,
          site TEXT DEFAULT 'Gameatica',
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      // Create indexes for fast queries
      this.db.run(`CREATE INDEX IF NOT EXISTS idx_scores_game ON game_scores(game_id, score DESC)`);
      this.db.run(`CREATE INDEX IF NOT EXISTS idx_scores_user ON game_scores(username, game_id)`);
      this.db.run(`CREATE INDEX IF NOT EXISTS idx_scores_site ON game_scores(site, game_id)`);
      
      console.log('[SQLDatabase] Tables ensured');
      this.autoSave();
      
    } catch (error) {
      console.error('[SQLDatabase] ensureTables error:', error);
    }
  },
  
  // ==================== GAME SCORES API ====================
  
  /**
   * Submit a new game score
   */
  submitScore(gameId, username, displayName, score, extraData = {}) {
    if (!this.db) {
      console.log('[SQLDatabase] No database, score not saved to SQL');
      return null;
    }
    
    try {
      this.db.run(`
        INSERT INTO game_scores (game_id, username, display_name, score, level, duration_seconds, extra_data, site)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        gameId,
        username || 'guest',
        displayName || username || 'Guest',
        score,
        extraData.level || 1,
        extraData.duration || null,
        JSON.stringify(extraData),
        this.SITE_ID
      ]);
      
      this.autoSave();
      console.log('[SQLDatabase] Score saved:', gameId, score);
      
      return {
        gameId,
        username,
        displayName,
        score,
        createdAt: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('[SQLDatabase] submitScore error:', error);
      return null;
    }
  },
  
  /**
   * Get top scores for a game (global leaderboard)
   */
  getTopScores(gameId, limit = 10, siteOnly = false) {
    if (!this.db) return [];
    
    try {
      let query = `
        SELECT username, display_name, MAX(score) as score, 
               level, duration_seconds, site, created_at
        FROM game_scores
        WHERE game_id = ?
      `;
      
      if (siteOnly) {
        query += ` AND site = '${this.SITE_ID}'`;
      }
      
      query += `
        GROUP BY username
        ORDER BY score DESC
        LIMIT ?
      `;
      
      const stmt = this.db.prepare(query);
      stmt.bind([gameId, limit]);
      
      const scores = [];
      while (stmt.step()) {
        const row = stmt.getAsObject();
        scores.push({
          username: row.username,
          displayName: row.display_name || row.username,
          score: row.score,
          level: row.level,
          duration: row.duration_seconds,
          site: row.site,
          date: row.created_at
        });
      }
      stmt.free();
      
      return scores;
      
    } catch (error) {
      console.error('[SQLDatabase] getTopScores error:', error);
      return [];
    }
  },
  
  /**
   * Get personal best score for a user
   */
  getPersonalBest(gameId, username) {
    if (!this.db || !username) return 0;
    
    try {
      const stmt = this.db.prepare(`
        SELECT MAX(score) as best FROM game_scores
        WHERE game_id = ? AND username = ?
      `);
      stmt.bind([gameId, username]);
      
      if (stmt.step()) {
        const row = stmt.getAsObject();
        stmt.free();
        return row.best || 0;
      }
      stmt.free();
      return 0;
      
    } catch (error) {
      console.error('[SQLDatabase] getPersonalBest error:', error);
      return 0;
    }
  },
  
  /**
   * Get user's score history for a game
   */
  getUserScores(gameId, username, limit = 20) {
    if (!this.db || !username) return [];
    
    try {
      const stmt = this.db.prepare(`
        SELECT score, level, duration_seconds, created_at
        FROM game_scores
        WHERE game_id = ? AND username = ?
        ORDER BY created_at DESC
        LIMIT ?
      `);
      stmt.bind([gameId, username, limit]);
      
      const scores = [];
      while (stmt.step()) {
        const row = stmt.getAsObject();
        scores.push({
          score: row.score,
          level: row.level,
          duration: row.duration_seconds,
          date: row.created_at
        });
      }
      stmt.free();
      
      return scores;
      
    } catch (error) {
      console.error('[SQLDatabase] getUserScores error:', error);
      return [];
    }
  },
  
  /**
   * Get user's stats across all games
   */
  getUserStats(username) {
    if (!this.db || !username) return { totalPlays: 0, totalScore: 0, gamesPlayed: {} };
    
    try {
      // Total plays and score
      const totalStmt = this.db.prepare(`
        SELECT COUNT(*) as plays, COALESCE(SUM(score), 0) as total_score
        FROM game_scores WHERE username = ?
      `);
      totalStmt.bind([username]);
      totalStmt.step();
      const totalRow = totalStmt.getAsObject();
      totalStmt.free();
      
      // Games breakdown
      const gamesStmt = this.db.prepare(`
        SELECT game_id, COUNT(*) as plays, MAX(score) as best_score
        FROM game_scores WHERE username = ?
        GROUP BY game_id
      `);
      gamesStmt.bind([username]);
      
      const gamesPlayed = {};
      while (gamesStmt.step()) {
        const row = gamesStmt.getAsObject();
        gamesPlayed[row.game_id] = {
          plays: row.plays,
          bestScore: row.best_score
        };
      }
      gamesStmt.free();
      
      return {
        totalPlays: totalRow.plays || 0,
        totalScore: totalRow.total_score || 0,
        gamesPlayed
      };
      
    } catch (error) {
      console.error('[SQLDatabase] getUserStats error:', error);
      return { totalPlays: 0, totalScore: 0, gamesPlayed: {} };
    }
  },
  
  /**
   * Get global stats for admin panel
   */
  getGlobalStats() {
    if (!this.db) return { totalScores: 0, uniquePlayers: 0, topGames: [] };
    
    try {
      // Total scores
      const totalResult = this.db.exec(`SELECT COUNT(*) FROM game_scores WHERE site = '${this.SITE_ID}'`);
      const totalScores = totalResult[0]?.values[0]?.[0] || 0;
      
      // Unique players
      const playersResult = this.db.exec(`SELECT COUNT(DISTINCT username) FROM game_scores WHERE site = '${this.SITE_ID}'`);
      const uniquePlayers = playersResult[0]?.values[0]?.[0] || 0;
      
      // Top games by plays
      const gamesResult = this.db.exec(`
        SELECT game_id, COUNT(*) as plays
        FROM game_scores WHERE site = '${this.SITE_ID}'
        GROUP BY game_id
        ORDER BY plays DESC
        LIMIT 5
      `);
      
      const topGames = gamesResult[0]?.values.map(row => ({
        gameId: row[0],
        plays: row[1]
      })) || [];
      
      return { totalScores, uniquePlayers, topGames };
      
    } catch (error) {
      console.error('[SQLDatabase] getGlobalStats error:', error);
      return { totalScores: 0, uniquePlayers: 0, topGames: [] };
    }
  },
  
  /**
   * Get all leaderboards for admin panel
   */
  getAllLeaderboards(limit = 5) {
    if (!this.db) return {};
    
    try {
      // Get unique games
      const gamesResult = this.db.exec(`
        SELECT DISTINCT game_id FROM game_scores 
        WHERE site = '${this.SITE_ID}'
        ORDER BY game_id
      `);
      
      if (!gamesResult.length) return {};
      
      const leaderboards = {};
      
      gamesResult[0].values.forEach(([gameId]) => {
        leaderboards[gameId] = this.getTopScores(gameId, limit, true);
      });
      
      return leaderboards;
      
    } catch (error) {
      console.error('[SQLDatabase] getAllLeaderboards error:', error);
      return {};
    }
  },
  
  // ==================== DATABASE OPERATIONS ====================
  
  /**
   * Auto-load from GitHub
   */
  async autoLoadFromGitHub() {
    try {
      const config = this.locationConfig.githubSync || this.DEFAULT_GITHUB_CONFIG;
      const apiUrl = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${config.path}`;
      
      const headers = config.token ? { 'Authorization': `token ${config.token}` } : {};
      const resp = await fetch(apiUrl, { headers });
      
      if (!resp.ok) return false;
      
      const data = await resp.json();
      const binary = atob(data.content.replace(/\n/g, ''));
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      
      this.db = new this.SQL.Database(bytes);
      this.isLoaded = true;
      this.location = 'githubSync';
      
      // Ensure our tables exist
      this.ensureTables();
      
      console.log('[SQLDatabase] Loaded from GitHub!');
      
      const sourceEl = document.getElementById('sql-status-source');
      if (sourceEl) sourceEl.textContent = '(Loaded from GitHub)';
      
      document.getElementById('sql-save-github-btn')?.removeAttribute('disabled');
      
      if (typeof App !== 'undefined' && App.showToast) {
        App.showToast('🐙 Database loaded from GitHub!', 'success');
      }
      
      return true;
    } catch (error) {
      console.error('[SQLDatabase] Auto-load failed:', error);
      return false;
    }
  },
  
  loadLocationConfig() {
    try {
      const saved = localStorage.getItem(this.LOCATION_KEY);
      if (saved) {
        const config = JSON.parse(saved);
        this.location = config.location || 'browser';
        this.locationConfig = config.configs || {};
      }
    } catch (e) {}
  },
  
  saveLocationConfig() {
    localStorage.setItem(this.LOCATION_KEY, JSON.stringify({
      location: this.location,
      configs: this.locationConfig
    }));
  },
  
  updateLocationUI() {
    const statusEl = document.getElementById('db-location-status');
    if (statusEl) {
      const loc = this.LOCATIONS[this.location];
      statusEl.textContent = loc ? loc.name : 'Browser';
    }
    
    document.querySelectorAll('.db-location-card').forEach(card => {
      const isActive = card.dataset.location === this.location;
      card.classList.toggle('active', isActive);
      const badge = card.querySelector('.db-loc-badge');
      const btn = card.querySelector('.btn-tiny');
      if (badge) badge.style.display = isActive ? 'inline' : 'none';
      if (btn) btn.style.display = isActive ? 'none' : 'inline';
    });
  },
  
  configureLocation(locationType) {
    if (locationType === 'githubSync') {
      const token = prompt('Enter GitHub token (or leave empty for read-only):');
      if (token !== null) {
        this.locationConfig.githubSync = { ...this.DEFAULT_GITHUB_CONFIG, token };
        this.location = 'githubSync';
        this.saveLocationConfig();
        this.updateLocationUI();
        if (typeof App !== 'undefined' && App.showToast) {
          App.showToast('GitHub Sync configured!', 'success');
        }
      }
    } else {
      alert('This database location is not yet configured. Use Browser or GitHub Sync.');
    }
  },
  
  bindEvents() {
    document.getElementById('sql-new-db-btn')?.addEventListener('click', () => this.createNewDatabase());
    document.getElementById('sql-load-github-btn')?.addEventListener('click', () => this.loadFromGitHub());
    document.getElementById('sql-save-github-btn')?.addEventListener('click', () => this.saveToGitHub());
    
    document.querySelector('.db-location-card[data-location="browser"]')?.addEventListener('click', () => {
      this.location = 'browser';
      this.saveLocationConfig();
      this.updateLocationUI();
    });
  },
  
  createNewDatabase() {
    if (this.db && !confirm('This will replace current database. Continue?')) return;
    
    this.db = new this.SQL.Database();
    this.isLoaded = true;
    this.ensureTables();
    this.updateStatus('New database created', 'success');
    this.autoSave();
    document.getElementById('sql-save-github-btn')?.removeAttribute('disabled');
  },
  
  async loadFromGitHub() {
    const config = this.locationConfig.githubSync || this.DEFAULT_GITHUB_CONFIG;
    
    try {
      const apiUrl = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${config.path}`;
      const headers = config.token ? { 'Authorization': `token ${config.token}` } : {};
      
      const resp = await fetch(apiUrl, { headers });
      if (!resp.ok) {
        alert(resp.status === 404 ? 'Database not found on GitHub' : 'GitHub API error');
        return;
      }
      
      const data = await resp.json();
      const binary = atob(data.content.replace(/\n/g, ''));
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      
      this.db = new this.SQL.Database(bytes);
      this.isLoaded = true;
      this.location = 'githubSync';
      
      this.ensureTables();
      this.updateStatus('Loaded from GitHub', 'success');
      this.updateLocationUI();
      this.autoSave();
      
      document.getElementById('sql-save-github-btn')?.removeAttribute('disabled');
      
      if (typeof App !== 'undefined' && App.showToast) {
        App.showToast('🐙 Database loaded from GitHub!', 'success');
      }
    } catch (error) {
      console.error('[SQLDatabase] Load error:', error);
      alert('Error: ' + error.message);
    }
  },
  
  async saveToGitHub() {
    if (!this.db) {
      alert('No database to save');
      return;
    }
    
    let token = this.locationConfig.githubSync?.token || localStorage.getItem('github_token');
    
    if (!token) {
      token = prompt('Enter GitHub token (needs repo write access):');
      if (!token) return;
      if (confirm('Save token for future?')) {
        localStorage.setItem('github_token', token);
      }
    }
    
    try {
      const config = this.locationConfig.githubSync || this.DEFAULT_GITHUB_CONFIG;
      const apiUrl = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${config.path}`;
      
      let sha = null;
      try {
        const existing = await fetch(apiUrl, { headers: { 'Authorization': `token ${token}` } });
        if (existing.ok) {
          sha = (await existing.json()).sha;
        }
      } catch (e) {}
      
      const data = this.db.export();
      const base64 = btoa(String.fromCharCode.apply(null, data));
      
      const body = {
        message: `Update from ${this.SITE_ID} - ${new Date().toISOString()}`,
        content: base64,
        branch: 'main'
      };
      if (sha) body.sha = sha;
      
      const resp = await fetch(apiUrl, {
        method: 'PUT',
        headers: { 'Authorization': `token ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      
      if (resp.ok) {
        if (typeof App !== 'undefined' && App.showToast) {
          App.showToast('🐙 Saved to GitHub!', 'success');
        } else {
          alert('Saved to GitHub!');
        }
      } else {
        throw new Error('GitHub API error');
      }
    } catch (error) {
      console.error('[SQLDatabase] Save error:', error);
      alert('Error: ' + error.message);
    }
  },
  
  autoSave() {
    if (!this.db) return;
    try {
      const data = this.db.export();
      const base64 = btoa(String.fromCharCode.apply(null, data));
      localStorage.setItem(this.STORAGE_KEY, base64);
    } catch (e) {}
  },
  
  async loadFromStorage() {
    try {
      const base64 = localStorage.getItem(this.STORAGE_KEY);
      if (!base64) return;
      
      const binary = atob(base64);
      const data = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        data[i] = binary.charCodeAt(i);
      }
      
      this.db = new this.SQL.Database(data);
      this.isLoaded = true;
      document.getElementById('sql-save-github-btn')?.removeAttribute('disabled');
    } catch (e) {}
  },
  
  updateStatus(message = null, type = 'info') {
    const iconEl = document.getElementById('sql-status-icon');
    const textEl = document.getElementById('sql-status-text');
    
    if (textEl) {
      textEl.textContent = message || (this.isLoaded ? 'Database ready' : 'Database not loaded');
    }
    
    if (iconEl) {
      iconEl.textContent = type === 'success' ? '🟢' : (type === 'error' ? '🔴' : (this.isLoaded ? '🟢' : '⚪'));
    }
  },
  
  getGitHubToken() {
    return localStorage.getItem('github_token') || this.locationConfig.githubSync?.token || '';
  },
  
  setGitHubToken(token) {
    if (token) {
      localStorage.setItem('github_token', token);
    } else {
      localStorage.removeItem('github_token');
    }
  }
};

// Initialize when DOM ready
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => SQLDatabase.init(), 100);
});

window.SQLDatabase = SQLDatabase;
