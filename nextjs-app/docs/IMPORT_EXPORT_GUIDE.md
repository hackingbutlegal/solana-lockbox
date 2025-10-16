# Import/Export Guide

**Last Updated:** October 15, 2025
**Version:** v2.2.1

---

## Overview

Solana Lockbox supports importing passwords from popular password managers and exporting your data for backup or migration. This feature is accessible through the **Settings modal** (⚙️ Settings button in the sidebar).

---

## Supported Formats

### Import Formats

1. **Lockbox JSON** (Native format)
2. **LastPass CSV** (.csv export from LastPass)
3. **1Password CSV** (.csv export from 1Password)
4. **Bitwarden JSON** (.json export from Bitwarden)
5. **Generic CSV** (Custom CSV mapping)

### Export Formats

1. **JSON** - Full-fidelity export with all fields and metadata
2. **CSV** - Spreadsheet-compatible export

---

## How to Import Passwords

### Step 1: Access Settings

1. Open the **Lockbox Password Manager**
2. Click **⚙️ Settings** in the left sidebar
3. Navigate to the **Import/Export** tab (default tab)

### Step 2: Select Import Format

In the Import section:

1. Choose your password manager from the dropdown:
   - Lockbox JSON
   - LastPass CSV
   - 1Password CSV
   - Bitwarden JSON
   - Generic CSV

2. The format is **auto-detected** when you upload a file

### Step 3: Upload File

1. Click **Choose File** or drag-and-drop your export file
2. Supported file types: `.json`, `.csv`
3. The system will automatically detect the format

### Step 4: Preview Import

After uploading:

1. **Preview** shows the first 5 entries that will be imported
2. **Count** displays total entries detected
3. **Errors** section shows any parsing issues (if any)

Example preview:
```
✓ Found 127 password entries
Preview (first 5):
  1. GitHub Account (Login)
  2. Gmail (Login)
  3. Netflix (Login)
  4. Bank Account (Login)
  5. WiFi Password (Secure Note)
```

### Step 5: Confirm Import

1. Click **Import Passwords**
2. **Confirmation dialog** appears: "Import 127 password(s)?"
3. Click **Import All** to proceed

### Step 6: Monitor Progress

The **Batch Progress Modal** appears showing:
- **Progress bar** (0-100%)
- **Successful** count (green)
- **Remaining** count (blue)
- **Failed** count (red)
- **Current entry** being processed

Example:
```
Import Passwords
━━━━━━━━━━━━━━━━━━━━━━━━━ 65%

✓ Successful: 83
⏳ Remaining: 44
✗ Failed: 0

Processing entry 84...
```

### Step 7: Review Results

Completion message shows final results:
- **Success:** "Successfully imported 127 password(s)!"
- **Partial failure:** "Imported 120 password(s), 7 failed"

Failed entries are logged to the browser console for debugging.

---

## Format-Specific Import Guides

### From LastPass

1. **Export from LastPass:**
   - Log in to LastPass web vault
   - Click **Advanced Options** → **Export**
   - Save as `.csv` file

2. **Import to Lockbox:**
   - Select **LastPass CSV** format
   - Upload the CSV file
   - Review preview
   - Click **Import Passwords**

**Mapped Fields:**
- `url` → URL
- `username` → Username
- `password` → Password
- `extra` → Notes
- `name` → Title
- `grouping` → Category (if exists)
- `fav` → Favorite

### From 1Password

1. **Export from 1Password:**
   - Open 1Password app
   - File → Export → All Items
   - Choose **CSV** format
   - Save the file

2. **Import to Lockbox:**
   - Select **1Password CSV** format
   - Upload the CSV file
   - Review preview
   - Click **Import Passwords**

**Mapped Fields:**
- `url` → URL
- `username` → Username
- `password` → Password
- `notes` → Notes
- `title` → Title
- `type` → Entry Type

### From Bitwarden

1. **Export from Bitwarden:**
   - Open Bitwarden web vault
   - Settings → Export Vault
   - Choose **JSON** format (recommended) or CSV
   - Download the file

2. **Import to Lockbox:**
   - Select **Bitwarden JSON** format
   - Upload the JSON file
   - Review preview
   - Click **Import Passwords**

**Mapped Fields:**
- `login.uris[0].uri` → URL
- `login.username` → Username
- `login.password` → Password
- `notes` → Notes
- `name` → Title
- `favorite` → Favorite

### Generic CSV Format

For custom CSV files, use this format:

