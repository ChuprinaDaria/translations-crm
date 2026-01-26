import { Check } from "lucide-react";
import { cn } from "../../../components/ui/utils";
import { Progress } from "../../../components/ui/progress";
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

  // Рахуємо прогрес - тільки послідовно завершені етапи
  let completedCount = 0;
  for (const def of TIMELINE_DEFINITIONS) {
    if (completedStepsMap.has(def.step)) {
      completedCount++;
    } else {
      break; // Зупиняємося на першому незавершеному
    }
  }
  
  const progressPercent = Math.round((completedCount / TIMELINE_DEFINITIONS.length) * 100);
  
  // Знаходимо активний крок (перший незавершений після послідовно завершених)
  const activeStepIndex = TIMELINE_DEFINITIONS.findIndex(
    (def) => !completedStepsMap.has(def.step)
  );

  return (
    <div className={cn("space-y-6", className)}>
      {/* Прогрес-бар зверху */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-medium text-slate-700">Прогрес: {completedCount} / {TIMELINE_DEFINITIONS.length}</span>
          <span className="font-semibold text-emerald-600">{progressPercent}%</span>
        </div>
        <Progress 
          value={progressPercent} 
          className="h-2 [&>div]:bg-emerald-500" 
        />
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
            const isCompleted = completedStepsMap.has(def.step) && index < completedCount;
            const isCurrent = index === activeStepIndex && activeStepIndex !== -1;
            
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
                      ? "bg-white border-2 border-blue-500 text-blue-600 shadow-[0_0_8px_rgba(59,130,246,0.3)] animate-pulse"
                      : "bg-white border-2 border-slate-200 text-slate-400"
                    )}
                    title={def.label}
                  >
                    {isCompleted ? (
                      <Check className="w-4 h-4 stroke-[3px]" />
                    ) : isCurrent ? (
                      <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                    ) : (
                      <span className="text-xs font-bold">{def.order}</span>
                    )}
                </div>

                {/* Мітка під кружком */}
                <span className={cn(
                  "text-[10px] mt-2 text-center leading-tight font-medium",
                  isCompleted ? "text-emerald-700" : isCurrent ? "text-blue-600" : "text-slate-400"
                )}>
                  {def.shortLabel}
                </span>
                  </div>
            );
          })}
        </div>
      </div>

      {/* Опис етапів - вертикальний список з лінією */}
      <div className="space-y-0 mt-6 relative before:absolute before:inset-0 before:left-[11px] before:w-[2px] before:bg-slate-100">
        {TIMELINE_DEFINITIONS.map((def, index) => {
          const isCompleted = completedStepsMap.has(def.step) && index < completedCount;
          const completedStep = completedStepsMap.get(def.step);
          const isLast = index === TIMELINE_DEFINITIONS.length - 1;
          const isActive = index === activeStepIndex && activeStepIndex !== -1;

          return (
            <div key={def.step} className="relative flex items-start gap-4 pb-8 last:pb-0 group">
              {/* Лінія-з'єднувач кольору успіху */}
              {isCompleted && !isLast && (
                <div className="absolute left-[11px] top-6 w-[2px] h-full bg-emerald-500 z-10" />
              )}

              {/* Іконка стану */}
              <div className={cn(
                "relative z-20 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all",
                isCompleted 
                  ? "bg-emerald-500 border-emerald-500 shadow-sm" 
                  : isActive 
                  ? "bg-white border-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.3)]" 
                  : "bg-white border-slate-200"
              )}>
                {isCompleted ? (
                  <Check className="h-3.5 w-3.5 text-white stroke-[3px]" />
                ) : isActive ? (
                  <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                ) : (
                  <div className="h-1.5 w-1.5 rounded-full bg-slate-200" />
                )}
              </div>

              {/* Контент етапу */}
              <div className="flex flex-col gap-1 pt-0.5">
                <h4 className={cn(
                  "text-[12px] font-semibold leading-none",
                  isCompleted ? "text-slate-900" : isActive ? "text-blue-600" : "text-slate-400"
                )}>
                  {def.label}
                </h4>
                {isCompleted && completedStep && (
                  <span className="text-[10px] text-slate-400 font-mono">
                    {new Date(completedStep.completed_at).toLocaleString('uk-UA', { 
                      day: '2-digit', 
                      month: '2-digit', 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </span>
                )}
                {/* Метадані (якщо є) */}
                {isCompleted && completedStep?.metadata && (
                  <div className="text-[10px] text-slate-500 mt-1 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
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

