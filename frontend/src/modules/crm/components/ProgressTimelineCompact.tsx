import { Check } from 'lucide-react';
import { cn } from '../../../components/ui/utils';

export interface TimelineStepCompact {
  step: number;
  completed: boolean;
}

interface ProgressTimelineCompactProps {
  steps: TimelineStepCompact[];
  completedSteps: number;
  className?: string;
}

export function ProgressTimelineCompact({ steps, completedSteps, className }: ProgressTimelineCompactProps) {
  const progressPercentage = Math.round((completedSteps / steps.length) * 100);

  return (
    <div className={cn("space-y-3", className)}>
      {/* Header */}
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-gray-700">Прогрес</span>
        <span className="text-xs font-semibold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">
          {completedSteps}/{steps.length} ({progressPercentage}%)
        </span>
      </div>

      {/* Horizontal Progress Line */}
      <div className="relative px-2">
        {/* Background Line */}
        <div className="absolute top-3 left-5 right-5 h-0.5 bg-gray-200" />
        
        {/* Progress Line */}
        <div 
          className="absolute top-3 left-5 h-0.5 bg-emerald-500 transition-all duration-500"
          style={{ 
            width: steps.length > 1 
              ? `calc(((100% - 40px) * ${completedSteps - 1}) / ${steps.length - 1})`
              : '0%'
          }}
        />

        {/* Steps */}
        <div className="relative flex justify-between">
          {steps.map((step) => (
            <div key={step.step} className="flex flex-col items-center">
              {/* Circle */}
              <div
                className={cn(
                  'w-6 h-6 rounded-full border-2 flex items-center justify-center',
                  'transition-all duration-300 bg-white z-10 shadow-sm',
                  step.completed 
                    ? 'border-emerald-500 bg-emerald-500' 
                    : 'border-gray-300 bg-white'
                )}
              >
                {step.completed ? (
                  <Check className="w-3 h-3 text-white" />
                ) : (
                  <span className="text-[10px] font-medium text-gray-400">
                    {step.step}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Current Step Info */}
      {completedSteps < steps.length && (
        <div className="text-xs text-gray-600">
          Поточний етап: <span className="font-medium text-gray-800">{completedSteps + 1}</span> з {steps.length}
        </div>
      )}
      {completedSteps >= steps.length && (
        <div className="text-xs text-emerald-600 font-medium">
          ✓ Замовлення виконано
        </div>
      )}
    </div>
  );
}

