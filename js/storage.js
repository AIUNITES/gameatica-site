/**
 * Gameatica Storage Module
 * Handles localStorage-based data persistence for users, scores, and settings
 */

const Storage = {
  get KEYS() {
    const prefix = APP_CONFIG.storagePrefix;
    return {
      USERS: `${prefix}_users`,
      CURRENT_USER: `${prefix}_current_user`,
      SCORES: `${prefix}_scores`,
      SETTINGS: `${prefix}_settings`,
      STATS: `${prefix}_stats`
    };
  },

  /**
   * Initialize storage with default data
   */
  init() {
    // Initialize users
    if (!localStorage.getItem(this.KEYS.USERS)) {
      const users = {};
      
      // Admin user
      const admin = APP_CONFIG.defaultAdmin;
      users[admin.username] = {
        id: 'admin_001',
        username: admin.username,
        displayName: admin.displayName,
        email: admin.email,
        password: admin.password,
        isAdmin: true,
        createdAt: new Date().toISOString(),
        settings: {},
        stats: { totalPlays: 0, totalScore: 0, gamesPlayed: {} }
      };
      
      // Demo user
      const demo = APP_CONFIG.defaultDemo;
      users[demo.username] = {
        id: 'demo_001',
        username: demo.username,
        displayName: demo.displayName,
        email: demo.email,
        password: demo.password,
        isAdmin: false,
        createdAt: new Date().toISOString(),
        settings: {},
        stats: { totalPlays: 0, totalScore: 0, gamesPlayed: {} }
      };
      
      localStorage.setItem(this.KEYS.USERS, JSON.stringify(users));
    }

    // Initialize scores (leaderboards)
    if (!localStorage.getItem(this.KEYS.SCORES)) {
      localStorage.setItem(this.KEYS.SCORES, JSON.stringify({}));
    }

    // Initialize settings
    if (!localStorage.getItem(this.KEYS.SETTINGS)) {
      localStorage.setItem(this.KEYS.SETTINGS, JSON.stringify({
        emailVerification: false,
        publicSignup: true,
        maintenanceMode: false
      }));
    }
  },

  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  },

  getAll(key) {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : {};
  },

  saveAll(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
  },

  // ==================== USERS ====================

  getUsers() {
    return this.getAll(this.KEYS.USERS);
  },

  getUserByUsername(username) {
    const users = this.getUsers();
    return users[username.toLowerCase()] || null;
  },

  createUser(userData) {
    const users = this.getUsers();
    const username = userData.username.toLowerCase();
    
    if (users[username]) {
      throw new Error('Username already exists');
    }

    const user = {
      id: this.generateId(),
      username: username,
      displayName: userData.displayName,
      email: userData.email || '',
      password: userData.password,
      isAdmin: userData.isAdmin || false,
      createdAt: new Date().toISOString(),
      settings: {},
      stats: { totalPlays: 0, totalScore: 0, gamesPlayed: {} }
    };

    users[username] = user;
    this.saveAll(this.KEYS.USERS, users);
    return user;
  },

  updateUser(username, updates) {
    const users = this.getUsers();
    if (!users[username]) {
      throw new Error('User not found');
    }
    users[username] = { ...users[username], ...updates };
    this.saveAll(this.KEYS.USERS, users);
    return users[username];
  },

  getCurrentUser() {
    const username = localStorage.getItem(this.KEYS.CURRENT_USER);
    if (!username) return null;
    return this.getUserByUsername(username);
  },

  setCurrentUser(username) {
    localStorage.setItem(this.KEYS.CURRENT_USER, username.toLowerCase());
  },

  clearCurrentUser() {
    localStorage.removeItem(this.KEYS.CURRENT_USER);
  },

  // ==================== SCORES/LEADERBOARDS ====================

  getAllScores() {
    return this.getAll(this.KEYS.SCORES);
  },

  getGameScores(gameId) {
    const allScores = this.getAllScores();
    return allScores[gameId] || [];
  },

  getTopScores(gameId, limit = 10) {
    const scores = this.getGameScores(gameId);
    return scores
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  },

  submitScore(gameId, score, extraData = {}) {
    const user = this.getCurrentUser();
    if (!user) return null;

    const allScores = this.getAllScores();
    if (!allScores[gameId]) {
      allScores[gameId] = [];
    }

    const scoreEntry = {
      id: this.generateId(),
      username: user.username,
      displayName: user.displayName,
      score: score,
      date: new Date().toISOString(),
      ...extraData
    };

    allScores[gameId].push(scoreEntry);
    
    // Keep only top 100 scores per game
    allScores[gameId] = allScores[gameId]
      .sort((a, b) => b.score - a.score)
      .slice(0, 100);

    this.saveAll(this.KEYS.SCORES, allScores);

    // Update user stats
    this.updateUserStats(user.username, gameId, score);

    return scoreEntry;
  },

  getUserBestScore(gameId, username) {
    const scores = this.getGameScores(gameId);
    const userScores = scores.filter(s => s.username === username);
    if (userScores.length === 0) return 0;
    return Math.max(...userScores.map(s => s.score));
  },

  // ==================== USER STATS ====================

  updateUserStats(username, gameId, score) {
    const users = this.getUsers();
    if (!users[username]) return;

    if (!users[username].stats) {
      users[username].stats = { totalPlays: 0, totalScore: 0, gamesPlayed: {} };
    }

    users[username].stats.totalPlays++;
    users[username].stats.totalScore += score;
    
    if (!users[username].stats.gamesPlayed[gameId]) {
      users[username].stats.gamesPlayed[gameId] = { plays: 0, bestScore: 0, totalScore: 0 };
    }
    
    users[username].stats.gamesPlayed[gameId].plays++;
    users[username].stats.gamesPlayed[gameId].totalScore += score;
    if (score > users[username].stats.gamesPlayed[gameId].bestScore) {
      users[username].stats.gamesPlayed[gameId].bestScore = score;
    }

    this.saveAll(this.KEYS.USERS, users);
  },

  getUserStats(username) {
    const user = this.getUserByUsername(username);
    return user?.stats || { totalPlays: 0, totalScore: 0, gamesPlayed: {} };
  },

  // ==================== SETTINGS ====================

  getSystemSettings() {
    return this.getAll(this.KEYS.SETTINGS);
  },

  saveSystemSettings(settings) {
    this.saveAll(this.KEYS.SETTINGS, settings);
  },

  // ==================== EXPORT/IMPORT ====================

  exportData() {
    return {
      version: APP_CONFIG.version,
      app: APP_CONFIG.name,
      users: this.getAll(this.KEYS.USERS),
      scores: this.getAll(this.KEYS.SCORES),
      settings: this.getAll(this.KEYS.SETTINGS),
      exportedAt: new Date().toISOString()
    };
  },

  importData(data) {
    if (data.users) this.saveAll(this.KEYS.USERS, data.users);
    if (data.scores) this.saveAll(this.KEYS.SCORES, data.scores);
    if (data.settings) this.saveAll(this.KEYS.SETTINGS, data.settings);
  },

  clearAll() {
    localStorage.removeItem(this.KEYS.USERS);
    localStorage.removeItem(this.KEYS.SCORES);
    localStorage.removeItem(this.KEYS.SETTINGS);
    localStorage.removeItem(this.KEYS.CURRENT_USER);
    this.init();
  }
};

// Initialize on load
Storage.init();
