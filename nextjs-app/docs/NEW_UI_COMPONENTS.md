# New UI Components Documentation

**Date**: 2025-10-15
**Version**: 2.3.0
**Status**: Ready for Integration

## Overview

Four new production-ready UI components have been implemented to enhance the user experience in Phase 4:

1. **SearchBar** - Enhanced search with debouncing and fuzzy matching
2. **FilterPanel** - Advanced filtering with visual chips
3. **PasswordHealthCard** - Visual password health metrics
4. **ImportExportPanel** - Comprehensive import/export interface

All components are fully typed, accessible, and mobile-responsive.

---

## SearchBar Component

**Location**: `components/features/SearchBar.tsx`

### Features

- ✅ Real-time search with configurable debouncing (default 300ms)
- ✅ Fuzzy search indicator
- ✅ Clear button with keyboard support (ESC key)
- ✅ Responsive design with iOS zoom prevention
- ✅ Accessible (ARIA labels)

### Usage

```typescript
import { SearchBar } from '@/components/features/SearchBar';

function MyComponent() {
  const [query, setQuery] = useState('');

  return (
    <SearchBar
      value={query}
      onChange={setQuery}
      placeholder="Search passwords..."
      debounceMs={300}
      showFuzzyIndicator={true}
    />
  );
}
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | string | required | Current search value |
| `onChange` | (value: string) => void | required | Callback when search changes |
| `onClear` | () => void | optional | Callback when cleared |
| `placeholder` | string | "Search passwords..." | Input placeholder |
| `debounceMs` | number | 300 | Debounce delay in milliseconds |
| `showFuzzyIndicator` | boolean | true | Show fuzzy search hint |
| `disabled` | boolean | false | Disable the input |
| `className` | string | "" | Additional CSS classes |

### Keyboard Shortcuts

- **ESC**: Clear search

---

## FilterPanel Component

**Location**: `components/features/FilterPanel.tsx`

### Features

- ✅ Entry type filtering (Login, Credit Card, etc.)
- ✅ Category filtering with counts
- ✅ Quick filters (Favorites, Archived, Old Passwords)
- ✅ Active filter count badge
- ✅ Clear all filters button
- ✅ Collapsible panel
- ✅ Visual filter chips

### Usage

```typescript
import { FilterPanel } from '@/components/features/FilterPanel';
import { PasswordEntryType } from '@/sdk/src/types-v2';

