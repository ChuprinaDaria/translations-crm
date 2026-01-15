import React from 'react';
import { Skeleton } from '../../../components/ui/skeleton';
import { cn } from '../../../components/ui/utils';

/**
 * Animated skeleton для loading states
 * Використовує shimmer animation
 */

export function ConversationItemSkeleton() {
  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center gap-3">
        <Skeleton className="w-12 h-12 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-full" />
        </div>
      </div>
    </div>
  );
}

export function MessageSkeleton({ isOutbound = false }: { isOutbound?: boolean }) {
  return (
    <div className={cn('flex', isOutbound ? 'justify-end' : 'justify-start')}>
      <div className={cn('max-w-[70%] rounded-lg px-3 py-2', isOutbound ? 'bg-blue-100' : 'bg-gray-100')}>
        <Skeleton className="h-4 w-48 mb-2" />
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
  );
}

export function ClientCardSkeleton() {
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3">
        <Skeleton className="w-16 h-16 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
      <div className="space-y-2 pt-2 border-t">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      <Skeleton className="h-9 w-full" />
    </div>
  );
}

export function AttachmentGridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-2">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="p-3 border rounded-lg">
          <Skeleton className="w-10 h-10 rounded mb-2" />
          <Skeleton className="h-3 w-full mb-1" />
          <Skeleton className="h-2 w-2/3" />
        </div>
      ))}
    </div>
  );
}

