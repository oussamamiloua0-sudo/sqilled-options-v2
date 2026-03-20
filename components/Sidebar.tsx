'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useRef } from 'react';
import Image from 'next/image';
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

function SqilledMark() {
  return (
    <Image src="/logo.png" alt="Sqilled" width={40} height={40} style={{ width: 40, height: 40, flexShrink: 0 }} />
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
          <SqilledMark />
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
        {/* Logo row — icon stays fixed, text clips away */}
        <div className={`flex items-center h-[73px] flex-shrink-0 border-b border-[var(--color-border)] ${ICON_PADDING}`}>
          <SqilledMark />
          <span className={`ml-3 text-xl font-bold tracking-tight text-white whitespace-nowrap
            transition-opacity duration-200 ${expanded ? 'opacity-100' : 'opacity-0'}`}>
            sqilled Options
          </span>
        </div>

        {/* Nav — icon position never changes, text fades then clips */}
        <nav className="flex-1 py-4 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (pathname === '/' && item.href === '/portfolio');
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.href}
                title={!expanded ? item.name : undefined}
                className={`flex items-center py-3 rounded-xl mx-2 transition-colors whitespace-nowrap ${ICON_PADDING}
                  ${isActive
                    ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                    : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-white'
                  }`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span className={`ml-3 font-medium transition-opacity duration-200
                  ${expanded ? 'opacity-100' : 'opacity-0'}`}>
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
          <SqilledMark />
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
