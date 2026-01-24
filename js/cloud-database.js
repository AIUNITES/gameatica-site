/**
 * AIUNITES Cloud Database Module
 * Shared Google Forms-based cloud storage for all AIUNITES sites
 * Usage: <script src="js/cloud-database.js"></script> then CloudDB.init({ siteName: 'MySite' });
 */
const CloudDB = {
  config: {
    siteName: 'AIUNITES',
    formUrl: 'https://docs.google.com/forms/d/e/1FAIpQLSeQUi49AdTBRjetz5MDFQgMIkm9-vOMb_ARKwYEz41j_Nfiwg/formResponse',
    entryIds: { email: 'entry.904300305', source: 'entry.2053726945', message: 'entry.1759393763' },
    apiUrl: null, storagePrefix: 'aiunites_clouddb_'
  },
  init(options = {}) {
    Object.assign(this.config, options);
    const savedApiUrl = localStorage.getItem(this.config.storagePrefix + 'apiUrl');
    if (savedApiUrl) this.config.apiUrl = savedApiUrl;
    console.log(`☁️ CloudDB initialized for ${this.config.siteName}`);
    return this;
  },
  isEnabled() { return localStorage.getItem(this.config.storagePrefix + 'enabled') === 'true'; },
  setEnabled(enabled) { localStorage.setItem(this.config.storagePrefix + 'enabled', enabled ? 'true' : 'false'); },
  setApiUrl(url) { this.config.apiUrl = url; localStorage.setItem(this.config.storagePrefix + 'apiUrl', url); },
  getApiUrl() { return this.config.apiUrl || localStorage.getItem(this.config.storagePrefix + 'apiUrl'); },
  async submit(type, data, email = '') {
    if (!this.isEnabled()) return { success: false, reason: 'disabled' };
    try {
      const packedData = this.packData(type, data);
      const formData = new FormData();
      formData.append(this.config.entryIds.email, email || data.email || '');
      formData.append(this.config.entryIds.source, `${this.config.siteName}-${type}`);
      formData.append(this.config.entryIds.message, packedData);
      await fetch(this.config.formUrl, { method: 'POST', mode: 'no-cors', body: formData });
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  },
  packData(type, data) {
    switch (type.toUpperCase()) {
      case 'USER': return `USER|${data.username}|${data.email}|${data.password || ''}|${data.firstName || ''}|${data.lastName || ''}|${data.role || 'user'}|${data.createdAt || new Date().toISOString()}`;
      case 'SCORE': return `SCORE|${data.username}|${data.displayName}|${data.score}|${data.correct}|${data.wrong}|${data.streak}|${data.mode}|${data.timestamp || new Date().toISOString()}`;
      case 'FEEDBACK': return `FEEDBACK|${data.message}`;
      case 'WAITLIST': return `WAITLIST|${data.email}|${data.name || ''}|${data.source || this.config.siteName}|${new Date().toISOString()}`;
      case 'CONTACT': return `CONTACT|${data.name}|${data.email}|${data.subject || ''}|${data.message}|${new Date().toISOString()}`;
      default: return `${type.toUpperCase()}|${Object.entries(data).map(([k, v]) => `${k}:${v}`).join('|')}`;
    }
  },
  async fetch(type = 'users') {
    const apiUrl = this.getApiUrl();
    if (!apiUrl) return { success: false, error: 'No API URL configured' };
    if (!this.isEnabled()) return { success: false, reason: 'disabled' };
    try {
      const response = await fetch(type ? `${apiUrl}?type=${type}` : apiUrl);
      return { success: true, data: await response.json() };
    } catch (err) { return { success: false, error: err.message }; }
  },
  async testConnection() {
    const apiUrl = this.getApiUrl();
    if (!apiUrl) return { success: false, status: 'not_configured', message: 'No API URL configured' };
    try {
      const data = await (await fetch(apiUrl)).json();
      return Array.isArray(data) ? { success: true, status: 'connected', message: `Connected! Found ${data.length} records`, data } : { success: false, status: 'invalid', message: 'Invalid response format' };
    } catch (err) { return { success: false, status: 'error', message: err.message }; }
  },
  renderAdminPanel(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const enabled = this.isEnabled(), apiUrl = this.getApiUrl() || '';
    container.innerHTML = `<div style="background:#1a1a24;border-radius:12px;padding:20px;border:1px solid rgba(255,255,255,0.1);font-family:system-ui,sans-serif;"><h3 style="margin:0 0 15px;color:#fff;display:flex;align-items:center;gap:10px;">☁️ Cloud Database Settings<span id="clouddb-status" style="font-size:0.75rem;padding:4px 10px;border-radius:12px;background:${enabled?'rgba(34,197,94,0.2)':'rgba(239,68,68,0.2)'};color:${enabled?'#22c55e':'#ef4444'};">${enabled?'● Online':'○ Offline'}</span></h3><div style="margin-bottom:20px;"><label style="display:flex;align-items:center;gap:12px;cursor:pointer;color:#fff;"><input type="checkbox" id="clouddb-enabled" ${enabled?'checked':''} style="width:20px;height:20px;accent-color:#8b5cf6;"><span>Enable Cloud Sync</span></label><p style="margin:8px 0 0 32px;font-size:0.85rem;color:#a0a0b0;">When enabled, data syncs to shared AIUNITES cloud database</p></div><div style="margin-bottom:20px;"><label style="display:block;margin-bottom:8px;color:#a0a0b0;font-size:0.9rem;">Apps Script API URL</label><input type="text" id="clouddb-apiurl" value="${apiUrl}" placeholder="https://script.google.com/macros/s/YOUR_ID/exec" style="width:100%;padding:10px 12px;background:#252535;border:2px solid transparent;border-radius:8px;color:#fff;font-size:0.9rem;"></div><div style="display:flex;gap:10px;flex-wrap:wrap;"><button id="clouddb-save" style="padding:10px 20px;background:#8b5cf6;color:#fff;border:none;border-radius:8px;font-weight:600;cursor:pointer;">💾 Save</button><button id="clouddb-test" style="padding:10px 20px;background:#252535;color:#fff;border:none;border-radius:8px;font-weight:600;cursor:pointer;">🔄 Test</button><span id="clouddb-message" style="padding:10px;font-size:0.9rem;"></span></div></div>`;
    document.getElementById('clouddb-enabled').addEventListener('change', (e) => { this.setEnabled(e.target.checked); this.updateStatusBadge(); });
    document.getElementById('clouddb-save').addEventListener('click', () => { this.setApiUrl(document.getElementById('clouddb-apiurl').value.trim()); this.setEnabled(document.getElementById('clouddb-enabled').checked); this.updateStatusBadge(); const msg = document.getElementById('clouddb-message'); msg.textContent = '✅ Saved!'; msg.style.color = '#22c55e'; setTimeout(() => msg.textContent = '', 3000); });
    document.getElementById('clouddb-test').addEventListener('click', async () => { const msg = document.getElementById('clouddb-message'); msg.textContent = '🔄 Testing...'; msg.style.color = '#00d4ff'; const result = await this.testConnection(); msg.textContent = result.success ? `✅ ${result.message}` : `❌ ${result.message}`; msg.style.color = result.success ? '#22c55e' : '#ef4444'; });
  },
  updateStatusBadge() {
    const badge = document.getElementById('clouddb-status');
    if (!badge) return;
    const enabled = this.isEnabled();
    badge.style.background = enabled ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)';
    badge.style.color = enabled ? '#22c55e' : '#ef4444';
    badge.textContent = enabled ? '● Online' : '○ Offline';
  },
  renderStatusBadge(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const enabled = this.isEnabled();
    container.innerHTML = `<div style="display:inline-flex;align-items:center;gap:8px;padding:6px 12px;background:${enabled?'rgba(34,197,94,0.1)':'rgba(255,255,255,0.05)'};border-radius:20px;font-size:0.8rem;"><span style="width:8px;height:8px;border-radius:50%;background:${enabled?'#22c55e':'#666'};"></span><span style="color:${enabled?'#22c55e':'#888'};">${enabled?'Cloud Sync':'Offline Mode'}</span></div>`;
  }
};
document.addEventListener('DOMContentLoaded', () => { const script = document.querySelector('script[data-clouddb-site]'); if (script) CloudDB.init({ siteName: script.dataset.clouddbSite }); });
