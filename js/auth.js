/**
 * Gameatica Auth Module
 * Handles user registration, login, and session management
 * Supports both localStorage and SQL database authentication
 */

const Auth = {
  /**
   * Register new user
   * Saves to both localStorage and SQL database (if available)
   */
  signup(displayName, username, email, password) {
    if (!displayName || displayName.length < 2) {
      throw new Error('Display name must be at least 2 characters');
    }
    if (!username || username.length < 3) {
      throw new Error('Username must be at least 3 characters');
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      throw new Error('Username can only contain letters, numbers, and underscores');
    }
    if (!password || password.length < 6) {
      throw new Error('Password must be at least 6 characters');
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error('Please enter a valid email address');
    }

    // Check if username exists in localStorage
    if (Storage.getUserByUsername(username)) {
      throw new Error('Username already taken');
    }
    
    // Check if username exists in SQL database
    if (this.checkUsernameInSQL(username)) {
      throw new Error('Username already taken');
    }

    // Create user in localStorage
    const user = Storage.createUser({
      displayName,
      username,
      email,
      password
    });

    // Also save to SQL database if available
    this.saveUserToSQL(user, password);

    Storage.setCurrentUser(user.username);
    return user;
  },

  /**
   * Check if username exists in SQL database
   */
  checkUsernameInSQL(username) {
    if (typeof SQLDatabase === 'undefined' || !SQLDatabase.isLoaded || !SQLDatabase.db) {
      return false;
    }
    
    try {
      const stmt = SQLDatabase.db.prepare(
        `SELECT id FROM users WHERE LOWER(username) = LOWER(?) LIMIT 1`
      );
      stmt.bind([username]);
      const exists = stmt.step();
      stmt.free();
      return exists;
    } catch (e) {
      console.warn('[Auth] SQL username check failed:', e.message);
      return false;
    }
  },

  /**
   * Save user to SQL database
   */
  saveUserToSQL(user, password) {
    if (typeof SQLDatabase === 'undefined' || !SQLDatabase.isLoaded || !SQLDatabase.db) {
      return false;
    }
    
    try {
      SQLDatabase.db.run(`
        INSERT INTO users (username, password_hash, display_name, email, role, created_at, site)
        VALUES (?, ?, ?, ?, ?, datetime('now'), ?)
      `, [
        user.username,
        password,
        user.displayName,
        user.email || '',
        user.isAdmin ? 'admin' : 'user',
        'Gameatica'
      ]);
      
      SQLDatabase.autoSave();
      console.log('[Auth] User saved to SQL database:', user.username);
      return true;
    } catch (e) {
      console.warn('[Auth] Failed to save user to SQL:', e.message);
      return false;
    }
  },

  /**
   * Login user
   * Checks localStorage first, then SQL database if available
   */
  login(username, password) {
    if (!username || !password) {
      throw new Error('Please enter username and password');
    }

    // First, try localStorage (original behavior)
    let user = Storage.getUserByUsername(username);
    
    if (user) {
      // Found in localStorage - check password
      if (user.password !== password) {
        throw new Error('Incorrect password');
      }
      Storage.setCurrentUser(user.username);
      return user;
    }
    
    // Not found in localStorage - try SQL database if available
    if (typeof SQLDatabase !== 'undefined' && SQLDatabase.isLoaded && SQLDatabase.db) {
      try {
        // Use parameterized query to prevent SQL injection
        const stmt = SQLDatabase.db.prepare(
          `SELECT * FROM users WHERE LOWER(username) = LOWER(?) LIMIT 1`
        );
        stmt.bind([username]);
        
        if (stmt.step()) {
          const dbUser = stmt.getAsObject();
          stmt.free();
          
          // Check password (stored as password_hash in DB)
          const dbPassword = dbUser.password_hash || dbUser.password || '';
          if (dbPassword !== password) {
            throw new Error('Incorrect password');
          }
          
          // Create localStorage user from DB user for session
          user = Storage.createUser({
            displayName: dbUser.display_name || dbUser.displayName || username,
            username: dbUser.username,
            email: dbUser.email || '',
            password: password,
            isAdmin: dbUser.role === 'admin'
          });
          
          console.log('[Auth] User authenticated from SQL database:', username);
          
          if (typeof App !== 'undefined' && App.showToast) {
            App.showToast('🐙 Logged in from AIUNITES database!', 'success');
          }
          
          Storage.setCurrentUser(user.username);
          return user;
        } else {
          stmt.free(); // Clean up prepared statement
        }
      } catch (dbError) {
        console.warn('[Auth] SQL database lookup failed:', dbError.message);
        // Fall through to "User not found"
      }
    }
    
    throw new Error('User not found');
  },

  /**
   * Demo login
   * Tries SQL database first for demo user, then falls back to default
   */
  loginDemo() {
    const demo = APP_CONFIG.defaultDemo;
    
    // Try to login (will check SQL database too)
    try {
      return this.login(demo.username, demo.password);
    } catch (e) {
      // If demo user doesn't exist anywhere, create it locally
      console.log('[Auth] Creating local demo user');
      const user = Storage.createUser({
        displayName: demo.displayName,
        username: demo.username,
        email: demo.email,
        password: demo.password,
        isAdmin: demo.isAdmin
      });
      Storage.setCurrentUser(user.username);
      return user;
    }
  },

  /**
   * Logout current user
   */
  logout() {
    Storage.clearCurrentUser();
  },

  /**
   * Check if user is logged in
   */
  isLoggedIn() {
    return Storage.getCurrentUser() !== null;
  },

  /**
   * Get current user
   */
  getCurrentUser() {
    return Storage.getCurrentUser();
  },

  /**
   * Check if current user is admin
   */
  isAdmin() {
    const user = this.getCurrentUser();
    return user?.isAdmin === true;
  },

  /**
   * Update user profile
   */
  updateProfile(updates) {
    const user = this.getCurrentUser();
    if (!user) {
      throw new Error('Not logged in');
    }
    
    // Update in localStorage
    const updatedUser = Storage.updateUser(user.username, updates);
    
    // Also update in SQL database if available
    this.updateUserInSQL(user.username, updates);
    
    return updatedUser;
  },
  
  /**
   * Update user in SQL database
   */
  updateUserInSQL(username, updates) {
    if (typeof SQLDatabase === 'undefined' || !SQLDatabase.isLoaded || !SQLDatabase.db) {
      return false;
    }
    
    try {
      const fields = [];
      const values = [];
      
      if (updates.displayName) {
        fields.push('display_name = ?');
        values.push(updates.displayName);
      }
      if (updates.email !== undefined) {
        fields.push('email = ?');
        values.push(updates.email);
      }
      
      if (fields.length === 0) return false;
      
      values.push(username);
      
      SQLDatabase.db.run(
        `UPDATE users SET ${fields.join(', ')} WHERE username = ?`,
        values
      );
      
      SQLDatabase.autoSave();
      console.log('[Auth] User updated in SQL database:', username);
      return true;
    } catch (e) {
      console.warn('[Auth] Failed to update user in SQL:', e.message);
      return false;
    }
  }
};