```csv
title,username,password,url,notes
"GitHub Account","myusername","mypassword123","https://github.com","Two-factor enabled"
"Gmail","user@example.com","pass456","https://gmail.com","Primary email"
```

**Required Fields:**
- `title` - Entry name
- `username` or `password` - At least one must be present

**Optional Fields:**
- `url` - Website URL
- `notes` - Additional information
- `favorite` - "true" or "false"
- `category` - Category name

---

## How to Export Passwords

### Export All Passwords

1. Open **⚙️ Settings** → **Import/Export** tab
2. In the **Export** section, choose format:
   - **JSON** (recommended) - Full-fidelity export
   - **CSV** - Spreadsheet-compatible

3. Click **Export to JSON** or **Export to CSV**
4. File downloads automatically: `lockbox-export-YYYY-MM-DD.json`

### Export Selected Passwords

1. In the main password list, **select multiple entries** (checkbox)
2. **BatchOperationsToolbar** appears at bottom
3. Click **Export** button
4. Selected entries download as JSON

---

## Export Formats

### JSON Format

Full-fidelity export with all fields and metadata:

```json
[
  {
    "id": 1,
    "type": "Login",
    "title": "GitHub Account",
    "username": "myusername",
    "password": "mypassword123",
    "url": "https://github.com",
    "notes": "Two-factor enabled",
    "favorite": false,
    "archived": false,
    "category": 1,
    "createdAt": "2025-10-01T10:00:00.000Z",
    "lastModified": "2025-10-15T14:30:00.000Z",
    "totpSecret": null
  }
]
```

**Includes:**
- All entry types (Login, Secure Note, Credit Card, etc.)
- Metadata (created date, last modified, favorite, archived)
- Category assignments
- TOTP secrets (if any)

### CSV Format

Spreadsheet-compatible export:

```csv
title,type,username,password,url,notes,favorite,category,created_at,last_modified
"GitHub Account","Login","myusername","mypassword123","https://github.com","Two-factor enabled",false,1,"2025-10-01T10:00:00.000Z","2025-10-15T14:30:00.000Z"
```

**Fields:**
- title, type, username, password, url, notes
- favorite (true/false)
- category (category ID)
- created_at, last_modified (ISO 8601 format)

---

## Security Considerations

### Before Exporting

⚠️ **IMPORTANT:** Exported files contain **unencrypted passwords**!

1. **Secure Storage:** Store export files in encrypted volumes (e.g., VeraCrypt, BitLocker)
2. **Temporary Files:** Delete export files immediately after use
3. **Transmission:** Never email or upload exports to untrusted services
4. **Local Only:** Keep exports on local, trusted devices only

### After Exporting

1. **Verify Export:** Check file contents before deleting original data
2. **Secure Deletion:** Use secure delete tools (e.g., `shred` on Linux, `srm` on macOS)
3. **Clear Clipboard:** Clear clipboard after copying sensitive data
4. **Browser History:** Clear browser downloads history

### During Import

1. **Verify Source:** Only import from trusted, official password manager exports
2. **Check Preview:** Review the preview to ensure correct parsing
3. **Monitor Progress:** Watch for failed imports (may indicate malformed data)
4. **Verify Import:** After import, spot-check a few entries for accuracy

---

## Import Performance

### Estimated Times

| Entries | Time     | Notes                           |
|---------|----------|---------------------------------|
| 10      | ~5s      | Quick import                    |
| 50      | ~25s     | Shows progress modal            |
| 100     | ~50s     | Progress bar visible            |
| 500     | ~4m 10s  | Sequential processing           |
| 1000    | ~8m 20s  | Recommended to do off-peak      |

**Why So Slow?**
- Each entry requires a **blockchain transaction**
- 500ms delay between transactions to avoid nonce conflicts
- Solana Devnet RPC rate limits

**Tips for Large Imports:**
- Import during off-peak hours
- Ensure stable internet connection
- Don't close the browser tab during import
- Progress is saved incrementally (partial imports are OK)

---

## Troubleshooting

### Import Errors

#### "Failed to parse file"

**Cause:** File format not recognized or corrupted

**Solutions:**
1. Verify file format matches selected import type
2. Open file in text editor to check for corruption
3. Re-export from source password manager
4. Try **auto-detect** by not selecting a format

#### "No entries found"

**Cause:** File is empty or wrong format selected

**Solutions:**
1. Check file has content (open in text/spreadsheet editor)
2. Verify correct format selected (or use auto-detect)
3. Check if file is from correct password manager export

#### "X entries failed to import"

**Cause:** Malformed data or RPC issues

