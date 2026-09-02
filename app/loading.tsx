import React from 'react';

export default function Loading() {
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground p-4 space-y-4">
      {/* Header */}
      <div className="h-12 w-full">
        <Skeleton className="h-full w-full" />
      </div>
      {/* Main area */}
      <div className="flex flex-1 gap-4">
        {/* Sidebar */}
        <div className="w-64">
          <Skeleton className="h-full w-full" />
        </div>
        {/* Content */}
        <div className="flex-1">
          <Skeleton className="h-6 w-3/4 mb-4" />
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-5/6 mb-2" />
          <Skeleton className="h-4 w-4/5" />
        </div>
      </div>
    </div>
  );
}

import { Skeleton } from '@/components/Skeleton';
