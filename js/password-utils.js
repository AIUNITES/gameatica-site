/**
 * AIUNITES Password Utilities — SHA-256 hashing via Web Crypto API.
 * Passwords are NEVER stored in plaintext.
 */
const PasswordUtils = {
  SALT: 'aiunites-2026',
  async hash(password) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password + this.SALT));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
  },
  async verify(password, storedHash) { return (await this.hash(password)) === storedHash; },
  async migrate(user, plaintextPassword) {
    const migrated = { ...user, passwordHash: await this.hash(plaintextPassword) };
    delete migrated.password;
    return migrated;
  },
  sanitize(user) { const { password, passwordHash, ...safe } = user; return safe; }
};
window.PasswordUtils = PasswordUtils;
