import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/lib/auth';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/hooks/useTheme';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  X, User, Volume2, VolumeX, Moon, Sun, Globe, Send, LogOut
} from 'lucide-react';
import { playDrawSound, isMuted, setMuted } from '@/lib/sounds';
import { t, getLang, toggleLang } from '@/lib/i18n';

interface SettingsDrawerProps {
  open: boolean;
  onClose: () => void;
}

export default function SettingsDrawer({ open, onClose }: SettingsDrawerProps) {
  const [phone, setPhone] = useState('');
  const [muted, setMutedLocal] = useState(isMuted());
  const [syncMarks, setSyncMarks] = useState<boolean>(() => localStorage.getItem('bingo-sync-marks') !== '0');
  const { theme, toggle: toggleTheme } = useTheme();
  const [, setTick] = useState(0);
  const user = useUser();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user?.id || !open) return;
    supabase.from('profiles').select('phone').eq('id', user.id).single()
      .then(({ data }) => {
        if (data) setPhone(data.phone || '');
      });
  }, [user?.id, open]);

  const handleToggleMute = () => {
    const next = !muted;
    setMuted(next);
    setMutedLocal(next);
  };

  const handleToggleSync = () => {
    const next = !syncMarks;
    setSyncMarks(next);
    localStorage.setItem('bingo-sync-marks', next ? '1' : '0');
  };

  const handleToggleLang = () => {
    toggleLang();
    setTick(t => t + 1);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success('Logged out');
    navigate('/login');
  };

  if (!open) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        onClick={e => e.stopPropagation()}
        className="absolute right-0 top-0 bottom-0 w-72 bg-card border-l border-border p-4 space-y-5 overflow-y-auto"
        style={{ paddingTop: 'env(safe-area-inset-top, 16px)' }}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display font-bold text-foreground">Settings</h2>
          <button onClick={onClose} className="p-2 rounded-lg bg-muted text-muted-foreground"><X className="w-4 h-4" /></button>
        </div>

        {/* Profile — phone only, locked */}
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground flex items-center gap-1"><User className="w-3 h-3" /> Phone (your profile)</label>
          <div className="flex items-center gap-2 px-3 py-3 rounded-lg bg-muted text-foreground text-sm font-medium">
            <span>📱 {phone || 'Not set'}</span>
            <span className="ml-auto text-[10px] text-muted-foreground">locked</span>
          </div>
        </div>

        {/* Sync marks across cards */}
        <button onClick={handleToggleSync}
          className="w-full flex items-center justify-between px-3 py-3 rounded-lg bg-muted text-foreground text-sm">
          <span className="flex flex-col items-start">
            <span>Mark across cards</span>
            <span className="text-[10px] text-muted-foreground">Tap a number → marks it on every card that has it</span>
          </span>
          <span className={cn('text-xs font-bold', syncMarks ? 'text-primary' : 'text-muted-foreground')}>
            {syncMarks ? 'ON' : 'OFF'}
          </span>
        </button>

        {/* Sound */}
        <button onClick={handleToggleMute}
          className="w-full flex items-center justify-between px-3 py-3 rounded-lg bg-muted text-foreground text-sm">
          <span className="flex items-center gap-2">
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            Sound
          </span>
          <span className={cn('text-xs font-bold', muted ? 'text-destructive' : 'text-primary')}>
            {muted ? 'OFF' : 'ON'}
          </span>
        </button>

        {/* Theme */}
        <button onClick={toggleTheme}
          className="w-full flex items-center justify-between px-3 py-3 rounded-lg bg-muted text-foreground text-sm">
          <span className="flex items-center gap-2">
            {theme === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            Theme
          </span>
          <span className="text-xs font-bold text-primary">{theme === 'dark' ? 'Dark' : 'Light'}</span>
        </button>

        {/* Language */}
        <button onClick={handleToggleLang}
          className="w-full flex items-center justify-between px-3 py-3 rounded-lg bg-muted text-foreground text-sm">
          <span className="flex items-center gap-2">
            <Globe className="w-4 h-4" />
            Language
          </span>
          <span className="text-xs font-bold text-primary">{getLang() === 'ti' ? 'ትግርኛ' : 'English'}</span>
        </button>

        {/* Support */}
        <a
          href="https://t.me/+251978187178"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center gap-2 px-3 py-3 rounded-lg bg-primary/10 text-primary text-sm font-medium"
        >
          <Send className="w-4 h-4" />
          Telegram Support
        </a>

        {/* Logout */}
        <button onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-3 py-3 rounded-lg bg-destructive/10 text-destructive text-sm font-bold">
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </motion.div>
    </motion.div>
  );
}