**Solutions:**
1. Check browser console for specific errors
2. Retry failed entries manually
3. Check Solana Devnet RPC status
4. Try importing smaller batches

### Export Errors

#### "Export file is empty"

**Cause:** No entries match export criteria

**Solutions:**
1. Verify you have entries in your vault
2. Check filters (archived entries may be hidden)
3. Try exporting selected entries instead

### Performance Issues

#### "Import is very slow"

**Cause:** Sequential blockchain transactions + rate limits

**Solutions:**
1. **Expected behavior** - 500ms per entry
2. Ensure stable internet connection
3. Don't close browser during import
4. Consider importing in smaller batches

#### "Import froze at X%"

**Cause:** RPC timeout or network issue

**Solutions:**
1. Check browser console for errors
2. Check Solana Devnet status
3. Refresh page and retry from beginning
4. Try different time of day (less network congestion)

---

## Best Practices

### Import Workflow

1. **Backup first:** Export from old password manager
2. **Test import:** Try importing 5-10 entries first
3. **Verify:** Check imported entries are correct
4. **Full import:** Import all entries
5. **Spot check:** Verify random sample of imports
6. **Cleanup:** Securely delete export files

### Export Workflow

1. **Choose format:** JSON for Lockbox backup, CSV for spreadsheet
2. **Export all:** Get complete backup
3. **Verify:** Open file to confirm all entries present
4. **Secure storage:** Store in encrypted volume
5. **Regular backups:** Export weekly or after major changes

### Migration Checklist

Migrating from another password manager:

- [ ] Export passwords from old manager
- [ ] Test import with 5-10 entries
- [ ] Verify test entries imported correctly
- [ ] Import all passwords
- [ ] Spot-check random entries for accuracy
- [ ] Verify TOTP codes work (if applicable)
- [ ] Test autofill/copy-paste workflows
- [ ] Update master password (optional)
- [ ] Securely delete export files
- [ ] Keep old manager for 30 days (backup)

---

## Advanced Usage

### Batch Editing via CSV

You can export to CSV, edit in spreadsheet software, and re-import:

1. Export to CSV
2. Edit in Excel/Google Sheets/LibreOffice
3. Save as CSV
4. Import as Generic CSV
5. Review preview carefully
6. Import

**Use Cases:**
- Bulk category assignment
- Batch URL updates
- Mass password policy enforcement

**Warnings:**
- This creates **new entries**, doesn't update existing ones
- You'll need to manually delete old entries
- Test with a few entries first

### Programmatic Export

For advanced users, you can use the export functions directly:

```typescript
import { exportToJSON, exportToCSV } from '../lib/import-export';

// Export all entries to JSON
const jsonData = exportToJSON(allEntries);

// Export with options
const csvData = exportToCSV(filteredEntries, {
  format: 'csv',
  includeArchived: false,
  includeDeleted: false,
});
```

---

## Limitations

### Current Limitations

1. **No Automatic Sync:** Imports don't sync with other devices automatically
2. **No Duplicate Detection:** Re-importing creates duplicate entries
3. **No Incremental Updates:** Can't update existing entries via import
4. **No Folder Mapping:** Categories must be created manually first
5. **Sequential Only:** Can't batch transactions (yet - planned for v2.4.0)

### Planned Improvements (v2.3.0+)

- Duplicate detection during import
- Incremental update mode (update existing entries)
- Category auto-creation from folder names
- Faster batch imports (multi-instruction transactions)
- Import history and rollback
- Selective import (choose which entries to import)

---

## Summary

**Import:**
1. ⚙️ Settings → Import/Export tab
2. Choose format (or auto-detect)
3. Upload file
4. Review preview
5. Click Import → Monitor progress

**Export:**
1. ⚙️ Settings → Import/Export tab (or select entries)
2. Choose JSON or CSV
3. Click Export
4. Securely store file

**Security:**
- ⚠️ Export files contain unencrypted passwords
- Store in encrypted volumes only
- Delete immediately after use
- Never upload to untrusted services

**Performance:**
- ~2 seconds per entry import (500ms transaction delay)
- 100 entries ≈ 50 seconds
- Progress modal shows real-time status
- Partial imports are saved

---

**Need Help?**
- 📚 [Full Documentation](https://github.com/hackingbutlegal/solana-lockbox)
- 🐛 [Report Issues](https://github.com/hackingbutlegal/solana-lockbox/issues)
- 💬 [Community Support](https://github.com/hackingbutlegal/solana-lockbox/discussions)

**Last Updated:** October 15, 2025
**Version:** v2.2.1
