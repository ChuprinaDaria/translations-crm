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
        <span className="text-sm font-semibold text-emerald-600">
          {progressPercent}%
        </span>
      </div>

      {/* Візуальна лінія прогресу - горизонтальна */}
      <div className="relative px-2">
        {/* Фонова лінія */}
        <div className="absolute top-4 left-6 right-6 h-1 bg-gray-200 rounded-full" />
        
        {/* Прогрес лінія */}
        <div 
          className="absolute top-4 left-6 h-1 bg-emerald-500 rounded-full transition-all duration-500"
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
                      ? "bg-emerald-500 text-white ring-2 ring-emerald-200"
                      : isCurrent
                      ? "bg-white border-2 border-emerald-500 text-emerald-600"
                      : "bg-white border-2 border-gray-300 text-gray-400"
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
                  isCompleted ? "text-emerald-600" : isCurrent ? "text-emerald-600" : "text-gray-500"
                )}>
                  {def.shortLabel}
                </span>
                  </div>
            );
          })}
        </div>
      </div>

      {/* Опис етапів - вертикальний список */}
      <div className="space-y-2 mt-4">
        {TIMELINE_DEFINITIONS.map((def) => {
          const isCompleted = completedStepsMap.has(def.step);
          const completedStep = completedStepsMap.get(def.step);

          return (
            <div
              key={def.step}
              className={cn(
                "flex items-start gap-4 p-3 rounded-xl transition-colors",
                isCompleted ? "bg-emerald-50/70" : "bg-gray-50/70"
              )}
            >
              <div
                className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold",
                  isCompleted
                    ? "bg-emerald-500 text-white"
                    : "bg-gray-200 text-gray-500"
                )}
              >
                {isCompleted ? (
                  <Check className="w-4 h-4" />
                ) : (
                  def.order
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-3">
                  <span
                    className={cn(
                      "text-sm font-medium",
                      isCompleted ? "text-emerald-700" : "text-gray-600"
                    )}
                  >
                    {def.label}
                  </span>
                  {isCompleted && completedStep && (
                    <span className="text-xs text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full whitespace-nowrap">
                      ✓ {new Date(completedStep.completed_at).toLocaleDateString("uk-UA", {
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
                  <div className="text-xs text-gray-500 mt-1.5 bg-white/50 px-2 py-1 rounded">
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

