import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  ListChecks,
  Users,
  PlusCircle,
  Sparkles,
  Trash2,
  Menu,
  X,
  PhoneCall,
} from 'lucide-react';
import { useToast } from '../lib/toast';
import { Dialog } from './ui';

export function Layout({
  children,
  title,
  onDataChanged,
  loadingSamples,
  onTriggerLoadSamples,
}: {
  children: React.ReactNode;
  title: string;
  onDataChanged?: () => void;
  loadingSamples: boolean;
  onTriggerLoadSamples: () => Promise<void>;
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const navigate = useNavigate();
  const { showToast } = useToast();

  const handleClearData = async () => {
    setClearing(true);
    try {
      const res = await fetch('/api/my-data', { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to clear data');
      showToast('Your workspace data has been cleared.', 'success');
      setConfirmClearOpen(false);
      onDataChanged?.();
      navigate('/queue');
    } catch (err: any) {
      showToast(err.message || 'Could not clear data', 'error');
    } finally {
      setClearing(false);
    }
  };

  const navItems = [
    { to: '/queue', label: "Today's Queue", icon: ListChecks },
    { to: '/leads', label: 'All Leads', icon: Users },
    { to: '/new', label: 'New Lead', icon: PlusCircle },
  ];

  const SidebarContent = () => (
    <div className="flex flex-col h-full justify-between bg-white border-r border-[#E7E5E0] w-[240px] select-none">
      <div>
        {/* Brand header */}
        <div className="h-14 px-5 flex items-center gap-2.5 border-b border-[#E7E5E0]">
          <div className="w-7 h-7 rounded-lg bg-[#0F766E] flex items-center justify-center text-white">
            <PhoneCall className="w-4 h-4" />
          </div>
          <div>
            <span className="font-semibold text-base text-[#1C1B19] tracking-tight">LeadLens</span>
            <span className="ml-1.5 text-[11px] font-medium px-1.5 py-0.5 rounded bg-[#F7F7F5] text-[#5F5C55] border border-[#E7E5E0]">
              Voice
            </span>
          </div>
        </div>

        {/* Navigation links */}
        <nav className="p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition ${
                    isActive
                      ? 'bg-[#E6F2F0] text-[#0F766E]'
                      : 'text-[#5F5C55] hover:bg-[#F7F7F5] hover:text-[#1C1B19]'
                  }`
                }
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Bottom actions: Load sample leads & Clear my data */}
      <div className="p-3 border-t border-[#E7E5E0] space-y-1.5">
        <button
          onClick={() => {
            setMobileMenuOpen(false);
            onTriggerLoadSamples();
          }}
          disabled={loadingSamples}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-[#1C1B19] bg-[#F7F7F5] hover:bg-[#EAE8E1] border border-[#E7E5E0] transition cursor-pointer disabled:opacity-50"
        >
          <Sparkles className="w-3.5 h-3.5 text-[#0F766E]" />
          <span>{loadingSamples ? 'Analyzing samples...' : 'Load sample leads'}</span>
        </button>

        <button
          onClick={() => {
            setMobileMenuOpen(false);
            setConfirmClearOpen(true);
          }}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-[#5F5C55] hover:text-[#B42318] hover:bg-[#FDECEA]/50 transition cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Clear my data</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-[#F7F7F5] text-[#1C1B19]">
      {/* Fixed Desktop Sidebar */}
      <aside className="hidden md:block fixed inset-y-0 left-0 z-30 no-print">
        <SidebarContent />
      </aside>

      {/* Mobile Slide-Over Sidebar */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden no-print">
          <div
            className="fixed inset-0 bg-black/30"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative z-50 flex">
            <SidebarContent />
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="ml-2 mt-3 w-9 h-9 rounded-full bg-white border border-[#E7E5E0] flex items-center justify-center text-[#1C1B19]"
              aria-label="Close sidebar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 md:pl-[240px] flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="h-14 bg-white border-b border-[#E7E5E0] px-4 sm:px-6 flex items-center justify-between sticky top-0 z-20 no-print">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-1.5 rounded-lg border border-[#E7E5E0] text-[#5F5C55] hover:text-[#1C1B19]"
              aria-label="Open navigation menu"
            >
              <Menu className="w-4 h-4" />
            </button>
            <h1 className="text-lg font-semibold text-[#1C1B19] truncate">{title}</h1>
          </div>

          <button
            onClick={() => navigate('/new')}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#0F766E] hover:bg-[#0D6560] text-white text-xs sm:text-sm font-medium transition cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>New Lead</span>
          </button>
        </header>

        {/* Page Body */}
        <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto">{children}</main>
      </div>

      {/* Confirm Clear Data Dialog */}
      <Dialog
        open={confirmClearOpen}
        onClose={() => setConfirmClearOpen(false)}
        title="Clear all workspace data?"
      >
        <p className="text-sm text-[#5F5C55] mb-5">
          This will permanently delete all leads, analyses, chat history, and call briefs in your
          current session.
        </p>
        <div className="flex justify-end gap-2.5">
          <button
            onClick={() => setConfirmClearOpen(false)}
            className="px-3.5 py-2 rounded-lg border border-[#E7E5E0] bg-white text-sm font-medium text-[#1C1B19] hover:bg-[#F7F7F5]"
          >
            Cancel
          </button>
          <button
            onClick={handleClearData}
            disabled={clearing}
            className="px-3.5 py-2 rounded-lg bg-[#B42318] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 cursor-pointer"
          >
            {clearing ? 'Clearing...' : 'Yes, clear my data'}
          </button>
        </div>
      </Dialog>
    </div>
  );
}