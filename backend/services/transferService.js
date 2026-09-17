const { randomUUID: uuidv4 } = require('crypto');
const { supabaseAdmin, supabaseAnon, isConfigured } = require('../config/supabase');
const auditService = require('./auditService');
const alertService = require('./alertService');
const logger = require('../utils/logger');

// Initial seed transfers matching seed tracking records
const fallbackTransfers = [
  {
    id: 'tr-0000001-0000-0000-0000-000000000001',
    transactionId: 'TXN-773120',
    transaction_id: 'TXN-773120',
    requestId: 'c0000001-0000-0000-0000-000000000001',
    request_id: 'c0000001-0000-0000-0000-000000000001',
    inventoryLotId: 'b0000003-0000-0000-0000-000000000003',
    inventory_lot_id: 'b0000003-0000-0000-0000-000000000003',
    medicineId: 'a0000003-0000-0000-0000-000000000003',
    medicine_id: 'a0000003-0000-0000-0000-000000000003',
    batchNo: 'CLV-23-8874',
    batch_no: 'CLV-23-8874',
    quantity: 100,
    sourceHospitalId: '22222222-2222-2222-2222-222222222222',
    source_hospital_id: '22222222-2222-2222-2222-222222222222',
    sourceHospitalName: 'Fortis Memorial Research Institute',
    destinationHospitalId: '11111111-1111-1111-1111-111111111111',
    destination_hospital_id: '11111111-1111-1111-1111-111111111111',
    destinationHospitalName: 'Apollo Hospital & Multi-Specialty Centre',
    status: 'in_transit',
    trackingReference: 'MED-TRK-773120',
    tracking_reference: 'MED-TRK-773120',
    note: 'Temperature sensitive critical antibiotic delivery',
    dispatchedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
    createdAt: new Date(Date.now() - 3600000 * 6).toISOString(),
  }
];

const fallbackTrackingEvents = [
  {
    id: 'trk-0000001-0000-0000-0000-000000000001',
    transactionId: 'TXN-773120',
    transaction_id: 'TXN-773120',
    trackingNumber: 'MED-TRK-773120',
    tracking_number: 'MED-TRK-773120',
    transferId: 'tr-0000001-0000-0000-0000-000000000001',
    senderHospitalId: '22222222-2222-2222-2222-222222222222',
    sender_hospital_id: '22222222-2222-2222-2222-222222222222',
    senderHospital: 'Fortis Memorial Research Institute',
    sender_hospital: 'Fortis Memorial Research Institute',
    receiverHospitalId: '11111111-1111-1111-1111-111111111111',
    receiver_hospital_id: '11111111-1111-1111-1111-111111111111',
    receiverHospital: 'Apollo Hospital & Multi-Specialty Centre',
    receiver_hospital: 'Apollo Hospital & Multi-Specialty Centre',
    medicineName: 'Clavam 625 Tablets',
    medicine_name: 'Clavam 625 Tablets',
    quantity: 100,
    status: 'In Transit',
    location: 'Mumbai - Pune Expressway Checkpost',
    currentLocation: 'Mumbai - Pune Expressway Checkpost',
    current_location: 'Mumbai - Pune Expressway Checkpost',
    destination: 'Apollo Hospital Central Receiving Dock',
    eta: 'Today, 4:30 PM (Est. 2h remaining)',
    courierName: 'MediCold Logistics Express Ltd.',
    courier_name: 'MediCold Logistics Express Ltd.',
    courierContact: '+91 98201 55667 (Fleet Captain)',
    courier_contact: '+91 98201 55667 (Fleet Captain)',
    vehicleNo: 'MH-04-CP-8812 (Cold-Vault Van)',
    vehicle_no: 'MH-04-CP-8812 (Cold-Vault Van)',
    temperature: '3.8°C (Compliant)',
    temperatureCelsius: 3.8,
    temperature_celsius: 3.8,
    isColdChainCompliant: true,
    is_cold_chain_compliant: true,
    isDemoSimulation: true,
    is_demo_simulation: true,
    timeline: [
      { step: 'Order Placed & Escrow Locked', completed: true, time: '09:00 AM' },
      { step: 'Consignment Dispatched & Vault Sealed', completed: true, time: '11:15 AM' },
      { step: 'In Transit (Cold-Chain Active)', completed: true, time: '01:30 PM' },
      { step: 'Delivery & Inspection Verification', completed: false, time: 'Pending' }
    ],
    coordinates: { lat: 18.9876, lng: 73.1234 },
    timestamp: new Date().toISOString(),
    createdAt: new Date(Date.now() - 3600000 * 6).toISOString(),
  }
];

