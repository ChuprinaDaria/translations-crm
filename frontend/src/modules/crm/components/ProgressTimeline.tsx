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
  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
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

      {/* Horizontal Progress Line */}
      <div className="relative px-4">
        {/* Background Line */}
        <div className="absolute top-4 left-8 right-8 h-0.5 bg-gray-200" />
        
        {/* Progress Line */}
        <div 
          className="absolute top-4 left-8 h-0.5 bg-emerald-500 transition-all duration-500"
          style={{ 
            width: steps.length > 1 
              ? `calc(((100% - 64px) * ${completedSteps - 1}) / ${steps.length - 1})`
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
                  'w-8 h-8 rounded-full border-2 flex items-center justify-center',
                  'transition-all duration-300 bg-white z-10',
                  step.completed 
                    ? 'border-emerald-500 bg-emerald-500' 
                    : 'border-gray-300 bg-white'
                )}
              >
                {step.completed ? (
                  <Check className="w-4 h-4 text-white" />
                ) : (
                  <span className="text-xs font-medium text-gray-400">
                    {step.step}
                  </span>
                )}
              </div>
              
              {/* Step Number */}
              <span className="text-[10px] text-gray-400 mt-1">
                {step.step}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Step Details */}
      <div className="space-y-2 mt-4">
        {steps.map((step) => (
          <div
            key={step.step}
            className={cn(
              'p-3 rounded-lg border transition-all',
              step.completed
                ? 'bg-emerald-50/50 border-emerald-200'
                : 'bg-gray-50 border-gray-200'
            )}
          >
            <div className="flex items-start gap-3">
              <span
                className={cn(
                  'flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold',
                  step.completed
                    ? 'bg-emerald-500 text-white'
                    : 'bg-gray-300 text-gray-600'
                )}
              >
                {step.step}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={cn(
                      'text-sm font-medium',
                      step.completed ? 'text-gray-900' : 'text-gray-500'
                    )}
                  >
                    {step.label}
                  </span>
                  {step.completed && step.timestamp && (
                    <span className="text-xs text-emerald-600 whitespace-nowrap">
                      ✓ {step.timestamp}
                    </span>
                  )}
                </div>
                {step.details && (
                  <p className="text-xs text-gray-600 mt-1">
                    {step.details}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

