import React, { useMemo, useState, useEffect, useRef } from "react";
import { useSearchParams, useLocation, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import {
  AlertCircle,
  Calendar,
  CheckCircle,
  Clock,
  Eye,
  Hospital,
  MapPin,
  Package,
  Search,
  X,
  XCircle,
} from "lucide-react";
import toast from "react-hot-toast";
import { auditService } from "../../services/auditService";
import { getStoredItem, KEYS } from "../../services/storage";
import { hospitalService } from "../../services/hospitalService";
import { formatDate } from "../../utils/formatters";
import "./IncomingRequests.css";

/*
  ============================================================
  INCOMING REQUESTS
  ============================================================

  Frontend-safe implementation.

  Features:
  - Search requests
  - Filter by status
  - View request details
  - Approve request
  - Reject request
  - Confirmation modals
  - Loading/empty states
  - No undefined Lucide icons
  - No conditional hooks
  - Local mock state only

  Backend/API integration can be connected later.
*/

function normalizeIncomingRequest(r, hospitalsMap = {}, medicinesMap = {}) {
  const hosp = hospitalsMap[r.fromHospitalId] || {};
  const med = medicinesMap[r.medicineId] || {};

  let reqDateStr = "17 Sep 2026";
  let reqTimeStr = "10:30 AM";
  if (r.requestDate) {
    try {
      const d = new Date(r.requestDate);
      if (!isNaN(d.getTime())) {
        reqDateStr = d.toLocaleDateString("en-GB", { day: 'numeric', month: 'short', year: 'numeric' });
        reqTimeStr = d.toLocaleTimeString("en-US", { hour: '2-digit', minute: '2-digit' });
      }
    } catch (e) {}
  }

  let normalizedStatus = "Pending";
  const s = (r.status || "").toLowerCase();
  if (s === "accepted" || s === "approved") normalizedStatus = "Accepted";
  else if (s === "rejected" || s === "declined" || s === "cancelled" || s === "expired") normalizedStatus = "Rejected";
  else normalizedStatus = "Pending";

  return {
    id: r.id,
    orderId: r.orderId,
    transactionId: r.transactionId,
    hospital: r.fromHospitalName || hosp.name || "Requester Hospital",
    hospitalCode: hosp.code || (r.fromHospitalId ? r.fromHospitalId.toUpperCase() : "HOSP"),
    fromHospitalId: r.fromHospitalId,
    toHospitalId: r.toHospitalId,
    medicine: r.medicineName || med.brandName || med.name || "Medicine",
    genericName: r.genericName || med.genericName || r.medicineName || "Generic Medicine",
    composition: r.composition || med.composition || r.power || med.power || "Standard Formulation",
    form: r.form || med.dosageForm || "Tablet",
    quantity: Number(r.quantity || 0),
    unit: r.unit || "units",
    requestedPrice: Number(r.unitFinalPrice || r.unitOriginalPrice || r.requestedPrice || 0),
    totalAmount: Number(r.totalAmount || (r.quantity * (r.unitFinalPrice || r.unitOriginalPrice || 0))),
    requestedDate: reqDateStr,
    requestedTime: reqTimeStr,
    status: normalizedStatus,
    rawStatus: r.status,
    priority: r.priority || (r.delivery === 'Express' ? 'High' : 'Normal'),
    delivery: r.delivery || (r.distance && parseFloat(r.distance) > 15 ? 'Express' : 'Standard'),
    distance: r.distance || `${((r.fromHospitalId ? parseInt(r.fromHospitalId.replace(/\D/g, '')) * 3.7 : 5) % 25 + 2).toFixed(1)} km`,
    notes: r.notes || "Medicine requisition for patient care.",
    batch: r.batchNo || r.batch || med.batchNo || "BATCH-2026",
    expiry: r.expiryDate ? formatDate(r.expiryDate) : (med.expiryDate ? formatDate(med.expiryDate) : "15 Dec 2026"),
    medicineId: r.medicineId,
  };
}

const INITIAL_REQUESTS = [
  {
    id: "REQ-2026-014",
    hospital: "Apollo Care Hospital",
    hospitalCode: "ACH-2048",
    medicine: "Paracetamol 500mg",
    genericName: "Paracetamol",
    composition: "Paracetamol 500 mg",
    form: "Tablet",
    quantity: 100,
    unit: "tablets",
    requestedPrice: 3.5,
    totalAmount: 350,
    requestedDate: "13 Aug 2026",
    requestedTime: "10:30 AM",
    status: "Pending",
    priority: "Normal",
    delivery: "Standard",
    distance: "8.4 km",
    notes: "Required for general ward stock.",
    batch: "PCM-A123",
    expiry: "15 Sep 2026",
  },
  {
    id: "REQ-2026-015",
    hospital: "Green Valley Hospital",
    hospitalCode: "GVH-1092",
    medicine: "Amoxicillin 250mg",
    genericName: "Amoxicillin",
    composition: "Amoxicillin 250 mg",
    form: "Capsule",
    quantity: 150,
    unit: "capsules",
    requestedPrice: 5.2,
    totalAmount: 780,
    requestedDate: "13 Aug 2026",
    requestedTime: "09:15 AM",
    status: "Pending",
    priority: "High",
    delivery: "Express",
    distance: "12.7 km",
    notes: "Urgent requirement for inpatient department.",
    batch: "AMX-B205",
    expiry: "20 Dec 2026",
  },
  {
    id: "REQ-2026-011",
    hospital: "LifeCare Hospital",
    hospitalCode: "LCH-3318",
    medicine: "Ceftriaxone 1g",
    genericName: "Ceftriaxone",
    composition: "Ceftriaxone 1 g",
    form: "Injection",
    quantity: 50,
    unit: "vials",
    requestedPrice: 42,
    totalAmount: 2100,
    requestedDate: "12 Aug 2026",
    requestedTime: "04:20 PM",
    status: "Accepted",
    priority: "Normal",
    delivery: "Standard",
    distance: "5.2 km",
    notes: "Routine stock replenishment.",
    batch: "CEF-E109",
    expiry: "05 Oct 2026",
  },
  {
    id: "REQ-2026-010",
    hospital: "City Medical Centre",
    hospitalCode: "CMC-8871",
    medicine: "Azithromycin 500mg",
    genericName: "Azithromycin",
    composition: "Azithromycin 500 mg",
    form: "Tablet",
    quantity: 80,
    unit: "tablets",
    requestedPrice: 7.5,
    totalAmount: 600,
    requestedDate: "11 Aug 2026",
    requestedTime: "01:45 PM",
    status: "Rejected",
    priority: "Normal",
    delivery: "Standard",
    distance: "18.1 km",
    notes: "Requested quantity unavailable.",
    batch: "AZI-D221",
    expiry: "30 Oct 2026",
  },
  {
    id: "REQ-2026-009",
    hospital: "Metro Hospital",
    hospitalCode: "MTH-4412",
    medicine: "Insulin Injection",
    genericName: "Human Insulin",
    composition: "Human Insulin 40 IU/ml",
    form: "Injection",
    quantity: 25,
    unit: "vials",
    requestedPrice: 145,
    totalAmount: 3625,
    requestedDate: "10 Aug 2026",
    requestedTime: "11:10 AM",
    status: "Pending",
    priority: "High",
    delivery: "Express",
    distance: "3.9 km",
    notes: "Critical stock requirement.",
    batch: "INS-I778",
    expiry: "18 Nov 2026",
  },
];

const STATUS_OPTIONS = ["All", "Pending", "Accepted", "Rejected"];

function formatCurrency(value) {
  return `₹${Number(value || 0).toLocaleString("en-IN")}`;
}

function getStatusClass(status) {
  return status.toLowerCase();
}

function StatusBadge({ status }) {
  const icons = {
    Pending: <Clock size={14} />,
    Accepted: <CheckCircle size={14} />,
    Rejected: <XCircle size={14} />,
  };

  return (
    <span className={`incoming-status-badge ${getStatusClass(status)}`}>
      {icons[status]}
      {status}
    </span>
  );
}

function PriorityBadge({ priority }) {
  return (
    <span
      className={`incoming-priority-badge ${priority.toLowerCase()}`}
    >
      {priority}
    </span>
  );
}

export default function IncomingRequests() {
  const { user } = useSelector((state) => state.auth);
  const currentHospitalId = user?.hospitalId || user?.id || 'hosp-1';

  // Alert Deep-Link & Pulse Highlighting
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();

  const loadRequests = () => {
    try {
      const storedReqs = getStoredItem(KEYS.REQUESTS, []);
      if (Array.isArray(storedReqs) && storedReqs.length > 0) {
        const hospitals = getStoredItem(KEYS.HOSPITALS, []);
        const medicines = getStoredItem(KEYS.MEDICINES, []);
        const hospMap = Object.fromEntries(hospitals.map((h) => [h.id, h]));
        const medMap = Object.fromEntries(medicines.map((m) => [m.id, m]));

        const targetId = searchParams.get('requestId') || searchParams.get('orderId') || searchParams.get('reqId') || searchParams.get('transactionId') || location.state?.alertTarget?.requestId || location.state?.alertTarget?.orderId;

        const relevant = storedReqs.filter((r) => 
          r.toHospitalId === currentHospitalId || 
          (targetId && (r.id === targetId || r.transactionId === targetId || r.orderId === targetId)) ||
          !r.toHospitalId
        );

        if (relevant.length > 0) {
          return relevant.map((r) => normalizeIncomingRequest(r, hospMap, medMap));
        }
      }
    } catch (e) {
      console.warn("Failed loading stored requests", e);
    }
    return INITIAL_REQUESTS;
  };

  const [requests, setRequests] = useState(loadRequests);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const [selectedRequest, setSelectedRequest] = useState(null);

  const [actionRequest, setActionRequest] = useState(null);
  const [actionType, setActionType] = useState(null);

  const [actionLoading, setActionLoading] = useState(false);

  const [highlightedId, setHighlightedId] = useState(null);
  const processedTargetRef = useRef(null);

  useEffect(() => {
    if (!requests || requests.length === 0) return;

    const targetReqId = searchParams.get('requestId') || searchParams.get('orderId') || searchParams.get('reqId') || searchParams.get('transactionId') || location.state?.alertTarget?.requestId || location.state?.alertTarget?.orderId;
    if (!targetReqId) return;

    const targetSig = `${targetReqId}`;
    if (processedTargetRef.current === targetSig) return;
    processedTargetRef.current = targetSig;

    const cleanParams = () => {
      try {
        const next = new URLSearchParams(searchParams);
        next.delete('requestId');
        next.delete('orderId');
        next.delete('reqId');
        next.delete('transactionId');
        setSearchParams(next, { replace: true });
        if (location.state?.alertTarget) {
          navigate(location.pathname + (next.toString() ? `?${next.toString()}` : ''), {
            replace: true,
            state: {},
          });
        }
      } catch (e) {
        console.warn('Failed to clean target search params', e);
      }
    };

    const matched = requests.find(
      (r) => 
        r.id === targetReqId || 
        r.orderId === targetReqId || 
        r.transactionId === targetReqId || 
        (r.id && r.id.toLowerCase() === targetReqId.toLowerCase()) ||
        (r.transactionId && r.transactionId.toLowerCase() === targetReqId.toLowerCase())
    );

    if (matched) {
      setStatusFilter('All');
      setSearch('');
      setHighlightedId(matched.id);
      setSelectedRequest(matched);
      toast.success(`Focused on incoming request ${matched.id}`, { icon: '🎯', id: 'incoming-inspect-toast' });

      let attempts = 0;
      const scrollTimer = setInterval(() => {
        attempts++;
        const targetEl = document.getElementById(`incoming-req-row-${matched.id}`);
        if (targetEl) {
          clearInterval(scrollTimer);
          targetEl.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          });
        } else if (attempts > 30) {
          clearInterval(scrollTimer);
        }
      }, 75);

      const fadeTimer = setTimeout(() => {
        setHighlightedId(null);
      }, 4200);

      cleanParams();
      return () => {
        clearInterval(scrollTimer);
        clearTimeout(fadeTimer);
      };
    }

    toast.error('Original request is no longer available.', {
      icon: '⚠️',
      duration: 4000,
      id: 'incoming-missing-toast',
    });
    cleanParams();
  }, [requests, searchParams, location.state]);

  const filteredRequests = useMemo(() => {
    const query = search.trim().toLowerCase();

    return requests.filter((request) => {
      const matchesStatus =
        statusFilter === "All" ||
        request.status === statusFilter;

      const matchesSearch =
        !query ||
        request.id.toLowerCase().includes(query) ||
        request.hospital.toLowerCase().includes(query) ||
        request.medicine.toLowerCase().includes(query) ||
        request.genericName.toLowerCase().includes(query) ||
        request.composition.toLowerCase().includes(query);

      return matchesStatus && matchesSearch;
    });
  }, [requests, search, statusFilter]);

  const pendingCount = requests.filter(
    (request) => request.status === "Pending"
  ).length;

  const acceptedCount = requests.filter(
    (request) => request.status === "Accepted"
  ).length;

  const rejectedCount = requests.filter(
    (request) => request.status === "Rejected"
  ).length;

  const totalRequestedUnits = requests
    .filter((request) => request.status === "Pending")
    .reduce((sum, request) => sum + request.quantity, 0);

  function openAction(request, type) {
    if (!request) return;
    if (request.status !== "Pending") {
      toast.error(`Invalid transition: Request is already marked as "${request.status}" and cannot be modified.`);
      return;
    }
    if (actionLoading) return;
    setActionRequest(request);
    setActionType(type);
  }

  function closeAction() {
    if (actionLoading) return;

    setActionRequest(null);
    setActionType(null);
  }

  async function handleAction() {
    if (!actionRequest || !actionType) return;
    if (actionLoading) return;

    // Strict validation: Only Pending -> Accepted or Pending -> Rejected is permissible
    if (actionRequest.status !== "Pending") {
      toast.error(`Cannot process: Request status is currently "${actionRequest.status}". Only Pending requests can be decided.`);
      setActionRequest(null);
      setActionType(null);
      return;
    }

    setActionLoading(true);

    try {
      const newAction = actionType === "approve" ? "accept" : "reject";
      
      // Call hospitalService to sync storage, audit, and inventory deduction
      try {
        await hospitalService.handleRequest(actionRequest.id, newAction, '', currentHospitalId);
      } catch (svcErr) {
        console.warn("hospitalService.handleRequest fallback:", svcErr);
      }

      const newStatus = actionType === "approve" ? "Accepted" : "Rejected";

      // Log to audit trail
      auditService.logEvent({
        action: actionType === "approve" ? "REQUEST_ACCEPTED" : "REQUEST_REJECTED",
        entityType: "REQUEST",
        entityId: actionRequest.id,
        actorRole: "hospital",
        hospitalName: user?.name || "Authorized Provider Hospital",
        partnerHospitalName: actionRequest.hospital,
        summary: `${actionType === "approve" ? "Approved" : "Declined"} requisition ${actionRequest.id} for ${actionRequest.quantity} units of ${actionRequest.medicine}.`,
        resultingStatus: newStatus,
        metadata: { medicine: actionRequest.medicine, batch: actionRequest.batch, quantity: actionRequest.quantity, amount: actionRequest.totalAmount },
      });

      setRequests((currentRequests) =>
        currentRequests.map((request) =>
          request.id === actionRequest.id
            ? {
              ...request,
              status: newStatus,
              decidedAt: new Date().toISOString(),
            }
            : request
        )
      );

      if (selectedRequest?.id === actionRequest.id) {
        setSelectedRequest((current) =>
          current
            ? {
              ...current,
              status: newStatus,
              decidedAt: new Date().toISOString(),
            }
            : current
        );
      }

      toast.success(`Request ${actionRequest.id} marked as ${newStatus}`);
    } catch (err) {
      toast.error(`Failed to update request: ${err.message}`);
    } finally {
      setActionLoading(false);
      setActionRequest(null);
      setActionType(null);
    }
  }

  function clearFilters() {
    setSearch("");
    setStatusFilter("All");
  }

  return (
    <div className="incoming-requests-page">
      {/* =====================================================
          PAGE HEADER
      ===================================================== */}

      <div className="incoming-page-header">
        <div>
          <div className="incoming-eyebrow">
            HOSPITAL PORTAL
          </div>

          <h1>Incoming Requests</h1>

          <p>
            Review medicine requests from other verified
            hospitals and decide whether to approve or reject
            them.
          </p>
        </div>

        <div className="incoming-header-summary">
          <div className="incoming-header-summary-icon">
            <Package size={22} />
          </div>

          <div>
            <strong>{pendingCount}</strong>
            <span>Pending requests</span>
          </div>
        </div>
      </div>

      {/* =====================================================
          STATS
      ===================================================== */}

      <div className="incoming-stats-grid">
        <div className="incoming-stat-card pending">
          <div className="incoming-stat-icon">
            <Clock size={22} />
          </div>

          <div>
            <span>Pending</span>
            <strong>{pendingCount}</strong>
            <small>Awaiting your decision</small>
          </div>
        </div>

        <div className="incoming-stat-card accepted">
          <div className="incoming-stat-icon">
            <CheckCircle size={22} />
          </div>

          <div>
            <span>Accepted</span>
            <strong>{acceptedCount}</strong>
            <small>Approved requests</small>
          </div>
        </div>

        <div className="incoming-stat-card rejected">
          <div className="incoming-stat-icon">
            <XCircle size={22} />
          </div>

          <div>
            <span>Rejected</span>
            <strong>{rejectedCount}</strong>
            <small>Declined requests</small>
          </div>
        </div>

        <div className="incoming-stat-card units">
          <div className="incoming-stat-icon">
            <Package size={22} />
          </div>

          <div>
            <span>Pending Units</span>
            <strong>
              {totalRequestedUnits.toLocaleString("en-IN")}
            </strong>
            <small>Medicine units requested</small>
          </div>
        </div>
      </div>

      {/* =====================================================
          FILTER TOOLBAR
      ===================================================== */}

      <div className="incoming-toolbar">
        <div className="incoming-search-box">
          <Search size={18} />

          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search hospital, medicine or request ID..."
          />

          {search && (
            <button
              type="button"
              className="incoming-search-clear"
              onClick={() => setSearch("")}
              aria-label="Clear search"
            >
              <X size={16} />
            </button>
          )}
        </div>

        <div className="incoming-filter-group">
          {STATUS_OPTIONS.map((status) => (
            <button
              key={status}
              type="button"
              className={`incoming-filter-button ${statusFilter === status ? "active" : ""
                }`}
              onClick={() => setStatusFilter(status)}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* =====================================================
          REQUEST LIST
      ===================================================== */}

      <div className="incoming-list-card">
        <div className="incoming-list-header">
          <div>
            <h2>Medicine Requests</h2>
            <p>
              {filteredRequests.length} request
              {filteredRequests.length !== 1 ? "s" : ""} found
            </p>
          </div>

          {(search || statusFilter !== "All") && (
            <button
              type="button"
              className="incoming-clear-filters"
              onClick={clearFilters}
            >
              Clear filters
            </button>
          )}
        </div>

        {filteredRequests.length === 0 ? (
          <div className="incoming-empty-state">
            <div className="incoming-empty-icon">
              <Package size={32} />
            </div>

            <h3>No requests found</h3>

            <p>
              No incoming medicine requests match your current
              search or filter.
            </p>

            <button
              type="button"
              onClick={clearFilters}
              className="incoming-primary-button"
            >
              Clear Filters
            </button>
          </div>
        ) : (
          <div className="incoming-table-wrapper">
            <table className="incoming-table">
              <thead>
                <tr>
                  <th>Request</th>
                  <th>Requesting Hospital</th>
                  <th>Medicine</th>
                  <th>Quantity</th>
                  <th>Requested</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {filteredRequests.map((request) => (
                  <tr 
                    key={request.id}
                    id={`incoming-req-row-${request.id}`}
                    className={highlightedId === request.id ? 'alert-target-highlight alert-pulse-target' : ''}
                  >
                    <td>
                      <div className="incoming-request-id">
                        <strong>{request.id}</strong>

                        <span>
                          <Calendar size={13} />
                          {request.requestedDate}
                        </span>
                      </div>
                    </td>

                    <td>
                      <div className="incoming-hospital-cell">
                        <div className="incoming-hospital-icon">
                          <Hospital size={17} />
                        </div>

                        <div>
                          <strong>{request.hospital}</strong>

                          <span>
                            {request.hospitalCode}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td>
                      <div className="incoming-medicine-cell">
                        <strong>{request.medicine}</strong>

                        <span>{request.form}</span>
                      </div>
                    </td>

                    <td>
                      <strong className="incoming-quantity">
                        {request.quantity.toLocaleString("en-IN")}
                      </strong>

                      <span className="incoming-unit">
                        {request.unit}
                      </span>
                    </td>

                    <td>
                      <div className="incoming-date-cell">
                        <strong>
                          {request.requestedDate}
                        </strong>

                        <span>{request.requestedTime}</span>
                      </div>
                    </td>

                    <td>
                      <PriorityBadge
                        priority={request.priority}
                      />
                    </td>

                    <td>
                      <StatusBadge status={request.status} />
                    </td>

                    <td>
                      <div className="incoming-actions">
                        <button
                          type="button"
                          className="incoming-view-button"
                          onClick={() =>
                            setSelectedRequest(request)
                          }
                          title="View request details"
                        >
                          <Eye size={16} />
                          View
                        </button>

                        {request.status === "Pending" && (
                          <>
                            <button
                              type="button"
                              className="incoming-approve-button"
                              disabled={actionLoading}
                              onClick={() =>
                                openAction(
                                  request,
                                  "approve"
                                )
                              }
                              title="Approve request"
                            >
                              <CheckCircle size={16} />
                              Approve
                            </button>

                            <button
                              type="button"
                              className="incoming-reject-button"
                              disabled={actionLoading}
                              onClick={() =>
                                openAction(
                                  request,
                                  "reject"
                                )
                              }
                              title="Reject request"
                            >
                              <XCircle size={16} />
                              Reject
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* =====================================================
          DETAILS MODAL
      ===================================================== */}

      {selectedRequest && (
        <div
          className="incoming-modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedRequest(null);
            }
          }}
        >
          <div
            className="incoming-modal incoming-details-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="incoming-request-details-title"
          >
            <div className="incoming-modal-header">
              <div>
                <span className="incoming-modal-eyebrow">
                  REQUEST DETAILS
                </span>

                <h2 id="incoming-request-details-title">
                  {selectedRequest.id}
                </h2>
              </div>

              <button
                type="button"
                className="incoming-modal-close"
                onClick={() => setSelectedRequest(null)}
                aria-label="Close details"
              >
                <X size={20} />
              </button>
            </div>

            <div className="incoming-modal-body">
              {/* Requesting hospital */}

              <section className="incoming-detail-section">
                <div className="incoming-detail-section-title">
                  <Hospital size={18} />
                  <h3>Requesting Hospital</h3>
                </div>

                <div className="incoming-hospital-detail">
                  <div className="incoming-large-hospital-icon">
                    <Hospital size={24} />
                  </div>

                  <div>
                    <strong>
                      {selectedRequest.hospital}
                    </strong>

                    <span>
                      Hospital Code:{" "}
                      {selectedRequest.hospitalCode}
                    </span>

                    <span>
                      <MapPin size={14} />
                      {selectedRequest.distance} away
                    </span>
                  </div>
                </div>
              </section>

              {/* Medicine */}

              <section className="incoming-detail-section">
                <div className="incoming-detail-section-title">
                  <Package size={18} />
                  <h3>Medicine Details</h3>
                </div>

                <div className="incoming-detail-grid">
                  <div>
                    <span>Medicine</span>
                    <strong>
                      {selectedRequest.medicine}
                    </strong>
                  </div>

                  <div>
                    <span>Generic Name</span>
                    <strong>
                      {selectedRequest.genericName}
                    </strong>
                  </div>

                  <div>
                    <span>Composition</span>
                    <strong>
                      {selectedRequest.composition}
                    </strong>
                  </div>

                  <div>
                    <span>Dosage Form</span>
                    <strong>{selectedRequest.form}</strong>
                  </div>

                  <div>
                    <span>Batch</span>
                    <strong>{selectedRequest.batch}</strong>
                  </div>

                  <div>
                    <span>Expiry</span>
                    <strong>{selectedRequest.expiry}</strong>
                  </div>
                </div>
              </section>

              {/* Request */}

              <section className="incoming-detail-section">
                <div className="incoming-detail-section-title">
                  <Clock size={18} />
                  <h3>Request Information</h3>
                </div>

                <div className="incoming-detail-grid">
                  <div>
                    <span>Quantity</span>
                    <strong>
                      {selectedRequest.quantity.toLocaleString(
                        "en-IN"
                      )}{" "}
                      {selectedRequest.unit}
                    </strong>
                  </div>

                  <div>
                    <span>Requested Price</span>
                    <strong>
                      {formatCurrency(
                        selectedRequest.requestedPrice
                      )}{" "}
                      / unit
                    </strong>
                  </div>

                  <div>
                    <span>Total Amount</span>
                    <strong>
                      {formatCurrency(
                        selectedRequest.totalAmount
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>Delivery</span>
                    <strong>
                      {selectedRequest.delivery}
                    </strong>
                  </div>

                  <div>
                    <span>Priority</span>
                    <PriorityBadge
                      priority={selectedRequest.priority}
                    />
                  </div>

                  <div>
                    <span>Status</span>
                    <StatusBadge
                      status={selectedRequest.status}
                    />
                  </div>
                </div>
              </section>

              {/* Notes */}

              <section className="incoming-note-box">
                <AlertCircle size={18} />

                <div>
                  <strong>Request note</strong>
                  <p>{selectedRequest.notes}</p>
                </div>
              </section>
            </div>

            {selectedRequest.status === "Pending" && (
              <div className="incoming-modal-footer">
                <button
                  type="button"
                  className="incoming-reject-large"
                  onClick={() => {
                    const request = selectedRequest;
                    setSelectedRequest(null);
                    openAction(request, "reject");
                  }}
                >
                  <XCircle size={18} />
                  Reject Request
                </button>

                <button
                  type="button"
                  className="incoming-approve-large"
                  onClick={() => {
                    const request = selectedRequest;
                    setSelectedRequest(null);
                    openAction(request, "approve");
                  }}
                >
                  <CheckCircle size={18} />
                  Approve Request
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================
          APPROVE / REJECT CONFIRMATION
      ===================================================== */}

      {actionRequest && (
        <div
          className="incoming-modal-overlay"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !actionLoading
            ) {
              closeAction();
            }
          }}
        >
          <div
            className="incoming-modal incoming-confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="incoming-confirm-title"
          >
            <div
              className={`incoming-confirm-icon ${actionType === "approve"
                  ? "approve"
                  : "reject"
                }`}
            >
              {actionType === "approve" ? (
                <CheckCircle size={30} />
              ) : (
                <XCircle size={30} />
              )}
            </div>

            <h2 id="incoming-confirm-title">
              {actionType === "approve"
                ? "Approve this request?"
                : "Reject this request?"}
            </h2>

            <p>
              {actionType === "approve"
                ? `You are approving ${actionRequest.quantity} ${actionRequest.unit} of ${actionRequest.medicine} for ${actionRequest.hospital}.`
                : `You are rejecting the request for ${actionRequest.quantity} ${actionRequest.unit} of ${actionRequest.medicine} from ${actionRequest.hospital}.`}
            </p>

            <div className="incoming-confirm-summary">
              <div>
                <span>Request ID</span>
                <strong>{actionRequest.id}</strong>
              </div>

              <div>
                <span>Medicine</span>
                <strong>{actionRequest.medicine}</strong>
              </div>

              <div>
                <span>Quantity</span>
                <strong>
                  {actionRequest.quantity}{" "}
                  {actionRequest.unit}
                </strong>
              </div>

              <div>
                <span>Total</span>
                <strong>
                  {formatCurrency(actionRequest.totalAmount)}
                </strong>
              </div>
            </div>

            <div className="incoming-confirm-actions">
              <button
                type="button"
                className="incoming-cancel-button"
                onClick={closeAction}
                disabled={actionLoading}
              >
                Cancel
              </button>

              <button
                type="button"
                className={
                  actionType === "approve"
                    ? "incoming-confirm-approve"
                    : "incoming-confirm-reject"
                }
                onClick={handleAction}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <>
                    <span className="incoming-spinner" />
                    Processing...
                  </>
                ) : actionType === "approve" ? (
                  <>
                    <CheckCircle size={17} />
                    Confirm Approval
                  </>
                ) : (
                  <>
                    <XCircle size={17} />
                    Confirm Rejection
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}