import React from 'react';
import { Clock, Copy } from 'lucide-react';
import { copyToClipboard, formatMatchDate } from '../lib/formatters';
import type { TournamentMatch } from '../types/esports';

interface MyMatchesTabProps {
  matches: TournamentMatch[];
  currentUserId: string;
  onToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const MyMatchesTab: React.FC<MyMatchesTabProps> = ({
  matches,
  currentUserId,
  onToast,
}) => {
  const myMatches = matches.filter(
    (m) =>
      Array.isArray(m.participants) &&
      m.participants.some((p) => p.uid === currentUserId)
  );

  const handleCopy = async (value: string, label: string) => {
    if (!value) return;
    const ok = await copyToClipboard(value);
    if (ok) onToast(label, 'success');
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-gaming text-2xl font-bold uppercase text-white">
            My Joined Matches
          </h2>
          <p className="text-xs text-slate-400">
            Room ID &amp; Password appear here as soon as Admin updates them.
          </p>
        </div>
        <span className="text-sm font-bold text-[#00FF88] tabular-nums whitespace-nowrap">
          {myMatches.length} Joined
        </span>
      </div>

      {myMatches.length === 0 ? (
        <div className="card-surface rounded-2xl p-8 text-center text-slate-400 text-sm">
          You haven&apos;t joined any matches yet. Head to Matches tab to compete!
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {myMatches.map((m) => {
            const me = m.participants.find((p) => p.uid === currentUserId);
            const hasRoom = Boolean((m.roomId || '').trim() || (m.roomPass || '').trim());

            return (
              <article
                key={m.id}
                className="card-surface rounded-2xl p-4 sm:p-5 space-y-3.5 border border-[#00FF88]/25"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <span className="font-semibold text-[#FF5500]">{m.type}</span>
                      <span aria-hidden="true">·</span>
                      <span>{m.map}</span>
                      <span aria-hidden="true">·</span>
                      <span>{formatMatchDate(m.dateTime)}</span>
                    </div>
                    <h3 className="font-gaming text-xl font-bold uppercase text-white mt-1 truncate">
                      {m.title}
                    </h3>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs px-3.5 py-2.5 rounded-xl bg-[#0B0E14] border border-white/5">
                  <span className="text-slate-400">Your Registered IGN</span>
                  <span className="font-bold text-[#00FF88]">{me?.ign || '-'}</span>
                </div>

                {hasRoom ? (
                  <div className="p-3.5 rounded-xl bg-[#00FF88]/10 border border-[#00FF88]/35 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-[#00FF88]">
                        Room Details Live
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="p-2.5 rounded-lg bg-[#0B0E14] border border-white/10">
                        <span className="text-[11px] text-slate-400 block">Room ID</span>
                        <div className="flex items-center justify-between gap-1.5 mt-1">
                          <code className="text-xs font-mono-code font-bold text-white truncate">
                            {m.roomId || '-'}
                          </code>
                          <button
                            type="button"
                            onClick={() => handleCopy(m.roomId || '', 'Room ID copied!')}
                            className="min-h-[30px] px-2 py-0.5 rounded bg-[#151A23] text-[11px] font-semibold text-[#00FF88] border border-[#00FF88]/30 inline-flex items-center gap-1 shrink-0 hover:bg-[#00FF88] hover:text-[#0B0E14] transition"
                          >
                            <Copy className="w-3 h-3" />
                            Copy
                          </button>
                        </div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-[#0B0E14] border border-white/10">
                        <span className="text-[11px] text-slate-400 block">Password</span>
                        <div className="flex items-center justify-between gap-1.5 mt-1">
                          <code className="text-xs font-mono-code font-bold text-white truncate">
                            {m.roomPass || '-'}
                          </code>
                          <button
                            type="button"
                            onClick={() => handleCopy(m.roomPass || '', 'Room Password copied!')}
                            className="min-h-[30px] px-2 py-0.5 rounded bg-[#151A23] text-[11px] font-semibold text-[#00FF88] border border-[#00FF88]/30 inline-flex items-center gap-1 shrink-0 hover:bg-[#00FF88] hover:text-[#0B0E14] transition"
                          >
                            <Copy className="w-3 h-3" />
                            Copy
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-[#0B0E14] border border-white/10 flex items-center justify-center gap-2 text-center">
                    <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                    <p className="text-xs text-amber-400 font-medium">
                      Room ID &amp; Password will be shared 10 mins before match
                    </p>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};
