import React from 'react';
import { Link } from 'react-router-dom';
import { Boxes, ArrowRight, HelpCircle } from 'lucide-react';

/**
 * EmptyState
 * 
 * Reusable institutional empty state that clearly answers:
 * 1. What is empty
 * 2. Why it matters to the hospital
 * 3. What the user can do next
 */
export const EmptyState = ({
  icon: Icon = Boxes,
  title = 'No records found',
  description = 'There are no active records in this category.',
  impact = '',
  actionLabel = '',
  actionTo = '',
  onAction = null,
  secondaryActionLabel = '',
  secondaryActionTo = '',
  onSecondaryAction = null,
  className = '',
}) => {
  return (
    <div className={`p-8 sm:p-12 rounded-2xl bg-white border border-slate-200/90 shadow-sm text-center max-w-2xl mx-auto space-y-4 ${className}`}>
      {/* Icon Badge */}
      <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-500 border border-slate-200 flex items-center justify-center mx-auto shadow-inner">
        <Icon className="w-7 h-7" />
      </div>

      {/* Narrative */}
      <div className="space-y-1.5">
        <h3 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight">
          {title}
        </h3>
        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-md mx-auto">
          {description}
        </p>
        {impact && (
          <p className="text-xs font-mono text-primary-700 font-semibold pt-1">
            💡 {impact}
          </p>
        )}
      </div>

      {/* Action Buttons */}
      {(actionLabel || secondaryActionLabel) && (
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          {actionLabel && (
            actionTo ? (
              <Link
                to={actionTo}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs shadow-md shadow-primary-600/20 transition-all cursor-pointer"
              >
                <span>{actionLabel}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            ) : (
              <button
                type="button"
                onClick={onAction}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs shadow-md shadow-primary-600/20 transition-all cursor-pointer"
              >
                <span>{actionLabel}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )
          )}

          {secondaryActionLabel && (
            secondaryActionTo ? (
              <Link
                to={secondaryActionTo}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-colors"
              >
                <span>{secondaryActionLabel}</span>
              </Link>
            ) : (
              <button
                type="button"
                onClick={onSecondaryAction}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-colors cursor-pointer"
              >
                <span>{secondaryActionLabel}</span>
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
};

export default EmptyState;
