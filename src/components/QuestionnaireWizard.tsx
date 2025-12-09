import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Check, Loader2 } from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { toast } from "sonner";

interface WizardStep {
  id: number;
  title: string;
  component: React.ReactNode;
  isValid: () => boolean;
}

interface QuestionnaireWizardProps {
  steps: WizardStep[];
  onSave: () => void;
  onCancel: () => void;
  autoSave?: (step: number, data: any) => Promise<void>;
}

export function QuestionnaireWizard({ steps, onSave, onCancel, autoSave }: QuestionnaireWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [isSaving, setIsSaving] = useState(false);

  // Автозбереження при зміні кроку
  useEffect(() => {
    if (autoSave && currentStep > 0) {
      const timer = setTimeout(() => {
        autoSave(currentStep, {}).catch(console.error);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [currentStep, autoSave]);

  const handleNext = useCallback(() => {
    if (currentStep < steps.length - 1) {
      if (steps[currentStep].isValid()) {
        setCompletedSteps(prev => new Set(prev).add(currentStep));
        setCurrentStep(prev => prev + 1);
        // Прокрутка вгору для мобільних
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        toast.error("Будь ласка, заповніть обов'язкові поля");
      }
    }
  }, [currentStep, steps]);

  const handlePrev = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentStep]);

  const handleStepClick = (stepIndex: number) => {
    // Можна переходити тільки на вже пройдені кроки або наступний
    if (stepIndex <= currentStep || completedSteps.has(stepIndex - 1)) {
      setCurrentStep(stepIndex);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const progress = ((currentStep + 1) / steps.length) * 100;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Progress Bar */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">
              Крок {currentStep + 1} з {steps.length}
            </span>
            <span className="text-sm text-gray-500">
              {Math.round(progress)}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-[#FF5A00] h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Step Indicators (Mobile-friendly) */}
      <div className="max-w-4xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between overflow-x-auto pb-2 scrollbar-hide">
          {steps.map((step, index) => (
            <button
              key={step.id}
              onClick={() => handleStepClick(index)}
              disabled={index > currentStep && !completedSteps.has(index - 1)}
              className={`
                flex-shrink-0 flex flex-col items-center gap-1 px-2 min-w-[60px]
                transition-all duration-200
                ${index === currentStep ? 'scale-110' : ''}
                ${index <= currentStep || completedSteps.has(index - 1) 
                  ? 'opacity-100 cursor-pointer' 
                  : 'opacity-40 cursor-not-allowed'}
              `}
            >
              <div
                className={`
                  w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold
                  transition-all duration-200
                  ${index < currentStep || completedSteps.has(index)
                    ? 'bg-green-500 text-white'
                    : index === currentStep
                    ? 'bg-[#FF5A00] text-white'
                    : 'bg-gray-300 text-gray-600'}
                `}
              >
                {index < currentStep || completedSteps.has(index) ? (
                  <Check className="w-4 h-4" />
                ) : (
                  index + 1
                )}
              </div>
              <span className={`
                text-xs text-center leading-tight
                ${index === currentStep ? 'font-semibold text-[#FF5A00]' : 'text-gray-600'}
              `}>
                {step.title}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Current Step Content */}
      <div className="max-w-4xl mx-auto px-4 pb-6">
        <Card className="shadow-sm">
          <CardContent className="p-4 md:p-6">
            {steps[currentStep].component}
          </CardContent>
        </Card>
      </div>

      {/* Navigation Buttons - Sticky Bottom */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-20">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={currentStep === 0 ? onCancel : handlePrev}
              className="flex-1 h-12 text-base"
              disabled={isSaving}
            >
              <ChevronLeft className="w-5 h-5 mr-1" />
              {currentStep === 0 ? 'Скасувати' : 'Назад'}
            </Button>
            
            {currentStep === steps.length - 1 ? (
              <Button
                onClick={onSave}
                className="flex-1 h-12 text-base bg-[#FF5A00] hover:bg-[#FF5A00]/90"
                disabled={isSaving || !steps[currentStep].isValid()}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Збереження...
                  </>
                ) : (
                  <>
                    <Check className="w-5 h-5 mr-2" />
                    Зберегти анкету
                  </>
                )}
              </Button>
            ) : (
              <Button
                onClick={handleNext}
                className="flex-1 h-12 text-base bg-[#FF5A00] hover:bg-[#FF5A00]/90"
                disabled={!steps[currentStep].isValid()}
              >
                Далі
                <ChevronRight className="w-5 h-5 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

