'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useRef } from 'react';
import {
  Briefcase,
  LineChart,
  Layers,
  Activity,
  Menu,
  X,
  Pin,
  PinOff,
} from 'lucide-react';

function SqilledMark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <g transform="rotate(20, 20, 20)">
        <path
          d="M26.5 13H17.5C15.567 13 14 14.567 14 16.5C14 18.433 15.567 20 17.5 20H22.5C24.433 20 26 21.567 26 23.5C26 25.433 24.433 27 22.5 27H13.5"
          stroke="#F56C49" strokeWidth="4" strokeLinecap="round"
        />
      </g>
    </svg>
  );
}

const navItems = [
  { name: 'Portfolio',            href: '/portfolio',  icon: Briefcase },
  { name: 'Analytics',            href: '/analytics',  icon: LineChart  },
  { name: 'Covered Call Overlay', href: '/overlay',    icon: Layers     },
  { name: 'IV Regime',            href: '/iv-regime',  icon: Activity   },
];

// Icon left-edge sits at 18px → icon center ≈ 28px → looks centred in the 64px collapsed rail
const ICON_PADDING = 'px-[18px]';

export function Sidebar() {
  const pathname  = usePathname();
  const [isOpen,  setIsOpen]  = useState(false);
  const [pinned,  setPinned]  = useState(false);
  const [hovered, setHovered] = useState(false);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const expanded = pinned || hovered;

  const onEnter = () => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    setHovered(true);
  };
  const onLeave = () => {
    leaveTimer.current = setTimeout(() => setHovered(false), 120);
  };

  return (
    <>
      {/* ── Mobile topbar ── */}
      <div className="md:hidden flex items-center justify-between bg-[var(--color-surface)] border-b border-[var(--color-border)] p-4">
        <div className="flex items-center space-x-2">
          <SqilledMark className="w-7 h-7 flex-shrink-0" />
          <span className="text-lg font-bold tracking-tight text-white">sqilled Options</span>
        </div>
        <button onClick={() => setIsOpen(!isOpen)} className="text-[var(--color-text-muted)] hover:text-white">
          {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* ── Desktop sidebar — in-flow, drives layout width ── */}
      <div
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
        className={`
          hidden md:flex flex-col flex-shrink-0 h-full overflow-hidden
          bg-[var(--color-surface)] border-r border-[var(--color-border)]
          transition-all duration-300 ease-in-out
          ${expanded ? 'w-64' : 'w-16'}
        `}
      >
        {/* Logo row */}
        <div className={`flex items-center h-[73px] flex-shrink-0 border-b border-[var(--color-border)]
          ${expanded ? ICON_PADDING : 'justify-center'}`}>
          <SqilledMark className="w-10 h-10 flex-shrink-0" />
          <span className={`ml-3 text-xl font-bold tracking-tight text-white whitespace-nowrap
            transition-opacity duration-200 ${expanded ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`}>
            sqilled Options
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (pathname === '/' && item.href === '/portfolio');
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.href}
                title={!expanded ? item.name : undefined}
                className={`flex items-center py-3 rounded-xl mx-2 transition-colors whitespace-nowrap
                  ${expanded ? ICON_PADDING : 'justify-center px-3'}
                  ${isActive
                    ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                    : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-white'
                  }`}
              >
                <Icon className="w-[22px] h-[22px] flex-shrink-0" />
                <span className={`ml-3 font-medium transition-opacity duration-200
                  ${expanded ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`}>
                  {item.name}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* Pin button — fades in when expanded */}
        <div className={`border-t border-[var(--color-border)] py-3 flex ${ICON_PADDING}`}>
          <button
            onClick={() => setPinned(p => !p)}
            title={pinned ? 'Unpin sidebar' : 'Pin sidebar open'}
            className={`p-2 rounded-lg transition-all hover:bg-[var(--color-surface-hover)]
              ${pinned ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)] hover:text-white'}
              ${expanded ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          >
            {pinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* ── Mobile drawer — fixed overlay ── */}
      <div className={`
        md:hidden fixed inset-y-0 left-0 z-50 w-64 flex flex-col
        bg-[var(--color-surface)] border-r border-[var(--color-border)] overflow-hidden
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex items-center border-b border-[var(--color-border)] h-[73px] px-6 space-x-3 flex-shrink-0 mt-16">
          <SqilledMark className="w-8 h-8 flex-shrink-0" />
          <span className="text-xl font-bold tracking-tight text-white">sqilled Options</span>
        </div>
        <nav className="flex-1 py-4 px-4 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (pathname === '/' && item.href === '/portfolio');
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-colors
                  ${isActive
                    ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                    : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-white'
                  }`}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Mobile backdrop */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setIsOpen(false)} />
      )}
    </>
  );
}
