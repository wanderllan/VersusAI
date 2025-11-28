
import React from 'react';
import { CrownIcon, TrendingUpIcon, TrophyIcon } from './Icons';
import { LeaderboardItem } from '../types';

interface LeaderboardProps {
  onSelect: (query: string) => void;
}

const MOCK_LEADERBOARD: LeaderboardItem[] = [
  { id: '1', query: 'iPhone 15 Pro Max vs Galaxy S24 Ultra', votes: 15420, trend: 'up' },
  { id: '2', query: 'PS5 Slim vs Xbox Series X', votes: 12350, trend: 'stable' },
  { id: '3', query: 'MacBook Air M3 vs Dell XPS 13', votes: 9840, trend: 'up' },
  { id: '4', query: 'Honda Civic vs Toyota Corolla', votes: 8500, trend: 'down' },
  { id: '5', query: 'Netflix vs Disney+ vs Prime Video', votes: 7200, trend: 'up' },
];

const Leaderboard: React.FC<LeaderboardProps> = ({ onSelect }) => {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden h-full">
      <div className="absolute top-0 right-0 p-4 opacity-10">
        <CrownIcon className="w-16 h-16 text-yellow-500" />
      </div>
      
      <div className="flex items-center mb-4 relative z-10">
        <CrownIcon className="w-5 h-5 mr-2 text-yellow-500" />
        <h3 className="font-semibold text-slate-700 dark:text-slate-300">Battle Arena (Ranking)</h3>
      </div>

      <div className="space-y-3 relative z-10">
        {MOCK_LEADERBOARD.map((item, index) => (
          <button
            key={item.id}
            onClick={() => onSelect(item.query)}
            className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group text-left"
          >
            <div className="flex items-center min-w-0">
              <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold mr-3 ${
                index === 0 ? 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400' :
                index === 1 ? 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400' :
                index === 2 ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400' :
                'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-500'
              }`}>
                {index + 1}
              </span>
              <div className="truncate">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate pr-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  {item.query}
                </p>
                <p className="text-[10px] text-slate-400 flex items-center">
                  {item.votes.toLocaleString()} avaliações
                </p>
              </div>
            </div>
            {item.trend === 'up' && <TrendingUpIcon className="w-3 h-3 text-emerald-500" />}
          </button>
        ))}
      </div>
    </div>
  );
};

export default Leaderboard;
