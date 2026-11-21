import React, { useState } from 'react';
import {
  Ban,
  Check,
  Clock,
  Copy,
  Crosshair,
  ExternalLink,
  Play,
  Shield,
  Trophy,
} from 'lucide-react';
import { copyToClipboard, formatMatchDate } from '../lib/formatters';
import type { MatchTypeFilter, TournamentMatch } from '../types/esports';

interface MatchesTabProps {
  matches: TournamentMatch[];
  currentUserId: string;
  filter: MatchTypeFilter;
  onFilterChange: (filter: MatchTypeFilter) => void;
  onJoinClick: (match: TournamentMatch) => void;
  onViewResult: (match: TournamentMatch) => void;
  onToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const FILTERS: MatchTypeFilter[] = ['All', 'Solo', 'Duo', 'Squad'];

const isMatchCompleted = (m: TournamentMatch) =>
  m.status === 'Completed' || Boolean(m.resultsPublished);

const isMatchCancelled = (m: TournamentMatch) => m.status === 'Cancelled';

export const MatchesTab: React.FC<MatchesTabProps> = ({
  matches,
  currentUserId,
  filter,
  onFilterChange,
  onJoinClick,
  onViewResult,
  onToast,
}) => {
  const [statusTab, setStatusTab] = useState<'upcoming' | 'completed'>('upcoming');

  const upcomingMatches = matches.filter((m) => !isMatchCompleted(m) && !isMatchCancelled(m));
  const completedMatches = matches.filter((m) => isMatchCompleted(m) || isMatchCancelled(m));

  const baseList = statusTab === 'upcoming' ? upcomingMatches : completedMatches;

  const filtered =
    filter === 'All'
      ? baseList
      : baseList.filter((m) => (m.type || '').toLowerCase() === filter.toLowerCase());

  const handleCopy = async (val: string, label: string) => {
    if (!val) return;
    const ok = await copyToClipboard(val);
    if (ok) onToast(label, 'success');
  };

  return (
    <section className="space-y-4">
      {/* Status Tabs: Upcoming vs Completed / Results */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[#151A23] border border-white/10 w-full sm:w-auto">
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
            Completed / Results ({completedMatches.length})
          </button>
        </div>

        {/* Mode Type Filter */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar p-1 rounded-xl bg-[#151A23] border border-white/10">
          {FILTERS.map((f) => {
            const active = f === filter;
            return (
              <button
                key={f}
                type="button"
                onClick={() => onFilterChange(f)}
                className={`min-h-[36px] px-3.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider transition whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-[#1C222E] text-[#00FF88] border border-[#00FF88]/40'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {f}
              </button>
            );
          })}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card-surface rounded-2xl p-8 text-center text-slate-400 text-sm">
          {statusTab === 'upcoming'
            ? `No ${filter === 'All' ? '' : `${filter} `}upcoming tournaments available right now. Check back soon!`
            : `No ${filter === 'All' ? '' : `${filter} `}completed match results published yet.`}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((m) => {
            const joinedCount = Number(m.joinedCount || 0);
            const maxSlots = Number(m.maxSlots || 48);
            const pct = Math.min(100, Math.round((joinedCount / Math.max(1, maxSlots)) * 100));
            const participants = Array.isArray(m.participants) ? m.participants : [];
            const me = participants.find((p) => p.uid === currentUserId);
            const isJoined = Boolean(me);
            const isFull = joinedCount >= maxSlots;
            const completed = isMatchCompleted(m);
            const cancelled = isMatchCancelled(m);
            const gunOn = m.gunSkinAllowed !== false;
            const skillOn = m.charSkillAllowed !== false;
            const roomPublished = Boolean(m.roomPublished);
            const hasRoomCreds = Boolean((m.roomId || '').trim() || (m.roomPass || '').trim());
            const liveUrl = (m.watchLiveUrl || '').trim();

            return (
              <article
                key={m.id}
                className={`card-surface rounded-2xl p-4 sm:p-5 flex flex-col justify-between gap-4 transition ${
                  cancelled
                    ? 'border border-red-500/35 opacity-85'
                    : completed
                      ? 'border border-amber-400/25 hover:border-amber-400/45'
                      : 'hover:border-[#00FF88]/30'
                }`}
              >
                <div className="space-y-3.5">
                  <div className="space-y-2">
                    {/* Visual Pro Tags/Badges */}
                    <div className="flex items-center gap-1.5 flex-wrap text-[10px] font-bold uppercase tracking-wider">
                      <span className="px-2 py-0.5 rounded bg-[#FF5500]/15 border border-[#FF5500]/40 text-[#FF5500]">
                        {m.type || 'Solo'}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-sky-500/15 border border-sky-400/35 text-sky-300">
                        {m.map || 'Bermuda'}
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
                        Character Skill {skillOn ? 'ON' : 'OFF'}
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
                        <h3 className="font-gaming text-2xl font-bold uppercase text-white leading-tight truncate">
                          {m.title}
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {formatMatchDate(m.dateTime)}
                          {me?.slotLabel ? (
                            <span className="text-[#00FF88] font-semibold">
                              {' '}
                              · {me.slotLabel}
                            </span>
                          ) : null}
                        </p>
                      </div>

                      {liveUrl && (
                        <a
                          href={liveUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="min-h-[34px] px-2.5 py-1 rounded-lg bg-red-500/15 border border-red-500/45 text-red-400 text-[11px] font-bold uppercase tracking-wider hover:bg-red-500 hover:text-white transition inline-flex items-center gap-1 shrink-0 whitespace-nowrap"
                        >
                          <Play className="w-3 h-3 fill-current" />
                          Watch Live
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="p-2.5 rounded-xl bg-[#0B0E14] border border-white/5 text-center">
                      <span className="text-[11px] text-slate-400 block">Entry Fee</span>
                      <span className="font-gaming text-base font-bold text-[#FF5500] tabular-nums">
                        {Number(m.entryFee || 0)} Coins
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[#0B0E14] border border-white/5 text-center">
                      <span className="text-[11px] text-slate-400 block">Per Kill</span>
                      <span className="font-gaming text-base font-bold text-[#00FF88] tabular-nums">
                        {Number(m.perKill || 0)} Coins
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[#0B0E14] border border-white/5 text-center">
                      <span className="text-[11px] text-slate-400 block">Booyah Prize</span>
                      <span className="font-gaming text-base font-bold text-amber-400 tabular-nums">
                        {Number(m.booyahPrize || 0)} Coins
                      </span>
                    </div>
                  </div>

                  {/* In-App Room ID & Password ONLY for joined users & when Admin toggled Publish Room Details ON */}
                  {isJoined && !completed && !cancelled && (
                    roomPublished && hasRoomCreds ? (
                      <div className="p-3 rounded-xl bg-[#00FF88]/10 border border-[#00FF88]/40 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-[#00FF88]">
                            Room Details Live
                          </span>
                          {me?.slotLabel && (
                            <span className="text-[10px] font-bold uppercase text-white bg-[#0B0E14] px-2 py-0.5 rounded border border-white/10">
                              {me.slotLabel}
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="p-2 rounded-lg bg-[#0B0E14] border border-white/10">
                            <span className="text-[10px] text-slate-400 block">Room ID</span>
                            <div className="flex items-center justify-between gap-1 mt-0.5">
                              <code className="text-xs font-mono-code font-bold text-white truncate">
                                {m.roomId || '-'}
                              </code>
                              <button
                                type="button"
                                onClick={() => handleCopy(m.roomId || '', 'Room ID copied!')}
                                className="px-1.5 py-0.5 rounded bg-[#151A23] text-[10px] font-semibold text-[#00FF88] border border-[#00FF88]/30 inline-flex items-center gap-1 shrink-0 hover:bg-[#00FF88] hover:text-[#0B0E14] transition"
                              >
                                <Copy className="w-2.5 h-2.5" />
                                Copy
                              </button>
                            </div>
                          </div>
                          <div className="p-2 rounded-lg bg-[#0B0E14] border border-white/10">
                            <span className="text-[10px] text-slate-400 block">Password</span>
                            <div className="flex items-center justify-between gap-1 mt-0.5">
                              <code className="text-xs font-mono-code font-bold text-white truncate">
                                {m.roomPass || '-'}
                              </code>
                              <button
                                type="button"
                                onClick={() =>
                                  handleCopy(m.roomPass || '', 'Room Password copied!')
                                }
                                className="px-1.5 py-0.5 rounded bg-[#151A23] text-[10px] font-semibold text-[#00FF88] border border-[#00FF88]/30 inline-flex items-center gap-1 shrink-0 hover:bg-[#00FF88] hover:text-[#0B0E14] transition"
                              >
                                <Copy className="w-2.5 h-2.5" />
                                Copy
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="px-3 py-2 rounded-xl bg-[#0B0E14] border border-white/10 flex items-center gap-2 text-[11px] text-amber-300">
                        <Clock className="w-3.5 h-3.5 shrink-0" />
                        <span>Room ID &amp; Password will unlock once Admin publishes them.</span>
                      </div>
                    )
                  )}
                </div>

                <div className="flex items-center justify-between gap-4 pt-1">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-slate-400">
                        {cancelled
                          ? 'Match Cancelled'
                          : completed
                            ? 'Players Competed'
                            : 'Slots Filled'}
                      </span>
                      <span className="font-semibold text-white tabular-nums">
                        {joinedCount}/{maxSlots}
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-[#0B0E14] overflow-hidden border border-white/5">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#00FF88] to-[#FF5500] transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  {cancelled ? (
                    <button
                      type="button"
                      disabled
                      className="min-h-[42px] px-4 py-2 rounded-xl bg-red-500/15 border border-red-500/40 text-red-400 font-gaming font-bold text-sm uppercase tracking-wider flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-not-allowed"
                    >
                      <Ban className="w-4 h-4" />
                      Cancelled
                    </button>
                  ) : completed ? (
                    <button
                      type="button"
                      onClick={() => onViewResult(m)}
                      className="min-h-[42px] px-4 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-[#FF5500] text-[#0B0E14] font-gaming font-bold text-sm uppercase tracking-wider hover:brightness-110 active:scale-95 transition flex items-center gap-1.5 whitespace-nowrap shrink-0"
                    >
                      <Trophy className="w-4 h-4" />
                      View Result
                    </button>
                  ) : isJoined ? (
                    <button
                      type="button"
                      disabled
                      className="min-h-[42px] px-4 py-2 rounded-xl bg-[#00FF88]/15 border border-[#00FF88]/40 text-[#00FF88] font-gaming font-bold text-sm uppercase tracking-wider flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-default"
                    >
                      <Check className="w-4 h-4" />
                      Joined
                    </button>
                  ) : isFull ? (
                    <button
                      type="button"
                      disabled
                      className="min-h-[42px] px-4 py-2 rounded-xl bg-slate-800 text-slate-400 font-gaming font-bold text-sm uppercase tracking-wider whitespace-nowrap shrink-0 cursor-not-allowed"
                    >
                      Slots Full
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onJoinClick(m)}
                      className="min-h-[42px] px-5 py-2 rounded-xl bg-gradient-to-r from-[#00FF88] to-[#00CC6E] text-[#0B0E14] font-gaming font-bold text-sm uppercase tracking-wider hover:brightness-110 active:scale-95 transition glow-green-sm whitespace-nowrap shrink-0"
                    >
                      Join Now
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};
