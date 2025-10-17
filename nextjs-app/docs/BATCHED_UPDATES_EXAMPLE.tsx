/**
 * Example: Using Batched Updates in a Password Manager Component
 * 
 * This example shows how to integrate the batched updates system
 * into an existing password management interface.
 */

'use client';

import React, { useState } from 'react';
import { usePassword } from '../contexts/PasswordContext';
import { PendingChangesBar } from '../components/ui/PendingChangesBar';
import { PasswordEntry, PasswordEntryType } from '../sdk/src/types-v2';

export default function PasswordManagerExample() {
  const {
    entries,
    queueUpdate,
    queueDelete,
    hasPendingChanges,
    pendingStats,
  } = usePassword();

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<any>({});

  // ============================================================================
  // EDIT HANDLERS (using batched operations)
  // ============================================================================

  const handleStartEdit = (entry: PasswordEntry) => {
    setEditingId(entry.id ?? null);
    setEditForm({
      title: entry.title,
      username: entry.type === PasswordEntryType.Login ? entry.username : '',
      password: entry.type === PasswordEntryType.Login ? entry.password : '',
      url: entry.type === PasswordEntryType.Login ? entry.url : undefined,
      notes: entry.notes,
    });
  };

  const handleSaveEdit = (entry: PasswordEntry) => {
    if (!entry.id) {
      console.error('Cannot update entry without id');
      return;
    }

    const updatedEntry = {
      ...entry,
      title: editForm.title || entry.title,
      notes: editForm.notes,
      lastModified: new Date(),
    } as PasswordEntry;

    // Queue update (instant UI update, no blockchain wait)
    queueUpdate(0, entry.id, updatedEntry);

    // Clear edit state
    setEditingId(null);
    setEditForm({});

    // Note: Changes are NOT sent to blockchain yet
    // User will sync via PendingChangesBar
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleDelete = (entry: PasswordEntry) => {
    if (!entry.id) {
      console.error('Cannot delete entry without id');
      return;
    }

    // Confirm before queueing delete
    if (confirm(`Delete "${entry.title}"? Changes will be synced later.`)) {
      queueDelete(0, entry.id);
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header with pending changes indicator */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Password Manager</h1>
        
        {hasPendingChanges && (
          <div className="flex items-center gap-2 px-3 py-1 bg-yellow-100 rounded-md">
            <span className="text-sm text-yellow-900">
              {pendingStats.total} unsaved {pendingStats.total === 1 ? 'change' : 'changes'}
            </span>
          </div>
        )}
      </div>

      {/* Password entries list */}
      <div className="space-y-4">
        {entries.map(entry => (
          <div
            key={entry.id}
            className="p-4 bg-white border rounded-lg shadow-sm"
          >
            {editingId === entry.id ? (
              // EDIT MODE
              <div className="space-y-3">
                <input
                  type="text"
                  value={editForm.title || ''}
                  onChange={e => setEditForm({ ...editForm, title: e.target.value })}
                  placeholder="Title"
                  className="w-full px-3 py-2 border rounded"
                />
                
                {entry.type === PasswordEntryType.Login && (
                  <>
                    <input
                      type="text"
                      value={editForm.username || ''}
                      onChange={e => setEditForm({ ...editForm, username: e.target.value })}
                      placeholder="Username"
                      className="w-full px-3 py-2 border rounded"
                    />
                    
                    <input
                      type="password"
                      value={editForm.password || ''}
                      onChange={e => setEditForm({ ...editForm, password: e.target.value })}
                      placeholder="Password"
                      className="w-full px-3 py-2 border rounded"
                    />
                  </>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => handleSaveEdit(entry)}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Save (Queue)
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              // VIEW MODE
              <div>
                <h3 className="font-semibold text-lg">{entry.title}</h3>
                
                {entry.type === PasswordEntryType.Login && (
                  <p className="text-sm text-gray-600">
                    Username: {entry.username}
                  </p>
                )}

                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => handleStartEdit(entry)}
                    className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(entry)}
                    className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Pending changes bar (fixed at bottom) */}
      <PendingChangesBar position="bottom" />
    </div>
  );
}

// ============================================================================
// USAGE NOTES
// ============================================================================

/*

KEY DIFFERENCES FROM IMMEDIATE UPDATES:

1. NO LOADING STATES
   - Before: await updateEntry() with setLoading(true)
   - After: queueUpdate() - instant, no loading

2. NO AWAIT
   - Before: await updateEntry(...)
   - After: queueUpdate(...) - synchronous

3. BATCH SYNC
   - User makes multiple edits
   - Clicks "Sync to Blockchain" once
   - All changes sent together

4. OPTIMISTIC UI
   - Changes appear instantly
   - Even before blockchain confirmation
   - Can be reverted via "Discard"

5. PENDING CHANGES BAR
   - Shows count of unsaved changes
   - Provides sync/discard buttons
   - Auto-hides when no pending changes

MIGRATION CHECKLIST:
☑ Replace updateEntry() with queueUpdate()
☑ Replace deleteEntry() with queueDelete()
☑ Remove loading states from edit handlers
☑ Remove await from update/delete calls
☑ Add PendingChangesBar to layout
☑ Update user messaging ("queued" vs "saved")

*/
