import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { notify } from "@/lib/app-notifications";
import { NOTIFY_BLOG_IDEA_UPDATED, NOTIFY_TITLE_AND_KEYWORD_ARE_REQUIRED } from "@/lib/notify-messages";
import type { CSVRow } from '@/lib/bulk-auto-generate';
import {
  modifierLinksFromJson,
  serializeModifierLinksJson,
} from "@/lib/bulk/bulk-csv-parser";
import { BlogIdeaModifierLinksEditor } from "@/components/keyword-research/bulk/BlogIdeaModifierLinksEditor";

interface EditBlogIdeaDialogProps {
  editingIndex: number | null;
  setEditingIndex: (index: number | null) => void;
  editFormData: CSVRow | null;
  setEditFormData: (data: CSVRow | null) => void;
  setGeneratedRows: (rows: CSVRow[] | ((prev: CSVRow[]) => CSVRow[])) => void;
}

export function EditBlogIdeaDialog({
  editingIndex,
  setEditingIndex,
  editFormData,
  setEditFormData,
  setGeneratedRows,
}: EditBlogIdeaDialogProps) {
  const handleSave = () => {
    if (!editFormData || editingIndex === null) return;
    
    if (!editFormData.title.trim() || !editFormData.keyword.trim()) {
      notify.error(NOTIFY_TITLE_AND_KEYWORD_ARE_REQUIRED);
      return;
    }

    // Update the row at the editing index
    setGeneratedRows(prev => {
      const updated = [...prev];
      updated[editingIndex] = editFormData;
      return updated;
    });

    notify.success(NOTIFY_BLOG_IDEA_UPDATED);
    setEditingIndex(null);
    setEditFormData(null);
  };

  const handleCancel = () => {
    setEditingIndex(null);
    setEditFormData(null);
  };

  return (
    <Dialog open={editingIndex !== null} onOpenChange={(open) => {
      if (!open) {
        handleCancel();
      }
    }}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Blog Idea</DialogTitle>
          <DialogDescription>
            Modify the blog idea details below.
          </DialogDescription>
        </DialogHeader>
        {editFormData && (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-title">Title *</Label>
              <Input
                id="edit-title"
                value={editFormData.title}
                onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                placeholder="Blog post title"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-keyword">Keyword *</Label>
              <Input
                id="edit-keyword"
                value={editFormData.keyword}
                onChange={(e) => setEditFormData({ ...editFormData, keyword: e.target.value })}
                placeholder="Primary keyword"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-entity">Entity (Optional)</Label>
              <Input
                id="edit-entity"
                value={editFormData.entity || ''}
                onChange={(e) => setEditFormData({ ...editFormData, entity: e.target.value || undefined })}
                placeholder="Entity name (e.g., business name, brand)"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-meta">Meta Description (Optional)</Label>
              <Input
                id="edit-meta"
                value={editFormData.meta_description || ''}
                onChange={(e) => setEditFormData({ ...editFormData, meta_description: e.target.value || undefined })}
                placeholder="SEO meta description (150–160 chars)"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-modifier">Modifier (Optional)</Label>
              <Input
                id="edit-modifier"
                value={editFormData.modifier || ''}
                onChange={(e) => setEditFormData({ ...editFormData, modifier: e.target.value || undefined })}
                placeholder="Modifier (e.g., comprehensive guide, beginner-friendly)"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-slug">Slug (Optional)</Label>
              <Input
                id="edit-slug"
                value={editFormData.target_slug || ''}
                onChange={(e) => setEditFormData({ ...editFormData, target_slug: e.target.value.trim() || undefined })}
                placeholder="post-slug"
              />
            </div>
            <BlogIdeaModifierLinksEditor
              idPrefix="edit-blog-idea"
              links={modifierLinksFromJson(editFormData.modifier_links_json)}
              onChange={(urls) =>
                setEditFormData({
                  ...editFormData,
                  modifier_links_json: serializeModifierLinksJson(urls),
                })
              }
            />
            <div className="space-y-2">
              <Label htmlFor="edit-featured-image">Featured Image</Label>
              <Select
                value={editFormData.featuredImage || 'y'}
                onValueChange={(value) => setEditFormData({ ...editFormData, featuredImage: value })}
              >
                <SelectTrigger id="edit-featured-image">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="y">Yes</SelectItem>
                  <SelectItem value="n">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
