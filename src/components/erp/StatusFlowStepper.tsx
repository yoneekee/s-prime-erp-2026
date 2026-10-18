import { CheckCircle2, AlertCircle } from "lucide-react";
import type { FlowStep, FlowBranch } from "@/lib/workflow";

interface StatusFlowStepperProps {
  steps: FlowStep[];
  branch?: FlowBranch | null;
}

/**
 * 伝票ステータスのフローステッパー。
 * steps / branch は getFlowSteps(slip) の戻り値をそのまま渡す。
 * 否認 (A02) / 差戻 (P00, T00) は分岐マーカーとして afterStep の直後に表示する。
 */
const StatusFlowStepper = ({ steps, branch }: StatusFlowStepperProps) => {
  // Tailwind が静的に検出できるよう、分岐色はクラス名のマップで定義する
  const branchClasses = branch?.status === "A02"
    ? { circle: "bg-destructive/20 text-destructive ring-destructive/30", label: "text-destructive" }
    : { circle: "bg-warning/20 text-warning ring-warning/30", label: "text-warning" };

  const renderBranchMarker = (key: string) => {
    if (!branch) return null;
    return (
      <div key={key} className="flex items-center flex-shrink-0">
        <div className="mx-1 mt-[-14px] text-muted-foreground/30 text-xs">⇢</div>
        <div className="flex flex-col items-center gap-1">
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-mono font-bold ring-2 ring-offset-1 ring-offset-card ${branchClasses.circle}`}
          >
            <AlertCircle className="w-3.5 h-3.5" />
          </div>
          <span className={`text-[9px] whitespace-nowrap font-bold ${branchClasses.label}`}>
            {branch.label}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="mt-4">
      <div className="flex items-center overflow-x-auto pb-2">
        {steps.map((step, i) => {
          const isCurrent = step.state === "current";
          const isPast = step.state === "done";
          const showBranchHere = branch && branch.afterStep === step.code;

          return (
            <div key={step.code} className="flex items-center flex-shrink-0">
              <div className="flex flex-col items-center gap-1">
                {/* Circle */}
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-mono font-bold transition-all ${
                    isCurrent
                      ? "bg-primary text-primary-foreground ring-2 ring-primary/30 ring-offset-1 ring-offset-card"
                      : isPast
                        ? "bg-success/20 text-success"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {isPast ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : (
                    <span className="text-[9px]">{step.code}</span>
                  )}
                </div>
                {/* Label */}
                <span
                  className={`text-[9px] whitespace-nowrap ${
                    isCurrent
                      ? "text-primary font-bold"
                      : isPast
                        ? "text-success"
                        : "text-muted-foreground"
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {/* Connector line */}
              {i < steps.length - 1 && (
                <div
                  className={`w-6 h-0.5 mx-0.5 mt-[-14px] ${
                    isPast ? "bg-success/40" : "bg-border"
                  }`}
                />
              )}
              {/* 分岐マーカー (否認/差戻) */}
              {showBranchHere && renderBranchMarker(`branch-${step.code}`)}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default StatusFlowStepper;
