'use client';

import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Sidebar } from '@/components/dashboard/sidebar';
import { Topbar } from '@/components/dashboard/topbar';
import { Loader as Loader2, Code as Code2, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Code2 className="h-10 w-10 text-primary animate-pulse" />
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {/* Mobile sidebar overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="fixed inset-0 bg-black/60" onClick={() => setMobileMenuOpen(false)} />
          <div className="relative z-50">
            <Sidebar />
          </div>
        </div>
      )}

      <div className="lg:pl-64 transition-all duration-300">
        {/* Mobile menu button */}
        <div className="lg:hidden fixed top-0 left-0 z-30 h-16 flex items-center px-4 bg-card/80 backdrop-blur-sm border-b border-border/50 w-full">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="mr-2"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
          <div className="flex items-center gap-2">
            <Code2 className="h-6 w-6 text-primary" />
            <span className="font-bold">DevTrack</span>
          </div>
        </div>
        <div className="hidden lg:block">
          <Topbar />
        </div>
        <main className="p-4 lg:p-6 mt-16 lg:mt-0">{children}</main>
      </div>
    </div>
  );
}
