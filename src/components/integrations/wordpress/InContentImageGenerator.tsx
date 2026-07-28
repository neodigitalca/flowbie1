import React, { useState, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { ImageType } from "@/lib/image-section-analyzer";

interface InContentImageGeneratorProps {
  imageType?: ImageType | '';
  userPrompt?: string;
  onImageTypeChange: (imageType: ImageType | '') => void;
  onUserPromptChange: (userPrompt: string) => void;
  disabled?: boolean;
}

export const InContentImageGenerator: React.FC<InContentImageGeneratorProps> = ({
  imageType: propImageType = '',
  userPrompt: propUserPrompt = '',
  onImageTypeChange,
  onUserPromptChange,
  disabled = false,
}) => {
  const [imageType, setImageType] = useState<ImageType | ''>(propImageType);
  const [userPrompt, setUserPrompt] = useState(propUserPrompt);

  // Sync with props
  useEffect(() => {
    setImageType(propImageType);
  }, [propImageType]);

  useEffect(() => {
    setUserPrompt(propUserPrompt);
  }, [propUserPrompt]);

  const handleImageTypeChange = (value: string) => {
    // Convert "__none__" special value to empty string for clearing
    if (value === '__none__') {
      setImageType('');
      onImageTypeChange('');
      return;
    }
    const newType = value as ImageType;
    setImageType(newType);
    onImageTypeChange(newType);
  };

  const handleUserPromptChange = (value: string) => {
    setUserPrompt(value);
    onUserPromptChange(value);
  };

  return (
    <div className="space-y-2">
      <div className="space-y-2">
        <Select
          value={imageType || '__none__'}
          onValueChange={handleImageTypeChange}
          disabled={disabled}
        >
          <SelectTrigger id="image-type" className="h-9 text-sm font-medium">
            <SelectValue placeholder="In Content Image" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">In Content Image</SelectItem>
            <SelectItem value="infographic">Infographic</SelectItem>
            <SelectItem value="blog-image">Blog Image</SelectItem>
            <SelectItem value="diagram">Diagram</SelectItem>
            <SelectItem value="illustration">Illustration</SelectItem>
            <SelectItem value="chart">Chart</SelectItem>
            <SelectItem value="photo">Photo</SelectItem>
            <SelectItem value="custom">Custom</SelectItem>
          </SelectContent>
        </Select>
        {imageType === 'infographic' && (
          <p className="text-xs text-muted-foreground">
            Infographics are optimized for mobile displays (tall format)
          </p>
        )}
      </div>

      {imageType && (
        <div className="space-y-2">
          <Label htmlFor="image-prompt" className="text-sm font-medium text-foreground">
            Optional Prompt Modifier
          </Label>
          <Textarea
            id="image-prompt"
            placeholder="Describe any specific requirements for the image (e.g., 'modern and colorful', 'include data visualization')..."
            value={userPrompt}
            onChange={(e) => handleUserPromptChange(e.target.value)}
            className="min-h-[80px] text-sm"
            disabled={disabled}
          />
        </div>
      )}
    </div>
  );
};

