import React from 'react';
import { PlatformIcon } from './PlatformIcon';
import { cn } from '../../../components/ui/utils';

interface SourceBadgeProps {
  source: 'telegram' | 'whatsapp' | 'email' | 'facebook' | 'instagram';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Rounded badge з іконкою та кольором джерела
 * Size sm: 16x16, md: 20x20, lg: 24x24
 */
export function SourceBadge({ source, size = 'md', className }: SourceBadgeProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  return (
    <div
      className={cn(
        'rounded-full flex items-center justify-center',
        'bg-white border border-gray-200',
        sizeClasses[size],
        className
      )}
    >
      <PlatformIcon platform={source} size={size === 'sm' ? 12 : size === 'md' ? 16 : 20} />
    </div>
  );
}

