// ==UserScript==
// @name         Udyam Form Saver
// @namespace    https://udyamregistration.gov.in
// @version      1.1
// @description  Save and restore form fields on the Udyam Registration portal (encrypted)
// @author       Raj
// @match        https://www.udyamregistration.gov.in/UdyamRegistration.aspx*
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-idle
// ==/UserScript==

/*
  INSTALLATION:
  1. Open Chrome → Tampermonkey extension → Dashboard
  2. Click "+" (Create new script)
  3. Select all existing content and replace with this file's contents
  4. Press Ctrl+S (or Cmd+S on Mac) to save
  5. Visit https://www.udyamregistration.gov.in/UdyamRegistration.aspx
  6. A "Form Saver" panel will appear in the bottom-right corner

  USAGE:
  - Fill in some form fields
  - Click SAVE    → encrypts and stores all field values
  - Click RESTORE → decrypts and refills the form
  - Click CLEAR   → wipes saved data (do this after submitting the form!)

  SECURITY:
  - Data is encrypted with AES-256-GCM before being stored
  - The .log file in Chrome's extension storage will show unreadable ciphertext
  - Always click CLEAR after successfully submitting the form
*/

(function () {
  'use strict';

  const STORAGE_KEY = 'udyam_form_data';

  // ASP.NET system fields and non-data input types to skip
  const SKIP_TYPES = new Set(['hidden', 'submit', 'button', 'image', 'reset', 'file']);

  // --- Encryption (AES-256-GCM via Web Crypto API) ---

  const PASSPHRASE = 'udyam-form-saver-v1';
  const SALT       = new TextEncoder().encode('udyam-static-salt-v1');

  async function getKey() {
    const raw = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(PASSPHRASE),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: SALT, iterations: 100000, hash: 'SHA-256' },
      raw,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  async function encrypt(obj) {
    const key = await getKey();
    const iv  = crypto.getRandomValues(new Uint8Array(12));
    const enc = new TextEncoder();
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      enc.encode(JSON.stringify(obj))
    );
    // Pack iv + ciphertext → base64
    const combined = new Uint8Array(12 + ciphertext.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(ciphertext), 12);
    return btoa(String.fromCharCode(...combined));
  }

  async function decrypt(b64) {
    const key      = await getKey();
    const combined = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const iv       = combined.slice(0, 12);
    const data     = combined.slice(12);
    const plain    = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
    return JSON.parse(new TextDecoder().decode(plain));
  }

  // --- Field helpers ---

  function getFields() {
    return Array.from(document.querySelectorAll('input, select, textarea')).filter(el => {
      if (SKIP_TYPES.has((el.type || '').toLowerCase())) return false;
      const name = el.name || '';
      if (name.startsWith('__')) return false; // __VIEWSTATE, __EVENTVALIDATION, etc.
      return true;
    });
  }

  function fieldKey(el, index) {
    return el.name || el.id || `field_${index}`;
  }

  function fireEvents(el) {
    el.dispatchEvent(new Event('input',  { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // --- Save ---

  async function saveForm() {
    const fields = getFields();
    const data   = {};
    let count    = 0;

    fields.forEach((el, i) => {
      const key  = fieldKey(el, i);
      const type = (el.type || '').toLowerCase();

      if (type === 'checkbox') {
        data[key] = el.checked;
        count++;
      } else if (type === 'radio') {
        if (el.checked) {
          data[`radio__${el.name}`] = el.value;
          count++;
        }
      } else {
        if (el.value) {
          data[key] = el.value;
          count++;
        }
      }
    });

    const encrypted = await encrypt(data);
    GM_setValue(STORAGE_KEY, encrypted);
    return count;
  }

  // --- Restore ---

  async function restoreForm() {
    const raw = GM_getValue(STORAGE_KEY, null);
    if (!raw) return -1;

    let data;
    try {
      data = await decrypt(raw);
    } catch (e) {
      return -1;
    }

    const fields = getFields();
    let count    = 0;

    fields.forEach((el, i) => {
      const key  = fieldKey(el, i);
      const type = (el.type || '').toLowerCase();

      if (type === 'radio') {
        const savedVal = data[`radio__${el.name}`];
        if (savedVal !== undefined && el.value === savedVal) {
          el.checked = true;
          fireEvents(el);
          count++;
        }
      } else if (type === 'checkbox') {
        if (data[key] !== undefined) {
          el.checked = data[key];
          fireEvents(el);
          count++;
        }
      } else {
        if (data[key] !== undefined) {
          el.value = data[key];
          fireEvents(el);
          count++;
        }
      }
    });

    return count;
  }

  // --- Clear ---

  function clearSaved() {
    GM_setValue(STORAGE_KEY, null);
  }

  // --- UI ---

  function buildUI() {
    const panel = document.createElement('div');
    panel.id = 'udyam-saver-panel';
    Object.assign(panel.style, {
      position:     'fixed',
      bottom:       '20px',
      right:        '20px',
      zIndex:       '999999',
      background:   'rgba(20, 20, 20, 0.92)',
      color:        '#fff',
      padding:      '12px 14px',
      borderRadius: '10px',
      fontFamily:   'sans-serif',
      fontSize:     '13px',
      boxShadow:    '0 4px 16px rgba(0,0,0,0.4)',
      display:      'flex',
      flexDirection:'column',
      gap:          '8px',
      minWidth:     '160px',
      userSelect:   'none',
    });

    const title = document.createElement('div');
    title.textContent = '📋 Form Saver';
    Object.assign(title.style, { fontWeight: 'bold', marginBottom: '2px', fontSize: '13px' });

    const btnRow = document.createElement('div');
    Object.assign(btnRow.style, { display: 'flex', gap: '6px' });

    const status = document.createElement('div');
    Object.assign(status.style, { fontSize: '11px', color: '#aaa', minHeight: '14px' });

    function makeBtn(label, color, onClick) {
      const btn = document.createElement('button');
      btn.textContent = label;
      Object.assign(btn.style, {
        flex:         '1',
        padding:      '5px 0',
        border:       'none',
        borderRadius: '6px',
        background:   color,
        color:        '#fff',
        cursor:       'pointer',
        fontWeight:   'bold',
        fontSize:     '12px',
      });
      btn.addEventListener('mouseenter', () => btn.style.opacity = '0.85');
      btn.addEventListener('mouseleave', () => btn.style.opacity = '1');
      btn.addEventListener('click', onClick);
      return btn;
    }

    function setStatus(msg, ok = true) {
      status.textContent = msg;
      status.style.color = ok ? '#7dff9a' : '#ff7d7d';
    }

    function disableBtns(disabled) {
      [saveBtn, restoreBtn].forEach(b => b.disabled = disabled);
    }

    const saveBtn = makeBtn('Save', '#2563eb', () => {
      disableBtns(true);
      setStatus('Saving…');
      saveForm()
        .then(n => setStatus(`Saved ${n} field${n !== 1 ? 's' : ''} 🔒`))
        .catch(() => setStatus('Save failed', false))
        .finally(() => disableBtns(false));
    });

    const restoreBtn = makeBtn('Restore', '#16a34a', () => {
      disableBtns(true);
      setStatus('Restoring…');
      restoreForm()
        .then(n => {
          if (n === -1) setStatus('No saved data', false);
          else setStatus(`Restored ${n} field${n !== 1 ? 's' : ''}`);
        })
        .catch(() => setStatus('Restore failed', false))
        .finally(() => disableBtns(false));
    });

    const clearBtn = makeBtn('Clear', '#dc2626', () => {
      clearSaved();
      setStatus('Cleared', false);
    });

    btnRow.append(saveBtn, restoreBtn, clearBtn);
    panel.append(title, btnRow, status);
    document.body.appendChild(panel);
  }

  // Wait for body to be ready
  if (document.body) {
    buildUI();
  } else {
    window.addEventListener('DOMContentLoaded', buildUI);
  }

})();
