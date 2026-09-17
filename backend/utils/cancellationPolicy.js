/**
 * Configurable Cancellation & Refund Policy Engine for MedEx
 * 
 * Enforces business rules server-side so clients cannot manipulate
 * cancellation eligibility, refund amounts, or fee deductions.
 */

const DEFAULT_POLICY_CONFIG = {
  freeCancellationWindowHours: 24,
  tierBPenaltyPercent: 5,   // After 24h pre-dispatch
  tierCPenaltyPercent: 15,  // In transit / dispatched
};

/**
 * Calculates cancellation terms based on requisition timing and state
 * @param {object} requisition
 * @param {number} [currentTimeMs=Date.now()]
 * @param {object} [customConfig={}]
 */
const determineCancellationEligibility = (
  requisition,
  currentTimeMs = Date.now(),
  customConfig = {}
) => {
  const config = { ...DEFAULT_POLICY_CONFIG, ...customConfig };

  if (!requisition) {
    return {
      canCancel: false,
      cancellable: false,
      stage: 'INVALID',
      stageCode: 'INVALID',
      tierCode: 'INVALID',
      stageLabel: 'Invalid Requisition',
      penaltyPercent: 0,
      penaltyPercentage: 0,
      refundPercent: 0,
      refundPercentage: 0,
      penaltyAmount: 0,
      refundAmount: 0,
      totalAmount: 0,
      reason: 'No requisition data provided.',
    };
  }

  const rawStatus = String(requisition.status || '').toLowerCase().trim().replace(/[\-_]/g, ' ');

  const totalAmount = Number(
    requisition.totalAmount ||
    requisition.total_amount ||
    (Number(requisition.quantity || 0) * Number(requisition.unitFinalPrice || requisition.unit_final_price || 0))
  );

  const formatResult = (base) => {
    const penaltyAmount = Math.round((totalAmount * base.penaltyPercent) / 100);
    const refundAmount = Math.max(0, totalAmount - penaltyAmount);
    return {
      ...base,
      cancellable: base.canCancel,
      penaltyPercentage: base.penaltyPercent,
      refundPercentage: base.refundPercent,
      totalAmount,
      penaltyAmount,
      refundAmount,
    };
  };

  // Terminal non-cancellable stages
  if (['delivered', 'received', 'completed'].includes(rawStatus)) {
    return formatResult({
      canCancel: false,
      stage: 'DELIVERED',
      stageCode: 'DELIVERED',
      tierCode: 'DELIVERED',
      stageLabel: 'Delivered (Non-cancellable)',
      penaltyPercent: 0,
      refundPercent: 0,
      reason: 'Consignment has already been delivered and accepted into pharmacy inventory.',
    });
  }

  if (['cancelled', 'cancelled by buyer'].includes(rawStatus)) {
    const pen = requisition.cancellation?.penaltyPercent || 0;
    const ref = requisition.cancellation?.refundPercent || 0;
    return formatResult({
      canCancel: false,
      stage: 'CANCELLED',
      stageCode: 'CANCELLED',
      tierCode: 'CANCELLED',
      stageLabel: 'Already Cancelled',
      penaltyPercent: pen,
      refundPercent: ref,
      reason: 'This requisition has already been cancelled.',
    });
  }

  if (['rejected', 'expired', 'declined', 'failed'].includes(rawStatus)) {
    return formatResult({
      canCancel: false,
      stage: 'INACTIVE',
      stageCode: 'INACTIVE',
      tierCode: 'INACTIVE',
      stageLabel: 'Inactive Requisition',
      penaltyPercent: 0,
      refundPercent: 0,
      reason: 'Requisition is inactive or was declined.',
    });
  }

  // Calculate elapsed hours
  const createdDate = requisition.createdAt || requisition.requestDate || requisition.request_date || requisition.requested_date;
  let elapsedHours = 0;
  if (createdDate) {
    const createdMs = new Date(createdDate).getTime();
    if (!isNaN(createdMs)) {
      elapsedHours = Math.max(0, (currentTimeMs - createdMs) / (1000 * 60 * 60));
    }
  }

  const roundedAgeHours = Math.round(elapsedHours * 10) / 10;

  // Tier C: Dispatched / In Transit
  if (['in transit', 'dispatched', 'shipped', 'out for delivery', 'in_transit'].includes(rawStatus)) {
    return formatResult({
      canCancel: true,
      stage: 'DISPATCHED',
      stageCode: 'DISPATCHED',
      tierCode: 'WINDOW_C',
      stageLabel: `Dispatched (${config.tierCPenaltyPercent}% Courier Recall Fee)`,
      penaltyPercent: config.tierCPenaltyPercent,
      refundPercent: 100 - config.tierCPenaltyPercent,
      requestAgeHours: roundedAgeHours,
      elapsedHours: roundedAgeHours,
      reason: `Medicine has already been dispatched with active cold-chain logistics. A ${config.tierCPenaltyPercent}% courier recall fee applies.`,
    });
  }

  // Pre-dispatch states: pending, accepted, preparing, paid
  if (elapsedHours <= config.freeCancellationWindowHours) {
    // Tier A: Within 24 hours -> No penalty
    const hoursRemaining = Math.max(0, config.freeCancellationWindowHours - elapsedHours);
    return formatResult({
      canCancel: true,
      stage: 'WITHIN_24H',
      stageCode: 'WITHIN_24H',
      tierCode: 'WINDOW_A',
      stageLabel: 'Within 24 Hours (Free Cancellation)',
      penaltyPercent: 0,
      refundPercent: 100,
      hoursRemainingInFreeWindow: Math.round(hoursRemaining * 10) / 10,
      requestAgeHours: roundedAgeHours,
      elapsedHours: roundedAgeHours,
      reason: 'Requisition cancelled within the 24-hour statutory cooling window. 100% refund.',
    });
  }

  // Tier B: After 24 hours but before dispatch
  return formatResult({
    canCancel: true,
    stage: 'AFTER_24H_BEFORE_DISPATCH',
    stageCode: 'AFTER_24H_BEFORE_DISPATCH',
    tierCode: 'WINDOW_B',
    stageLabel: `After 24 Hours (${config.tierBPenaltyPercent}% Restocking Fee)`,
    penaltyPercent: config.tierBPenaltyPercent,
    refundPercent: 100 - config.tierBPenaltyPercent,
    requestAgeHours: roundedAgeHours,
    elapsedHours: roundedAgeHours,
    reason: `Requisition cancelled after 24-hour window prior to courier dispatch. ${config.tierBPenaltyPercent}% restocking fee applies.`,
  });
};

/**
 * Calculates financial amounts for refund based on policy determination
 * @param {object} requisition
 * @param {object} policy
 */
const calculateRefundAmounts = (requisition, policy) => {
  const totalAmount = Number(
    requisition.totalAmount ||
    requisition.total_amount ||
    (Number(requisition.quantity || 0) * Number(requisition.unitFinalPrice || requisition.unit_final_price || 0))
  );

  const penaltyPercent = policy.penaltyPercent || 0;
  const refundPercent = policy.refundPercent || 0;

  const penaltyAmount = Math.round((totalAmount * penaltyPercent) / 100);
  const refundAmount = Math.max(0, totalAmount - penaltyAmount);

  return {
    totalAmount,
    penaltyPercent,
    penaltyPercentage: penaltyPercent,
    penaltyAmount,
    refundPercent,
    refundPercentage: refundPercent,
    refundAmount,
  };
};

module.exports = {
  DEFAULT_POLICY_CONFIG,
  determineCancellationEligibility,
  evaluateCancellationPolicy: determineCancellationEligibility,
  calculateRefundAmounts,
};
