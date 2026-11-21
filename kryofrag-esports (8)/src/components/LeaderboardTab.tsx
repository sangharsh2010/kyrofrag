import React, { useMemo } from 'react';
import { Award, Crosshair, Crown, Flame, Medal, Shield, Trophy } from 'lucide-react';
import { formatMatchDate } from '../lib/formatters';
import type { TournamentMatch } from '../types/esports';

interface LeaderboardTabProps {
  matches: TournamentMatch[];
  currentUserId: string;
  onViewResult: (match: TournamentMatch) => void;
}

interface TopEarnerRow {
  uid: string;
  ign: string;
  totalCoins: number;
  totalKills: number;
  booyahWins: number;
  matchesPlayed: number;
}

const isMatchCompleted = (m: TournamentMatch) =>
  m.status === 'Completed' || Boolean(m.resultsPublished);

export const LeaderboardTab: React.FC<LeaderboardTabProps> = ({
  matches,
  currentUserId,
  onViewResult,
}) => {
  const completedMatches = useMemo(
    () => matches.filter((m) => isMatchCompleted(m)),
    [matches]
  );

  const topEarners = useMemo<TopEarnerRow[]>(() => {
    const map = new Map<string, TopEarnerRow>();

    completedMatches.forEach((m) => {
      const results = Array.isArray(m.results) ? m.results : [];
      results.forEach((r) => {
        if (!r.uid) return;
        const existing = map.get(r.uid);
        const coins = Math.max(0, Number(r.coinsWon || 0));
        const kills = Math.max(0, Number(r.kills || 0));
        const booyah = r.isBooyah ? 1 : 0;

        if (existing) {
          existing.totalCoins += coins;
          existing.totalKills += kills;
          existing.booyahWins += booyah;
          existing.matchesPlayed += 1;
          if (r.ign) existing.ign = r.ign;
        } else {
          map.set(r.uid, {
            uid: r.uid,
            ign: r.ign || 'Player',
            totalCoins: coins,
            totalKills: kills,
            booyahWins: booyah,
            matchesPlayed: 1,
          });
        }
      });
    });

    return Array.from(map.values())
      .sort((a, b) => {
        if (b.totalCoins !== a.totalCoins) return b.totalCoins - a.totalCoins;
        if (b.booyahWins !== a.booyahWins) return b.booyahWins - a.booyahWins;
        if (b.totalKills !== a.totalKills) return b.totalKills - a.totalKills;
        return a.ign.localeCompare(b.ign);
      })
      .slice(0, 25);
  }, [completedMatches]);

  const podium = topEarners.slice(0, 3);

  return (
    <section className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-gaming text-2xl font-bold uppercase text-white flex items-center gap-2">
            <Trophy className="w-6 h-6 text-amber-400" />
            Leaderboard &amp; Results
          </h2>
          <p className="text-xs text-slate-400">
            Top tournament earners, Booyah champions &amp; verified match scoreboards.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="px-3 py-1.5 rounded-xl bg-[#151A23] border border-white/10 text-slate-300 tabular-nums">
            Completed Matches:{' '}
            <strong className="text-[#00FF88]">{completedMatches.length}</strong>
          </span>
        </div>
      </div>

      {/* Top Earners / Winners Leaderboard */}
      <div className="card-surface rounded-2xl p-5 space-y-4 border border-[#00FF88]/25">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-400/15 border border-amber-400/40 flex items-center justify-center text-amber-400">
              <Crown className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-gaming text-xl font-bold uppercase text-white">
                Top Earners &amp; Winners
              </h3>
              <p className="text-xs text-slate-400">
                Ranked by total tournament coins won across completed matches
              </p>
            </div>
          </div>
        </div>

        {topEarners.length === 0 ? (
          <div className="p-8 rounded-xl bg-[#0B0E14] border border-white/5 text-center text-xs text-slate-400">
            No completed match payouts yet. Win a tournament to claim the #1 spot!
          </div>
        ) : (
          <>
            {/* Top 3 Podium Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {podium.map((player, idx) => {
                const rank = idx + 1;
                const isMe = player.uid === currentUserId;
                const cardStyle =
                  rank === 1
                    ? 'bg-gradient-to-b from-amber-400/15 to-[#0B0E14] border-amber-400/50'
                    : rank === 2
                      ? 'bg-gradient-to-b from-slate-300/10 to-[#0B0E14] border-slate-300/35'
                      : 'bg-gradient-to-b from-[#FF5500]/15 to-[#0B0E14] border-[#FF5500]/45';
                const badgeColor =
                  rank === 1
                    ? 'text-amber-400'
                    : rank === 2
                      ? 'text-slate-200'
                      : 'text-[#FF5500]';

                return (
                  <div
                    key={player.uid}
                    className={`rounded-xl p-4 border space-y-2 ${cardStyle}`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`font-gaming text-lg font-bold uppercase inline-flex items-center gap-1.5 ${badgeColor}`}
                      >
                        <Medal className="w-4 h-4" />
                        Rank #{rank}
                      </span>
                      {isMe && (
                        <span className="px-2 py-0.5 rounded bg-[#00FF88]/20 text-[#00FF88] text-[10px] font-bold uppercase">
                          You
                        </span>
                      )}
                    </div>
                    <p className="font-gaming text-xl font-bold text-white truncate">
                      {player.ign}
                    </p>
                    <div className="flex items-center justify-between text-xs pt-1 border-t border-white/10">
                      <span className="text-slate-400 tabular-nums">
                        {player.booyahWins} Booyah · {player.totalKills} Kills
                      </span>
                      <span className="font-gaming text-lg font-bold text-[#00FF88] tabular-nums">
                        {player.totalCoins} Coins
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Full Ranked List */}
            <div className="divide-y divide-white/5 rounded-xl bg-[#0B0E14] border border-white/10 overflow-hidden">
              {topEarners.map((player, idx) => {
                const rank = idx + 1;
                const isMe = player.uid === currentUserId;
                return (
                  <div
                    key={player.uid}
                    className={`px-4 py-3 flex items-center justify-between gap-3 ${
                      isMe ? 'bg-[#00FF88]/10' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`w-8 h-8 rounded-lg border flex items-center justify-center font-gaming text-sm font-bold tabular-nums shrink-0 ${
                          rank === 1
                            ? 'border-amber-400/50 text-amber-400 bg-amber-400/10'
                            : rank === 2
                              ? 'border-slate-300/40 text-slate-200 bg-slate-300/10'
                              : rank === 3
                                ? 'border-[#FF5500]/50 text-[#FF5500] bg-[#FF5500]/10'
                                : 'border-white/10 text-slate-400 bg-[#151A23]'
                        }`}
                      >
                        #{rank}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white truncate">
                            {player.ign}
                          </span>
                          {isMe && (
                            <span className="text-[10px] font-bold uppercase text-[#00FF88]">
                              (You)
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 tabular-nums">
                          {player.matchesPlayed}{' '}
                          {player.matchesPlayed === 1 ? 'Match' : 'Matches'} ·{' '}
                          {player.booyahWins} Booyah · {player.totalKills} Kills
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="font-gaming text-lg font-bold text-[#00FF88] tabular-nums">
                        +{player.totalCoins}
                      </span>
                      <span className="block text-[10px] uppercase text-slate-500">Coins</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Completed Match Results & Winner Prizes */}
      <div className="space-y-3">
        <h3 className="font-gaming text-xl font-bold uppercase text-white flex items-center gap-2">
          <Award className="w-5 h-5 text-[#FF5500]" />
          Completed Match Results ({completedMatches.length})
        </h3>

        {completedMatches.length === 0 ? (
          <div className="card-surface rounded-2xl p-8 text-center text-xs text-slate-400">
            No completed match results published yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {completedMatches.map((m) => {
              const results = Array.isArray(m.results) ? m.results : [];
              const topWinner = results.find((r) => r.isBooyah) || results[0];
              const totalPaid = results.reduce(
                (sum, r) => sum + Math.max(0, Number(r.coinsWon || 0)),
                0
              );
              const gunOn = m.gunSkinAllowed !== false;
              const skillOn = m.charSkillAllowed !== false;

              return (
                <article
                  key={m.id}
                  className="card-surface rounded-2xl p-4 sm:p-5 border border-amber-400/25 space-y-3.5"
                >
                  <div className="space-y-1.5">
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
                        Skill {skillOn ? 'ON' : 'OFF'}
                      </span>
                    </div>

                    <h4 className="font-gaming text-xl font-bold uppercase text-white truncate">
                      {m.title}
                    </h4>
                    <p className="text-xs text-slate-400">{formatMatchDate(m.dateTime)}</p>
                  </div>

                  {topWinner ? (
                    <div className="p-3 rounded-xl bg-[#0B0E14] border border-amber-400/30 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 inline-flex items-center gap-1">
                          <Flame className="w-3 h-3" />
                          {topWinner.isBooyah ? 'Booyah Champion' : 'Top Scorer'}
                        </span>
                        <p className="text-sm font-bold text-white truncate mt-0.5">
                          {topWinner.ign}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-gaming text-lg font-bold text-[#00FF88] tabular-nums">
                          +{Number(topWinner.coinsWon || 0)} Coins
                        </span>
                        <span className="block text-[10px] text-slate-400 tabular-nums">
                          {Number(topWinner.kills || 0)} Kills
                        </span>
                      </div>
                    </div>
                  ) : null}

                  <div className="flex items-center justify-between gap-3 pt-1">
                    <div className="text-xs text-slate-400 tabular-nums">
                      Total Paid:{' '}
                      <strong className="text-[#00FF88]">{totalPaid} Coins</strong>
                    </div>
                    <button
                      type="button"
                      onClick={() => onViewResult(m)}
                      className="min-h-[40px] px-4 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-[#FF5500] text-[#0B0E14] font-gaming font-bold text-sm uppercase tracking-wider hover:brightness-110 transition inline-flex items-center gap-1.5"
                    >
                      <Trophy className="w-4 h-4" />
                      Full Scoreboard
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};
