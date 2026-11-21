import React, { useState } from 'react';
import {
  Ban,
  Clock,
  Copy,
  Crosshair,
  Crown,
  ExternalLink,
  Play,
  Shield,
  Trophy,
} from 'lucide-react';
import { copyToClipboard, formatMatchDate } from '../lib/formatters';
import type { TournamentMatch } from '../types/esports';

interface MyMatchesTabProps {
  matches: TournamentMatch[];
  currentUserId: string;
  onToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  onViewResult: (match: TournamentMatch) => void;
}

const isMatchCompleted = (m: TournamentMatch) =>
  m.status === 'Completed' || Boolean(m.resultsPublished);

const isMatchCancelled = (m: TournamentMatch) => m.status === 'Cancelled';

export const MyMatchesTab: React.FC<MyMatchesTabProps> = ({
  matches,
  currentUserId,
  onToast,
  onViewResult,
}) => {
  const [statusTab, setStatusTab] = useState<'upcoming' | 'completed'>('upcoming');

  const myMatches = matches.filter(
    (m) =>
      Array.isArray(m.participants) &&
      m.participants.some((p) => p.uid === currentUserId)
  );

  const upcomingMatches = myMatches.filter(
    (m) => !isMatchCompleted(m) && !isMatchCancelled(m)
  );
  const completedMatches = myMatches.filter(
    (m) => isMatchCompleted(m) || isMatchCancelled(m)
  );
  const visibleMatches = statusTab === 'upcoming' ? upcomingMatches : completedMatches;

  const handleCopy = async (value: string, label: string) => {
    if (!value) return;
    const ok = await copyToClipboard(value);
    if (ok) onToast(label, 'success');
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-gaming text-2xl font-bold uppercase text-white">
            My Joined Matches
          </h2>
          <p className="text-xs text-slate-400">
            Your team slot, live Room ID &amp; Password, and final match results.
          </p>
        </div>
        <span className="text-sm font-bold text-[#00FF88] tabular-nums whitespace-nowrap">
          {myMatches.length} Joined
        </span>
      </div>

      <div className="grid grid-cols-2 sm:inline-grid gap-1.5 p-1 rounded-xl bg-[#151A23] border border-white/10">
        <button
          type="button"
          onClick={() => setStatusTab('upcoming')}
          className={`min-h-[40px] px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition whitespace-nowrap tabular-nums ${
            statusTab === 'upcoming'
              ? 'bg-[#00FF88] text-[#0B0E14]'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Upcoming ({upcomingMatches.length})
        </button>
        <button
          type="button"
          onClick={() => setStatusTab('completed')}
          className={`min-h-[40px] px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition whitespace-nowrap tabular-nums inline-flex items-center justify-center gap-1.5 ${
            statusTab === 'completed'
              ? 'bg-[#FF5500] text-white'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Trophy className="w-3.5 h-3.5" />
          Completed / Past ({completedMatches.length})
        </button>
      </div>

      {myMatches.length === 0 ? (
        <div className="card-surface rounded-2xl p-8 text-center text-slate-400 text-sm">
          You haven&apos;t joined any matches yet. Head to Matches tab to compete!
        </div>
      ) : visibleMatches.length === 0 ? (
        <div className="card-surface rounded-2xl p-8 text-center text-slate-400 text-sm">
          {statusTab === 'upcoming'
            ? 'No upcoming joined matches right now.'
            : 'None of your joined matches have completed or cancelled yet.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {visibleMatches.map((m) => {
            const me = m.participants.find((p) => p.uid === currentUserId);
            const roomPublished = Boolean(m.roomPublished);
            const hasRoomCreds = Boolean((m.roomId || '').trim() || (m.roomPass || '').trim());
            const completed = isMatchCompleted(m);
            const cancelled = isMatchCancelled(m);
            const gunOn = m.gunSkinAllowed !== false;
            const skillOn = m.charSkillAllowed !== false;
            const liveUrl = (m.watchLiveUrl || '').trim();
            const myResult = Array.isArray(m.results)
              ? m.results.find((r) => r.uid === currentUserId)
              : undefined;

            return (
              <article
                key={m.id}
                className={`card-surface rounded-2xl p-4 sm:p-5 space-y-3.5 border ${
                  cancelled
                    ? 'border-red-500/35'
                    : completed
                      ? 'border-amber-400/30'
                      : 'border-[#00FF88]/25'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 flex-wrap text-[10px] font-bold uppercase tracking-wider">
                    <span className="px-2 py-0.5 rounded bg-[#FF5500]/15 border border-[#FF5500]/40 text-[#FF5500]">
                      {m.type}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-sky-500/15 border border-sky-400/35 text-sky-300">
                      {m.map}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded border inline-flex items-center gap-1 ${
                        gunOn
                          ? 'bg-[#00FF88]/10 border-[#00FF88]/30 text-[#00FF88]'
                          : 'bg-red-500/10 border-red-500/30 text-red-400'
                      }`}
                    >
                      <Crosshair className="w-2.5 h-2.5" />
                      Gun Skin {gunOn ? 'ON' : 'OFF'}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded border inline-flex items-center gap-1 ${
                        skillOn
                          ? 'bg-purple-500/15 border-purple-400/35 text-purple-300'
                          : 'bg-red-500/10 border-red-500/30 text-red-400'
                      }`}
                    >
                      <Shield className="w-2.5 h-2.5" />
                      Skill {skillOn ? 'ON' : 'OFF'}
                    </span>
                    {cancelled && (
                      <span className="px-2 py-0.5 rounded bg-red-500/20 border border-red-500/45 text-red-400">
                        Cancelled · Refunded
                      </span>
                    )}
                    {completed && !cancelled && (
                      <span className="px-2 py-0.5 rounded bg-[#00FF88]/15 border border-[#00FF88]/40 text-[#00FF88]">
                        Completed
                      </span>
                    )}
                  </div>

                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-gaming text-xl font-bold uppercase text-white truncate">
                        {m.title}
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">{formatMatchDate(m.dateTime)}</p>
                    </div>
                    {liveUrl && (
                      <a
                        href={liveUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-h-[32px] px-2.5 py-1 rounded-lg bg-red-500/15 border border-red-500/45 text-red-400 text-[10px] font-bold uppercase tracking-wider hover:bg-red-500 hover:text-white transition inline-flex items-center gap-1 shrink-0"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        Watch Live
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 text-xs px-3.5 py-2.5 rounded-xl bg-[#0B0E14] border border-white/5 flex-wrap">
                  <div>
                    <span className="text-slate-400">IGN: </span>
                    <span className="font-bold text-[#00FF88]">{me?.ign || '-'}</span>
                  </div>
                  {me?.slotLabel && (
                    <span className="px-2 py-0.5 rounded bg-[#151A23] border border-[#00FF88]/30 text-[#00FF88] font-bold text-[11px]">
                      {me.slotLabel}
                    </span>
                  )}
                </div>

                {cancelled ? (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/35 flex items-center justify-center gap-2 text-center text-xs text-red-300 font-semibold">
                    <Ban className="w-4 h-4 shrink-0" />
                    <span>
                      This match was cancelled. Entry fee ({Number(m.entryFee || 0)} Coins) was
                      refunded to your wallet.
                    </span>
                  </div>
                ) : completed ? (
                  <div className="space-y-3">
                    {myResult && (
                      <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-[#0B0E14] border border-white/10 text-center">
                        <div>
                          <span className="text-[11px] text-slate-400 block">Rank</span>
                          <span className="font-gaming text-base font-bold text-white tabular-nums">
                            #{myResult.rank}
                          </span>
                        </div>
                        <div>
                          <span className="text-[11px] text-slate-400 block">Kills</span>
                          <span className="font-gaming text-base font-bold text-[#FF5500] tabular-nums inline-flex items-center gap-1 justify-center">
                            {Number(myResult.kills || 0)}
                            {myResult.isBooyah && <Crown className="w-3.5 h-3.5 text-amber-400" />}
                          </span>
                        </div>
                        <div>
                          <span className="text-[11px] text-slate-400 block">Won</span>
                          <span className="font-gaming text-base font-bold text-[#00FF88] tabular-nums">
                            +{Number(myResult.coinsWon || 0)} Coins
                          </span>
                        </div>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => onViewResult(m)}
                      className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-400 to-[#FF5500] text-[#0B0E14] font-gaming font-bold text-sm uppercase tracking-wider hover:brightness-110 transition flex items-center justify-center gap-2"
                    >
                      <Trophy className="w-4 h-4" />
                      View Result
                    </button>
                  </div>
                ) : roomPublished && hasRoomCreds ? (
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
                      Room ID &amp; Password will appear once Admin publishes Room Details
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
