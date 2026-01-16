import React, { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, X } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Textarea } from '../../../components/ui/textarea';
import { AttachmentPreview } from './AttachmentPreview';
import { cn } from '../../../components/ui/utils';

interface MessageInputProps {
  onSend: (content: string, attachments: File[]) => void;
  placeholder?: string;
  disabled?: boolean;
  isLoading?: boolean;
}

/**
 * Message Input компонент
 * Features:
 * - Textarea з auto-resize
 * - File upload (drag-n-drop)
 * - Send button (Ctrl+Enter shortcut)
 */
export function MessageInput({
  onSend,
  placeholder = 'Напишіть повідомлення...',
  disabled = false,
  isLoading = false,
}: MessageInputProps) {
  const [message, setMessage] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      const maxHeight = 120; // max-height in pixels
      textareaRef.current.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
    }
  }, [message]);

  const handleSend = () => {
    if ((!message.trim() && attachments.length === 0) || disabled || isLoading) return;
    onSend(message, attachments);
    setMessage('');
    setAttachments([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setAttachments((prev) => [...prev, ...files]);
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    setAttachments((prev) => [...prev, ...files]);
  };

  const canSend = (message.trim() || attachments.length > 0) && !disabled && !isLoading;

  return (
    <div
      className={cn(
        'border-t border-gray-200 bg-white p-3',
        isDragging && 'bg-blue-50 border-blue-300'
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Selected Files Preview */}
      {attachments.length > 0 && (
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          {attachments.map((file, index) => (
            <AttachmentPreview
              key={index}
              file={file}
              isPreview
              onRemove={() => removeAttachment(index)}
            />
          ))}
        </div>
      )}

      {/* Input Area */}
      <div className="flex items-end gap-2">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileSelect}
        />
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0 h-10 w-10 p-0"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
        >
          <Paperclip className="w-5 h-5 text-gray-600" />
        </Button>
        <Textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            'min-h-[44px] max-h-[120px] resize-none',
            'px-3 py-2 text-sm',
            'border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
          )}
          rows={1}
        />
        <Button
          onClick={handleSend}
          disabled={!canSend}
          size="sm"
          className={cn(
            'shrink-0 h-10 px-4',
            canSend
              ? 'bg-blue-500 hover:bg-blue-600 text-white'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed',
            'active:scale-95 transition-transform duration-100'
          )}
        >
          {isLoading ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </Button>
      </div>

      {/* Hint */}
      <p className="text-xs text-gray-400 mt-1 px-1">
        Натисніть Ctrl+Enter для відправки
      </p>
    </div>
  );
}

