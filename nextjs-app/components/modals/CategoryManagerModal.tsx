'use client';

import React, { useState, useMemo } from 'react';
import { CategoryManager, type Category } from '../../lib/category-manager';
import { useToast } from '../ui/Toast';
import { useConfirm } from '../ui/ConfirmDialog';

interface CategoryManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  onCreateCategory?: (name: string, icon: number, color: number, parentId: number | null) => Promise<void>;
  onUpdateCategory?: (id: number, name: string, icon: number, color: number) => Promise<void>;
  onDeleteCategory?: (id: number) => Promise<void>;
}

const ICON_PRESETS = [
  { code: 0, label: '👤 Personal' },
  { code: 1, label: '💼 Work' },
  { code: 2, label: '💰 Financial' },
  { code: 3, label: '🎮 Gaming' },
  { code: 4, label: '🛒 Shopping' },
  { code: 5, label: '📱 Social' },
  { code: 6, label: '🏥 Health' },
  { code: 7, label: '🎓 Education' },
  { code: 8, label: '✈️ Travel' },
  { code: 9, label: '🏠 Home' },
  { code: 10, label: '🎵 Entertainment' },
  { code: 11, label: '⚙️ System' },
];

export function CategoryManagerModal({
  isOpen,
  onClose,
  categories,
  onCreateCategory,
  onUpdateCategory,
  onDeleteCategory,
}: CategoryManagerModalProps) {
  const toast = useToast();
  const { confirm } = useConfirm();
  const [activeTab, setActiveTab] = useState<'categories' | 'templates'>('categories');
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    icon: 0,
    color: 1,
    parentId: null as number | null,
  });

  type CategoryWithChildren = Category & { children: CategoryWithChildren[] };

  const hierarchy = useMemo<CategoryWithChildren[]>(() => {
    return CategoryManager.buildHierarchy(categories) as CategoryWithChildren[];
  }, [categories]);

  const handleCreateTemplate = async (template: typeof CategoryManager.DEFAULT_TEMPLATES[0]) => {
    if (!onCreateCategory) return;
    try {
      await onCreateCategory(template.name, template.icon, template.color, null);
      toast.showSuccess(`Created category: ${template.name}`);
    } catch (error) {
      console.error('Failed to create category:', error);
      toast.showError('Failed to create category');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.showWarning('Category name is required');
      return;
    }

    try {
      if (editingCategory && onUpdateCategory) {
        await onUpdateCategory(editingCategory.id, formData.name, formData.icon, formData.color);
        toast.showSuccess('Category updated successfully');
      } else if (isCreating && onCreateCategory) {
        await onCreateCategory(formData.name, formData.icon, formData.color, formData.parentId);
        toast.showSuccess('Category created successfully');
      }
      handleCancelEdit();
    } catch (error) {
      console.error('Failed to save category:', error);
      toast.showError('Failed to save category');
    }
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setIsCreating(false);
    setFormData({
      name: category.name,
      icon: category.icon,
      color: category.color,
      parentId: category.parentId,
    });
  };

  const handleDelete = async (category: Category) => {
    if (category.entryCount > 0) {
      toast.showWarning(`Cannot delete category with ${category.entryCount} entries. Remove entries first.`);
      return;
    }

    const confirmed = await confirm({
      title: 'Delete Category',
      message: `Delete category "${category.name}"?`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      danger: true
    });

    if (!confirmed) return;

    try {
      if (onDeleteCategory) {
        await onDeleteCategory(category.id);
        toast.showSuccess('Category deleted successfully');
      }
    } catch (error) {
      console.error('Failed to delete category:', error);
      toast.showError('Failed to delete category');
    }
  };

  const handleStartCreate = () => {
    setIsCreating(true);
    setEditingCategory(null);
    setFormData({
      name: '',
      icon: 0,
      color: 1,
      parentId: null,
    });
  };

  const handleCancelEdit = () => {
    setIsCreating(false);
    setEditingCategory(null);
    setFormData({
      name: '',
      icon: 0,
      color: 1,
      parentId: null,
    });
  };

  const getColorValue = (colorCode: number): string => {
    return CategoryManager.COLOR_PALETTE[colorCode] || '#6B7280';
  };

  const renderCategoryTree = (
    items: CategoryWithChildren[],
    depth: number = 0
  ) => {
    return items.map((category) => (
      <div key={category.id} style={{ marginLeft: depth > 0 ? '2rem' : '0' }}>
        <div className="category-item">
          <div className="category-info">
            <div
              className="category-icon"
              style={{ background: getColorValue(category.color) }}
            >
              {ICON_PRESETS.find((p) => p.code === category.icon)?.label.split(' ')[0] || '📁'}
            </div>
            <div className="category-details">
              <div className="category-name">{category.name}</div>
              <div className="category-meta">
                {category.entryCount} {category.entryCount === 1 ? 'entry' : 'entries'}
              </div>
            </div>
          </div>
          <div className="category-actions">
            <button
              className="btn-icon-small"
              onClick={() => handleEdit(category)}
              title="Edit"
            >
              ✏️
            </button>
            <button
              className="btn-icon-small"
              onClick={() => handleDelete(category)}
              title="Delete"
              disabled={category.entryCount > 0}
            >
              🗑️
            </button>
          </div>
        </div>
        {category.children.length > 0 && renderCategoryTree(category.children, depth + 1)}
      </div>
    ));
  };

  if (!isOpen) return null;

  return (
    <div className="category-manager-modal-overlay" onClick={onClose}>
      <div className="category-manager-modal-content category-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Category Manager</h2>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="tabs">
          <button
            className={`tab ${activeTab === 'categories' ? 'active' : ''}`}
            onClick={() => setActiveTab('categories')}
          >
            📂 My Categories ({categories.length})
          </button>
          <button
            className={`tab ${activeTab === 'templates' ? 'active' : ''}`}
            onClick={() => setActiveTab('templates')}
          >
            ✨ Templates
          </button>
        </div>

        <div className="modal-body">
          {activeTab === 'categories' && (
            <>
              {/* Create/Edit Form */}
              {(isCreating || editingCategory) && (
                <form onSubmit={handleSubmit} className="category-form">
                  <div className="form-header">
                    <h3>{editingCategory ? 'Edit Category' : 'Create Category'}</h3>
                    <button type="button" onClick={handleCancelEdit} className="btn-cancel-inline">
                      ✕
                    </button>
                  </div>

                  <div className="form-group">
                    <label>Category Name</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g., Personal, Work, Financial"
                      required
                      maxLength={32}
                    />
                  </div>

                  <div className="form-group">
                    <label>Icon</label>
                    <div className="icon-grid">
                      {ICON_PRESETS.map((preset) => (
                        <button
                          key={preset.code}
                          type="button"
                          className={`icon-option ${formData.icon === preset.code ? 'selected' : ''}`}
                          onClick={() => setFormData({ ...formData, icon: preset.code })}
                          title={preset.label}
                        >
                          {preset.label.split(' ')[0]}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Color</label>
                    <div className="color-grid">
                      {Object.entries(CategoryManager.COLOR_PALETTE).map(([code, color]) => (
                        <button
                          key={code}
                          type="button"
                          className={`color-option ${formData.color === parseInt(code) ? 'selected' : ''}`}
                          style={{ background: color }}
                          onClick={() => setFormData({ ...formData, color: parseInt(code) })}
                          title={color}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="form-actions">
                    <button type="button" onClick={handleCancelEdit} className="btn-secondary">
                      Cancel
                    </button>
                    <button type="submit" className="btn-primary">
                      {editingCategory ? 'Update' : 'Create'}
                    </button>
                  </div>
                </form>
              )}

              {/* Category List */}
              {!isCreating && !editingCategory && (
                <>
                  <div className="section-header">
                    <h3>Your Categories</h3>
                    {onCreateCategory && (
                      <button onClick={handleStartCreate} className="btn-create">
                        + New Category
                      </button>
                    )}
                  </div>

                  {categories.length === 0 ? (
                    <div className="empty-state">
                      <div className="empty-icon">📂</div>
                      <h3>No Categories Yet</h3>
                      <p>Create categories to organize your password entries.</p>
                    </div>
                  ) : (
                    <div className="category-tree">{renderCategoryTree(hierarchy)}</div>
                  )}
                </>
              )}
            </>
          )}

          {activeTab === 'templates' && (
            <div className="templates-section">
              <div className="section-header">
                <h3>Quick Start Templates</h3>
                <p className="section-description">
                  Create common categories with a single click
                </p>
              </div>

              <div className="templates-grid">
                {CategoryManager.DEFAULT_TEMPLATES.map((template, index) => {
                  const existingCategory = categories.find(
                    (c) => c.name.toLowerCase() === template.name.toLowerCase()
                  );

                  return (
                    <div key={index} className="template-card">
                      <div
                        className="template-icon"
                        style={{ background: getColorValue(template.color) }}
                      >
                        {ICON_PRESETS.find((p) => p.code === template.icon)?.label.split(' ')[0] || '📁'}
                      </div>
                      <div className="template-name">{template.name}</div>
                      {existingCategory ? (
                        <button className="btn-template" disabled>
                          ✓ Created
                        </button>
                      ) : (
                        <button
                          className="btn-template"
                          onClick={() => handleCreateTemplate(template)}
                        >
                          + Add
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="template-info">
                <strong>💡 Tip:</strong> You can customize these categories after creating them,
                or create your own from scratch in the &quot;My Categories&quot; tab.
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="btn-primary">
            Close
          </button>
        </div>

        <style jsx global>{`
          .category-manager-modal-overlay {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            background: rgba(0, 0, 0, 0.8) !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            z-index: 99999 !important;
            padding: 1rem !important;
          }

          .category-manager-modal-content {
            background: white;
            border-radius: 16px;
            width: 100%;
            max-width: 700px;
            max-height: 90vh;
            overflow-y: auto;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          }

          .category-modal {
            max-width: 700px;
          }

          .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 1.5rem;
            border-bottom: 1px solid #e1e8ed;
          }

          .modal-header h2 {
            margin: 0;
            color: #2c3e50;
            font-size: 1.5rem;
          }

          .modal-close {
            background: none;
            border: none;
            font-size: 2rem;
            color: #7f8c8d;
            cursor: pointer;
            line-height: 1;
            padding: 0;
            width: 32px;
            height: 32px;
          }

          .tabs {
            display: flex;
            border-bottom: 1px solid #e1e8ed;
          }

          .tab {
            flex: 1;
            padding: 1rem;
            background: none;
            border: none;
            border-bottom: 3px solid transparent;
            cursor: pointer;
            font-size: 1rem;
            font-weight: 600;
            color: #7f8c8d;
            transition: all 0.2s;
          }

          .tab:hover {
            background: #f8f9fa;
            color: #2c3e50;
          }

          .tab.active {
            color: #667eea;
            border-bottom-color: #667eea;
          }

          .modal-body {
            padding: 1.5rem;
            min-height: 300px;
          }

          .category-form {
            background: #f8f9fa;
            border-radius: 12px;
            padding: 1.5rem;
            margin-bottom: 1.5rem;
          }

          .form-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1rem;
          }

          .form-header h3 {
            margin: 0;
            color: #2c3e50;
            font-size: 1.1rem;
          }

          .btn-cancel-inline {
            background: none;
            border: none;
            font-size: 1.5rem;
            color: #7f8c8d;
            cursor: pointer;
            line-height: 1;
          }

          .form-group {
            margin-bottom: 1.5rem;
          }

          .form-group:last-of-type {
            margin-bottom: 0;
          }

          .form-group label {
            display: block;
            margin-bottom: 0.5rem;
            color: #2c3e50;
            font-weight: 600;
            font-size: 0.9rem;
          }

          .form-group input {
            width: 100%;
            padding: 0.75rem;
            border: 1px solid #e1e8ed;
            border-radius: 8px;
            font-size: 1rem;
            transition: all 0.2s;
          }

          .form-group input:focus {
            outline: none;
            border-color: #667eea;
            box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
          }

          .icon-grid {
            display: grid;
            grid-template-columns: repeat(6, 1fr);
            gap: 0.5rem;
          }

          .icon-option {
            background: white;
            border: 2px solid #e1e8ed;
            border-radius: 8px;
            padding: 0.75rem;
            font-size: 1.5rem;
            cursor: pointer;
            transition: all 0.2s;
          }

          .icon-option:hover {
            border-color: #667eea;
            transform: scale(1.05);
          }

          .icon-option.selected {
            border-color: #667eea;
            background: #f0f3ff;
          }

          .color-grid {
            display: grid;
            grid-template-columns: repeat(8, 1fr);
            gap: 0.5rem;
          }

          .color-option {
            width: 100%;
            aspect-ratio: 1;
            border: 3px solid transparent;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.2s;
          }

          .color-option:hover {
            transform: scale(1.1);
          }

          .color-option.selected {
            border-color: #2c3e50;
            box-shadow: 0 0 0 2px white, 0 0 0 4px #2c3e50;
          }

          .form-actions {
            display: flex;
            gap: 0.75rem;
            margin-top: 1.5rem;
          }

          .section-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1rem;
          }

          .section-header h3 {
            margin: 0;
            color: #2c3e50;
            font-size: 1.1rem;
          }

          .section-description {
            color: #7f8c8d;
            font-size: 0.9rem;
            margin: 0.5rem 0 0 0;
          }

          .btn-create {
            background: #667eea;
            color: white;
            border: none;
            border-radius: 8px;
            padding: 0.5rem 1rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
          }

          .btn-create:hover {
            background: #5568d3;
            transform: translateY(-1px);
          }

          .category-tree {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
          }

          .category-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: white;
            border: 1px solid #e1e8ed;
            border-radius: 8px;
            padding: 1rem;
            transition: all 0.2s;
          }

          .category-item:hover {
            border-color: #667eea;
            box-shadow: 0 2px 8px rgba(102, 126, 234, 0.1);
          }

          .category-info {
            display: flex;
            align-items: center;
            gap: 1rem;
            flex: 1;
          }

          .category-icon {
            width: 48px;
            height: 48px;
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.5rem;
          }

          .category-details {
            flex: 1;
          }

          .category-name {
            font-weight: 600;
            color: #2c3e50;
            margin-bottom: 0.25rem;
          }

          .category-meta {
            font-size: 0.85rem;
            color: #7f8c8d;
          }

          .category-actions {
            display: flex;
            gap: 0.5rem;
          }

          .btn-icon-small {
            background: #f8f9fa;
            border: 1px solid #e1e8ed;
            border-radius: 6px;
            width: 32px;
            height: 32px;
            cursor: pointer;
            font-size: 1rem;
            transition: all 0.2s;
          }

          .btn-icon-small:hover:not(:disabled) {
            background: #e1e8ed;
            transform: scale(1.05);
          }

          .btn-icon-small:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }

          .templates-section {
            padding: 1rem 0;
          }

          .templates-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
            gap: 1rem;
            margin-bottom: 1.5rem;
          }

          .template-card {
            background: white;
            border: 2px solid #e1e8ed;
            border-radius: 12px;
            padding: 1.5rem;
            text-align: center;
            transition: all 0.2s;
          }

          .template-card:hover {
            border-color: #667eea;
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.1);
          }

          .template-icon {
            width: 64px;
            height: 64px;
            margin: 0 auto 1rem;
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 2rem;
          }

          .template-name {
            font-weight: 600;
            color: #2c3e50;
            margin-bottom: 1rem;
            font-size: 0.95rem;
          }

          .btn-template {
            width: 100%;
            padding: 0.5rem;
            border: none;
            border-radius: 6px;
            font-weight: 600;
            font-size: 0.85rem;
            cursor: pointer;
            background: #667eea;
            color: white;
            transition: all 0.2s;
          }

          .btn-template:hover:not(:disabled) {
            background: #5568d3;
          }

          .btn-template:disabled {
            background: #e1e8ed;
            color: #7f8c8d;
            cursor: not-allowed;
          }

          .template-info {
            background: #fff3cd;
            border: 1px solid #ffc107;
            border-radius: 8px;
            padding: 1rem;
            color: #856404;
            font-size: 0.9rem;
          }

          .empty-state {
            text-align: center;
            padding: 3rem 1rem;
          }

          .empty-icon {
            font-size: 4rem;
            margin-bottom: 1rem;
          }

          .empty-state h3 {
            color: #2c3e50;
            margin: 0 0 0.5rem 0;
          }

          .empty-state p {
            color: #7f8c8d;
            margin: 0;
          }

          .modal-footer {
            padding: 1.5rem;
            border-top: 1px solid #e1e8ed;
          }

          .btn-secondary,
          .btn-primary {
            flex: 1;
            padding: 0.875rem;
            border: none;
            border-radius: 8px;
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
          }

          .btn-secondary {
            background: #f8f9fa;
            color: #2c3e50;
          }

          .btn-secondary:hover {
            background: #e1e8ed;
          }

          .btn-primary {
            background: #667eea;
            color: white;
            width: 100%;
          }

          .btn-primary:hover {
            background: #5568d3;
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
          }

          @media (max-width: 768px) {
            .category-manager-modal-content {
              max-width: 100%;
              margin: 0.5rem;
            }

            .icon-grid {
              grid-template-columns: repeat(4, 1fr);
            }

            .color-grid {
              grid-template-columns: repeat(6, 1fr);
            }

            .templates-grid {
              grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
            }
          }
        `}</style>
      </div>
    </div>
  );
}
