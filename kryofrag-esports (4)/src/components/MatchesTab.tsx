import React, { useState } from 'react';
import { Check, Trophy } from 'lucide-react';
import { formatMatchDate } from '../lib/formatters';
import type { MatchTypeFilter, TournamentMatch } from '../types/esports';

interface MatchesTabProps {
  matches: TournamentMatch[];
  currentUserId: string;
  filter: MatchTypeFilter;
  onFilterChange: (filter: MatchTypeFilter) => void;
  onJoinClick: (match: TournamentMatch) => void;
  onViewResult: (match: TournamentMatch) => void;
}

const FILTERS: MatchTypeFilter[] = ['All', 'Solo', 'Duo', 'Squad'];

const isMatchCompleted = (m: TournamentMatch) =>
  m.status === 'Completed' || Boolean(m.resultsPublished);

export const MatchesTab: React.FC<MatchesTabProps> = ({
  matches,
  currentUserId,
  filter,
  onFilterChange,
  onJoinClick,
  onViewResult,
}) => {
  const [statusTab, setStatusTab] = useState<'upcoming' | 'completed'>('upcoming');

  const upcomingMatches = matches.filter((m) => !isMatchCompleted(m));
  const completedMatches = matches.filter((m) => isMatchCompleted(m));

  const baseList = statusTab === 'upcoming' ? upcomingMatches : completedMatches;

  const filtered =
    filter === 'All'
      ? baseList
      : baseList.filter((m) => (m.type || '').toLowerCase() === filter.toLowerCase());

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
            const isJoined = participants.some((p) => p.uid === currentUserId);
            const isFull = joinedCount >= maxSlots;
            const completed = isMatchCompleted(m);

            return (
              <article
                key={m.id}
                className={`card-surface rounded-2xl p-4 sm:p-5 flex flex-col justify-between gap-4 transition ${
                  completed
                    ? 'border border-amber-400/25 hover:border-amber-400/45'
                    : 'hover:border-[#00FF88]/30'
                }`}
              >
                <div className="space-y-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-xs text-slate-400 flex-wrap">
                        <span className="font-semibold text-[#FF5500]">{m.type || 'Solo'}</span>
                        <span aria-hidden="true">·</span>
                        <span>{m.map || 'Bermuda'}</span>
                        <span aria-hidden="true">·</span>
                        <span>{formatMatchDate(m.dateTime)}</span>
                        {completed && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-bold text-[#00FF88]">Completed</span>
                          </>
                        )}
                      </div>
                      <h3 className="font-gaming text-2xl font-bold uppercase text-white mt-1 leading-tight truncate">
                        {m.title}
                      </h3>
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
                </div>

                <div className="flex items-center justify-between gap-4 pt-1">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-slate-400">
                        {completed ? 'Players Competed' : 'Slots Filled'}
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

                  {completed ? (
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
