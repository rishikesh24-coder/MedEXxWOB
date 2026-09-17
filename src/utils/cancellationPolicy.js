/**
 * Cancellation & Refund Policy Helper Module
 * 
 * Implements the 4-tier demo policy rules for inter-hospital medicine requisitions:
 * Tier A: Within 24 hours (before dispatch) -> 0% fee, 100% refund
 * Tier B: After 24 hours (before dispatch)  -> 5% fee, 95% refund
 * Tier C: After dispatch (before delivery)  -> 15% fee, 85% refund
 * Tier D: After delivery/receipt           -> Non-cancellable
 */

/**
 * Calculates the cancellation eligibility and policy terms for a given request.
 * 
 * @param {Object} request - The requisition object from Redux or localStorage
 * @param {number} currentTime - Reference timestamp in ms (defaults to Date.now())
 * @returns {Object} Policy determination result
 */
export function getCancellationPolicy(request, currentTime = Date.now()) {
  if (!request) {
    return {
      canCancel: false,
      stage: 'INVALID',
      stageLabel: 'Invalid Requisition',
      penaltyPercent: 0,
      refundPercent: 0,
      hoursRemainingInFreeWindow: 0,
      elapsedHours: 0,
      reason: 'No requisition data provided.',
    };
  }

  // 1. Calculate elapsed hours from creation timestamp
  const rawDate = request.createdAt || request.requestDate;
  let elapsedHours = 0;
  if (rawDate) {
    const createdMs = new Date(rawDate).getTime();
    if (!isNaN(createdMs)) {
      elapsedHours = Math.max(0, (currentTime - createdMs) / (1000 * 60 * 60));
    }
  }

  const rawStatus = String(request.status || '').trim();
  const normalizedStatus = rawStatus.toLowerCase().replace(/[\-_]/g, ' ');

  // 2. Terminal non-cancellable states
  if (['delivered', 'received'].includes(normalizedStatus)) {
    return {
      canCancel: false,
      stage: 'DELIVERED',
      stageLabel: 'Delivered (Non-cancellable)',
      penaltyPercent: 0,
      refundPercent: 0,
      hoursRemainingInFreeWindow: 0,
      elapsedHours,
      reason: 'This request has already been delivered and cannot be cancelled.',
    };
  }

  if (['cancelled', 'cancelled by buyer'].includes(normalizedStatus)) {
    return {
      canCancel: false,
      stage: 'CANCELLED',
      stageLabel: 'Already Cancelled',
      penaltyPercent: request.cancellation?.penaltyPercent || 0,
      refundPercent: request.cancellation?.refundPercent || 0,
      hoursRemainingInFreeWindow: 0,
      elapsedHours,
      reason: 'This requisition has already been cancelled.',
    };
  }

  if (['rejected', 'expired', 'declined', 'failed'].includes(normalizedStatus)) {
    return {
      canCancel: false,
      stage: 'INACTIVE',
      stageLabel: 'Inactive Requisition',
      penaltyPercent: 0,
      refundPercent: 0,
      hoursRemainingInFreeWindow: 0,
      elapsedHours,
      reason: 'This requisition is closed and cannot be cancelled.',
    };
  }

  // 3. Tier C: After dispatch, before delivery
  if (['in transit', 'dispatched', 'shipped', 'out for delivery'].includes(normalizedStatus)) {
    return {
      canCancel: true,
      stage: 'DISPATCHED',
      stageLabel: 'Dispatched (15% Cancellation Fee)',
      penaltyPercent: 15,
      refundPercent: 85,
      hoursRemainingInFreeWindow: 0,
      elapsedHours,
      reason: 'Medicine has already been dispatched. 15% courier recall fee applies.',
    };
  }

  // 4. Pre-dispatch states: pending, reviewing, accepted, confirmed, preparing, packed, paid
  if (elapsedHours <= 24) {
    const hoursRemaining = Math.max(0, 24 - elapsedHours);
    return {
      canCancel: true,
      stage: 'WITHIN_24H',
      stageLabel: 'Within 24 Hours (Free Cancellation)',
      penaltyPercent: 0,
      refundPercent: 100,
      hoursRemainingInFreeWindow: hoursRemaining,
      elapsedHours,
      reason: 'Requisition submitted within the 24-hour grace window. 100% full refund.',
    };
  }

  // Tier B: After 24 hours, before dispatch
  return {
    canCancel: true,
    stage: 'AFTER_24H_BEFORE_DISPATCH',
    stageLabel: 'After 24 Hours (5% Re-stocking Fee)',
    penaltyPercent: 5,
    refundPercent: 95,
    hoursRemainingInFreeWindow: 0,
    elapsedHours,
    reason: 'Cancellation after 24 hours prior to dispatch. 5% administrative allocation fee applies.',
  };
}

