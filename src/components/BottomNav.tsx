'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { TrendingUp, Trophy, Sparkles } from 'lucide-react';

export default function BottomNav() {
  const pathname = usePathname();

  const navItems = [
    { href: '/Home', icon: Sparkles, label: 'Home' },
    { href: '/trade', icon: TrendingUp, label: 'Trade' },
    { href: '/leaderboard', icon: Trophy, label: 'Ranks' }
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-black/95 backdrop-blur-lg border-t border-zinc-800/50 z-40 pb-safe">
      <div className="flex justify-around items-center h-[72px] px-4 max-w-lg mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center justify-center flex-1"
            >
              {isActive ? (
                <div className="flex items-center gap-2 bg-zinc-800 px-4 py-2 rounded-full">
                  <Icon size={20} className="text-white" />
                  <span className="text-sm font-medium text-white">{item.label}</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1 py-2">
                  <Icon size={22} className="text-zinc-500" />
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
