# Udyam Form Saver — Claude Context

## What This Is

A single-file Tampermonkey userscript that injects a Save/Restore/Clear UI panel onto the Udyam Registration portal (ASP.NET WebForms). Saves form field values to Tampermonkey's persistent storage (`GM_setValue`/`GM_getValue`).

---

## File Structure

```
udyam-form-saver/
├── udyam_form_saver.user.js   # The Tampermonkey userscript (single source of truth)
├── README.md                  # User-facing install + usage guide
└── CLAUDE.md                  # This file
```

---

## Script Internals

### URL Match
```
https://www.udyamregistration.gov.in/UdyamRegistration.aspx*
```

### Storage
- Uses `GM_setValue` / `GM_getValue` (Tampermonkey internal storage)
- Storage key: `udyam_form_data` → JSON string of `{ fieldKey: value }`

### Field Collection
- Selects all `input, select, textarea`
- **Skips**: `type=hidden/submit/button/image/reset/file` and fields whose `name` starts with `__` (ASP.NET internals like `__VIEWSTATE`)
- **Key per field**: `name` → `id` → `field_<index>`

### Per-Type Handling
| Type | Save | Restore |
|------|------|---------|
| text / email / tel / number / date / textarea / select | `.value` | set `.value` + fire `input`+`change` |
| checkbox | `.checked` | set `.checked` + fire `change` |
| radio | save `radio__<name>: value` if checked | find by name+value, set `.checked` + fire `change` |

### Events
After restoring each field, fires both `input` and `change` events with `bubbles: true` — needed for ASP.NET validators and dynamic dropdowns to react.

### UI
- Fixed panel, bottom-right, `z-index: 999999`
- Buttons: Save (blue), Restore (green), Clear (red)
- Status line below buttons shows feedback (e.g. "Saved 24 fields")

---

## How to Modify

**Change the target URL** → update `@match` in the metadata block  
**Change storage backend** → replace `GM_setValue`/`GM_getValue` calls in `saveForm()` and `restoreForm()` (e.g. swap for a `fetch` to a local server)  
**Change UI position** → edit `bottom`/`right` in `buildUI()`  
**Add more skipped field types** → add to the `SKIP_TYPES` Set  

---

## Future Ideas

- Support multiple saved profiles (e.g. save different applicants)
- Export saved data as a downloadable JSON file via `GM_download`
- Make it work on any government form site (change `@match` to `*://*/*` and toggle panel with a keyboard shortcut)