/**
 * Derives the numerical settlement, penalty, and refund amounts safely without NaN or negative values.
 * 
 * @param {Object} request - Requisition object
 * @param {Object} policy - Policy object returned from getCancellationPolicy
 * @returns {Object} Safe rounded financial amounts
 */
export function calculateRefundAmounts(request, policy) {
  if (!request) return { totalAmount: 0, penaltyAmount: 0, refundAmount: 0 };

  const totalAmount = Number(
    request.totalAmount ||
    (Number(request.quantity || 0) * Number(request.unitFinalPrice || 0)) ||
    (Number(request.quantity || 0) * Number(request.unitOriginalPrice || 0)) ||
    0
  );

  const penaltyPercent = Number(policy?.penaltyPercent || 0);
  const penaltyAmount = Math.round((totalAmount * penaltyPercent) / 100);
  const refundAmount = Math.max(0, totalAmount - penaltyAmount);

  return {
    totalAmount,
    penaltyAmount,
    refundAmount,
  };
}

/**
 * Returns UI badge props (color classes, label, and icon identifier) for rendering directly on cards.
 */
export function getCancellationBadgeProps(policy) {
  if (!policy || !policy.canCancel) {
    if (policy?.stage === 'DELIVERED') {
      return {
        variant: 'neutral',
        bgClass: 'bg-slate-100 text-slate-600 border-slate-200',
        dotColor: 'bg-slate-400',
        label: 'Delivered • Non-cancellable',
        shortText: 'Non-cancellable',
      };
    }
    if (policy?.stage === 'CANCELLED') {
      return {
        variant: 'rose',
        bgClass: 'bg-rose-50 text-rose-700 border-rose-200',
        dotColor: 'bg-rose-500',
        label: 'Requisition Cancelled',
        shortText: 'Cancelled',
      };
    }
    return null;
  }

  if (policy.stage === 'WITHIN_24H') {
    const hrs = Math.ceil(policy.hoursRemainingInFreeWindow);
    return {
      variant: 'emerald',
      bgClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      dotColor: 'bg-emerald-500',
      label: `Cancel within ${hrs}h • 100% Refund (0% Fee)`,
      shortText: '100% Refund',
      subText: `${hrs}h left in free window`,
    };
  }

  if (policy.stage === 'AFTER_24H_BEFORE_DISPATCH') {
    return {
      variant: 'amber',
      bgClass: 'bg-amber-50 text-amber-800 border-amber-200',
      dotColor: 'bg-amber-500',
      label: '5% Cancellation Fee • 95% Refund',
      shortText: '95% Refund (5% Fee)',
      subText: 'Over 24h elapsed',
    };
  }

  if (policy.stage === 'DISPATCHED') {
    return {
      variant: 'rose',
      bgClass: 'bg-rose-50 text-rose-800 border-rose-200',
      dotColor: 'bg-rose-500',
      label: '15% Cancellation Fee • 85% Refund (Dispatched)',
      shortText: '85% Refund (15% Fee)',
      subText: 'Dispatched in transit',
    };
  }

  return null;
}
