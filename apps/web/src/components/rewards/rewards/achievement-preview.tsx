'use client';

import { ArrowRight, Check, Star, Trophy } from 'lucide-react';

interface AchievementPreviewItem {
  id: string;
  isCompleted: boolean;
}

interface AchievementPreviewProps {
  achievements: AchievementPreviewItem[];
  onViewAll: () => void;
}

export function AchievementPreview({
  achievements,
  onViewAll,
}: AchievementPreviewProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-amber-500" />
          <h2 className="font-semibold text-foreground text-lg">
            Achievements
          </h2>
        </div>
        <button
          onClick={onViewAll}
          className="flex items-center gap-1 font-medium text-indigo-500 text-sm hover:text-indigo-600"
        >
          View all
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-4 gap-3">
        {achievements.slice(0, 4).map((achievement, index) => (
          <div
            key={achievement.id}
            className={`flex aspect-square items-center justify-center rounded-xl ${
              index === 0 && achievement.isCompleted
                ? 'bg-amber-100'
                : 'bg-gray-100'
            }`}
          >
            {achievement.isCompleted ? (
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-400">
                <Check className="h-6 w-6 text-white" />
              </div>
            ) : (
              <Star className="h-8 w-8 text-gray-300" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
