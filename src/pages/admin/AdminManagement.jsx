import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { 
  Activity, 
  Truck, 
  Trash2, 
  Building2, 
  MapPin, 
  Thermometer, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  Search,
  ShieldCheck,
  FileCheck,
  AlertTriangle,
  ArrowRight,
  ThermometerSnowflake,
  Flame,
  FileCheck2
} from 'lucide-react';
import { 
  fetchAllTransfers, 
  updateTransferMilestone, 
  fetchDisposals, 
  updateDisposalMilestone 
} from '../../store/slices/trackSlice';
import StatusBadge from '../../components/common/StatusBadge';
import Modal from '../../components/common/Modal';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import toast from 'react-hot-toast';

export const AdminManagement = () => {
  const dispatch = useDispatch();
  const { allTransfers, disposals, isLoading } = useSelector((state) => state.track);

  const [activeTab, setActiveTab] = useState('transfers'); // 'transfers' | 'disposals'
  const [searchTerm, setSearchTerm] = useState('');

  // Transfer status modifier modal
  const [editingTransfer, setEditingTransfer] = useState(null);
  const [newTransferStatus, setNewTransferStatus] = useState('In Transit');

  // Disposal status modifier modal
  const [editingDisposal, setEditingDisposal] = useState(null);
  const [newDisposalStatus, setNewDisposalStatus] = useState('In Transit to Bio-Centre');

  useEffect(() => {
    dispatch(fetchAllTransfers());
    dispatch(fetchDisposals());
  }, [dispatch]);

  const handleUpdateTransfer = async (e) => {
    e.preventDefault();
    if (!editingTransfer) return;
    try {
      await dispatch(updateTransferMilestone({
        txnId: editingTransfer.transactionId,
        status: newTransferStatus,
      })).unwrap();
      toast.success(`Updated transfer milestone to "${newTransferStatus}"`);
      setEditingTransfer(null);
    } catch (err) {
      toast.error(err?.message || err || 'Failed to update transfer status');
    }
  };

  const handleUpdateDisposal = async (e) => {
    e.preventDefault();
    if (!editingDisposal) return;
    try {
      await dispatch(updateDisposalMilestone({
        id: editingDisposal.id,
        status: newDisposalStatus,
      })).unwrap();
      toast.success(`Updated disposal status to "${newDisposalStatus}"`);
      setEditingDisposal(null);
    } catch (err) {
      toast.error(err?.message || err || 'Failed to update disposal milestone');
    }
  };

  const filteredTransfers = allTransfers.filter((t) =>
    t.transactionId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.medicineName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.senderHospital.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.receiverHospital.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredDisposals = disposals.filter((d) =>
    d.hospitalName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.medicineName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.bioCentreName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-ocean-950 via-ocean-900 to-teal-950 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-80 h-full bg-[radial-gradient(ellipse_at_top_right,rgba(10,110,121,0.25),transparent_70%)] pointer-events-none" />
        
        <div className="relative z-10 space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wider uppercase bg-teal-500/20 text-teal-300 border border-teal-500/30">
              <Activity className="w-3 h-3 text-teal-400" />
              Transit & Bio-Waste Cockpit
            </span>
            <span className="text-xs text-slate-400 font-mono">Central Telemetry</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">Logistics Telemetry & Bio-Waste Oversight</h1>
          <p className="text-xs text-slate-300 max-w-xl font-normal">
            Real-time multi-state monitoring of cold-chain medicine transfers, active thermal sensors (2°C - 8°C), and certified hazardous bio-waste incineration.
          </p>
        </div>

        <div className="relative z-10 flex items-center gap-3">
          <div className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 backdrop-blur-md text-right">
            <div className="text-[10px] uppercase font-bold text-teal-400 tracking-wider">Active Consignments</div>
            <div className="text-lg font-black text-white font-mono flex items-center justify-end gap-1.5">
              <span>{allTransfers.length} Live Vehicles</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs & Search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          
          <button
            onClick={() => setActiveTab('transfers')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'transfers'
                ? 'bg-teal-600 text-white shadow-md shadow-teal-600/20'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            <span>Inter-Hospital Transfers ({allTransfers.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('disposals')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'disposals'
                ? 'bg-rose-700 text-white shadow-md shadow-rose-700/20'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            <span>Bio-Hazard Disposals ({disposals.length})</span>
          </button>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search consignments, vehicles, or hubs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
          />
        </div>
      </div>

      {/* TAB 1: Transfer Tracking */}
      {activeTab === 'transfers' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200/80 text-xs">
              <thead className="bg-slate-50/80 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-5 py-3.5 text-left">Consignment & TXN</th>
                  <th className="px-4 py-3.5 text-left">Dispatch Origin</th>
                  <th className="px-4 py-3.5 text-left">Receiving Hospital</th>
                  <th className="px-4 py-3.5 text-left">Live Telemetry & Route</th>
                  <th className="px-4 py-3.5 text-center">Status</th>
                  <th className="px-5 py-3.5 text-center">Milestone Control</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filteredTransfers.length > 0 ? (
                  filteredTransfers.map((t) => (
                    <tr key={t.transactionId} className="hover:bg-teal-50/20 transition-colors group">
                      
                      {/* Medicine */}
                      <td className="px-5 py-4">
                        <div className="font-bold text-slate-900 group-hover:text-teal-700 transition-colors">{t.medicineName}</div>
                        <div className="text-[10px] font-mono text-slate-400 font-semibold mt-0.5">TXN: {t.transactionId}</div>
                        <span className="text-[10px] text-teal-800 font-semibold">Qty: {t.quantity} units</span>
                      </td>

                      {/* Origin */}
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-1.5 font-bold text-slate-800">
                          <Building2 className="w-3.5 h-3.5 text-teal-600" />
                          <span>{t.senderHospital}</span>
                        </div>
                        <span className="text-[10px] text-slate-400">Departure Hub</span>
                      </td>

                      {/* Destination */}
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-1.5 font-bold text-slate-800">
                          <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{t.receiverHospital}</span>
                        </div>
                        <span className="text-[10px] text-slate-400">Intake Trauma Unit</span>
                      </td>

                      {/* Live Telemetry */}
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-1.5 text-slate-900 font-bold">
                          <MapPin className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          <span>{t.currentLocation}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-500 font-mono">
                          <span className="text-teal-700 font-bold flex items-center gap-1">
                            <ThermometerSnowflake className="w-3 h-3" />
                            {t.temperature}
                          </span>
                          <span>•</span>
                          <span>ETA: {t.eta}</span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-4 text-center">
                        <StatusBadge status={t.status} />
                      </td>

                      {/* Controls */}
                      <td className="px-5 py-4 text-center">
                        <button
                          onClick={() => {
                            setEditingTransfer(t);
                            setNewTransferStatus(t.status);
                          }}
                          className="px-3 py-1.5 rounded-xl border border-slate-200 hover:border-teal-400 bg-slate-50 hover:bg-white text-slate-700 font-bold text-xs transition-all shadow-sm"
                        >
                          Modify Status
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="px-6 py-14 text-center text-slate-400">
                      <Truck className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      <p className="font-bold text-slate-700">No transfers found matching your query</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: Disposal Tracking */}
      {activeTab === 'disposals' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200/80 text-xs">
              <thead className="bg-slate-50/80 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-5 py-3.5 text-left">Expired Medicine Lot</th>
                  <th className="px-4 py-3.5 text-left">Surrendering Hospital</th>
                  <th className="px-4 py-3.5 text-left">Authorized Incinerator Facility</th>
                  <th className="px-4 py-3.5 text-left">Hazardous Transit Vehicle</th>
                  <th className="px-4 py-3.5 text-center">Disposal Stage</th>
                  <th className="px-5 py-3.5 text-center">Destruction Audit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filteredDisposals.length > 0 ? (
                  filteredDisposals.map((disp) => (
                    <tr key={disp.id} className="hover:bg-rose-50/20 transition-colors group">
                      
                      {/* Expired Lot */}
                      <td className="px-5 py-4">
                        <div className="font-bold text-slate-900 group-hover:text-rose-700 transition-colors">{disp.medicineName}</div>
                        <div className="text-[10px] font-mono text-slate-400">Batch: {disp.batchNo} • Exp: {disp.expiryDate}</div>
                        <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 mt-1 inline-block">
                          {disp.quantity}
                        </span>
                      </td>

                      {/* Origin */}
                      <td className="px-4 py-4 font-bold text-slate-800">
                        {disp.hospitalName}
                      </td>

                      {/* Bio-Centre */}
                      <td className="px-4 py-4">
                        <div className="font-bold text-slate-800">{disp.bioCentreName}</div>
                        <span className="text-[10px] text-slate-400">Pollution Board Certified</span>
                      </td>

                      {/* Vehicle */}
                      <td className="px-4 py-4">
                        <div className="font-mono font-bold text-slate-900">{disp.vehicleNo}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">{disp.currentLocation}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{disp.eta}</div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-4 text-center">
                        <StatusBadge status={disp.status} />
                      </td>

                      {/* Action */}
                      <td className="px-5 py-4 text-center">
                        <div className="space-y-1.5">
                          <button
                            onClick={() => {
                              setEditingDisposal(disp);
                              setNewDisposalStatus(disp.status);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
                          >
                            Update Milestone
                          </button>
                          {disp.certificateNo && (
                            <span className="text-[10px] text-emerald-700 font-mono font-bold block">
                              Cert: {disp.certificateNo}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="px-6 py-14 text-center text-slate-400">
                      <Trash2 className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      <p className="font-bold text-slate-700">No bio-hazard disposal records recorded</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Transfer Milestone Modal */}
      {editingTransfer && (
        <Modal
          isOpen={!!editingTransfer}
          onClose={() => setEditingTransfer(null)}
          title="Update Transfer Logistics Milestone"
          subtitle={`Consignment: ${editingTransfer.medicineName} (${editingTransfer.transactionId})`}
          maxWidth="max-w-md"
        >
          <form onSubmit={handleUpdateTransfer} className="space-y-4 pt-1">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Select Active Milestone</label>
              <select
                value={newTransferStatus}
                onChange={(e) => setNewTransferStatus(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 bg-white font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="Ordered">Ordered (Awaiting Pickup)</option>
                <option value="Dispatched">Dispatched from Dock</option>
                <option value="In Transit">In Transit on Highway</option>
                <option value="Delivered">Delivered & Intake Signed</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingTransfer(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-sm"
              >
                Save Milestone
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Disposal Milestone Modal */}
      {editingDisposal && (
        <Modal
          isOpen={!!editingDisposal}
          onClose={() => setEditingDisposal(null)}
          title="Update Bio-Hazard Incineration Status"
          subtitle={`Disposal Lot: ${editingDisposal.medicineName}`}
          maxWidth="max-w-md"
        >
          <form onSubmit={handleUpdateDisposal} className="space-y-4 pt-1">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Select Disposal Status</label>
              <select
                value={newDisposalStatus}
                onChange={(e) => setNewDisposalStatus(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 bg-white font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-500"
              >
                <option value="Pending Pickup">Pending Bio-Centre Vehicle Pickup</option>
                <option value="In Transit to Bio-Centre">In Transit to Incinerator Facility</option>
                <option value="Incinerated & Certified">Incinerated & Destruction Certified</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingDisposal(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-bold text-white bg-rose-700 hover:bg-rose-800 rounded-xl shadow-sm"
              >
                Update Status
              </button>
            </div>
          </form>
        </Modal>
      )}

    </div>
  );
};

export default AdminManagement;
