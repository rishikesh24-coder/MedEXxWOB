const transferService = require('../services/transferService');

class TransferController {
  async getTransfers(req, res, next) {
    try {
      const { status, search, page, limit } = req.query;
      const transfers = await transferService.getTransfers({ status, search, page, limit }, req.user);
      return res.status(200).json({
        success: true,
        data: transfers,
        meta: {
          total: transfers.length,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      next(err);
    }
  }

  async createTransfer(req, res, next) {
    try {
      const { destinationHospitalId, quantity, medicineName } = req.body;
      if (!destinationHospitalId) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_DESTINATION_HOSPITAL',
            message: 'Destination hospital ID is required to dispatch an inter-hospital transfer consignment.',
          },
        });
      }
      if (!medicineName || !quantity || Number(quantity) <= 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Valid medicine name and quantity (> 0) are required to dispatch a transfer.',
          },
        });
      }

      const result = await transferService.createTransfer(req.body, req.user);
      return res.status(201).json({
        success: true,
        data: result,
        message: 'Inter-hospital transfer consignment dispatched and tracking telemetry initialized.',
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      next(err);
    }
  }

  async getTracking(req, res, next) {
    try {
      const { txnId } = req.params;
      const tracking = await transferService.getTrackingByTxn(txnId, req.user);
      if (!tracking) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'TRACKING_NOT_FOUND',
            message: `No active tracking telemetry found for consignment or transaction '${txnId}'.`,
          },
          timestamp: new Date().toISOString(),
        });
      }
      return res.status(200).json({
        success: true,
        data: tracking,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      next(err);
    }
  }

  async updateStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const telemetry = req.body.telemetry ? { ...req.body, ...req.body.telemetry } : req.body;
      const result = await transferService.updateTransferStatus(id, status, telemetry, req.user);
      return res.status(200).json({
        success: true,
        data: result,
        message: `Transfer milestone successfully updated to "${status}".`,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new TransferController();
