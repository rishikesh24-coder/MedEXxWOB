const { randomUUID: uuidv4 } = require('crypto');
const { supabaseAdmin, supabaseAnon, isConfigured } = require('../config/supabase');
const { determineCancellationEligibility, calculateRefundAmounts } = require('../utils/cancellationPolicy');
const auditService = require('./auditService');
const notificationService = require('./notificationService');
const alertService = require('./alertService');
const refundService = require('./refundService');
const logger = require('../utils/logger');

// Asynchronous mutex to prevent concurrent request-mutation race conditions
class RequestMutex {
  constructor() {
    this.locks = new Map();
  }
  async acquire(key) {
    while (this.locks.has(key)) {
      await this.locks.get(key);
    }
    let resolveLock;
    const promise = new Promise((res) => { resolveLock = res; });
    this.locks.set(key, promise);
    return () => {
      this.locks.delete(key);
      resolveLock();
    };
  }
}
const requestMutex = new RequestMutex();

// Local in-memory seed requests dataset
const devRequests = [
  {
    id: 'req-demo-1',
    transactionId: 'REQ-2024-9102',
    orderId: 'ORD-1024',
    fromHospitalId: '11111111-1111-1111-1111-111111111111',
    fromHospitalName: 'Apollo Hospital & Multi-Specialty Centre',
    toHospitalId: '22222222-2222-2222-2222-222222222222',
    toHospitalName: 'Fortis Memorial Research Institute',
    inventoryLotId: 'b0000003-0000-0000-0000-000000000003',
    medicineId: 'a0000003-0000-0000-0000-000000000003',
    medicineName: 'Azithral 500',
    genericName: 'Azithromycin',
    batchNo: 'AZI-24-0412',
    quantity: 100,
    unitOriginalPrice: 120,
    unitFinalPrice: 105,
    totalAmount: 10500,
    gstAmount: 1260,
    urgency: 'Standard Routine',
    notes: 'Replenishment for emergency respiratory triage ward.',
    status: 'pending',
    paymentStatus: 'pending',
    requestDate: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
    timeline: [
      {
        status: 'pending',
        timestamp: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
        actor: 'Apollo Hospital & Multi-Specialty Centre',
        note: 'Requisition created and stock reserved.',
      }
    ],
  },
  {
    id: 'req-demo-2',
    transactionId: 'REQ-2024-8841',
    orderId: 'ORD-1025',
    fromHospitalId: '33333333-3333-3333-3333-333333333333',
    fromHospitalName: 'Max Super Specialty Hospital',
    toHospitalId: '11111111-1111-1111-1111-111111111111',
    toHospitalName: 'Apollo Hospital & Multi-Specialty Centre',
    inventoryLotId: 'b0000001-0000-0000-0000-000000000001',
    medicineId: 'a0000001-0000-0000-0000-000000000001',
    medicineName: 'Augmentin 625 Duo',
    genericName: 'Amoxicillin + Clavulanic Acid',
    batchNo: 'AUG-24-0981',
    quantity: 50,
    unitOriginalPrice: 160,
    unitFinalPrice: 140,
    totalAmount: 7000,
    gstAmount: 840,
    urgency: 'Emergency',
    notes: 'Urgent ICU post-operative stock requirement.',
    status: 'accepted',
    paymentStatus: 'pending',
    requestDate: new Date(Date.now() - 8 * 3600 * 1000).toISOString(),
    acceptedAt: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 8 * 3600 * 1000).toISOString(),
    timeline: [
      {
        status: 'pending',
        timestamp: new Date(Date.now() - 8 * 3600 * 1000).toISOString(),
        actor: 'Max Super Specialty Hospital',
        note: 'Requisition submitted',
      },
      {
        status: 'accepted',
        timestamp: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
        actor: 'Apollo Hospital & Multi-Specialty Centre',
        note: 'Requisition accepted by supplier',
      }
    ],
  },
  {
    id: 'req-demo-3',
    transactionId: 'REQ-2024-7104',
    orderId: 'ORD-1026',
    fromHospitalId: '11111111-1111-1111-1111-111111111111',
    fromHospitalName: 'Apollo Hospital & Multi-Specialty Centre',
    toHospitalId: '22222222-2222-2222-2222-222222222222',
    toHospitalName: 'Fortis Memorial Research Institute',
    inventoryLotId: 'b0000004-0000-0000-0000-000000000004',
    medicineId: 'a0000004-0000-0000-0000-000000000004',
    medicineName: 'Pantocid 40',
    genericName: 'Pantoprazole',
    batchNo: 'PAN-24-0655',
    quantity: 80,
    unitOriginalPrice: 85,
    unitFinalPrice: 75,
    totalAmount: 6000,
    gstAmount: 720,
    urgency: 'Standard Routine',
    notes: 'Completed stock exchange.',
    status: 'delivered',
    paymentStatus: 'paid',
    requestDate: new Date(Date.now() - 72 * 3600 * 1000).toISOString(),
    acceptedAt: new Date(Date.now() - 70 * 3600 * 1000).toISOString(),
    deliveredAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 72 * 3600 * 1000).toISOString(),
    timeline: [
      { status: 'pending', timestamp: new Date(Date.now() - 72 * 3600 * 1000).toISOString() },
      { status: 'accepted', timestamp: new Date(Date.now() - 70 * 3600 * 1000).toISOString() },
      { status: 'delivered', timestamp: new Date(Date.now() - 24 * 3600 * 1000).toISOString() },
    ]
  }
];

