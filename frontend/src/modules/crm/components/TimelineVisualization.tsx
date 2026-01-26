import React from "react";
import { Check, Circle, AlertCircle } from "lucide-react";
import { cn } from "../../../components/ui/utils";
import type { TimelineStep } from "../api/timeline";

interface TimelineVisualizationProps {
  steps: TimelineStep[];
  className?: string;
}

const TIMELINE_DEFINITIONS = [
  { step: "client_created", label: "Створено клієнта", shortLabel: "Клієнт", order: 1 },
  { step: "order_created", label: "Створено замовлення", shortLabel: "Замовл.", order: 2 },
  { step: "payment_link_sent", label: "Надіслано лінк оплати", shortLabel: "Лінк", order: 3 },
  { step: "payment_received", label: "Оплачено", shortLabel: "Оплата", order: 4 },
  { step: "translator_assigned", label: "Призначено перекладача", shortLabel: "Перекл.", order: 5 },
  { step: "translation_ready", label: "Переклад готовий", shortLabel: "Готово", order: 6 },
  { step: "issued_sent", label: "Видано/Відправлено", shortLabel: "Видано", order: 7 },
];

export function TimelineVisualization({ steps, className }: TimelineVisualizationProps) {
  // Створюємо Map для швидкого пошуку
  const completedStepsMap = new Map<string, TimelineStep>();
  steps.forEach((step) => {
    if (step.completed) {
      completedStepsMap.set(step.step_type, step);
    }
  });

  // Рахуємо прогрес
  const completedCount = steps.filter(s => s.completed).length;
  const progressPercent = Math.round((completedCount / TIMELINE_DEFINITIONS.length) * 100);

  return (
    <div className={cn("space-y-6", className)}>
      {/* Заголовок з прогресом */}
        <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">
          Прогрес: {completedCount} / {TIMELINE_DEFINITIONS.length}
        </span>
        <span className="text-sm font-semibold text-green-600">
          {progressPercent}%
        </span>
      </div>

      {/* Візуальна лінія прогресу - горизонтальна */}
      <div className="relative px-2">
        {/* Фонова лінія */}
        <div className="absolute top-4 left-6 right-6 h-1 bg-gray-200 rounded-full" />
        
        {/* Прогрес лінія */}
        <div 
          className="absolute top-4 left-6 h-1 bg-green-500 rounded-full transition-all duration-500"
          style={{ width: `calc(${progressPercent}% - 48px)` }}
        />

        <div className="relative flex items-start justify-between">
          {TIMELINE_DEFINITIONS.map((def, index) => {
            const isCompleted = completedStepsMap.has(def.step);
            const isCurrent = !isCompleted && (index === 0 || completedStepsMap.has(TIMELINE_DEFINITIONS[index - 1].step));
            
            return (
              <div 
                key={def.step} 
                className="flex flex-col items-center"
                style={{ width: `${100 / TIMELINE_DEFINITIONS.length}%` }}
              >
                {/* Кружок */}
                  <div
                    className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 shadow-sm relative z-10",
                      isCompleted
                      ? "bg-green-500 text-white ring-2 ring-green-200"
                      : isCurrent
                      ? "bg-white border-2 border-blue-500 text-blue-600 shadow-[0_0_8px_rgba(59,130,246,0.5)] animate-pulse"
                      : "bg-white border-2 border-slate-200 text-slate-400"
                    )}
                    title={def.label}
                  >
                    {isCompleted ? (
                      <Check className="w-4 h-4" />
                    ) : (
                    <span className="text-xs font-bold">{def.order}</span>
                    )}
                </div>

                {/* Мітка під кружком */}
                <span className={cn(
                  "text-[10px] mt-2 text-center leading-tight font-medium",
                  isCompleted ? "text-green-700" : isCurrent ? "text-blue-600" : "text-slate-400"
                )}>
                  {def.shortLabel}
                </span>
                  </div>
            );
          })}
        </div>
      </div>

      {/* Опис етапів - вертикальний список з лінією */}
      <div className="space-y-0 mt-6">
        {TIMELINE_DEFINITIONS.map((def, index) => {
          const isCompleted = completedStepsMap.has(def.step);
          const completedStep = completedStepsMap.get(def.step);
          const isLast = index === TIMELINE_DEFINITIONS.length - 1;
          
          // Визначаємо активний крок (перший невиконаний після останнього виконаного)
          const previousCompleted = index === 0 || completedStepsMap.has(TIMELINE_DEFINITIONS[index - 1].step);
          const isActive = !isCompleted && previousCompleted;

          return (
            <div key={def.step} className="relative flex gap-4 pb-6 last:pb-0">
              {/* Вертикальна лінія-з'єднувач */}
              {!isLast && (
                <span 
                  className={cn(
                    "absolute left-[11px] top-6 h-full w-[2px] transition-colors duration-300",
                    isCompleted ? "bg-green-500" : "bg-slate-200"
                  )} 
                />
              )}

              {/* Коло етапу */}
              <div className={cn(
                "relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-300",
                isCompleted 
                  ? "border-green-500 bg-green-500 text-white shadow-sm" 
                  : isActive 
                  ? "border-blue-500 bg-white text-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)] animate-pulse" 
                  : "border-slate-200 bg-white text-slate-400"
              )}>
                {isCompleted ? (
                  <Check className="h-3.5 w-3.5 stroke-[3px]" />
                ) : (
                  <span className="text-[10px] font-bold">{def.order}</span>
                )}
              </div>

              {/* Текст етапу */}
              <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                <div className="flex items-center justify-between gap-3">
                  <p className={cn(
                    "text-[12px] font-semibold leading-none",
                    isCompleted ? "text-slate-900" : isActive ? "text-blue-600" : "text-slate-400"
                  )}>
                    {def.label}
                  </p>
                  {isCompleted && completedStep && (
                    <span className="text-[10px] text-green-700 font-mono whitespace-nowrap">
                      {new Date(completedStep.completed_at).toLocaleDateString("uk-UA", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  )}
                </div>
                
                {/* Метадані (якщо є) */}
                {isCompleted && completedStep?.metadata && (
                  <div className="text-[10px] text-slate-500 mt-1 bg-slate-50 px-2 py-1 rounded border border-slate-100">
                    {completedStep.metadata}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Компактна версія (тільки лінія)
export function TimelineVisualizationCompact({ steps, className }: TimelineVisualizationProps) {
  const completedStepsMap = new Map<string, boolean>();
  steps.forEach((step) => {
    if (step.completed) {
      completedStepsMap.set(step.step_type, true);
    }
  });

  const currentStep = TIMELINE_DEFINITIONS.findIndex(
    (def) => !completedStepsMap.has(def.step)
  );
  const completedCount = steps.filter((s) => s.completed).length;
  const progress = currentStep === -1 ? 100 : (currentStep / TIMELINE_DEFINITIONS.length) * 100;

  return (
    <div className={cn("space-y-3", className)}>
      {/* Прогрес-бар */}
      <div className="relative h-2.5 bg-gray-200 rounded-full overflow-hidden shadow-inner">
        <div
          className="absolute top-0 left-0 h-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all duration-500 rounded-full"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Текст прогресу */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-600">
          {currentStep === -1 ? (
            <span className="text-emerald-600 font-medium">✓ Виконано</span>
          ) : (
            <>Наступний: <span className="font-medium text-gray-800">{TIMELINE_DEFINITIONS[currentStep]?.shortLabel}</span></>
          )}
        </span>
        <span className="font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
          {completedCount} / {TIMELINE_DEFINITIONS.length}
        </span>
      </div>
    </div>
  );
}

