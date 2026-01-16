import { Award, Star, Crown, Gem } from 'lucide-react';
import { Badge } from './ui/badge';

interface LoyaltyBadgeProps {
  tier: string;
  cashbackRate: number;
  size?: 'sm' | 'md' | 'lg';
}

const TIER_CONFIG = {
  silver: {
    icon: Award,
    color: 'bg-gray-200 text-gray-700',
    name: 'Silver DZYGA'
  },
  gold: {
    icon: Star,
    color: 'bg-yellow-200 text-yellow-800',
    name: 'Gold DZYGA'
  },
  platinum: {
    icon: Crown,
    color: 'bg-slate-200 text-slate-700',
    name: 'Platinum DZYGA'
  },
  diamond: {
    icon: Gem,
    color: 'bg-cyan-200 text-cyan-800',
    name: 'Diamond DZYGA'
  },
  custom: {
    icon: Star,
    color: 'bg-purple-200 text-purple-800',
    name: 'Індивідуальні умови'
  }
};

export function LoyaltyBadge({ tier, cashbackRate, size = 'md' }: LoyaltyBadgeProps) {
  const config = TIER_CONFIG[tier as keyof typeof TIER_CONFIG] || TIER_CONFIG.silver;
  const Icon = config.icon;
  
  const sizeClasses = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-1.5',
    lg: 'text-base px-4 py-2'
  };
  
  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  };
  
  return (
    <Badge className={`${config.color} ${sizeClasses[size]} flex items-center gap-1.5 font-medium`}>
      <Icon className={iconSizes[size]} />
      <span>{config.name}</span>
      <span className="font-semibold">• {cashbackRate}%</span>
    </Badge>
  );
}

