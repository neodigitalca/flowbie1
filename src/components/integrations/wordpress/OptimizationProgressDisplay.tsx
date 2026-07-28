import React from 'react';
import { Progress } from '@/components/ui/progress';
import { Loader2, CheckCircle2, Circle, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { notify } from "@/lib/app-notifications";
import { NOTIFY_COPIED_TO_CLIPBOARD } from "@/lib/notify-messages";
import { cn } from '@/lib/utils';
import { getCyberpunkTextClasses } from './cyberpunk-theme';
import { OPTIMIZATION_STEPS, getCurrentStep, type ProgressData } from './optimization-constants';

interface OptimizationProgressDisplayProps {
  progress?: ProgressData;
  isOptimizing: boolean;
}

export const OptimizationProgressDisplay: React.FC<OptimizationProgressDisplayProps> = ({
  progress,
  isOptimizing,
}) => {
  if (!isOptimizing || !progress || typeof progress !== 'object') {
    return null;
  }

  const currentStepIndex = getCurrentStep(progress);
  const progressValue = progress?.progress || 0;

  return (
    <div className="space-y-2 pt-3">
      {/* Progress Bar */}
      <div className="space-y-1">
        <div className={`flex items-center justify-between text-sm ${getCyberpunkTextClasses('secondary')}`}>
          <span className={`${getCyberpunkTextClasses('primary')} font-semibold font-mono`}>
            {progress.step || 'Processing...'}
          </span>
          <span className={getCyberpunkTextClasses('muted')}>{Math.round(progressValue)}%</span>
        </div>
        <Progress value={progressValue} className="h-2 bg-green-500/10" />
      </div>

      {/* Step-by-step breakdown (always expanded) */}
      <div className="space-y-1.5 pt-2">
        {OPTIMIZATION_STEPS.map((step, index) => {
          const isCompleted = index < currentStepIndex;
          const isCurrent = index === currentStepIndex;
          const isPending = index > currentStepIndex;

          return (
            <div
              key={step.key}
              className={cn(
                'flex items-center gap-2 text-sm font-medium py-1',
                isCompleted && getCyberpunkTextClasses('muted'),
                isCurrent && `${getCyberpunkTextClasses('primary')} font-medium`,
                isPending && getCyberpunkTextClasses('muted')
              )}
            >
              {isCompleted ? (
                <CheckCircle2 className="h-3 w-3 text-green-300 shrink-0" />
              ) : isCurrent ? (
                <Loader2 className="h-3 w-3 animate-spin text-green-300 shrink-0" />
              ) : (
                <Circle className={`h-3 w-3 shrink-0 ${getCyberpunkTextClasses('muted')}`} />
              )}
              <span className={`flex-1 ${getCyberpunkTextClasses('secondary')}`}>{step.label}</span>
              {isCurrent && progress?.message && (
                <div className="flex items-center gap-1 min-w-0 flex-1">
                  <span className={`${getCyberpunkTextClasses('muted')} text-sm break-all`}>
                    {progress.message}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0 shrink-0 text-green-500/70 hover:text-green-400 hover:bg-green-500/20"
                    onClick={() => {
                      navigator.clipboard.writeText(progress.message || '');
                      notify.success(NOTIFY_COPIED_TO_CLIPBOARD);
                    }}
                    title="Copy"
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

