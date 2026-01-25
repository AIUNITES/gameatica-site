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
      
      // When online (not localhost), ALWAYS try GitHub first for shared database
      if (!this.isLocalhost()) {
        console.log('[SQLDatabase] Online mode - loading shared database from GitHub...');
        const loaded = await this.autoLoadFromGitHub();
        if (!loaded) {
          // Fallback to localStorage if GitHub fails
          console.log('[SQLDatabase] GitHub load failed, trying localStorage...');
          await this.loadFromStorage();
        }
      } else {
        // Localhost: use localStorage (development mode)
        console.log('[SQLDatabase] Localhost mode - using local database');
        await this.loadFromStorage();
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
      // Create users table (shared across all AIUNITES sites)
      this.db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          display_name TEXT,
          email TEXT,
          role TEXT DEFAULT 'user',
          site TEXT DEFAULT 'Gameatica',
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
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
      this.db.run(`CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)`);
      this.db.run(`CREATE INDEX IF NOT EXISTS idx_users_site ON users(site)`);
      this.db.run(`CREATE INDEX IF NOT EXISTS idx_scores_game ON game_scores(game_id, score DESC)`);
      this.db.run(`CREATE INDEX IF NOT EXISTS idx_scores_user ON game_scores(username, game_id)`);
      this.db.run(`CREATE INDEX IF NOT EXISTS idx_scores_site ON game_scores(site, game_id)`);
      
      console.log('[SQLDatabase] Tables ensured (users + game_scores)');
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
  },
  
  // ==================== QUERY EDITOR ====================
  
  history: [],
  HISTORY_KEY: 'gameatica_sql_history',
  
  bindQueryEditorEvents() {
    document.getElementById('sql-run-btn')?.addEventListener('click', () => this.runQuery());
    document.getElementById('sql-clear-btn')?.addEventListener('click', () => {
      document.getElementById('sql-query-input').value = '';
    });
    document.getElementById('sql-examples-select')?.addEventListener('change', (e) => {
      this.insertExampleQuery(e.target.value);
      e.target.value = '';
    });
    document.getElementById('sql-refresh-tables-btn')?.addEventListener('click', () => this.refreshTables());
    document.getElementById('sql-create-table-btn')?.addEventListener('click', () => this.showCreateTableDialog());
    document.getElementById('sql-clear-history-btn')?.addEventListener('click', () => this.clearHistory());
    document.getElementById('sql-save-db-btn')?.addEventListener('click', () => this.saveToFile());
    document.getElementById('sql-load-file')?.addEventListener('change', (e) => this.loadFromFile(e.target.files[0]));
    
    // Ctrl+Enter to run
    document.getElementById('sql-query-input')?.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        this.runQuery();
      }
    });
  },
  
  runQuery() {
    const input = document.getElementById('sql-query-input');
    const query = input?.value.trim();
    
    if (!query) {
      alert('Please enter a SQL query');
      return;
    }
    
    if (!this.db) {
      this.createNewDatabase();
    }
    
    const startTime = performance.now();
    
    try {
      const results = this.db.exec(query);
      const duration = (performance.now() - startTime).toFixed(2);
      
      document.getElementById('sql-query-time').textContent = `${duration}ms`;
      this.displayResults(results);
      this.addToHistory(query, true);
      
      if (this.isSchemaChange(query)) {
        this.refreshTables();
      }
      
      this.autoSave();
      console.log('[SQLDatabase] Query executed:', query);
      
    } catch (error) {
      console.error('[SQLDatabase] Query error:', error);
      this.displayError(error.message);
      this.addToHistory(query, false, error.message);
    }
  },
  
  isSchemaChange(query) {
    const upper = query.toUpperCase();
    return ['CREATE', 'DROP', 'ALTER', 'RENAME'].some(kw => upper.includes(kw));
  },
  
  displayResults(results) {
    const container = document.getElementById('sql-results-container');
    const countEl = document.getElementById('sql-results-count');
    
    if (!results || results.length === 0) {
      container.innerHTML = '<div style="color:#22c55e;text-align:center;">✅ Query executed successfully (no results)</div>';
      countEl.textContent = '';
      return;
    }
    
    let html = '';
    let totalRows = 0;
    
    results.forEach((result) => {
      const { columns, values } = result;
      totalRows += values.length;
      
      html += '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:0.85rem;">';
      html += '<thead><tr>';
      columns.forEach(col => {
        html += `<th style="padding:8px;text-align:left;border-bottom:1px solid rgba(255,255,255,0.1);color:var(--primary);">${this.escapeHtml(col)}</th>`;
      });
      html += '</tr></thead><tbody>';
      
      values.forEach(row => {
        html += '<tr>';
        row.forEach(cell => {
          const val = cell === null ? '<span style="color:var(--gray);">NULL</span>' : this.escapeHtml(String(cell));
          html += `<td style="padding:8px;border-bottom:1px solid rgba(255,255,255,0.05);">${val}</td>`;
        });
        html += '</tr>';
      });
      
      html += '</tbody></table></div>';
    });
    
    container.innerHTML = html;
    countEl.textContent = `${totalRows} row${totalRows !== 1 ? 's' : ''}`;
  },
  
  displayError(message) {
    const container = document.getElementById('sql-results-container');
    container.innerHTML = `<div style="color:#ef4444;">❌ Error: ${this.escapeHtml(message)}</div>`;
    document.getElementById('sql-results-count').textContent = '';
  },
  
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },
  
  refreshTables() {
    const container = document.getElementById('sql-tables-list');
    if (!container) return;
    
    if (!this.db) {
      container.innerHTML = '<div style="color:var(--gray);text-align:center;padding:15px;">No database loaded</div>';
      return;
    }
    
    try {
      const result = this.db.exec("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
      
      if (!result.length || !result[0].values.length) {
        container.innerHTML = '<div style="color:var(--gray);text-align:center;padding:15px;">No tables yet</div>';
        return;
      }
      
      let html = '';
      result[0].values.forEach(([tableName]) => {
        let rowCount = 0;
        try {
          const countResult = this.db.exec(`SELECT COUNT(*) FROM "${tableName}"`);
          rowCount = countResult[0]?.values[0]?.[0] || 0;
        } catch (e) {}
        
        html += `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;background:rgba(255,255,255,0.03);border-radius:6px;margin-bottom:6px;">
            <span>📋 ${this.escapeHtml(tableName)} <span style="color:var(--gray);font-size:0.8rem;">(${rowCount})</span></span>
            <div style="display:flex;gap:5px;">
              <button class="btn-tiny" onclick="SQLDatabase.selectAll('${tableName}')" title="SELECT *">👁️</button>
              <button class="btn-tiny" onclick="SQLDatabase.showTableSchema('${tableName}')" title="Schema">📄</button>
              <button class="btn-tiny" onclick="SQLDatabase.dropTable('${tableName}')" title="Drop" style="color:#ef4444;">🗑️</button>
            </div>
          </div>
        `;
      });
      
      container.innerHTML = html;
    } catch (error) {
      container.innerHTML = '<div style="color:var(--gray);text-align:center;">Error loading tables</div>';
    }
  },
  
  selectAll(tableName) {
    document.getElementById('sql-query-input').value = `SELECT * FROM "${tableName}" LIMIT 100;`;
    this.runQuery();
  },
  
  showTableSchema(tableName) {
    document.getElementById('sql-query-input').value = `PRAGMA table_info("${tableName}");`;
    this.runQuery();
  },
  
  dropTable(tableName) {
    if (confirm(`Drop table "${tableName}"? This cannot be undone.`)) {
      document.getElementById('sql-query-input').value = `DROP TABLE "${tableName}";`;
      this.runQuery();
    }
  },
  
  showCreateTableDialog() {
    const name = prompt('Table name:');
    if (!name) return;
    const cols = prompt('Columns (e.g., id INTEGER PRIMARY KEY, name TEXT):');
    if (!cols) return;
    document.getElementById('sql-query-input').value = `CREATE TABLE "${name}" (\n  ${cols}\n);`;
    this.runQuery();
  },
  
  insertExampleQuery(type) {
    const examples = {
      // User queries
      users: 'SELECT id, username, display_name, email, role, site, created_at FROM users ORDER BY created_at DESC LIMIT 50;',
      tables: "SELECT name, type FROM sqlite_master WHERE type='table' ORDER BY name;",
      count: 'SELECT COUNT(*) as total_users FROM users;',
      siteusers: `SELECT site, COUNT(*) as user_count FROM users GROUP BY site ORDER BY user_count DESC;`,
      // Game score queries
      scores: 'SELECT * FROM game_scores ORDER BY created_at DESC LIMIT 50;',
      // Generic templates
      select: 'SELECT * FROM table_name WHERE condition LIMIT 10;',
      create: `CREATE TABLE example (\n  id INTEGER PRIMARY KEY AUTOINCREMENT,\n  name TEXT NOT NULL,\n  created_at TEXT DEFAULT CURRENT_TIMESTAMP\n);`,
      insert: `INSERT INTO table_name (col1, col2) VALUES \n  ('value1', 'value2');`
    };
    if (examples[type]) {
      document.getElementById('sql-query-input').value = examples[type];
    }
  },
  
  // Quick query - insert AND run immediately
  quickQuery(type) {
    this.insertExampleQuery(type);
    this.runQuery();
  },
  
  addToHistory(query, success, error = null) {
    this.history.unshift({ query, success, error, timestamp: new Date().toISOString() });
    this.history = this.history.slice(0, 50);
    this.saveHistory();
    this.renderHistory();
  },
  
  saveHistory() {
    localStorage.setItem(this.HISTORY_KEY, JSON.stringify(this.history));
  },
  
  loadHistory() {
    try {
      const saved = localStorage.getItem(this.HISTORY_KEY);
      if (saved) {
        this.history = JSON.parse(saved);
        this.renderHistory();
      }
    } catch (e) {
      this.history = [];
    }
  },
  
  clearHistory() {
    this.history = [];
    this.saveHistory();
    this.renderHistory();
  },
  
  renderHistory() {
    const container = document.getElementById('sql-history-list');
    if (!container) return;
    
    if (!this.history.length) {
      container.innerHTML = '<div style="color:var(--gray);text-align:center;padding:15px;">No queries yet</div>';
      return;
    }
    
    let html = '';
    this.history.slice(0, 20).forEach((item, idx) => {
      const icon = item.success ? '✅' : '❌';
      const shortQuery = item.query.substring(0, 50) + (item.query.length > 50 ? '...' : '');
      html += `
        <div onclick="SQLDatabase.useHistoryItem(${idx})" style="display:flex;align-items:center;gap:8px;padding:8px;background:rgba(255,255,255,0.03);border-radius:6px;margin-bottom:4px;cursor:pointer;font-size:0.85rem;">
          <span>${icon}</span>
          <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${this.escapeHtml(shortQuery)}</span>
        </div>
      `;
    });
    container.innerHTML = html;
  },
  
  useHistoryItem(index) {
    if (this.history[index]) {
      document.getElementById('sql-query-input').value = this.history[index].query;
    }
  },
  
  saveToFile() {
    if (!this.db) {
      alert('No database to save');
      return;
    }
    const data = this.db.export();
    const blob = new Blob([data], { type: 'application/x-sqlite3' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gameatica_db_${Date.now()}.db`;
    a.click();
    URL.revokeObjectURL(url);
    if (typeof App !== 'undefined' && App.showToast) {
      App.showToast('💾 Database saved!', 'success');
    }
  },
  
  async loadFromFile(file) {
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const data = new Uint8Array(buffer);
      this.db = new this.SQL.Database(data);
      this.isLoaded = true;
      this.ensureTables();
      this.updateStatus(`Loaded: ${file.name}`, 'success');
      this.refreshTables();
      this.autoSave();
      document.getElementById('sql-save-db-btn')?.removeAttribute('disabled');
      document.getElementById('sql-save-github-btn')?.removeAttribute('disabled');
    } catch (error) {
      alert('Error loading file: ' + error.message);
    }
  }
};

// Initialize when DOM ready
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    SQLDatabase.init();
    SQLDatabase.bindQueryEditorEvents();
    SQLDatabase.loadHistory();
    SQLDatabase.refreshTables();
  }, 100);
});

window.SQLDatabase = SQLDatabase;
