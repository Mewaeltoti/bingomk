import { useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { isMuted, setMuted } from '@/lib/sounds';
import { cn } from '@/lib/utils';

export default function MuteToggle({ className }: { className?: string }) {
  const [muted, setLocal] = useState(isMuted());

  const toggle = () => {
    const next = !muted;
    setMuted(next);
    setLocal(next);
  };

  return (
    <button
      onClick={toggle}
      aria-label={muted ? 'Unmute' : 'Mute'}
      className={cn(
        'p-2 rounded-full transition-colors bg-muted/60 text-muted-foreground hover:text-foreground',
        className
      )}
    >
      {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
    </button>
  );
}