function MyComponent() {
  const [selectedTypes, setSelectedTypes] = useState<PasswordEntryType[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<number[]>([]);
  const [showFavorites, setShowFavorites] = useState<boolean | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [showOldPasswords, setShowOldPasswords] = useState(false);

  const categories = [
    { id: 1, name: 'Work', count: 12 },
    { id: 2, name: 'Personal', count: 8 },
  ];

  return (
    <FilterPanel
      selectedTypes={selectedTypes}
      onTypesChange={setSelectedTypes}
      selectedCategories={selectedCategories}
      onCategoriesChange={setSelectedCategories}
      categories={categories}
      showFavorites={showFavorites}
      onShowFavoritesChange={setShowFavorites}
      showArchived={showArchived}
      onShowArchivedChange={setShowArchived}
      showOldPasswords={showOldPasswords}
      onShowOldPasswordsChange={setShowOldPasswords}
      onClearAll={() => {
        setSelectedTypes([]);
        setSelectedCategories([]);
        setShowFavorites(null);
        setShowArchived(false);
        setShowOldPasswords(false);
      }}
    />
  );
}
```

### Props

| Prop | Type | Description |
|------|------|-------------|
| `selectedTypes` | PasswordEntryType[] | Currently selected entry types |
| `onTypesChange` | (types: PasswordEntryType[]) => void | Type selection callback |
| `selectedCategories` | number[] | Currently selected category IDs |
| `onCategoriesChange` | (categories: number[]) => void | Category selection callback |
| `categories` | Array<{id, name, count?}> | Available categories |
| `showFavorites` | boolean \| null | Favorites filter state |
| `onShowFavoritesChange` | (show: boolean \| null) => void | Favorites toggle callback |
| `showArchived` | boolean | Show archived items |
| `onShowArchivedChange` | (show: boolean) => void | Archived toggle callback |
| `showOldPasswords` | boolean | Show old passwords (>90 days) |
| `onShowOldPasswordsChange` | (show: boolean) => void | Old passwords toggle callback |
| `onClearAll` | () => void | Clear all filters callback |
| `className` | string | Additional CSS classes |

---

## PasswordHealthCard Component

**Location**: `components/features/PasswordHealthCard.tsx`

### Features

- ✅ Visual strength indicator with color coding
- ✅ Progress bar (0-100% strength)
- ✅ Entropy display
- ✅ Warning badges (Common, Reused, Old)
- ✅ Actionable recommendations
- ✅ Compact mode for lists
- ✅ Clickable for navigation

### Usage

```typescript
import { PasswordHealthCard } from '@/components/features/PasswordHealthCard';
import { analyzePasswordHealth } from '@/lib/password-health-analyzer';

function MyComponent() {
  const entry = /* ... password entry ... */;
  const passwordMap = /* ... password reuse map ... */;
  const health = analyzePasswordHealth(entry, passwordMap);

  return (
    <PasswordHealthCard
      title={entry.title}
      health={health}
      onClick={() => console.log('View details')}
      compact={false}
    />
  );
}
```

### Props

| Prop | Type | Description |
|------|------|-------------|
| `title` | string | Password entry title |
| `health` | PasswordHealth | Health analysis object |
| `onClick` | () => void | Optional click handler |
| `className` | string | Additional CSS classes |
| `compact` | boolean | Show compact version (limits recommendations to 3) |

### Strength Color Coding

| Strength | Color | Background |
|----------|-------|------------|
| Very Weak | Red (#991b1b) | #fef2f2 |
| Weak | Orange (#92400e) | #fef3c7 |
| Fair | Blue (#1e40af) | #dbeafe |
| Strong | Green (#065f46) | #d1fae5 |
| Very Strong | Dark Green (#065f46) | #d1fae5 |

---

## ImportExportPanel Component

**Location**: `components/features/ImportExportPanel.tsx`

### Features

- ✅ Multi-format import support
  - Lockbox JSON (native)
  - LastPass CSV
  - 1Password CSV
  - Bitwarden CSV
  - Generic CSV
- ✅ Auto-format detection
- ✅ Import preview (first 5 entries)
- ✅ Error reporting
- ✅ Export options (JSON/CSV)
- ✅ Filter before export
- ✅ Security warnings

### Usage

```typescript
import { ImportExportPanel } from '@/components/features/ImportExportPanel';
import { PasswordEntry } from '@/sdk/src/types-v2';

function MyComponent() {
  const entries: PasswordEntry[] = /* ... your entries ... */;

  const handleImport = async (newEntries: PasswordEntry[]) => {
    // Process imported entries
    for (const entry of newEntries) {
      await createEntry(entry);
    }
  };

  return (
    <ImportExportPanel
      entries={entries}
      onImport={handleImport}
    />
  );
}
```

### Props

| Prop | Type | Description |
|------|------|-------------|
| `entries` | PasswordEntry[] | Current password entries for export |
| `onImport` | (entries: PasswordEntry[]) => Promise<void> | Import callback |
| `className` | string | Additional CSS classes |

### Supported Import Formats

1. **Lockbox JSON**: Native format with full metadata
2. **LastPass CSV**: Compatible with LastPass exports
3. **1Password CSV**: Compatible with 1Password exports
4. **Bitwarden CSV**: Compatible with Bitwarden exports
5. **Generic CSV**: Standard CSV with customizable mapping

### Export Options

- **Format**: JSON (full metadata) or CSV (spreadsheet compatible)
- **Include Archived**: Toggle to include/exclude archived entries
- **Future**: Category filtering, date range, favorites only

---

## Integration Guide

### Step 1: Replace Basic Search

**Before** (in PasswordManager.tsx):
```typescript
<input
  type="text"
  placeholder="Search passwords..."
  value={searchQuery}
  onChange={(e) => setSearchQuery(e.target.value)}
/>
```

**After**:
```typescript
import { SearchBar } from './SearchBar';

<SearchBar
  value={searchQuery}
  onChange={setSearchQuery}
  showFuzzyIndicator={true}
/>
```

### Step 2: Add FilterPanel

```typescript
import { FilterPanel } from './FilterPanel';

// Add state
const [selectedTypes, setSelectedTypes] = useState<PasswordEntryType[]>([]);
const [selectedCategories, setSelectedCategories] = useState<number[]>([]);
const [showFavorites, setShowFavorites] = useState<boolean | null>(null);
const [showArchived, setShowArchived] = useState(false);
const [showOldPasswords, setShowOldPasswords] = useState(false);

// Add to UI
<FilterPanel
  selectedTypes={selectedTypes}
  onTypesChange={setSelectedTypes}
  selectedCategories={selectedCategories}
  onCategoriesChange={setSelectedCategories}
  categories={categories}
  showFavorites={showFavorites}
  onShowFavoritesChange={setShowFavorites}
  showArchived={showArchived}
  onShowArchivedChange={setShowArchived}
  showOldPasswords={showOldPasswords}
  onShowOldPasswordsChange={setShowOldPasswords}
  onClearAll={() => {
    setSelectedTypes([]);
    setSelectedCategories([]);
    setShowFavorites(null);
    setShowArchived(false);
    setShowOldPasswords(false);
  }}
/>

// Update filteredEntries logic
const filteredEntries = useMemo(() => {
  let result = entries;

  // Apply type filter
  if (selectedTypes.length > 0) {
    result = result.filter(e => selectedTypes.includes(e.type));
  }

  // Apply category filter
  if (selectedCategories.length > 0) {
    result = result.filter(e => e.category && selectedCategories.includes(e.category));
  }

  // Apply favorites filter
  if (showFavorites === true) {
    result = result.filter(e => e.favorite);
  }

  // Apply archived filter
  if (!showArchived) {
    result = result.filter(e => !e.archived);
  }

  // Apply old passwords filter
  if (showOldPasswords) {
    result = result.filter(e => {
      if (!e.lastModified) return false;
      const age = (Date.now() - e.lastModified.getTime()) / (1000 * 60 * 60 * 24);
      return age > 90;
    });
  }

  // ... existing search and sort logic
  return result;
}, [entries, selectedTypes, selectedCategories, showFavorites, showArchived, showOldPasswords, searchQuery]);
```

### Step 3: Use PasswordHealthCard in Health Dashboard

```typescript
import { PasswordHealthCard } from './PasswordHealthCard';

// In HealthDashboardModal or similar
{weakPasswords.map(entry => {
  const health = analyzePasswordHealth(entry, passwordMap);
  return (
    <PasswordHealthCard
      key={entry.id}
      title={entry.title}
      health={health}
      onClick={() => openPasswordDetails(entry)}
      compact={true}
    />
  );
})}
```

### Step 4: Add Import/Export to Settings

```typescript
import { ImportExportPanel } from './ImportExportPanel';

<ImportExportPanel
  entries={entries}
  onImport={async (newEntries) => {
    for (const entry of newEntries) {
      await createEntry(entry);
    }
    toast.success(`Imported ${newEntries.length} entries`);
    refreshEntries();
  }}
/>
```

---

## Styling Notes

All components use:
- **CSS-in-JS** with `<style jsx>` for scoped styles
- **Consistent color palette** (Tailwind-inspired)
- **Mobile-first responsive design**
- **Smooth transitions** (0.2s default)
- **Accessible focus states**

### Color Palette

- Primary: `#667eea` (purple-blue)
- Success: `#10b981` (green)
- Warning: `#f59e0b` (orange)
- Error: `#dc2626` (red)
- Neutral: `#6b7280` (gray)

---

## Accessibility

All components follow WCAG 2.1 AA standards:

- ✅ Keyboard navigation support
- ✅ ARIA labels and roles
- ✅ Focus indicators
- ✅ Color contrast ratios > 4.5:1
- ✅ Screen reader announcements
- ✅ No color-only information

---

## Testing Recommendations

### Unit Tests

```typescript
// SearchBar.test.tsx
describe('SearchBar', () => {
  it('should debounce onChange calls', async () => {
    const onChange = jest.fn();
    const { getByRole } = render(<SearchBar value="" onChange={onChange} />);

    const input = getByRole('textbox');
    fireEvent.change(input, { target: { value: 'test' } });

    expect(onChange).not.toHaveBeenCalled();
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('test'), { timeout: 400 });
  });
});
```

### Integration Tests

Test with actual PasswordManager component to ensure:
1. Filters update the entry list correctly
2. Search works with fuzzy matching
3. Import/export round-trip maintains data integrity
4. Health cards display accurate information

---

## Performance Considerations

- **SearchBar**: Debouncing prevents excessive re-renders
- **FilterPanel**: Uses controlled components to minimize state updates
- **PasswordHealthCard**: Memoize health calculations in parent
- **ImportExportPanel**: File reading is async, doesn't block UI

---

## Future Enhancements

1. **SearchBar**:
   - Search history dropdown
   - Suggested searches
   - Advanced query syntax (AND/OR operators)

2. **FilterPanel**:
   - Save filter presets
   - Quick filter templates
   - Filter by password strength

3. **PasswordHealthCard**:
   - Interactive strength meter
   - Clickable recommendations
   - Compare passwords feature

4. **ImportExportPanel**:
   - Scheduled exports
   - Cloud backup integration
   - Conflict resolution UI

---

## Support

For questions or issues with these components:
1. Check component prop types in TypeScript
2. Review this documentation
3. Examine existing usage in PasswordManager.tsx
4. Consult the main README.md for project context

---

**Last Updated**: 2025-10-15
**Maintainer**: Development Team
**Status**: Production Ready ✅
