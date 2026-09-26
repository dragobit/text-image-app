import { NavLink } from 'react-router-dom';
import { ImageIcon } from 'lucide-react';

import { LoginArea } from '@/components/auth/LoginArea';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { to: '/', label: 'エディタ' },
  { to: '/library', label: 'ライブラリ' },
  { to: '/settings', label: '設定' },
];

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
        <NavLink to="/" className="flex items-center gap-2 font-bold">
          <ImageIcon className="size-5 text-primary" />
          TextImage
        </NavLink>
        <nav className="flex flex-1 items-center gap-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                cn(
                  'rounded-md px-3 py-1.5 text-sm transition-colors',
                  isActive
                    ? 'bg-secondary font-medium text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <LoginArea className="max-w-40" />
      </div>
    </header>
  );
}