class TransferService {
  /**
   * Creates a new transfer consignment and initialized tracking record
   */
  async createTransfer(transferData, user = null) {
    const transactionId = transferData.transactionId || `TXN-${Math.floor(100000 + Math.random() * 900000)}`;
    const trackingNumber = transferData.trackingNumber || `MED-TRK-${Math.floor(100000 + Math.random() * 900000)}`;
    const transferId = uuidv4();
    const trackingId = uuidv4();

    const rawTemp = transferData.currentTemp !== undefined ? transferData.currentTemp : (transferData.temperatureCelsius !== undefined ? transferData.temperatureCelsius : 4.0);
    const initialTemp = Number(rawTemp);
    const isCompliant = initialTemp >= 2.0 && initialTemp <= 8.0;
    const tempBreach = !isCompliant;

    const newTransfer = {
      id: transferId,
      transactionId,
      transaction_id: transactionId,
      requestId: transferData.requestId || null,
      request_id: transferData.requestId || null,
      inventoryLotId: transferData.inventoryLotId || null,
      inventory_lot_id: transferData.inventoryLotId || null,
      medicineId: transferData.medicineId || null,
      medicine_id: transferData.medicineId || null,
      medicineName: transferData.medicineName || 'Essential Medicine Lot',
      medicine_name: transferData.medicineName || 'Essential Medicine Lot',
      batchNo: transferData.batchNo || 'N/A',
      batch_no: transferData.batchNo || 'N/A',
      quantity: Number(transferData.quantity) || 1,
      currentTemp: initialTemp,
      temperatureCelsius: initialTemp,
      temperature: `${initialTemp}°C (${isCompliant ? 'Compliant' : 'BREACH'})`,
      tempBreach,
      sourceHospitalId: transferData.sourceHospitalId || user?.hospitalId || user?.id,
      source_hospital_id: transferData.sourceHospitalId || user?.hospitalId || user?.id,
      sourceHospitalName: transferData.sourceHospitalName || 'Dispatching Facility',
      destinationHospitalId: transferData.destinationHospitalId,
      destination_hospital_id: transferData.destinationHospitalId,
      destinationHospitalName: transferData.destinationHospitalName || 'Receiving Facility',
      status: transferData.status || 'DISPATCHED',
      trackingReference: trackingNumber,
      tracking_reference: trackingNumber,
      note: transferData.note || 'Inter-hospital cold-chain transit initiated',
      dispatchedAt: new Date().toISOString(),
      deliveredAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const newTracking = {
      id: trackingId,
      transactionId,
      transaction_id: transactionId,
      trackingNumber,
      tracking_number: trackingNumber,
      transferId,
      transfer_id: transferId,
      senderHospitalId: newTransfer.sourceHospitalId,
      sender_hospital_id: newTransfer.sourceHospitalId,
      senderHospital: newTransfer.sourceHospitalName,
      sender_hospital: newTransfer.sourceHospitalName,
      receiverHospitalId: newTransfer.destinationHospitalId,
      receiver_hospital_id: newTransfer.destinationHospitalId,
      receiverHospital: newTransfer.destinationHospitalName,
      receiver_hospital: newTransfer.destinationHospitalName,
      medicineName: newTransfer.medicineName,
      medicine_name: newTransfer.medicineName,
      quantity: newTransfer.quantity,
      status: 'In Transit',
      location: transferData.originLocation || 'Origin Hospital Pharmacy Dock',
      currentLocation: transferData.originLocation || 'Origin Hospital Pharmacy Dock',
      current_location: transferData.originLocation || 'Origin Hospital Pharmacy Dock',
      destination: transferData.destinationLocation || 'Destination Hospital Receiving Bay',
      eta: transferData.eta || 'Standard Transit (4-6 hours)',
      courierName: transferData.courierName || 'MediCold Logistics Express Ltd.',
      courier_name: transferData.courierName || 'MediCold Logistics Express Ltd.',
      courierContact: transferData.courierContact || '+91 98200 12345 (Fleet Dispatch)',
      courier_contact: transferData.courierContact || '+91 98200 12345 (Fleet Dispatch)',
      vehicleNo: transferData.vehicleNo || 'MH-01-TR-9000 (Cold-Vault)',
      vehicle_no: transferData.vehicleNo || 'MH-01-TR-9000 (Cold-Vault)',
      temperature: `${initialTemp}°C (${isCompliant ? 'Compliant' : 'BREACH'})`,
      temperatureCelsius: initialTemp,
      temperature_celsius: initialTemp,
      isColdChainCompliant: isCompliant,
      is_cold_chain_compliant: isCompliant,
      isDemoSimulation: true,
      is_demo_simulation: true,
      timeline: [
        { step: 'Order Placed & Escrow Locked', completed: true, time: 'Just now' },
        { step: 'Consignment Dispatched & Vault Sealed', completed: true, time: 'Just now' },
        { step: 'In Transit (Cold-Chain Active)', completed: true, time: 'In Progress' },
        { step: 'Delivery & Inspection Verification', completed: false, time: 'Pending' }
      ],
      coordinates: transferData.coordinates || { lat: 19.0760, lng: 72.8777 },
      telemetryHistory: [
        {
          timestamp: new Date().toISOString(),
          location: transferData.originLocation || 'Origin Hospital Pharmacy Dock',
          temperatureCelsius: initialTemp,
          isColdChainCompliant: isCompliant,
          coordinates: transferData.coordinates || { lat: 19.0760, lng: 72.8777 },
        }
      ],
      timestamp: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Attempt Supabase insert
    if (isConfigured && supabaseAdmin) {
      try {
        await supabaseAdmin.from('transfers').insert({
          id: newTransfer.id,
          transaction_id: newTransfer.transactionId,
          request_id: newTransfer.requestId,
          inventory_lot_id: newTransfer.inventoryLotId,
          medicine_id: newTransfer.medicineId,
          batch_no: newTransfer.batchNo,
          quantity: newTransfer.quantity,
          source_hospital_id: newTransfer.sourceHospitalId,
          destination_hospital_id: newTransfer.destinationHospitalId,
          status: newTransfer.status,
          tracking_reference: newTransfer.trackingReference,
          note: newTransfer.note,
          dispatched_at: newTransfer.dispatchedAt,
        });

        await supabaseAdmin.from('tracking_events').insert({
          id: newTracking.id,
          transaction_id: newTracking.transactionId,
          tracking_number: newTracking.trackingNumber,
          transfer_id: newTracking.transferId,
          sender_hospital_id: newTracking.senderHospitalId,
          sender_hospital: newTracking.senderHospital,
          receiver_hospital_id: newTracking.receiverHospitalId,
          receiver_hospital: newTracking.receiverHospital,
          medicine_name: newTracking.medicineName,
          quantity: newTracking.quantity,
          status: newTracking.status,
          current_location: newTracking.currentLocation,
          destination: newTracking.destination,
          eta: newTracking.eta,
          courier_name: newTracking.courierName,
          courier_contact: newTracking.courierContact,
          vehicle_no: newTracking.vehicleNo,
          temperature: newTracking.temperature,
          temperature_celsius: newTracking.temperatureCelsius,
          is_cold_chain_compliant: newTracking.isColdChainCompliant,
          timeline: newTracking.timeline,
          coordinates: newTracking.coordinates,
        });
      } catch (err) {
        logger.warn('Failed to insert transfer into Supabase, maintaining in fallback memory:', err.message);
      }
    }

    fallbackTransfers.unshift(newTransfer);
    fallbackTrackingEvents.unshift(newTracking);

    // Audit log
    auditService.logEvent({
      action: 'TRANSFER_DISPATCHED',
      entityType: 'TRANSFER',
      entityId: newTransfer.id,
      hospitalId: newTransfer.sourceHospitalId,
      hospitalName: newTransfer.sourceHospitalName,
      partnerHospitalId: newTransfer.destinationHospitalId,
      partnerHospitalName: newTransfer.destinationHospitalName,
      summary: `Transfer ${newTransfer.transactionId} dispatched with tracking ${newTracking.trackingNumber} (${newTransfer.medicineName}, Qty: ${newTransfer.quantity})`,
      resultingStatus: 'dispatched',
      metadata: { trackingNumber, vehicleNo: newTracking.vehicleNo, temperature: newTracking.temperature }
    });

    if (tempBreach) {
      alertService.createAlert({
        hospitalId: newTransfer.sourceHospitalId,
        title: 'Cold-Chain Temperature Breach Alert',
        message: `Consignment ${newTransfer.transactionId} temperature (${initialTemp}°C) breached mandatory 2°C - 8°C limits!`,
        severity: 'CRITICAL',
        alertType: 'TRANSFER_BREACH',
        transferId,
      });
    }

    // Authoritative alert for destination hospital
    try {
      alertService.createAlert({
        hospitalId: newTransfer.destinationHospitalId,
        title: `Consignment Dispatched: ${newTransfer.medicineName}`,
        message: `${newTransfer.sourceHospitalName} has dispatched ${newTransfer.quantity} units of ${newTransfer.medicineName} (Consignment #${newTransfer.transactionId}).`,
        severity: 'INFO',
        alertType: 'TRANSFER_DISPATCHED',
        category: 'TRANSFERS',
        transferId: newTransfer.transactionId || transferId,
        link: `/hospital/track?txn=${encodeURIComponent(newTransfer.transactionId || transferId)}`,
        actionText: 'Track Consignment',
      });
    } catch (e) {
      logger.warn('Failed to emit transfer dispatched alert:', e.message);
    }

    return {
      ...newTransfer,
      id: transferId,
      currentTemp: initialTemp,
      tempBreach,
      status: (newTransfer.status || 'DISPATCHED').toUpperCase(),
      transfer: newTransfer,
      tracking: newTracking,
    };
  }

  /**
   * Retrieves transfers filtered by authorized hospital or admin
   */
  async getTransfers(filter = {}, user = null) {
    let transfers = [...fallbackTransfers];

    // Read from Supabase if configured
    if (isConfigured && supabaseAdmin) {
      try {
        const { data, error } = await supabaseAdmin.from('transfers').select('*');
        if (!error && Array.isArray(data) && data.length > 0) {
          transfers = data.map(t => ({
            id: t.id,
            transactionId: t.transaction_id,
            requestId: t.request_id,
            inventoryLotId: t.inventory_lot_id,
            medicineId: t.medicine_id,
            batchNo: t.batch_no,
            quantity: t.quantity,
            sourceHospitalId: t.source_hospital_id,
            destinationHospitalId: t.destination_hospital_id,
            status: t.status,
            trackingReference: t.tracking_reference,
            note: t.note,
            dispatchedAt: t.dispatched_at,
            deliveredAt: t.delivered_at,
            createdAt: t.created_at,
          }));
        }
      } catch (err) {
        logger.warn('Supabase transfers query failed, using memory store:', err.message);
      }
    }

    // Role-based tenant isolation:
    // Non-admin hospitals can only see transfers where they are source or destination
    if (user && user.role !== 'admin') {
      const userHospId = user.hospitalId || user.id;
      transfers = transfers.filter(t => 
        t.sourceHospitalId === userHospId || 
        t.destinationHospitalId === userHospId ||
        t.source_hospital_id === userHospId ||
        t.destination_hospital_id === userHospId
      );
    }

    // Filters
    if (filter.status && filter.status !== 'all') {
      transfers = transfers.filter(t => (t.status || '').toLowerCase() === filter.status.toLowerCase());
    }

    if (filter.search) {
      const q = filter.search.toLowerCase();
      transfers = transfers.filter(t => 
        (t.transactionId || '').toLowerCase().includes(q) ||
        (t.trackingReference || '').toLowerCase().includes(q) ||
        (t.batchNo || '').toLowerCase().includes(q) ||
        (t.medicineName || '').toLowerCase().includes(q)
      );
    }

    return transfers;
  }

  /**
   * Retrieves tracking telemetry by transaction ID or tracking number
   */
  async getTrackingByTxn(txnId, user = null) {
    if (!txnId) return null;
    const cleanTxn = txnId.trim().toLowerCase();

    let tracking = fallbackTrackingEvents.find(t => 
      (t.transactionId && t.transactionId.toLowerCase() === cleanTxn) ||
      (t.trackingNumber && t.trackingNumber.toLowerCase() === cleanTxn) ||
      (t.transaction_id && t.transaction_id.toLowerCase() === cleanTxn) ||
      (t.tracking_number && t.tracking_number.toLowerCase() === cleanTxn)
    );

    // If not in memory and Supabase configured, query database
    if (isConfigured && supabaseAdmin) {
      try {
        const { data, error } = await supabaseAdmin
          .from('tracking_events')
          .select('*')
          .or(`transaction_id.eq.${txnId.trim()},tracking_number.eq.${txnId.trim()}`)
          .maybeSingle();

        if (!error && data) {
          tracking = {
            id: data.id,
            transactionId: data.transaction_id,
            trackingNumber: data.tracking_number,
            transferId: data.transfer_id,
            senderHospitalId: data.sender_hospital_id,
            senderHospital: data.sender_hospital,
            receiverHospitalId: data.receiver_hospital_id,
            receiverHospital: data.receiver_hospital,
            medicineName: data.medicine_name,
            quantity: data.quantity,
            status: data.status,
            currentLocation: data.current_location,
            destination: data.destination,
            eta: data.eta,
            courierName: data.courier_name,
            courierContact: data.courier_contact,
            vehicleNo: data.vehicle_no,
            temperature: data.temperature,
            temperatureCelsius: Number(data.temperature_celsius),
            isColdChainCompliant: data.is_cold_chain_compliant,
            timeline: data.timeline || [],
            coordinates: data.coordinates,
            timestamp: data.timestamp || data.updated_at,
          };
        }
      } catch (err) {
        logger.warn('Failed to query tracking_events from Supabase:', err.message);
      }
    }

    if (!tracking) return null;

    if (!tracking.telemetryHistory || !Array.isArray(tracking.telemetryHistory)) {
      tracking.telemetryHistory = [
        {
          timestamp: tracking.timestamp || new Date().toISOString(),
          location: tracking.currentLocation || tracking.location || 'Dispatch Terminal Checkpoint',
          temperatureCelsius: tracking.temperatureCelsius || 4.2,
          isColdChainCompliant: tracking.isColdChainCompliant ?? true,
          coordinates: tracking.coordinates || { lat: 19.0760, lng: 72.8777 },
        }
      ];
    }

    // Authorization: User must be sender, receiver, or admin
    if (user && user.role !== 'admin') {
      const userHospId = user.hospitalId || user.id;
      const isSender = tracking.senderHospitalId === userHospId || tracking.sender_hospital_id === userHospId;
      const isReceiver = tracking.receiverHospitalId === userHospId || tracking.receiver_hospital_id === userHospId;
      if (!isSender && !isReceiver) {
        const err = new Error('Access denied: You do not have permission to inspect this consignment telemetry.');
        err.statusCode = 403;
        err.code = 'FORBIDDEN_TRACKING_ACCESS';
        throw err;
      }
    }

    return tracking;
  }

  /**
   * Updates milestone status for a transfer & consignment
   */
  async updateTransferStatus(transferIdOrTxn, newStatus, telemetryData = {}, user = null) {
    const cleanId = String(transferIdOrTxn).trim().toLowerCase();

    let transfer = fallbackTransfers.find(t => 
      (t.id && t.id.toLowerCase() === cleanId) ||
      (t.transactionId && t.transactionId.toLowerCase() === cleanId)
    );

    let tracking = fallbackTrackingEvents.find(t => 
      (t.transferId && t.transferId.toLowerCase() === cleanId) ||
      (t.transactionId && t.transactionId.toLowerCase() === cleanId) ||
      (t.trackingNumber && t.trackingNumber.toLowerCase() === cleanId)
    );

    if (!transfer && !tracking) {
      const err = new Error(`Transfer record '${transferIdOrTxn}' not found.`);
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    const updatedStatus = newStatus || 'Delivered';
    if (transfer) {
      transfer.status = updatedStatus.toLowerCase().replace(/\s+/g, '_');
      if (updatedStatus.toLowerCase() === 'delivered') {
        transfer.deliveredAt = new Date().toISOString();
        try {
          const txn = transfer.transactionId || id;
          const med = transfer.medicineName || 'Consignment';
          alertService.createAlert({
            hospitalId: transfer.destinationHospitalId,
            title: `Consignment Delivered: ${med}`,
            message: `Consignment #${txn} has arrived and is ready for inventory ingestion.`,
            severity: 'INFO',
            alertType: 'TRANSFER_DELIVERED',
            category: 'TRANSFERS',
            transferId: txn,
            link: `/hospital/track?txn=${encodeURIComponent(txn)}`,
            actionText: 'Inspect Delivery',
          });
          alertService.createAlert({
            hospitalId: transfer.sourceHospitalId,
            title: `Transfer Completed: ${med}`,
            message: `Transfer #${txn} has been safely received by ${transfer.destinationHospitalName || 'partner hospital'}.`,
            severity: 'INFO',
            alertType: 'TRANSFER_DELIVERED',
            category: 'TRANSFERS',
            transferId: txn,
            link: `/hospital/track?txn=${encodeURIComponent(txn)}`,
            actionText: 'View Telemetry',
          });
        } catch (e) {
          logger.warn('Failed to emit transfer delivered alerts:', e.message);
        }
      }
      transfer.updatedAt = new Date().toISOString();
    }

    if (tracking) {
      tracking.status = updatedStatus;
      if (telemetryData.currentLocation) tracking.currentLocation = telemetryData.currentLocation;
      if (telemetryData.eta) tracking.eta = telemetryData.eta;

      const rawTemp = telemetryData.currentTemp !== undefined ? telemetryData.currentTemp : telemetryData.temperatureCelsius;
      if (rawTemp !== undefined) {
        const temp = Number(rawTemp);
        tracking.temperatureCelsius = temp;
        tracking.isColdChainCompliant = temp >= 2.0 && temp <= 8.0;
        tracking.temperature = `${temp}°C (${tracking.isColdChainCompliant ? 'Compliant' : 'BREACH'})`;
        if (transfer) {
          transfer.currentTemp = temp;
          transfer.tempBreach = !tracking.isColdChainCompliant;
        }

        // If cold-chain breach detected, trigger critical alert
        if (!tracking.isColdChainCompliant) {
          alertService.createAlert({
            hospitalId: tracking.senderHospitalId,
            title: 'Cold-Chain Temperature Breach Alert',
            message: `Consignment ${tracking.transactionId} temperature (${temp}°C) breached mandatory 2°C - 8°C limits!`,
            severity: 'CRITICAL',
            alertType: 'TRANSFER_BREACH',
            transferId: tracking.transferId || transfer?.id,
          });
        }
      }

      if (!tracking.telemetryHistory || !Array.isArray(tracking.telemetryHistory)) {
        tracking.telemetryHistory = [];
      }
      tracking.telemetryHistory.push({
        timestamp: new Date().toISOString(),
        location: tracking.currentLocation || 'In Transit Corridor',
        temperatureCelsius: tracking.temperatureCelsius,
        isColdChainCompliant: tracking.isColdChainCompliant,
        coordinates: tracking.coordinates,
      });

      // Update timeline step
      if (tracking.timeline && Array.isArray(tracking.timeline)) {
        tracking.timeline.forEach(step => {
          if (step.step.toLowerCase().includes(updatedStatus.toLowerCase())) {
            step.completed = true;
            step.time = 'Just now';
          }
        });
      }

      tracking.timestamp = new Date().toISOString();
    }

    // Persist to Supabase if configured
    if (isConfigured && supabaseAdmin) {
      try {
        if (transfer) {
          await supabaseAdmin
            .from('transfers')
            .update({
              status: transfer.status,
              delivered_at: transfer.deliveredAt,
              updated_at: new Date().toISOString(),
            })
            .or(`id.eq.${transfer.id},transaction_id.eq.${transfer.transactionId}`);
        }

        if (tracking) {
          await supabaseAdmin
            .from('tracking_events')
            .update({
              status: tracking.status,
              current_location: tracking.currentLocation,
              temperature: tracking.temperature,
              temperature_celsius: tracking.temperatureCelsius,
              is_cold_chain_compliant: tracking.isColdChainCompliant,
              timeline: tracking.timeline,
              updated_at: new Date().toISOString(),
            })
            .or(`id.eq.${tracking.id},transaction_id.eq.${tracking.transactionId}`);
        }
      } catch (err) {
        logger.warn('Failed to update transfer status in Supabase:', err.message);
      }
    }

    // Audit log
    auditService.logEvent({
      action: 'TRANSFER_STATUS_UPDATED',
      entityType: 'TRANSFER',
      entityId: transfer?.id || tracking?.id || cleanId,
      hospitalId: transfer?.sourceHospitalId || tracking?.senderHospitalId,
      hospitalName: transfer?.sourceHospitalName || tracking?.senderHospital,
      partnerHospitalId: transfer?.destinationHospitalId || tracking?.receiverHospitalId,
      partnerHospitalName: transfer?.destinationHospitalName || tracking?.receiverHospital,
      summary: `Transfer consignment status updated to "${updatedStatus}"`,
      resultingStatus: updatedStatus,
      metadata: { newStatus: updatedStatus, telemetry: telemetryData }
    });

    return {
      ...(transfer || {}),
      id: transfer?.id || tracking?.transferId || cleanId,
      status: updatedStatus.toUpperCase(),
      currentTemp: tracking?.temperatureCelsius ?? transfer?.currentTemp,
      tempBreach: !(tracking?.isColdChainCompliant ?? true),
      transfer: transfer || null,
      tracking: tracking || null,
    };
  }
}

module.exports = new TransferService();
