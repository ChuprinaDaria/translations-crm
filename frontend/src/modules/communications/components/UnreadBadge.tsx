import React from 'react';
import { cn } from '../../../components/ui/utils';

interface UnreadBadgeProps {
  count: number;
  className?: string;
}

/**
 * Червоне коло з числом непрочитаних
 * Max 99+ (якщо більше)
 * Min-width: 20px, height: 20px
 * Font-size: 12px, bold
 */
export function UnreadBadge({ count, className }: UnreadBadgeProps) {
  if (count <= 0) return null;

  const displayCount = count > 99 ? '99+' : count.toString();

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center',
        'min-w-[20px] h-5 px-1.5',
        'bg-red-500 text-white',
        'text-xs font-bold',
        'rounded-full',
        className
      )}
    >
      {displayCount}
    </span>
  );
}

