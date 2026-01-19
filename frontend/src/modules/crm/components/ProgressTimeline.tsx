import { Check } from 'lucide-react';
import { cn } from '../../../components/ui/utils';

export interface TimelineStep {
  step: number;
  label: string;
  completed: boolean;
  timestamp?: string;
  details?: string;
}

interface ProgressTimelineProps {
  steps: TimelineStep[];
  completedSteps: number;
  className?: string;
}

export function ProgressTimeline({ steps, completedSteps, className }: ProgressTimelineProps) {
  const progressPercent =
    steps.length > 1 && completedSteps > 0
      ? (Math.min(completedSteps, steps.length) - 1) / (steps.length - 1)
      : 0;
  const lineInsetPercent = steps.length > 0 ? 100 / steps.length / 2 : 0;

  return (
    <div className={cn("space-y-2", className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-900">Progress Timeline</h3>
          <span className="text-xs text-gray-500">
            Завершено: {completedSteps} з {steps.length}
          </span>
        </div>
        <div className="text-xs font-bold text-emerald-600">
          {Math.round((completedSteps / steps.length) * 100)}%
        </div>
      </div>

      {/* Timeline */}
      <div className="relative pt-6 pb-16">
        {/* Background connecting line (сіра) */}
        <div
          className="absolute top-4 rounded-full z-0"
          style={{
            height: 4,
            backgroundColor: '#d1d5db',
            left: `${lineInsetPercent}%`,
            right: `${lineInsetPercent}%`,
          }}
        />
        
        {/* Progress connecting line (зелена) */}
        <div 
          className="absolute top-4 rounded-full transition-all duration-500 z-0"
          style={{ 
            height: 4,
            backgroundColor: '#10b981',
            left: `${lineInsetPercent}%`,
            width: progressPercent > 0
              ? `calc((100% - ${lineInsetPercent * 2}%) * ${progressPercent})`
              : '0%',
          }}
        />

        {/* Steps */}
        <div className="relative flex justify-between items-start">
          {steps.map((step, index) => {
            const isCompleted = step.completed || index < completedSteps;
            return (
            <div 
              key={step.step} 
              className="flex flex-col items-center"
              style={{ width: `${100 / steps.length}%` }}
            >
              {/* Circle */}
              <div
                className={cn(
                  'rounded-full flex items-center justify-center flex-none',
                  'transition-all duration-300 z-10 relative'
                )}
                style={{
                  width: 32,
                  height: 32,
                  minWidth: 32,
                  minHeight: 32,
                  borderWidth: 2,
                  borderStyle: 'solid',
                  borderColor: isCompleted ? '#10b981' : '#d1d5db',
                  backgroundColor: isCompleted ? '#10b981' : '#ffffff',
                  boxShadow: isCompleted ? '0 4px 10px rgba(16, 185, 129, 0.25)' : 'none',
                }}
              >
                {isCompleted ? (
                  <Check className="w-5 h-5 text-white" strokeWidth={3} />
                ) : (
                  <span className="text-sm font-bold text-gray-400">
                    {step.step}
                  </span>
                )}
              </div>
              
              {/* Step Label */}
              <div className="mt-3 text-center w-full px-1">
                <span 
                  className={cn(
                    "text-xs leading-tight block font-medium",
                    isCompleted ? 'text-emerald-600 font-semibold' : 'text-gray-500'
                  )}
                >
                  {step.label}
                </span>
                {isCompleted && step.timestamp && (
                  <span className="text-[10px] text-emerald-500 mt-1 block font-medium">
                    {step.timestamp}
                  </span>
                )}
              </div>
            </div>
          );
          })}
        </div>
      </div>
    </div>
  );
}

