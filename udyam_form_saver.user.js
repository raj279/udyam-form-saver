// ==UserScript==
// @name         Udyam Form Saver
// @namespace    https://udyamregistration.gov.in
// @version      1.0
// @description  Save and restore form fields on the Udyam Registration portal
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
  - Click SAVE   → stores all field values (survives page refresh & browser restart)
  - Click RESTORE → fills the form back with saved values
  - Click CLEAR  → wipes saved data
*/

(function () {
  'use strict';

  const STORAGE_KEY = 'udyam_form_data';

  // ASP.NET system fields and non-data input types to skip
  const SKIP_TYPES = new Set(['hidden', 'submit', 'button', 'image', 'reset', 'file']);

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
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // --- Save ---

  function saveForm() {
    const fields = getFields();
    const data = {};
    let count = 0;

    fields.forEach((el, i) => {
      const key = fieldKey(el, i);
      const type = (el.type || '').toLowerCase();

      if (type === 'checkbox') {
        data[key] = el.checked;
        count++;
      } else if (type === 'radio') {
        if (el.checked) {
          // Store checked radio: key = name, value = value
          data[`radio__${el.name}`] = el.value;
          count++;
        }
      } else {
        // text, email, tel, number, date, textarea, select
        if (el.value) {
          data[key] = el.value;
          count++;
        }
      }
    });

    GM_setValue(STORAGE_KEY, JSON.stringify(data));
    return count;
  }

  // --- Restore ---

  function restoreForm() {
    const raw = GM_getValue(STORAGE_KEY, null);
    if (!raw) return -1;

    let data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      return -1;
    }

    const fields = getFields();
    let count = 0;

    fields.forEach((el, i) => {
      const key = fieldKey(el, i);
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
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      zIndex: '999999',
      background: 'rgba(20, 20, 20, 0.92)',
      color: '#fff',
      padding: '12px 14px',
      borderRadius: '10px',
      fontFamily: 'sans-serif',
      fontSize: '13px',
      boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      minWidth: '160px',
      userSelect: 'none',
    });

    const title = document.createElement('div');
    title.textContent = '📋 Form Saver';
    Object.assign(title.style, { fontWeight: 'bold', marginBottom: '2px', fontSize: '13px' });

    const btnRow = document.createElement('div');
    Object.assign(btnRow.style, { display: 'flex', gap: '6px' });

    const status = document.createElement('div');
    Object.assign(status.style, {
      fontSize: '11px',
      color: '#aaa',
      minHeight: '14px',
    });

    function makeBtn(label, color, onClick) {
      const btn = document.createElement('button');
      btn.textContent = label;
      Object.assign(btn.style, {
        flex: '1',
        padding: '5px 0',
        border: 'none',
        borderRadius: '6px',
        background: color,
        color: '#fff',
        cursor: 'pointer',
        fontWeight: 'bold',
        fontSize: '12px',
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

    const saveBtn = makeBtn('Save', '#2563eb', () => {
      const n = saveForm();
      setStatus(`Saved ${n} field${n !== 1 ? 's' : ''}`);
    });

    const restoreBtn = makeBtn('Restore', '#16a34a', () => {
      const n = restoreForm();
      if (n === -1) setStatus('No saved data', false);
      else setStatus(`Restored ${n} field${n !== 1 ? 's' : ''}`);
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
