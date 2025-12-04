interface LoyaltyProgressProps {
  currentAmount: number;
  nextTierAmount: number;
  nextTierName: string;
}

export function LoyaltyProgress({ currentAmount, nextTierAmount, nextTierName }: LoyaltyProgressProps) {
  const progress = Math.min((currentAmount / nextTierAmount) * 100, 100);
  const remaining = Math.max(nextTierAmount - currentAmount, 0);
  
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-600">Прогрес до {nextTierName}</span>
        <span className="font-semibold text-gray-900">
          {currentAmount.toLocaleString()}₴ / {nextTierAmount.toLocaleString()}₴
        </span>
      </div>
      
      <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
        <div
          className="bg-gradient-to-r from-orange-500 to-orange-600 h-full rounded-full transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
      
      {remaining > 0 && (
        <p className="text-xs text-gray-500">
          Ще {remaining.toLocaleString()}₴ до {nextTierName}
        </p>
      )}
    </div>
  );
}

