/**
 * Edit Marketing Info Modal
 * 
 * Modal form for editing social marketing metadata for a movie.
 * Part of Phase 1 of the Social Marketing Integration Plan.
 */
'use client';

import { useState, useEffect } from 'react';
import { Loader2, Plus, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import {
  MarketingFormData,
  DEFAULT_MARKETING_FORM,
  formToMetadata,
  metadataToForm,
  normalizeHashtag,
  isValidHashtag,
  MarketingMetadata,
} from '@/features/performances/types/social';

interface EditMarketingModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** Movie ID to update */
  movieId: string;
  /** Movie title for display */
  movieTitle: string;
  /** Existing marketing metadata (if any) */
  initialData?: MarketingMetadata;
  /** Callback when marketing data is successfully saved */
  onSuccess?: () => void;
}

export function EditMarketingModal({
  open,
  onOpenChange,
  movieId,
  movieTitle,
  initialData,
  onSuccess,
}: EditMarketingModalProps) {
  const [formData, setFormData] = useState<MarketingFormData>(DEFAULT_MARKETING_FORM);
  const [newSecondaryHashtag, setNewSecondaryHashtag] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Initialize form when modal opens with existing data
  useEffect(() => {
    if (open) {
      setFormData(metadataToForm(initialData));
      setError(null);
      setValidationErrors({});
    }
  }, [open, initialData]);

  // Update form field
  const updateField = (field: keyof MarketingFormData, value: string): void => {
    // Strip prefixes if user manually types them
    let cleanValue = value;
    if (field === 'primary_hashtag') {
        cleanValue = value.replace(/^#+/, '');
    } else if (field.endsWith('_handle')) {
        cleanValue = value.replace(/^@+/, '');
    }

    setFormData((prev: MarketingFormData) => ({ ...prev, [field]: cleanValue }));
    // Clear validation error for this field
    if (validationErrors[field]) {
      setValidationErrors((prev: Record<string, string>) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  // Add secondary hashtag
  const addSecondaryHashtag = (): void => {
    const cleanTag = newSecondaryHashtag.replace(/^#+/, '');
    const normalized = normalizeHashtag(cleanTag);
    if (!normalized) return;
    
    if (!isValidHashtag(normalized)) {
      setValidationErrors((prev: Record<string, string>) => ({
        ...prev,
        secondary_hashtags: 'Invalid hashtag format',
      }));
      return;
    }
    
    if (formData.secondary_hashtags.includes(normalized)) {
      setValidationErrors((prev: Record<string, string>) => ({
        ...prev,
        secondary_hashtags: 'Hashtag already added',
      }));
      return;
    }
    
    if (formData.secondary_hashtags.length >= 5) {
      setValidationErrors((prev: Record<string, string>) => ({
        ...prev,
        secondary_hashtags: 'Maximum 5 secondary hashtags allowed',
      }));
      return;
    }
    
    setFormData((prev: MarketingFormData) => ({
      ...prev,
      secondary_hashtags: [...prev.secondary_hashtags, normalized],
    }));
    setNewSecondaryHashtag('');
    setValidationErrors((prev: Record<string, string>) => {
      const next = { ...prev };
      delete next.secondary_hashtags;
      return next;
    });
  };

  // Remove secondary hashtag
  const removeSecondaryHashtag = (hashtag: string): void => {
    setFormData((prev: MarketingFormData) => ({
      ...prev,
      secondary_hashtags: prev.secondary_hashtags.filter((h: string) => h !== hashtag),
    }));
  };

  // Validate form
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    
    // Primary hashtag is required
    if (!formData.primary_hashtag.trim()) {
      errors.primary_hashtag = 'Primary hashtag is required';
    } else if (!isValidHashtag(normalizeHashtag(formData.primary_hashtag))) {
      errors.primary_hashtag = 'Invalid hashtag format (use #HashtagName)';
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const metadata = formToMetadata(formData);
      
      const response = await fetch(`/api/performance/${movieId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marketing: metadata }),
      });
      
      const result = await response.json();
      
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to save marketing info');
      }
      
      // Success
      onSuccess?.();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit Marketing Info</DialogTitle>
            <DialogDescription>
              {movieTitle}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Error Alert */}
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            {/* Primary Hashtag */}
            <div className="space-y-2">
              <Label htmlFor="primary_hashtag">
                Primary Hashtag <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold select-none">#</span>
                <Input
                    id="primary_hashtag"
                    placeholder="MovieTitle"
                    value={formData.primary_hashtag.replace(/^#+/, '')}
                    onChange={e => updateField('primary_hashtag', e.target.value)}
                    className={cn("pl-7", validationErrors.primary_hashtag ? 'border-destructive' : '')}
                />
              </div>
              {validationErrors.primary_hashtag && (
                <p className="text-sm text-destructive">{validationErrors.primary_hashtag}</p>
              )}
            </div>
            
            {/* Secondary Hashtags */}
            <div className="space-y-2">
              <Label>Secondary Hashtags (max 5)</Label>
              <div className="flex flex-wrap gap-2 mb-2">
                {formData.secondary_hashtags.map((tag: string) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-secondary text-secondary-foreground rounded-md text-sm font-medium"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeSecondaryHashtag(tag)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold select-none">#</span>
                    <Input
                        placeholder="AnotherTag"
                        value={newSecondaryHashtag.replace(/^#+/, '')}
                        onChange={e => setNewSecondaryHashtag(e.target.value)}
                        onKeyDown={e => {
                            if (e.key === 'Enter') {
                            e.preventDefault();
                            addSecondaryHashtag();
                            }
                        }}
                        className={cn("pl-7", validationErrors.secondary_hashtags ? 'border-destructive' : '')}
                    />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={addSecondaryHashtag}
                  disabled={formData.secondary_hashtags.length >= 5}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              {validationErrors.secondary_hashtags && (
                <p className="text-sm text-destructive">{validationErrors.secondary_hashtags}</p>
              )}
            </div>
            
            {/* Official Accounts */}
            <div className="space-y-3">
              <Label>Official Accounts</Label>
              
              <div className="grid grid-cols-[80px_1fr] items-center gap-2">
                <span className="text-sm text-muted-foreground">TikTok</span>
                <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold select-none">@</span>
                    <Input
                        placeholder="username"
                        value={formData.tiktok_handle.replace(/^@+/, '')}
                        onChange={e => updateField('tiktok_handle', e.target.value)}
                        className="pl-7"
                    />
                </div>
              </div>
              
              <div className="grid grid-cols-[80px_1fr] items-center gap-2">
                <span className="text-sm text-muted-foreground">Instagram</span>
                <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold select-none">@</span>
                    <Input
                        placeholder="username"
                        value={formData.instagram_handle.replace(/^@+/, '')}
                        onChange={e => updateField('instagram_handle', e.target.value)}
                        className="pl-7"
                    />
                </div>
              </div>
              
              <div className="grid grid-cols-[80px_1fr] items-center gap-2">
                <span className="text-sm text-muted-foreground">X (Twitter)</span>
                <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold select-none">@</span>
                    <Input
                        placeholder="username"
                        value={formData.x_handle.replace(/^@+/, '')}
                        onChange={e => updateField('x_handle', e.target.value)}
                        className="pl-7"
                    />
                </div>
              </div>
            </div>
            
            {/* Campaign Info */}
            <div className="space-y-3 pt-2 border-t">
              <Label className="text-muted-foreground">Campaign Info (Optional)</Label>
              
              <div className="grid grid-cols-[100px_1fr] items-center gap-2">
                <span className="text-sm text-muted-foreground">Start Date</span>
                <Input
                  type="date"
                  value={formData.campaign_start_date}
                  onChange={e => updateField('campaign_start_date', e.target.value)}
                />
              </div>
              
              <div className="grid grid-cols-[100px_1fr] items-center gap-2">
                <span className="text-sm text-muted-foreground">Budget (IDR)</span>
                <Input
                  type="text"
                  placeholder="500000000"
                  value={formData.marketing_budget}
                  onChange={e => updateField('marketing_budget', e.target.value.replace(/[^\d]/g, ''))}
                />
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