const requestService = {
  /**
   * Creates an inter-hospital medicine requisition with atomic stock reservation
   */
  async createRequest(reqData, reqUser) {
    const inventoryService = require('./inventoryService');
    const hospitalService = require('./hospitalService');

    // 1. Authoritative verification of buyer hospital
    const buyerHospitalId = reqUser?.hospitalId || reqUser?.id;
    if (!buyerHospitalId) {
      const err = new Error('Authentication required: Caller is not associated with a hospital profile.');
      err.statusCode = 401;
      throw err;
    }

    const buyerHospital = await hospitalService.getHospitalById(buyerHospitalId);
    if (!buyerHospital || (buyerHospital.status !== 'APPROVED' && buyerHospital.status !== 'verified')) {
      const err = new Error('Operation Forbidden: Your hospital registration is pending or unapproved.');
      err.statusCode = 403;
      err.code = 'BUYER_UNAPPROVED';
      throw err;
    }

    // 2. Validate quantity
    const quantity = Number(reqData.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      const err = new Error('Validation Error: Requested quantity must be a positive integer.');
      err.statusCode = 400;
      throw err;
    }

    // 3. Resolve target inventory lot
    const lotId = reqData.inventoryLotId || reqData.lotId || reqData.medicineId;
    if (!lotId) {
      const err = new Error('Validation Error: Target inventory lot identifier is required.');
      err.statusCode = 400;
      throw err;
    }

    // 4. Atomically reserve stock on target inventory lot
    // This strictly verifies lot existence, activity, non-expiry, and available quantity
    const reservation = await inventoryService.reserveStock(lotId, quantity);

    // 5. Guard: Reject self-purchase
    if (reservation.hospitalId === buyerHospitalId) {
      // Revert reservation
      await inventoryService.releaseReservation(lotId, quantity);
      const err = new Error('Self-procurement prohibited: Hospitals cannot submit purchase requisitions for their own stock.');
      err.statusCode = 400;
      err.code = 'SELF_PURCHASE_FORBIDDEN';
      throw err;
    }

    // 6. Verify seller hospital approval
    const sellerHospital = await hospitalService.getHospitalById(reservation.hospitalId);
    if (!sellerHospital || (sellerHospital.status !== 'APPROVED' && sellerHospital.status !== 'verified')) {
      await inventoryService.releaseReservation(lotId, quantity);
      const err = new Error('Requisition prohibited: Supplying hospital is not in verified active status.');
      err.statusCode = 403;
      err.code = 'SELLER_UNAPPROVED';
      throw err;
    }

    // 7. Authoritative price snapshot (Never trust client prices)
    const unitPrice = Number(reservation.unitPrice || 100);
    const subtotal = Math.round(quantity * unitPrice * 100) / 100;
    const gstAmount = Math.round(subtotal * 0.12 * 100) / 100;
    const totalAmount = Math.round((subtotal + gstAmount) * 100) / 100;

    const txnId = 'REQ-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + Math.floor(1000 + Math.random() * 9000);
    const orderId = 'ORD-' + Date.now().toString().slice(-6);
    const nowIso = new Date().toISOString();

    const newRequest = {
      id: uuidv4(),
      transactionId: txnId,
      orderId,
      fromHospitalId: buyerHospitalId,
      fromHospitalName: buyerHospital.name,
      toHospitalId: sellerHospital.id,
      toHospitalName: sellerHospital.name,
      inventoryLotId: reservation.lotId,
      medicineId: reservation.medicineId || reservation.lotId,
      medicineName: reservation.medicineName,
      genericName: reservation.genericName || 'Pharmaceutical Compound',
      batchNo: reservation.batchNumber,
      quantity,
      unitOriginalPrice: unitPrice,
      unitFinalPrice: unitPrice,
      totalAmount,
      gstAmount,
      urgency: reqData.urgency || 'Standard Routine',
      notes: reqData.notes ? String(reqData.notes).trim() : 'Inter-hospital logistics requisition',
      status: 'pending',
      paymentStatus: 'pending',
      requestDate: nowIso,
      createdAt: nowIso,
      updatedAt: nowIso,
      timeline: [
        {
          status: 'pending',
          timestamp: nowIso,
          actor: buyerHospital.name,
          note: `Requisition created for ${quantity} units. Stock atomically reserved.`,
        }
      ],
    };

    if (isConfigured && supabaseAdmin) {
      try {
        await supabaseAdmin.from('requests').insert([{
          id: newRequest.id,
          transaction_id: newRequest.transactionId,
          order_id: newRequest.orderId,
          from_hospital_id: newRequest.fromHospitalId,
          from_hospital_name: newRequest.fromHospitalName,
          to_hospital_id: newRequest.toHospitalId,
          to_hospital_name: newRequest.toHospitalName,
          inventory_lot_id: newRequest.inventoryLotId,
          medicine_name: newRequest.medicineName,
          generic_name: newRequest.genericName,
          batch_no: newRequest.batchNo,
          quantity: newRequest.quantity,
          unit_original_price: newRequest.unitOriginalPrice,
          unit_final_price: newRequest.unitFinalPrice,
          total_amount: newRequest.totalAmount,
          gst_amount: newRequest.gstAmount,
          urgency: newRequest.urgency,
          notes: newRequest.notes,
          status: 'pending',
          payment_status: 'pending',
          timeline: newRequest.timeline,
          requested_date: nowIso,
          request_date: nowIso,
        }]);

        // Point-in-time line-item snapshot in request_items table
        await supabaseAdmin.from('request_items').insert([{
          id: uuidv4(),
          request_id: newRequest.id,
          inventory_lot_id: newRequest.inventoryLotId,
          medicine_name: newRequest.medicineName,
          generic_name: newRequest.genericName,
          batch_number: newRequest.batchNo,
          quantity: newRequest.quantity,
          unit_price: newRequest.unitFinalPrice,
          subtotal,
          gst_percent: 12.00,
          gst_amount: gstAmount,
          total_price: totalAmount,
        }]);
      } catch (dbErr) {
        logger.warn('Supabase request insertion failed:', dbErr.message);
      }
    }

    devRequests.unshift(newRequest);

    // 8. In-app notification for supplying hospital with stable references
    await notificationService.createNotification({
      hospitalId: sellerHospital.id,
      notificationType: 'NEW_REQUEST',
      type: 'info',
      title: `New Requisition: ${newRequest.medicineName}`,
      message: `${buyerHospital.name} requested ${quantity} units of ${newRequest.medicineName} (Batch ${newRequest.batchNo}). Stock has been reserved.`,
      relatedEntityType: 'request',
      relatedEntityId: newRequest.id,
      link: `/hospital/requests/incoming`,
      metadata: {
        requestId: newRequest.id,
        transactionId: newRequest.transactionId,
        medicineId: newRequest.medicineId,
        inventoryLotId: newRequest.inventoryLotId,
        hospitalId: buyerHospitalId,
        quantity,
      }
    });

    // 8b. Real-time authoritative alert for supplying hospital
    try {
      await alertService.createRequestAlert({
        hospitalId: sellerHospital.id,
        requestId: newRequest.id,
        status: 'PENDING_REQUEST',
        type: 'PENDING_REQUEST',
        medicineName: newRequest.medicineName,
        reason: `${buyerHospital.name} requested ${quantity} units. Review clinical availability.`,
        actor: buyerHospital.name,
        request: newRequest,
      });
    } catch (alertErr) {
      logger.warn('Failed to emit requisition alert to seller:', alertErr.message);
    }

    // 9. Immutable audit log
    await auditService.logEvent({
      action: 'REQUEST_CREATED',
      entityType: 'REQUEST',
      entityId: newRequest.id,
      hospitalId: buyerHospitalId,
      hospitalName: buyerHospital.name,
      partnerHospitalId: sellerHospital.id,
      partnerHospitalName: sellerHospital.name,
      summary: `Created requisition ${newRequest.transactionId} for ${quantity} units of ${newRequest.medicineName} from ${sellerHospital.name}. Stock reserved.`,
      resultingStatus: 'pending',
      metadata: {
        transactionId: newRequest.transactionId,
        inventoryLotId: newRequest.inventoryLotId,
        quantity,
        totalAmount,
      }
    });

    return newRequest;
  },

  /**
   * Retrieves authoritative server-side cancellation policy and estimated refund
   */
  async getCancellationPolicy(requestId, { hospitalId = null, isAdmin = false } = {}) {
    const request = await this.getRequestById(requestId, { hospitalId, isAdmin });
    const policy = determineCancellationEligibility(request);
    const amounts = calculateRefundAmounts(request, policy);

    return {
      cancellable: policy.canCancel,
      canCancel: policy.canCancel,
      reason: policy.reason,
      requestAgeHours: policy.requestAgeHours || policy.elapsedHours,
      penaltyPercent: policy.penaltyPercent,
      penaltyPercentage: policy.penaltyPercent,
      refundPercent: policy.refundPercent,
      refundPercentage: policy.refundPercent,
      estimatedPenalty: amounts.penaltyAmount,
      penaltyAmount: amounts.penaltyAmount,
      estimatedRefund: amounts.refundAmount,
      refundAmount: amounts.refundAmount,
      totalAmount: amounts.totalAmount,
      stage: policy.stage,
      stageCode: policy.stageCode || policy.stage,
      tierCode: policy.tierCode,
      stageLabel: policy.stageLabel,
    };
  },

  /**
   * Performs atomic request cancellation, stock release, and refund record creation
   */
  async cancelRequest({ requestId, reason = 'Buyer requested cancellation', note = '', hospitalId, reqUser }) {
    const unlock = await requestMutex.acquire(requestId);
    const inventoryService = require('./inventoryService');

    try {
      const request = await this.getRequestById(requestId, { hospitalId, isAdmin: reqUser?.role === 'admin' });

      // Permission check: strictly buyer hospital or explicitly privileged admin
      const isBuyer = request.fromHospitalId === hospitalId || request.from_hospital_id === hospitalId;
      const isAdmin = reqUser?.role === 'admin';

      if (!isBuyer && !isAdmin) {
        const err = new Error('Access denied: Only the purchasing/buyer hospital can cancel this requisition.');
        err.statusCode = 403;
        err.code = 'CANCELLATION_FORBIDDEN';
        throw err;
      }

      // Check current state & eligibility
      const policy = determineCancellationEligibility(request);
      if (!policy.canCancel) {
        const err = new Error(policy.reason || 'This requisition cannot be cancelled at its current stage.');
        err.statusCode = policy.stage === 'CANCELLED' ? 409 : 400;
        err.code = policy.stage === 'CANCELLED' ? 'ALREADY_CANCELLED' : 'CANCELLATION_NOT_ALLOWED';
        throw err;
      }

      // Authoritative financial calculations
      const amounts = calculateRefundAmounts(request, policy);
      const nowIso = new Date().toISOString();
      const combinedReason = note ? `${reason} (${note})` : reason;

      // Atomic multi-instance cancellation lock in database
      if (isConfigured) {
        const client = supabaseAdmin || supabaseAnon;
        if (client) {
          try {
            const { data: existingRow } = await client
              .from('requests')
              .select('id, status')
              .eq('id', request.id)
              .maybeSingle();

            if (existingRow) {
              if (existingRow.status === 'cancelled') {
                const err = new Error('Requisition is already cancelled.');
                err.statusCode = 409;
                err.code = 'ALREADY_CANCELLED';
                throw err;
              }

              const { data: cancelledRow, error: updateErr } = await client
                .from('requests')
                .update({
                  status: 'cancelled',
                  cancelled_at: nowIso,
                  cancelled_by: reqUser?.id,
                  cancellation_reason: combinedReason,
                  cancellation_stage: policy.stage,
                  cancellation_penalty_percent: policy.penaltyPercent,
                  cancellation_penalty_amount: amounts.penaltyAmount,
                  cancellation_refund_percent: policy.refundPercent,
                  cancellation_refund_amount: amounts.refundAmount,
                  updated_at: nowIso,
                })
                .eq('id', request.id)
                .neq('status', 'cancelled')
                .select();

              if (!updateErr && (!cancelledRow || cancelledRow.length === 0)) {
                const err = new Error('Requisition is already cancelled.');
                err.statusCode = 409;
                err.code = 'ALREADY_CANCELLED';
                throw err;
              }
            }
          } catch (dbErr) {
            if (dbErr.statusCode) throw dbErr;
            logger.warn('Supabase cancellation transition check note:', dbErr.message);
          }
        }
      }

      if (request.status === 'cancelled') {
        const err = new Error('This requisition is already cancelled.');
        err.statusCode = 409;
        err.code = 'ALREADY_CANCELLED';
        throw err;
      }
      request.status = 'cancelled';

      // 1. Release reserved stock if request has an inventory lot attached
      const lotId = request.inventoryLotId || request.inventory_lot_id;
      if (lotId) {
        await inventoryService.releaseReservation(lotId, request.quantity);
      }

      // 2. Create Refund Record
      const refundRecord = await refundService.createRefund({
        requestId: request.id,
        paymentId: request.paymentId || request.payment_id || null,
        transactionId: request.transactionId || request.transaction_id,
        buyerHospitalId: request.fromHospitalId || request.from_hospital_id,
        sellerHospitalId: request.toHospitalId || request.to_hospital_id,
        totalOrderAmount: amounts.totalAmount,
        cancellationStage: policy.stage,
        penaltyPercentage: policy.penaltyPercent,
        penaltyAmount: amounts.penaltyAmount,
        refundPercentage: policy.refundPercent,
        refundAmount: amounts.refundAmount,
        reason: combinedReason,
        status: 'pending', // Starts as pending until actual gateway disbursement
      });

      // 3. Update Request record
      const cancellationData = {
        cancelledAt: nowIso,
        cancelledBy: reqUser?.id || hospitalId,
        reason: combinedReason,
        stage: policy.stage,
        stageLabel: policy.stageLabel,
        penaltyPercent: policy.penaltyPercent,
        penaltyAmount: amounts.penaltyAmount,
        refundPercent: policy.refundPercent,
        refundAmount: amounts.refundAmount,
        totalAmount: amounts.totalAmount,
        refundId: refundRecord.id,
        refundNumber: refundRecord.refundNumber,
      };

      request.cancelledAt = nowIso;
      request.cancelledBy = reqUser?.id || hospitalId;
      request.cancellationReason = combinedReason;
      request.cancellationStage = policy.stage;
      request.cancellationPenaltyPercent = policy.penaltyPercent;
      request.cancellationPenaltyAmount = amounts.penaltyAmount;
      request.cancellationRefundPercent = policy.refundPercent;
      request.cancellationRefundAmount = amounts.refundAmount;
      request.cancellation = cancellationData;
      request.updatedAt = nowIso;

      if (!request.timeline) request.timeline = [];
      request.timeline.push({
        status: 'cancelled',
        timestamp: nowIso,
        actor: reqUser?.name || 'Buyer Hospital Pharmacist',
        note: `Requisition cancelled (${policy.stageLabel}). Penalty: ₹${amounts.penaltyAmount} (${policy.penaltyPercent}%). Refund: ₹${amounts.refundAmount}. Reason: ${combinedReason}`,
      });

      if (isConfigured) {
        const client = supabaseAdmin || supabaseAnon;
        if (client) {
          try {
            await client
              .from('requests')
              .update({
                cancellation: cancellationData,
                timeline: request.timeline,
                updated_at: nowIso,
              })
              .eq('id', request.id);
          } catch (dbErr) {
            logger.warn('Supabase cancellation metadata update note:', dbErr.message);
          }
        }
      }

      // 4. Notify supplying/seller hospital
      await notificationService.createNotification({
        hospitalId: request.toHospitalId || request.to_hospital_id,
        notificationType: 'REQUEST_CANCELLED',
        type: 'warning',
        title: `Requisition Cancelled: ${request.medicineName}`,
        message: `Requisition #${request.transactionId || request.id} for ${request.medicineName} (${request.quantity} units) was cancelled by ${request.fromHospitalName || 'Buyer'}. Reason: ${combinedReason}. Reserved stock has been restored.`,
        relatedEntityType: 'request',
        relatedEntityId: request.id,
        link: `/hospital/requests/incoming`,
        metadata: {
          requestId: request.id,
          transactionId: request.transactionId,
          inventoryLotId: lotId,
          medicineId: request.medicineId,
          quantity: request.quantity,
          reason: combinedReason,
        }
      });

      // 4b. Notify buyer hospital regarding refund creation
      await notificationService.createNotification({
        hospitalId: request.fromHospitalId || request.from_hospital_id,
        notificationType: 'REFUND_PENDING',
        type: 'info',
        title: `Refund Pending: ₹${amounts.refundAmount.toLocaleString()}`,
        message: `Your cancellation for requisition #${request.transactionId || request.id} has been processed. An estimated refund of ₹${amounts.refundAmount.toLocaleString()} (${policy.refundPercent}%) is pending ledger reconciliation.`,
        relatedEntityType: 'refund',
        relatedEntityId: refundRecord.id,
        link: `/hospital/requests`,
        metadata: {
          refundId: refundRecord.id,
          refundNumber: refundRecord.refundNumber,
          requestId: request.id,
          transactionId: request.transactionId,
          refundAmount: amounts.refundAmount,
          penaltyAmount: amounts.penaltyAmount,
          refundPercent: policy.refundPercent,
          status: 'pending',
        }
      });

      // 4c. Authoritative Request Alert to Seller
      try {
        await alertService.createRequestAlert({
          hospitalId: request.toHospitalId || request.to_hospital_id,
          requestId: request.id,
          status: 'CANCELLED',
          medicineName: request.medicineName,
          reason: combinedReason,
        });
      } catch (alertErr) {
        logger.warn('Failed to emit cancellation alert to seller:', alertErr.message);
      }

      // 5. Audit Logging
      await auditService.logEvent({
        action: 'REQUEST_CANCELLED',
        entityType: 'REQUEST',
        entityId: request.id,
        hospitalId: request.fromHospitalId || request.from_hospital_id,
        hospitalName: request.fromHospitalName || request.from_hospital_name,
        partnerHospitalId: request.toHospitalId || request.to_hospital_id,
        partnerHospitalName: request.toHospitalName || request.to_hospital_name,
        summary: `Cancelled requisition ${request.transactionId || request.id} for ${request.medicineName}. Penalty: ₹${amounts.penaltyAmount} (${policy.penaltyPercent}%). Refund: ₹${amounts.refundAmount} (${policy.refundPercent}%). Stock reservation released.`,
        resultingStatus: 'cancelled',
        metadata: {
          refundNumber: refundRecord.refundNumber,
          penaltyAmount: amounts.penaltyAmount,
          refundAmount: amounts.refundAmount,
          totalAmount: amounts.totalAmount,
          cancellationStage: policy.stage,
          reason: combinedReason,
        }
      });

      try {
        const tradingService = require('./tradingService');
        await tradingService.syncTradeFromRequest(request, { actor: 'Buyer Hospital' });
      } catch (trdErr) {
        logger.warn('Failed to sync trade in cancelRequest:', trdErr.message);
      }

      return {
        request,
        refund: refundRecord,
        message: 'Requisition successfully cancelled and stock reservation released.',
      };
    } finally {
      unlock();
    }
  },

  /**
   * Supplier accepts incoming requisition (maintains stock reservation)
   */
  async acceptRequest({ requestId, hospitalId, reqUser }) {
    const unlock = await requestMutex.acquire(requestId);
    try {
      const request = await this.getRequestById(requestId, { hospitalId, isAdmin: reqUser?.role === 'admin' });

      // Seller permission check
      if (request.toHospitalId !== hospitalId && request.to_hospital_id !== hospitalId && reqUser?.role !== 'admin') {
        const err = new Error('Access denied: You are not the supplying hospital for this requisition.');
        err.statusCode = 403;
        throw err;
      }

      if (request.status !== 'pending') {
        const err = new Error(`Cannot accept requisition: Current status is already "${request.status}".`);
        err.statusCode = 400;
        throw err;
      }

      const nowIso = new Date().toISOString();

      if (isConfigured) {
        const client = supabaseAdmin || supabaseAnon;
        if (client) {
          try {
            const { data: existingRow } = await client
              .from('requests')
              .select('id, status')
              .eq('id', request.id)
              .maybeSingle();

            if (existingRow) {
              if (existingRow.status !== 'pending') {
                const err = new Error(`Cannot accept requisition: Current status is already "${existingRow.status}".`);
                err.statusCode = 400;
                throw err;
              }

              const { data: acceptedRow, error: updateErr } = await client
                .from('requests')
                .update({
                  status: 'accepted',
                  accepted_at: nowIso,
                  updated_at: nowIso,
                })
                .eq('id', request.id)
                .eq('status', 'pending')
                .select();

              if (!updateErr && (!acceptedRow || acceptedRow.length === 0)) {
                const err = new Error(`Cannot accept requisition: Current status is already "${request.status}".`);
                err.statusCode = 400;
                throw err;
              }
            }
          } catch (dbErr) {
            if (dbErr.statusCode) throw dbErr;
            logger.warn('Supabase acceptRequest note:', dbErr.message);
          }
        }
      }

      request.status = 'accepted';
      request.acceptedAt = nowIso;
      request.updatedAt = nowIso;

      if (!request.timeline) request.timeline = [];
      request.timeline.push({
        status: 'accepted',
        timestamp: nowIso,
        actor: reqUser?.name || 'Supplying Hospital Pharmacist',
        note: `Requisition accepted. Stock reservation confirmed for dispatch.`,
      });

      if (isConfigured) {
        const client = supabaseAdmin || supabaseAnon;
        if (client) {
          try {
            await client
              .from('requests')
              .update({
                timeline: request.timeline,
                updated_at: nowIso,
              })
              .eq('id', request.id);
          } catch (dbErr) {
            logger.warn('Supabase acceptRequest timeline update note:', dbErr.message);
          }
        }
      }

      // Notify buyer hospital
      await notificationService.createNotification({
        hospitalId: request.fromHospitalId || request.from_hospital_id,
        notificationType: 'REQUEST_ACCEPTED',
        type: 'success',
        title: `Requisition Accepted: ${request.medicineName}`,
        message: `${request.toHospitalName || 'Supplier'} accepted your requisition #${request.transactionId || request.id} for ${request.quantity} units.`,
        relatedEntityType: 'request',
        relatedEntityId: request.id,
        link: `/hospital/requests`,
        metadata: {
          requestId: request.id,
          transactionId: request.transactionId,
          medicineId: request.medicineId,
          quantity: request.quantity,
        }
      });

      // Emit authoritative alert to buyer hospital
      try {
        await alertService.createRequestAlert({
          hospitalId: request.fromHospitalId || request.from_hospital_id,
          requestId: request.id,
          status: 'ACCEPTED',
          type: 'REQUEST_ACCEPTED',
          medicineName: request.medicineName,
          reason: `${request.toHospitalName || 'Supplier'} accepted transfer request for ${request.quantity} units. Dispatch packaging underway.`,
          actor: request.toHospitalName,
          request,
        });
      } catch (alertErr) {
        logger.warn('Failed to emit acceptance alert to buyer:', alertErr.message);
      }

      await auditService.logEvent({
        action: 'REQUEST_ACCEPTED',
        entityType: 'REQUEST',
        entityId: request.id,
        hospitalId: request.toHospitalId || request.to_hospital_id,
        hospitalName: request.toHospitalName,
        partnerHospitalId: request.fromHospitalId || request.from_hospital_id,
        partnerHospitalName: request.fromHospitalName,
        summary: `Accepted requisition ${request.transactionId} for ${request.quantity} units of ${request.medicineName}.`,
        resultingStatus: 'accepted',
      });

      try {
        const tradingService = require('./tradingService');
        await tradingService.syncTradeFromRequest(request, { actor: 'Supplier Hospital' });
      } catch (trdErr) {
        logger.warn('Failed to sync trade in acceptRequest:', trdErr.message);
      }

      return request;
    } finally {
      unlock();
    }
  },

  /**
   * Supplier declines incoming requisition (releases stock reservation)
   */
  async rejectRequest({ requestId, reason = 'Stock unavailable', hospitalId, reqUser }) {
    const unlock = await requestMutex.acquire(requestId);
    const inventoryService = require('./inventoryService');

    try {
      const request = await this.getRequestById(requestId, { hospitalId, isAdmin: reqUser?.role === 'admin' });

      if (request.toHospitalId !== hospitalId && request.to_hospital_id !== hospitalId && reqUser?.role !== 'admin') {
        const err = new Error('Access denied: You are not the supplying hospital for this requisition.');
        err.statusCode = 403;
        throw err;
      }

      if (request.status !== 'pending') {
        const err = new Error(`Cannot decline requisition: Current status is already "${request.status}".`);
        err.statusCode = 400;
        throw err;
      }

      const nowIso = new Date().toISOString();

      if (isConfigured) {
        const client = supabaseAdmin || supabaseAnon;
        if (client) {
          try {
            const { data: existingRow } = await client
              .from('requests')
              .select('id, status')
              .eq('id', request.id)
              .maybeSingle();

            if (existingRow) {
              if (existingRow.status !== 'pending') {
                const err = new Error(`Cannot decline requisition: Current status is already "${existingRow.status}".`);
                err.statusCode = 400;
                throw err;
              }

              const { data: rejectedRow, error: updateErr } = await client
                .from('requests')
                .update({
                  status: 'rejected',
                  rejected_at: nowIso,
                  reject_reason: reason,
                  updated_at: nowIso,
                })
                .eq('id', request.id)
                .eq('status', 'pending')
                .select();

              if (!updateErr && (!rejectedRow || rejectedRow.length === 0)) {
                const err = new Error(`Cannot decline requisition: Current status is already "${request.status}".`);
                err.statusCode = 400;
                throw err;
              }
            }
          } catch (dbErr) {
            if (dbErr.statusCode) throw dbErr;
            logger.warn('Supabase rejectRequest note:', dbErr.message);
          }
        }
      }

      if (request.status !== 'pending') {
        const err = new Error(`Cannot decline requisition: Current status is already "${request.status}".`);
        err.statusCode = 400;
        throw err;
      }
      request.status = 'rejected';
      request.rejectedAt = nowIso;
      request.rejectReason = reason;
      request.updatedAt = nowIso;

      // Release reserved stock back to available pool ONLY after status successfully transitioned
      const lotId = request.inventoryLotId || request.inventory_lot_id;
      if (lotId) {
        await inventoryService.releaseReservation(lotId, request.quantity);
      }

      if (!request.timeline) request.timeline = [];
      request.timeline.push({
        status: 'rejected',
        timestamp: nowIso,
        actor: reqUser?.name || 'Supplying Hospital Pharmacist',
        note: `Requisition declined: ${reason}. Stock reservation released.`,
      });

      if (isConfigured) {
        const client = supabaseAdmin || supabaseAnon;
        if (client) {
          try {
            await client
              .from('requests')
              .update({
                timeline: request.timeline,
                updated_at: nowIso,
              })
              .eq('id', request.id);
          } catch (dbErr) {
            logger.warn('Supabase rejectRequest timeline note:', dbErr.message);
          }
        }
      }

      // Notify buyer hospital
      await notificationService.createNotification({
        hospitalId: request.fromHospitalId || request.from_hospital_id,
        notificationType: 'REQUEST_REJECTED',
        type: 'error',
        title: `Requisition Declined: ${request.medicineName}`,
        message: `${request.toHospitalName || 'Supplier'} declined requisition #${request.transactionId || request.id}. Reason: ${reason}.`,
        relatedEntityType: 'request',
        relatedEntityId: request.id,
        link: `/hospital/requests`,
        metadata: {
          requestId: request.id,
          transactionId: request.transactionId,
          reason,
        }
      });

      // Emit authoritative alert to buyer hospital
      try {
        await alertService.createRequestAlert({
          hospitalId: request.fromHospitalId || request.from_hospital_id,
          requestId: request.id,
          status: 'REJECTED',
          type: 'REQUEST_REJECTED',
          medicineName: request.medicineName,
          reason: reason || 'Requisition declined by supplier.',
          actor: request.toHospitalName,
          request,
        });
      } catch (alertErr) {
        logger.warn('Failed to emit rejection alert to buyer:', alertErr.message);
      }

      await auditService.logEvent({
        action: 'REQUEST_REJECTED',
        entityType: 'REQUEST',
        entityId: request.id,
        hospitalId: request.toHospitalId || request.to_hospital_id,
        hospitalName: request.toHospitalName,
        partnerHospitalId: request.fromHospitalId || request.from_hospital_id,
        partnerHospitalName: request.fromHospitalName,
        summary: `Declined requisition ${request.transactionId} for ${request.medicineName}. Reason: ${reason}. Stock released.`,
        resultingStatus: 'rejected',
      });

      return request;
    } finally {
      unlock();
    }
  },

  /**
   * Returns requests where the authenticated hospital is the buyer
   */
  async getMyRequests({ hospitalId, status, search, page = 1, limit = 50, startDate, endDate }) {
    return this.getRequests({
      hospitalId,
      type: 'outgoing',
      status,
      search,
      page,
      limit,
      startDate,
      endDate,
    });
  },

  /**
   * Returns incoming requests where the authenticated hospital is the seller
   */
  async getIncomingRequests({ hospitalId, status, search, page = 1, limit = 50, startDate, endDate }) {
    return this.getRequests({
      hospitalId,
      type: 'incoming',
      status,
      search,
      page,
      limit,
      startDate,
      endDate,
    });
  },

  /**
   * Derived purchases view (authenticated hospital is buyer)
   */
  async getPurchases({ hospitalId, search, page = 1, limit = 50, startDate, endDate }) {
    const result = await this.getRequests({
      hospitalId,
      type: 'outgoing',
      status: 'all',
      search,
      page,
      limit,
      startDate,
      endDate,
    });
    return result;
  },

  /**
   * Derived sales view (authenticated hospital is seller)
   */
  async getSales({ hospitalId, search, page = 1, limit = 50, startDate, endDate }) {
    const result = await this.getRequests({
      hospitalId,
      type: 'incoming',
      status: 'all',
      search,
      page,
      limit,
      startDate,
      endDate,
    });
    return result;
  },

  /**
   * General request filtering engine with permission controls and pagination
   */
  async getRequests({ hospitalId = null, type = 'all', status = 'all', search = '', page = 1, limit = 50, startDate = null, endDate = null }) {
    if (isConfigured) {
      try {
        const client = supabaseAdmin || supabaseAnon;
        let query = client.from('requests').select('*', { count: 'exact' });

        if (hospitalId) {
          if (type === 'incoming') {
            query = query.eq('to_hospital_id', hospitalId);
          } else if (type === 'outgoing') {
            query = query.eq('from_hospital_id', hospitalId);
          } else {
            query = query.or(`from_hospital_id.eq.${hospitalId},to_hospital_id.eq.${hospitalId}`);
          }
        }

        if (status && status !== 'all') {
          query = query.eq('status', status.toLowerCase());
        }

        if (search) {
          query = query.or(`medicine_name.ilike.%${search}%,transaction_id.ilike.%${search}%,from_hospital_name.ilike.%${search}%,to_hospital_name.ilike.%${search}%`);
        }

        if (startDate) {
          query = query.gte('request_date', startDate);
        }
        if (endDate) {
          query = query.lte('request_date', endDate);
        }

        const offset = (Math.max(1, Number(page)) - 1) * Number(limit);
        const { data, count, error } = await query
          .order('request_date', { ascending: false })
          .range(offset, offset + Number(limit) - 1);

        if (!error && data) {
          return {
            items: data,
            requests: data, // for backward compatibility
            total: count || data.length,
            page: Number(page),
            limit: Number(limit),
            totalPages: Math.ceil((count || data.length) / Number(limit)),
          };
        }
      } catch (err) {
        logger.warn('Supabase query failed in getRequests:', err.message);
      }
    }

    let reqs = [...devRequests];
    if (hospitalId) {
      if (type === 'incoming') {
        reqs = reqs.filter((r) => r.toHospitalId === hospitalId || r.to_hospital_id === hospitalId);
      } else if (type === 'outgoing') {
        reqs = reqs.filter((r) => r.fromHospitalId === hospitalId || r.from_hospital_id === hospitalId);
      } else {
        reqs = reqs.filter(
          (r) =>
            r.fromHospitalId === hospitalId ||
            r.from_hospital_id === hospitalId ||
            r.toHospitalId === hospitalId ||
            r.to_hospital_id === hospitalId
        );
      }
    }

    if (status && status !== 'all') {
      reqs = reqs.filter((r) => (r.status || '').toLowerCase() === status.toLowerCase());
    }

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      reqs = reqs.filter(
        (r) =>
          (r.medicineName || '').toLowerCase().includes(q) ||
          (r.transactionId || '').toLowerCase().includes(q) ||
          (r.fromHospitalName || '').toLowerCase().includes(q) ||
          (r.toHospitalName || '').toLowerCase().includes(q)
      );
    }

    if (startDate) {
      reqs = reqs.filter((r) => new Date(r.requestDate || r.createdAt) >= new Date(startDate));
    }
    if (endDate) {
      reqs = reqs.filter((r) => new Date(r.requestDate || r.createdAt) <= new Date(endDate));
    }

    const total = reqs.length;
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.max(1, Number(limit));
    const offset = (pageNum - 1) * limitNum;
    const paginated = reqs.slice(offset, offset + limitNum);

    return {
      items: paginated,
      requests: paginated,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    };
  },

  /**
   * Retrieves single request with item snapshot and permissions enforcement
   */
  async getRequestById(id, { hospitalId = null, isAdmin = false } = {}) {
    let targetReq = null;

    if (isConfigured) {
      try {
        const client = supabaseAdmin || supabaseAnon;
        const { data, error } = await client
          .from('requests')
          .select('*, request_items(*)')
          .eq('id', id)
          .single();

        if (!error && data) targetReq = data;
      } catch (err) {
        // Fall through
      }
    }

    if (!targetReq) {
      targetReq = devRequests.find((r) => r.id === id || r.transactionId === id);
    }

    if (!targetReq) {
      const err = new Error(`Requisition '${id}' not found.`);
      err.statusCode = 404;
      throw err;
    }

    const fromHosp = targetReq.fromHospitalId || targetReq.from_hospital_id;
    const toHosp = targetReq.toHospitalId || targetReq.to_hospital_id;

    if (!isAdmin && hospitalId && fromHosp !== hospitalId && toHosp !== hospitalId) {
      const err = new Error('Access denied: You are not authorized to view this requisition.');
      err.statusCode = 403;
      throw err;
    }

    return targetReq;
  },

  /**
   * Phase 7: Transition request to payment_pending state when payment intent is created
   */
  async markRequestPaymentPending({ requestId, paymentId, reqUser = null }) {
    const unlock = await requestMutex.acquire(requestId);
    try {
      const request = await this.getRequestById(requestId, { isAdmin: true });
      const nowIso = new Date().toISOString();

      request.paymentStatus = 'pending';
      request.payment_status = 'pending';
      request.paymentId = paymentId;
      request.payment_id = paymentId;
      request.updatedAt = nowIso;
      request.updated_at = nowIso;

      if (!request.timeline) request.timeline = [];
      request.timeline.push({
        status: request.status,
        timestamp: nowIso,
        actor: reqUser?.name || 'MedEx Payment Engine',
        note: `Payment order initiated (Payment ID: ${paymentId}). Awaiting gateway authorization.`,
      });

      if (isConfigured && supabaseAdmin) {
        try {
          await supabaseAdmin
            .from('requests')
            .update({
              payment_status: 'pending',
              payment_id: paymentId,
              timeline: request.timeline,
              updated_at: nowIso,
            })
            .eq('id', request.id);
        } catch (dbErr) {
          logger.warn('Supabase markRequestPaymentPending failed:', dbErr.message);
        }
      }

      return request;
    } finally {
      unlock();
    }
  },

  /**
   * Phase 7: Atomically transition request to PAID upon verified payment or webhook
   */
  async markRequestAsPaid({ requestId, paymentId, providerOrderId, providerPaymentId, actor = 'Payment Gateway' }) {
    const unlock = await requestMutex.acquire(requestId);
    try {
      const request = await this.getRequestById(requestId, { isAdmin: true });
      if (request.status === 'paid' && (request.paymentStatus === 'paid' || request.payment_status === 'paid')) {
        return request;
      }

      const nowIso = new Date().toISOString();

      request.paymentStatus = 'paid';
      request.payment_status = 'paid';
      request.paymentId = paymentId;
      request.payment_id = paymentId;
      request.paidDate = nowIso;
      request.paid_date = nowIso;
      request.status = 'paid';
      request.updatedAt = nowIso;
      request.updated_at = nowIso;

      if (!request.timeline) request.timeline = [];
      request.timeline.push({
        status: 'paid',
        timestamp: nowIso,
        actor,
        note: `Payment verified & locked in Escrow. Provider Ref: ${providerPaymentId || providerOrderId || 'N/A'}. Order marked for preparation.`,
      });

      if (isConfigured) {
        const client = supabaseAdmin || supabaseAnon;
        if (client) {
          try {
            await client
              .from('requests')
              .update({
                status: 'paid',
                payment_status: 'paid',
                payment_id: paymentId,
                paid_date: nowIso,
                timeline: request.timeline,
                updated_at: nowIso,
              })
              .eq('id', request.id);
          } catch (dbErr) {
            logger.warn('Supabase markRequestAsPaid failed:', dbErr.message);
          }
        }
      }

      try {
        const tradingService = require('./tradingService');
        await tradingService.syncTradeFromRequest(request, { paymentId, actor });
      } catch (trdErr) {
        logger.warn('Failed to sync trade in markRequestAsPaid:', trdErr.message);
      }

      return request;
    } finally {
      unlock();
    }
  },

  /**
   * Phase 7: Record payment failure without prematurely cancelling the request or releasing stock
   */
  async markRequestPaymentFailed({ requestId, paymentId, reason = 'Payment attempt failed' }) {
    const unlock = await requestMutex.acquire(requestId);
    try {
      const request = await this.getRequestById(requestId, { isAdmin: true });
      const nowIso = new Date().toISOString();

      request.paymentStatus = 'failed';
      request.payment_status = 'failed';
      request.paymentFailureReason = reason;
      request.payment_failure_reason = reason;
      request.updatedAt = nowIso;
      request.updated_at = nowIso;

      if (!request.timeline) request.timeline = [];
      request.timeline.push({
        status: request.status,
        timestamp: nowIso,
        actor: 'Payment Gateway',
        note: `Payment authorization failed: ${reason}. Stock remains reserved for retry.`,
      });

      if (isConfigured && supabaseAdmin) {
        try {
          await supabaseAdmin
            .from('requests')
            .update({
              payment_status: 'failed',
              payment_failure_reason: reason,
              timeline: request.timeline,
              updated_at: nowIso,
            })
            .eq('id', request.id);
        } catch (dbErr) {
          logger.warn('Supabase markRequestPaymentFailed failed:', dbErr.message);
        }
      }

      return request;
    } finally {
      unlock();
    }
  }
};

requestService.devRequests = devRequests;
requestService.fallbackRequests = devRequests;
module.exports = requestService;
