/**
 * Gameatica Configuration
 */

const APP_CONFIG = {
  // Basic Info
  name: 'Gameatica',
  tagline: 'Free Online Arcade Games',
  description: 'Play and compete on leaderboards!',
  icon: '🎮',
  version: '2.6.0',
  lastUpdated: '2026-01-25',
  
  // Storage keys prefix
  storagePrefix: 'gameatica',
  
  // Item config (for scores)
  itemName: 'score',
  itemNamePlural: 'scores',
  
  // Default users
  defaultAdmin: {
    username: 'admin',
    password: 'admin123',
    displayName: 'Admin',
    email: 'admin@gameatica.com',
    isAdmin: true
  },
  
  defaultDemo: {
    username: 'demo',
    password: 'demo123',
    displayName: 'Demo Player',
    email: 'demo@gameatica.com',
    isAdmin: false
  },
  
  // Theme
  theme: {
    primary: '#ef4444',
    secondary: '#f97316',
    accent: '#10b981'
  },
  
  // Changelog
  changelog: [
    {
      version: 'v2.6.0',
      date: 'January 25, 2026',
      changes: [
        'Added SQL database integration',
        'Added game_scores table for persistent storage',
        'Added Data Sources admin tab',
        'Added SQL Database admin tab with GitHub Sync',
        'Leaderboards now pull from SQL database',
        'Scores auto-sync to AIUNITES shared database'
      ]
    },
    {
      version: 'v2.5.0',
      date: 'January 25, 2026',
      changes: [
        'Added user authentication system',
        'Added global leaderboards',
        'Added user profiles and stats',
        'Added admin panel',
        'Added 4 English/Language Arts games'
      ]
    },
    {
      version: 'v2.4.0',
      date: 'January 25, 2026',
      changes: [
        'Added Grammar Galaxy',
        'Added Spelling Bee',
        'Added Punctuation Pro',
        'Added Literary Legends'
      ]
    },
    {
      version: 'v2.3.0',
      date: 'January 25, 2026',
      changes: [
        'Added Statistics Lab',
        'Added Pre-Algebra Pro',
        'Added Number Theory',
        'Added Matrix Math',
        'Added Word Problems',
        'Added Math Facts Drill'
      ]
    },
    {
      version: 'v2.0.0',
      date: 'January 25, 2026',
      changes: [
        'Full arcade launch with 18 games',
        'Category filters',
        'Player stats tracking'
      ]
    }
  ]
};

window.APP_CONFIG = APP_CONFIG;
console.log(`${APP_CONFIG.name} v${APP_CONFIG.version}`);
