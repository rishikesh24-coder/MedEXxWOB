const { randomUUID: uuidv4 } = require('crypto');
const { supabaseAdmin, supabaseAnon, isConfigured } = require('../config/supabase');
const { getPaymentProvider } = require('./paymentProvider');
const requestService = require('./requestService');
const auditService = require('./auditService');
const notificationService = require('./notificationService');
const alertService = require('./alertService');
const logger = require('../utils/logger');

// Mutex to serialize payment transitions and prevent race conditions
class PaymentMutex {
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
const paymentMutex = new PaymentMutex();

// Local fallback stores for offline/sandbox development
const fallbackPayments = [];
const fallbackWebhookEvents = [];

const paymentService = {
  /**
   * Creates a secure server-side payment intent.
   * STRICT AMOUNT PROTECTION: Calculates total amount exclusively from database/request snapshot.
   */
  async createPayment({ user, requestId }) {
    if (!user) {
      const err = new Error('Authentication required to create payment');
      err.statusCode = 401;
      throw err;
    }

    const unlock = await paymentMutex.acquire(requestId);
    try {
      // 1. Fetch authoritative request snapshot
      const request = await requestService.getRequestById(requestId, {
        hospitalId: user.hospitalId,
        isAdmin: user.role === 'admin' || user.role === 'ADMIN',
      });

      // 2. Authorization check: user's hospital must be the buyer
      const buyerHospId = request.fromHospitalId || request.from_hospital_id;
      if (user.role !== 'admin' && user.role !== 'ADMIN' && user.hospitalId !== buyerHospId) {
        const err = new Error('Access denied: Only the requisitioning buyer hospital can make payments.');
        err.statusCode = 403;
        throw err;
      }

      // 3. State check: must be 'accepted' or 'payment_pending'
      const status = String(request.status).toLowerCase();
      if (status === 'pending') {
        const err = new Error('Requisition has not been accepted by the supplying hospital yet.');
        err.statusCode = 400;
        throw err;
      }
      if (status === 'rejected') {
        const err = new Error('Cannot pay for a declined requisition.');
        err.statusCode = 400;
        throw err;
      }
      if (status === 'cancelled') {
        const err = new Error('Cannot pay for a cancelled requisition.');
        err.statusCode = 400;
        throw err;
      }
      if (status === 'paid' || request.paymentStatus === 'paid' || request.payment_status === 'paid') {
        const err = new Error('This requisition has already been paid and escrow-locked.');
        err.statusCode = 400;
        throw err;
      }

      // 4. Server-Side Authoritative Amount Calculation
      const amount = Number(request.totalAmount || request.total_amount || 0);
      if (amount <= 0) {
        const err = new Error('Authoritative requisition total must be greater than zero.');
        err.statusCode = 400;
        throw err;
      }

      const provider = getPaymentProvider();
      const transactionId = `PAY-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

      // 5. Create provider order
      let providerOrder;
      try {
        providerOrder = await provider.createOrder({
          amount,
          currency: 'INR',
          receipt: `rcpt_${request.transactionId || request.id}`,
          notes: {
            requestId: request.id,
            transactionId: request.transactionId,
            buyerHospital: request.fromHospitalName || request.from_hospital_name,
            sellerHospital: request.toHospitalName || request.to_hospital_name,
          },
        });
      } catch (provErr) {
        logger.error('Payment provider order creation failed:', provErr);
        const err = new Error(`Payment gateway order creation failed: ${provErr.message}`);
        err.statusCode = 502;
        throw err;
      }

      const nowIso = new Date().toISOString();
      const paymentRecord = {
        id: uuidv4(),
        transaction_id: transactionId,
        transactionId,
        request_id: request.id,
        requestId: request.id,
        medicine_name: request.medicineName || request.medicine_name || 'Pharmaceutical Order',
        medicineName: request.medicineName || request.medicine_name || 'Pharmaceutical Order',
        quantity: request.quantity || 1,
        amount,
        gst_amount: Number(request.gstAmount || request.gst_amount || 0),
        gstAmount: Number(request.gstAmount || request.gst_amount || 0),
        total_paid: amount,
        totalPaid: amount,
        currency: 'INR',
        provider: provider.name,
        provider_order_id: providerOrder.id,
        providerOrderId: providerOrder.id,
        status: 'CREATED',
        payment_status: 'created',
        payment_method: 'B2B Escrow Transfer',
        paymentMethod: 'B2B Escrow Transfer',
        buyer_hospital_id: buyerHospId,
        buyerHospitalId: buyerHospId,
        buyer_hospital_name: request.fromHospitalName || request.from_hospital_name || 'Buyer Hospital',
        buyerHospitalName: request.fromHospitalName || request.from_hospital_name || 'Buyer Hospital',
        seller_hospital_id: request.toHospitalId || request.to_hospital_id,
        sellerHospitalId: request.toHospitalId || request.to_hospital_id,
        seller_hospital_name: request.toHospitalName || request.to_hospital_name || 'Seller Hospital',
        sellerHospitalName: request.toHospitalName || request.to_hospital_name || 'Seller Hospital',
        is_demo_simulation: provider.name === 'mock',
        isDemoSimulation: provider.name === 'mock',
        created_at: nowIso,
        createdAt: nowIso,
        updated_at: nowIso,
        updatedAt: nowIso,
      };

      // Persist payment record
      if (isConfigured) {
        const client = supabaseAdmin || supabaseAnon;
        if (client) {
          try {
            await client.from('payments').insert([{
              id: paymentRecord.id,
              transaction_id: paymentRecord.transaction_id,
              request_id: paymentRecord.request_id,
              medicine_name: paymentRecord.medicine_name,
              quantity: paymentRecord.quantity,
              amount: paymentRecord.amount,
              gst_amount: paymentRecord.gst_amount,
              total_paid: paymentRecord.total_paid,
              currency: paymentRecord.currency,
              provider: paymentRecord.provider,
              provider_order_id: paymentRecord.provider_order_id,
              status: paymentRecord.status,
              payment_status: paymentRecord.payment_status,
              payment_method: paymentRecord.payment_method,
              buyer_hospital_id: paymentRecord.buyer_hospital_id,
              buyer_hospital_name: paymentRecord.buyer_hospital_name,
              seller_hospital_id: paymentRecord.seller_hospital_id,
              seller_hospital_name: paymentRecord.seller_hospital_name,
              is_demo_simulation: paymentRecord.is_demo_simulation,
              created_at: nowIso,
              updated_at: nowIso,
            }]);
          } catch (dbErr) {
            logger.warn('Supabase payment insert failed:', dbErr.message);
          }
        }
      }

      fallbackPayments.unshift(paymentRecord);

      // 6. Update request status to payment_pending
      await requestService.markRequestPaymentPending({
        requestId: request.id,
        paymentId: paymentRecord.id,
        reqUser: user,
      });

      // 7. Audit log
      await auditService.logEvent({
        action: 'PAYMENT_INITIATED',
        entityType: 'PAYMENT',
        entityId: paymentRecord.id,
        actorRole: user.role || 'hospital',
        hospitalId: buyerHospId,
        hospitalName: paymentRecord.buyerHospitalName,
        partnerHospitalId: paymentRecord.sellerHospitalId,
        partnerHospitalName: paymentRecord.sellerHospitalName,
        summary: `Initiated payment order ${paymentRecord.transactionId} for ₹${amount}. Gateway order ID: ${providerOrder.id}.`,
        resultingStatus: 'CREATED',
        metadata: {
          requestId: request.id,
          provider: provider.name,
          providerOrderId: providerOrder.id,
          amount,
        },
      });

      // 8. In-app notification
      await notificationService.createNotification({
        hospitalId: buyerHospId,
        userId: user.id,
        notificationType: 'PAYMENT_INITIATED',
        type: 'info',
        title: `Payment Order Generated: ₹${amount.toLocaleString()}`,
        message: `Order #${providerOrder.id} generated for requisition #${request.transactionId}. Complete escrow authorization to release stock.`,
        relatedEntityType: 'payment',
        relatedEntityId: paymentRecord.id,
        link: '/hospital/requests',
        metadata: {
          paymentId: paymentRecord.id,
          providerOrderId: providerOrder.id,
          amount,
        },
      });

      return {
        paymentId: paymentRecord.id,
        transactionId: paymentRecord.transactionId,
        providerOrderId: providerOrder.id,
        amount,
        currency: 'INR',
        provider: provider.name,
        keyId: provider.keyId,
        requestId: request.id,
        medicineName: paymentRecord.medicineName,
      };
    } finally {
      unlock();
    }
  },

  /**
   * Verifies payment via client-submitted cryptographic signature.
   * Atomically transitions payment and requisition to PAID.
   */
  async verifyPayment({ user, paymentId, providerOrderId, providerPaymentId, providerSignature }) {
    if (!user) {
      const err = new Error('Authentication required to verify payment');
      err.statusCode = 401;
      throw err;
    }

    if (!providerOrderId || !providerPaymentId || !providerSignature) {
      const err = new Error('Missing payment verification tokens (providerOrderId, providerPaymentId, providerSignature required).');
      err.statusCode = 400;
      throw err;
    }

    const unlock = await paymentMutex.acquire(paymentId || providerOrderId);
    try {
      // 1. Fetch payment record
      const payment = await this.getPaymentById(paymentId, {
        providerOrderId,
        hospitalId: user.hospitalId,
        isAdmin: user.role === 'admin' || user.role === 'ADMIN',
      });

      // Idempotency: if already PAID, return success
      if (payment.status === 'PAID' || payment.status === 'paid') {
        return {
          success: true,
          payment,
          message: 'Payment has already been verified and locked in escrow.',
          alreadyProcessed: true,
        };
      }

      // 2. Cryptographic signature check via provider adapter
      const provider = getPaymentProvider(payment.provider);
      const isValid = provider.verifyPaymentSignature({
        orderId: providerOrderId,
        paymentId: providerPaymentId,
        signature: providerSignature,
      });

      if (!isValid) {
        // Mark payment as failed
        const nowIso = new Date().toISOString();
        payment.status = 'FAILED';
        payment.failureReason = 'Invalid cryptographic signature';
        payment.updatedAt = nowIso;

        if (isConfigured && supabaseAdmin) {
          try {
            await supabaseAdmin
              .from('payments')
              .update({
                status: 'FAILED',
                failure_reason: 'Invalid cryptographic signature',
                updated_at: nowIso,
              })
              .eq('id', payment.id);
          } catch (dbErr) {
            logger.warn('Failed to update payment status to FAILED in Supabase:', dbErr.message);
          }
        }

        const err = new Error('Cryptographic signature verification failed. Payment cannot be verified.');
        err.statusCode = 400;
        throw err;
      }

      // 3. Mark payment as PAID with conditional CAS update
      const nowIso = new Date().toISOString();

      if (isConfigured) {
        const client = supabaseAdmin || supabaseAnon;
        if (client) {
          try {
            const { data: existingDbRow } = await client
              .from('payments')
              .select('id, status')
              .eq('id', payment.id)
              .maybeSingle();

            if (existingDbRow) {
              const { data: updatedRows, error: updateErr } = await client
                .from('payments')
                .update({
                  status: 'PAID',
                  payment_status: 'paid',
                  provider_payment_id: providerPaymentId,
                  provider_signature: providerSignature,
                  paid_at: nowIso,
                  escrow_locked_at: nowIso,
                  updated_at: nowIso,
                })
                .eq('id', payment.id)
                .neq('status', 'PAID')
                .select();

              if (!updateErr && (!updatedRows || updatedRows.length === 0)) {
                return {
                  success: true,
                  payment,
                  message: 'Payment has already been verified and locked in escrow.',
                  alreadyProcessed: true,
                };
              }
            }
          } catch (dbErr) {
            logger.warn('Supabase payment update to PAID failed:', dbErr.message);
          }
        }
      }

      if (payment.status === 'PAID' || payment.status === 'paid') {
        return {
          success: true,
          payment,
          message: 'Payment has already been verified and locked in escrow.',
          alreadyProcessed: true,
        };
      }

      payment.status = 'PAID';
      payment.payment_status = 'paid';
      payment.providerPaymentId = providerPaymentId;
      payment.provider_payment_id = providerPaymentId;
      payment.providerSignature = providerSignature;
      payment.provider_signature = providerSignature;
      payment.paidAt = nowIso;
      payment.paid_at = nowIso;
      payment.escrowLockedAt = nowIso;
      payment.updatedAt = nowIso;

      // 4. Atomically transition request to PAID
      await requestService.markRequestAsPaid({
        requestId: payment.requestId || payment.request_id,
        paymentId: payment.id,
        providerOrderId,
        providerPaymentId,
        actor: user.name || payment.buyerHospitalName || 'Buyer Hospital Pharmacist',
      });

      // 5. Audit Logging
      await auditService.logEvent({
        action: 'PAYMENT_SUCCESSFUL',
        entityType: 'PAYMENT',
        entityId: payment.id,
        actorRole: user.role || 'hospital',
        hospitalId: payment.buyerHospitalId || payment.buyer_hospital_id,
        hospitalName: payment.buyerHospitalName || payment.buyer_hospital_name,
        partnerHospitalId: payment.sellerHospitalId || payment.seller_hospital_id,
        partnerHospitalName: payment.sellerHospitalName || payment.seller_hospital_name,
        summary: `Payment of ₹${payment.amount} verified for order ${payment.transactionId}. Funds secured in MedEx Escrow. Gateway payment ID: ${providerPaymentId}.`,
        resultingStatus: 'PAID',
        metadata: {
          requestId: payment.requestId || payment.request_id,
          provider: payment.provider,
          providerPaymentId,
          providerOrderId,
          amount: payment.amount,
        },
      });

      // 6. In-App Notifications
      // To Buyer
      await notificationService.createNotification({
        hospitalId: payment.buyerHospitalId || payment.buyer_hospital_id,
        notificationType: 'PAYMENT_SUCCESSFUL',
        type: 'success',
        title: `Payment Confirmed: ₹${payment.amount.toLocaleString()}`,
        message: `Your payment of ₹${payment.amount.toLocaleString()} for requisition #${payment.requestId} is secured in Escrow. The supplying hospital has been notified to prepare dispatch.`,
        relatedEntityType: 'payment',
        relatedEntityId: payment.id,
        link: '/hospital/requests',
        metadata: {
          paymentId: payment.id,
          requestId: payment.requestId || payment.request_id,
          amount: payment.amount,
        }
      });

      // To Seller
      await notificationService.createNotification({
        hospitalId: payment.sellerHospitalId || payment.seller_hospital_id,
        notificationType: 'PAYMENT_ESCROW_LOCKED',
        type: 'info',
        title: `Escrow Secured: ₹${payment.amount.toLocaleString()}`,
        message: `Buyer deposited payment of ₹${payment.amount.toLocaleString()} for requisition #${payment.requestId}. Stock is confirmed; proceed to prepare and dispatch consignment.`,
        relatedEntityType: 'request',
        relatedEntityId: payment.requestId || payment.request_id,
        link: '/hospital/incoming-requests',
        metadata: {
          paymentId: payment.id,
          requestId: payment.requestId || payment.request_id,
          amount: payment.amount,
        }
      });

      try {
        await alertService.createPaymentAlert({
          hospitalId: payment.sellerHospitalId || payment.seller_hospital_id,
          paymentId: payment.id,
          requestId: payment.requestId || payment.request_id,
          status: 'PAID',
          amount: payment.amount,
        });
      } catch (alertErr) {
        logger.warn('Failed to emit payment alert:', alertErr.message);
      }

      return {
        success: true,
        payment,
        message: 'Payment successfully verified and funds locked in MedEx Escrow.',
      };
    } finally {
      unlock();
    }
  },

  /**
   * Processes incoming gateway webhooks with cryptographic HMAC verification and idempotency ledger
   */
  async handleWebhook({ rawBody, signature, headers = {} }) {
    if (!rawBody || !signature) {
      const err = new Error('Missing webhook signature or raw payload body.');
      err.statusCode = 400;
      throw err;
    }

    const provider = getPaymentProvider();

    // 1. Cryptographic HMAC Verification
    const isValid = provider.verifyWebhookSignature({ rawBody, signature });
    if (!isValid) {
      logger.error('Webhook cryptographic HMAC verification failed');
      const err = new Error('Invalid webhook cryptographic signature');
      err.statusCode = 401;
      throw err;
    }

    // 2. Parse Event Payload
    let payload;
    try {
      const bodyStr = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody);
      payload = JSON.parse(bodyStr);
    } catch {
      const err = new Error('Malformed JSON payload in webhook body.');
      err.statusCode = 400;
      throw err;
    }

    const eventId = payload.event_id || payload.id || headers['x-razorpay-event-id'] || `ev_${Date.now()}`;
    const eventType = payload.event || payload.event_type || 'unknown';

    // 3. Idempotency Check
    const isProcessed = await this.isWebhookEventProcessed(eventId);
    if (isProcessed) {
      logger.info(`Webhook event '${eventId}' already processed. Skipping to guarantee idempotency.`);
      return {
        received: true,
        duplicate: true,
        eventId,
        message: 'Webhook event already processed previously.',
      };
    }

    // Record event as PROCESSING
    const recordResult = await this.recordWebhookEvent({
      eventId,
      eventType,
      provider: provider.name,
      payload,
      processingResult: 'PROCESSING',
    });

    if (recordResult && recordResult.duplicate) {
      logger.info(`Webhook event '${eventId}' detected as duplicate during ledger write. Skipping.`);
      return {
        received: true,
        duplicate: true,
        eventId,
        message: 'Webhook event already processed previously.',
      };
    }

    const unlock = await paymentMutex.acquire(eventId);
    try {
      // 4. Handle Event Types
      if (eventType === 'payment.captured' || eventType === 'order.paid') {
        const paymentEntity = payload.payload?.payment?.entity || payload.payment || {};
        const orderId = paymentEntity.order_id || payload.payload?.order?.entity?.id || payload.order_id;
        const providerPaymentId = paymentEntity.id || payload.payment_id;

        if (orderId) {
          const payment = await this.findPaymentByProviderOrderId(orderId);
          if (payment && payment.status !== 'PAID') {
            const nowIso = new Date().toISOString();

            if (isConfigured) {
              const client = supabaseAdmin || supabaseAnon;
              if (client) {
                try {
                  const { data: existingDbPayment } = await client
                    .from('payments')
                    .select('id, status')
                    .eq('id', payment.id)
                    .maybeSingle();

                  if (existingDbPayment) {
                    const { data: updatedRows, error: updateErr } = await client
                      .from('payments')
                      .update({
                        status: 'PAID',
                        provider_payment_id: providerPaymentId,
                        paid_at: nowIso,
                        updated_at: nowIso,
                      })
                      .eq('id', payment.id)
                      .neq('status', 'PAID')
                      .select();

                    if (!updateErr && (!updatedRows || updatedRows.length === 0)) {
                      await this.updateWebhookEventResult(eventId, 'SUCCESS');
                      return {
                        received: true,
                        duplicate: true,
                        eventId,
                        message: 'Webhook event already processed previously.',
                      };
                    }
                  }
                } catch (dbErr) {
                  logger.warn('Supabase webhook payment update failed:', dbErr.message);
                }
              }
            }

            payment.status = 'PAID';
            payment.providerPaymentId = providerPaymentId;
            payment.paidAt = nowIso;
            payment.updatedAt = nowIso;

            if (isConfigured && supabaseAdmin) {
              try {
                await supabaseAdmin
                  .from('payments')
                  .update({
                    status: 'PAID',
                    provider_payment_id: providerPaymentId,
                    paid_at: nowIso,
                    updated_at: nowIso,
                  })
                  .eq('id', payment.id);
              } catch (dbErr) {
                logger.warn('Supabase webhook payment update failed:', dbErr.message);
              }
            }

            await requestService.markRequestAsPaid({
              requestId: payment.requestId || payment.request_id,
              paymentId: payment.id,
              providerOrderId: orderId,
              providerPaymentId,
              actor: 'Gateway Webhook',
            });

            await auditService.logEvent({
              action: 'PAYMENT_WEBHOOK_CAPTURED',
              entityType: 'PAYMENT',
              entityId: payment.id,
              actorRole: 'system',
              summary: `Webhook ${eventId} confirmed payment ${payment.transactionId} for ₹${payment.amount}.`,
              resultingStatus: 'PAID',
              metadata: { eventId, orderId, providerPaymentId },
            });

            try {
              await alertService.createPaymentAlert({
                hospitalId: payment.sellerHospitalId || payment.seller_hospital_id,
                paymentId: payment.id,
                requestId: payment.requestId || payment.request_id,
                status: 'PAID',
                amount: payment.amount,
              });
            } catch (alertErr) {
              logger.warn('Failed to emit webhook payment alert:', alertErr.message);
            }
          }
        }
      } else if (eventType === 'payment.failed') {
        const paymentEntity = payload.payload?.payment?.entity || payload.payment || {};
        const orderId = paymentEntity.order_id || payload.order_id;
        const reason = paymentEntity.error_description || paymentEntity.error_reason || 'Gateway reported transaction failure';

        if (orderId) {
          const payment = await this.findPaymentByProviderOrderId(orderId);
          if (payment && payment.status !== 'PAID') {
            payment.status = 'FAILED';
            payment.failureReason = reason;
            payment.updatedAt = new Date().toISOString();

            if (isConfigured && supabaseAdmin) {
              try {
                await supabaseAdmin
                  .from('payments')
                  .update({
                    status: 'FAILED',
                    failure_reason: reason,
                    updated_at: payment.updatedAt,
                  })
                  .eq('id', payment.id);
              } catch (dbErr) {
                logger.warn('Supabase webhook payment fail update failed:', dbErr.message);
              }
            }

            await requestService.markRequestPaymentFailed({
              requestId: payment.requestId || payment.request_id,
              paymentId: payment.id,
              reason,
            });

            try {
              await alertService.createPaymentAlert({
                hospitalId: payment.buyerHospitalId || payment.buyer_hospital_id,
                paymentId: payment.id,
                requestId: payment.requestId || payment.request_id,
                status: 'FAILED',
                amount: payment.amount,
              });
            } catch (alertErr) {
              logger.warn('Failed to emit payment failure alert:', alertErr.message);
            }

            await auditService.logEvent({
              action: 'PAYMENT_WEBHOOK_FAILED',
              entityType: 'PAYMENT',
              entityId: payment.id,
              actorRole: 'system',
              summary: `Webhook ${eventId} recorded failure for payment ${payment.transactionId}: ${reason}.`,
              resultingStatus: 'FAILED',
              metadata: { eventId, orderId, reason },
            });
          }
        }
      }

      // Mark event as SUCCESS
      await this.updateWebhookEventResult(eventId, 'SUCCESS');

      return {
        received: true,
        processed: true,
        eventId,
      };
    } catch (processErr) {
      logger.error(`Error processing webhook ${eventId}:`, processErr);
      await this.updateWebhookEventResult(eventId, 'FAILED', processErr.message);
      throw processErr;
    } finally {
      unlock();
    }
  },

  /**
   * Records client-side payment failure without prematurely cancelling the request or releasing stock
   */
  async failPayment({ user, paymentId, reason = 'Payment was declined or cancelled by user' }) {
    if (!user) {
      const err = new Error('Authentication required');
      err.statusCode = 401;
      throw err;
    }

    const unlock = await paymentMutex.acquire(paymentId);
    try {
      const payment = await this.getPaymentById(paymentId, {
        hospitalId: user.hospitalId,
        isAdmin: user.role === 'admin' || user.role === 'ADMIN',
      });

      if (payment.status === 'PAID') {
        const err = new Error('Cannot fail a payment that is already marked as PAID.');
        err.statusCode = 400;
        throw err;
      }

      const nowIso = new Date().toISOString();
      payment.status = 'FAILED';
      payment.failureReason = reason;
      payment.updatedAt = nowIso;

      if (isConfigured && supabaseAdmin) {
        try {
          await supabaseAdmin
            .from('payments')
            .update({
              status: 'FAILED',
              failure_reason: reason,
              updated_at: nowIso,
            })
            .eq('id', payment.id);
        } catch (dbErr) {
          logger.warn('Supabase failPayment update failed:', dbErr.message);
        }
      }

      await requestService.markRequestPaymentFailed({
        requestId: payment.requestId || payment.request_id,
        paymentId: payment.id,
        reason,
      });

      await auditService.logEvent({
        action: 'PAYMENT_FAILED',
        entityType: 'PAYMENT',
        entityId: payment.id,
        actorRole: user.role || 'hospital',
        hospitalId: payment.buyerHospitalId || payment.buyer_hospital_id,
        hospitalName: payment.buyerHospitalName,
        partnerHospitalId: payment.sellerHospitalId,
        partnerHospitalName: payment.sellerHospitalName,
        summary: `Payment ${payment.transactionId} failed: ${reason}. Stock remains reserved for retry.`,
        resultingStatus: 'FAILED',
        metadata: {
          requestId: payment.requestId || payment.request_id,
          reason,
        },
      });

      return {
        success: true,
        payment,
        message: 'Payment failure recorded. Requisition stock remains reserved for retry.',
      };
    } finally {
      unlock();
    }
  },

  /**
   * Helper: Check if webhook event has already been processed
   */
  async isWebhookEventProcessed(eventId) {
    if (isConfigured) {
      const client = supabaseAdmin || supabaseAnon;
      if (client) {
        try {
          const { data, error } = await client
            .from('webhook_events')
            .select('id, processing_result')
            .eq('event_id', eventId)
            .single();

          if (!error && data && data.processing_result === 'SUCCESS') {
            return true;
          }
        } catch {
          // Fall through to in-memory check
        }
      }
    }

    const inMem = fallbackWebhookEvents.find((e) => e.eventId === eventId || e.event_id === eventId);
    return inMem ? inMem.processingResult === 'SUCCESS' : false;
  },

  /**
   * Helper: Record webhook event in ledger
   */
  async recordWebhookEvent({ eventId, eventType, provider, payload, processingResult = 'PROCESSING' }) {
    const record = {
      id: uuidv4(),
      eventId,
      event_id: eventId,
      eventType,
      event_type: eventType,
      provider,
      payload,
      processingResult,
      processing_result: processingResult,
      processed_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    if (isConfigured) {
      const client = supabaseAdmin || supabaseAnon;
      if (client) {
        try {
          const { error } = await client.from('webhook_events').insert([{
            id: record.id,
            event_id: record.event_id,
            event_type: record.event_type,
            provider: record.provider,
            payload: record.payload,
            processing_result: record.processing_result,
          }]);

          if (error && (error.code === '23505' || error.message.includes('unique') || error.message.includes('duplicate'))) {
            return { duplicate: true, ...record };
          }
        } catch (dbErr) {
          logger.warn('Failed to insert webhook_events record in Supabase:', dbErr.message);
        }
      }
    }

    const inMemExisting = fallbackWebhookEvents.find((e) => e.eventId === eventId || e.event_id === eventId);
    if (inMemExisting) {
      return { duplicate: true, ...inMemExisting };
    }

    fallbackWebhookEvents.unshift(record);
    if (fallbackWebhookEvents.length > 500) fallbackWebhookEvents.length = 500;
    return record;
  },

  /**
   * Helper: Update webhook event result
   */
  async updateWebhookEventResult(eventId, result, errorMessage = null) {
    const nowIso = new Date().toISOString();

    if (isConfigured) {
      const client = supabaseAdmin || supabaseAnon;
      if (client) {
        try {
          await client
            .from('webhook_events')
            .update({
              processing_result: result,
              processed_at: nowIso,
            })
            .eq('event_id', eventId);
        } catch (dbErr) {
          logger.warn('Failed to update webhook event status in Supabase:', dbErr.message);
        }
      }
    }

    const inMem = fallbackWebhookEvents.find((e) => e.eventId === eventId || e.event_id === eventId);
    if (inMem) {
      inMem.processingResult = result;
      inMem.processedAt = nowIso;
      if (errorMessage) inMem.errorMessage = errorMessage;
    }
  },

  /**
   * Finds payment by provider order ID
   */
  async findPaymentByProviderOrderId(providerOrderId) {
    if (isConfigured) {
      try {
        const client = supabaseAdmin || supabaseAnon;
        const { data, error } = await client
          .from('payments')
          .select('*')
          .eq('provider_order_id', providerOrderId)
          .single();

        if (!error && data) return data;
      } catch {
        // Fall through
      }
    }

    return fallbackPayments.find(
      (p) => p.providerOrderId === providerOrderId || p.provider_order_id === providerOrderId
    );
  },

  /**
   * Retrieves single payment by ID or provider order ID with strict hospital permission checks
   */
  async getPaymentById(id, { providerOrderId = null, hospitalId = null, isAdmin = false } = {}) {
    let payment = null;

    if (isConfigured) {
      try {
        const client = supabaseAdmin || supabaseAnon;
        let query = client.from('payments').select('*');
        if (id) {
          query = query.eq('id', id);
        } else if (providerOrderId) {
          query = query.eq('provider_order_id', providerOrderId);
        }
        const { data, error } = await query.single();
        if (!error && data) payment = data;
      } catch {
        // Fall through
      }
    }

    if (!payment) {
      payment = fallbackPayments.find(
        (p) => (id && (p.id === id || p.transactionId === id)) || (providerOrderId && p.providerOrderId === providerOrderId)
      );
    }

    if (!payment) {
      const err = new Error(`Payment record '${id || providerOrderId}' not found.`);
      err.statusCode = 404;
      throw err;
    }

    const buyerHosp = payment.buyerHospitalId || payment.buyer_hospital_id;
    const sellerHosp = payment.sellerHospitalId || payment.seller_hospital_id;

    if (!isAdmin && hospitalId && buyerHosp !== hospitalId && sellerHosp !== hospitalId) {
      const err = new Error('Access denied: You do not have permission to view this payment record.');
      err.statusCode = 403;
      throw err;
    }

    return payment;
  },

  /**
   * Retrieves payments for the authenticated hospital (buyer or seller)
   */
  async getMyPayments({ hospitalId, page = 1, limit = 20, status = 'all' }) {
    if (!hospitalId) {
      return { payments: [], total: 0, page: 1, limit };
    }

    const offset = (page - 1) * limit;

    if (isConfigured) {
      try {
        const client = supabaseAdmin || supabaseAnon;
        let query = client
          .from('payments')
          .select('*', { count: 'exact' })
          .or(`buyer_hospital_id.eq.${hospitalId},seller_hospital_id.eq.${hospitalId}`);

        if (status && status !== 'all') {
          query = query.eq('status', status.toUpperCase());
        }

        const { data, count, error } = await query
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);

        if (!error && data && data.length > 0) {
          return {
            payments: data,
            total: count || data.length,
            page: Number(page),
            limit: Number(limit),
          };
        }
      } catch (err) {
        logger.warn('Supabase getMyPayments failed:', err.message);
      }
    }

    let filtered = fallbackPayments.filter(
      (p) => (p.buyerHospitalId === hospitalId || p.buyer_hospital_id === hospitalId) ||
             (p.sellerHospitalId === hospitalId || p.seller_hospital_id === hospitalId)
    );

    if (status && status !== 'all') {
      filtered = filtered.filter((p) => String(p.status).toUpperCase() === status.toUpperCase());
    }

    return {
      payments: filtered.slice(offset, offset + limit),
      total: filtered.length,
      page: Number(page),
      limit: Number(limit),
    };
  },

  /**
   * Admin payment monitoring endpoint
   */
  async getAdminPayments({ page = 1, limit = 50, status = 'all', search = '' }) {
    const offset = (page - 1) * limit;

    if (isConfigured) {
      try {
        const client = supabaseAdmin || supabaseAnon;
        let query = client.from('payments').select('*', { count: 'exact' });

        if (status && status !== 'all') {
          query = query.eq('status', status.toUpperCase());
        }
        if (search) {
          query = query.or(`transaction_id.ilike.%${search}%,provider_order_id.ilike.%${search}%,medicine_name.ilike.%${search}%`);
        }

        const { data, count, error } = await query
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);

        if (!error && data && data.length > 0) {
          return {
            payments: data,
            total: count || data.length,
            page: Number(page),
            limit: Number(limit),
          };
        }
      } catch (err) {
        logger.warn('Supabase getAdminPayments failed:', err.message);
      }
    }

    let filtered = [...fallbackPayments];
    if (status && status !== 'all') {
      filtered = filtered.filter((p) => String(p.status).toUpperCase() === status.toUpperCase());
    }
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (p) => (p.transactionId || '').toLowerCase().includes(q) ||
               (p.providerOrderId || '').toLowerCase().includes(q) ||
               (p.medicineName || '').toLowerCase().includes(q)
      );
    }

    return {
      payments: filtered.slice(offset, offset + limit),
      total: filtered.length,
      page: Number(page),
      limit: Number(limit),
    };
  }
};

paymentService.fallbackPayments = fallbackPayments;
paymentService.fallbackWebhookEvents = fallbackWebhookEvents;
paymentService.processWebhookEvent = paymentService.handleWebhook;
module.exports = paymentService;
