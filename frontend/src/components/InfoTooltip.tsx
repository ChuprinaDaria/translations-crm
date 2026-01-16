import { HelpCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";

interface InfoTooltipProps {
  content: string;
}

export function InfoTooltip({ content }: InfoTooltipProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span 
            className="inline-flex items-center justify-center opacity-40 hover:opacity-100 transition-opacity cursor-help"
            role="button"
            tabIndex={0}
            aria-label="Інформація"
          >
            <HelpCircle className="w-3.5 h-3.5 text-gray-500" />
            <span className="sr-only">Інформація</span>
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-sm">{content}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
