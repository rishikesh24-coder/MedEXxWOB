import React, { useState, useEffect, useMemo, useRef, Component } from 'react';
import { 
  MapContainer, 
  TileLayer, 
  Marker, 
  Popup, 
  Polyline, 
  useMap 
} from 'react-leaflet';
import L from 'leaflet';
import { 
  Navigation, 
  Play, 
  Pause, 
  RotateCcw, 
  Compass, 
  ZoomIn, 
  ZoomOut, 
  Maximize2,
  AlertTriangle,
  MapPin,
  Clock,
  Thermometer,
  ShieldCheck
} from 'lucide-react';
import { 
  INDIA_MAP_CENTER, 
  DEFAULT_MAP_ZOOM, 
  getTrackingRouteData, 
  interpolatePathPosition 
} from '../../utils/geoUtils';

// Ensure default Leaflet marker assets resolve without 404s in Vite bundler
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

/**
 * Child Controller inside MapContainer to access Leaflet map instance
 * Handles fitBounds, reset view, and smooth responsive resize invalidations.
 */
const MapController = ({ boundsTrigger, centerTrigger, boundsCoords }) => {
  const map = useMap();

  // Invalidate map size on mount/resize
  useEffect(() => {
    if (!map) return;
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 150);
    return () => clearTimeout(timer);
  }, [map]);

  // Fit bounds when boundsTrigger changes or new route coords provided
  useEffect(() => {
    if (!map || !boundsCoords || boundsCoords.length === 0) return;
    try {
      const validPoints = boundsCoords.filter(
        (pt) => Array.isArray(pt) && pt.length === 2 && !isNaN(pt[0]) && !isNaN(pt[1])
      );
      if (validPoints.length > 0) {
        const bounds = L.latLngBounds(validPoints);
        if (bounds.isValid()) {
          map.fitBounds(bounds, {
            padding: [48, 48],
            maxZoom: 13,
            animate: true,
          });
        }
      }
    } catch (err) {
      console.warn('Map bounds fit warning:', err);
    }
  }, [map, boundsTrigger, boundsCoords]);

  // Center to National India view when requested
  useEffect(() => {
    if (!map || centerTrigger === 0) return;
    map.setView(INDIA_MAP_CENTER, DEFAULT_MAP_ZOOM, { animate: true });
  }, [map, centerTrigger]);

  return null;
};

/**
 * Custom High-Definition HTML DivIcons for SaaS aesthetic
 * Completely decoupled from static image asset loading.
 */
const createSellerIcon = (cityName = 'Seller') => {
  return L.divIcon({
    className: 'custom-leaflet-marker',
    html: `
      <div style="position: relative; display: flex; flex-direction: column; align-items: center; transform: translate(-50%, -100%); pointer-events: auto; cursor: pointer;">
        <div style="background: #059669; color: white; padding: 4px 10px; border-radius: 9999px; box-shadow: 0 4px 12px rgba(5,150,105,0.4); font-size: 11px; font-weight: 800; display: flex; align-items: center; gap: 5px; border: 2px solid white; white-space: nowrap; font-family: ui-sans-serif, system-ui, sans-serif;">
          <span>🏥</span>
          <span>${cityName}</span>
        </div>
        <div style="width: 2px; height: 10px; background: #059669;"></div>
        <div style="width: 8px; height: 8px; border-radius: 9999px; background: #059669; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.2);"></div>
      </div>
    `,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
    popupAnchor: [0, -32],
  });
};

const createBuyerIcon = (cityName = 'Buyer') => {
  return L.divIcon({
    className: 'custom-leaflet-marker',
    html: `
      <div style="position: relative; display: flex; flex-direction: column; align-items: center; transform: translate(-50%, -100%); pointer-events: auto; cursor: pointer;">
        <div style="background: #2563EB; color: white; padding: 4px 10px; border-radius: 9999px; box-shadow: 0 4px 12px rgba(37,99,235,0.4); font-size: 11px; font-weight: 800; display: flex; align-items: center; gap: 5px; border: 2px solid white; white-space: nowrap; font-family: ui-sans-serif, system-ui, sans-serif;">
          <span>🏥</span>
          <span>${cityName}</span>
        </div>
        <div style="width: 2px; height: 10px; background: #2563EB;"></div>
        <div style="width: 8px; height: 8px; border-radius: 9999px; background: #2563EB; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.2);"></div>
      </div>
    `,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
    popupAnchor: [0, -32],
  });
};

const createVehicleIcon = (isDelivered = false) => {
  if (isDelivered) {
    return L.divIcon({
      className: 'custom-leaflet-marker',
      html: `
        <div style="position: relative; display: flex; flex-direction: column; align-items: center; transform: translate(-50%, -50%); pointer-events: auto; cursor: pointer;">
          <div style="background: #059669; color: white; width: 34px; height: 34px; border-radius: 9999px; box-shadow: 0 4px 14px rgba(5, 150, 105, 0.5); display: flex; align-items: center; justify-content: center; font-size: 16px; border: 2.5px solid white;">
            ✓
          </div>
          <div style="background: #064E3B; color: #A7F3D0; font-size: 9px; font-weight: 800; padding: 1px 6px; border-radius: 4px; margin-top: 2px; border: 1px solid rgba(255,255,255,0.3); white-space: nowrap; font-family: monospace;">
            DELIVERED
          </div>
        </div>
      `,
      iconSize: [0, 0],
      iconAnchor: [0, 0],
      popupAnchor: [0, -24],
    });
  }

  return L.divIcon({
    className: 'custom-leaflet-marker',
    html: `
      <div style="position: relative; display: flex; flex-direction: column; align-items: center; transform: translate(-50%, -50%); pointer-events: auto; cursor: pointer;">
        <div style="position: absolute; width: 44px; height: 44px; border-radius: 9999px; background: rgba(217, 119, 6, 0.22); animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
        <div style="position: relative; background: #D97706; color: white; width: 36px; height: 36px; border-radius: 9999px; box-shadow: 0 4px 14px rgba(217, 119, 6, 0.5); display: flex; align-items: center; justify-content: center; font-size: 18px; border: 2.5px solid white;">
          🚚
        </div>
        <div style="background: #0F172A; color: #FCD34D; font-size: 9px; font-weight: 800; padding: 1px 6px; border-radius: 4px; margin-top: 2px; border: 1px solid rgba(255,255,255,0.25); white-space: nowrap; font-family: monospace; letter-spacing: 0.05em;">
          DEMO LIVE
        </div>
      </div>
    `,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
    popupAnchor: [0, -28],
  });
};

/**
 * Robust Error Boundary around Leaflet Map
 * Prevents whole-page crashing if tiles/webgl/container fail
 */
class MapErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('IndiaLiveMap error boundary caught:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-8 sm:p-12 text-center space-y-4 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-base font-extrabold text-slate-900">Map temporarily unavailable</h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
              The interactive geographic tile layer could not be initialized. All consignment details, transfer timeline, and cold-chain telemetry remain active.
            </p>
          </div>
          <button
            onClick={this.handleRetry}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-sm"
          >
            Retry Loading Map
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

/**
 * IndiaLiveMap Component
 * Real interactive Leaflet map centered on India displaying live transfer routes.
 */
export const IndiaLiveMap = ({ tracking, className = '' }) => {
  // Extract centralized mapping data architecture
  const routeData = useMemo(() => {
    return getTrackingRouteData(tracking);
  }, [tracking]);

  const isDelivered = (tracking?.status || '').toLowerCase() === 'delivered';

  // Map view triggers
  const [boundsTrigger, setBoundsTrigger] = useState(0);
  const [centerTrigger, setCenterTrigger] = useState(0);

  // Simulation state
  const [isSimulating, setIsSimulating] = useState(!isDelivered);
  // Default progress: 0.58 along route (in transit between origin and destination)
  const [simProgress, setSimProgress] = useState(isDelivered ? 1.0 : 0.58);

  // Update simProgress when tracking item changes
  useEffect(() => {
    if (isDelivered) {
      setSimProgress(1.0);
      setIsSimulating(false);
    } else {
      setSimProgress(0.58);
      setIsSimulating(true);
    }
    // Auto-fit route bounds when shipment switches
    setBoundsTrigger((prev) => prev + 1);
  }, [tracking?.transactionId, isDelivered]);

  // Gentle vehicle simulation movement loop (subtle 0.4% increment every 1.2s)
  useEffect(() => {
    if (!isSimulating || isDelivered) return;

    const interval = setInterval(() => {
      setSimProgress((prev) => {
        // Loop gently between 0.35 and 0.88 to represent real in-transit highway corridor
        if (prev >= 0.88) {
          return 0.35;
        }
        return prev + 0.004;
      });
    }, 1200);

    return () => clearInterval(interval);
  }, [isSimulating, isDelivered]);

  // Current interpolated vehicle coordinates
  const vehiclePosition = useMemo(() => {
    if (isDelivered) {
      return [routeData.destination.latitude, routeData.destination.longitude];
    }
    return interpolatePathPosition(routeData.route, simProgress);
  }, [routeData, simProgress, isDelivered]);

  // Coordinates array for map bounding box
  const boundsCoords = useMemo(() => {
    return [
      [routeData.seller.latitude, routeData.seller.longitude],
      vehiclePosition,
      [routeData.destination.latitude, routeData.destination.longitude],
      ...(routeData.route || []),
    ];
  }, [routeData, vehiclePosition]);

  // Custom marker icon instances
  const sellerIcon = useMemo(() => createSellerIcon(routeData.seller.city), [routeData.seller.city]);
  const buyerIcon = useMemo(() => createBuyerIcon(routeData.destination.city), [routeData.destination.city]);
  const vehicleIcon = useMemo(() => createVehicleIcon(isDelivered), [isDelivered]);

  // Split route into completed segment (origin -> vehicle) and remaining segment (vehicle -> destination)
  const { completedSegment, remainingSegment } = useMemo(() => {
    if (!routeData.route || routeData.route.length < 2) {
      return { completedSegment: [], remainingSegment: [] };
    }
    // Simple 2-point splits for visual progression
    return {
      completedSegment: [
        [routeData.seller.latitude, routeData.seller.longitude],
        vehiclePosition,
      ],
      remainingSegment: [
        vehiclePosition,
        [routeData.destination.latitude, routeData.destination.longitude],
      ],
    };
  }, [routeData, vehiclePosition]);

  return (
    <MapErrorBoundary>
      <div className={`space-y-3 ${className}`}>
        
        {/* Top Control & Simulation Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 px-1">
          
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200/80 text-[11px] font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Interactive India Map</span>
            </span>

            <span className="text-[11px] text-slate-400 font-mono hidden sm:inline-block">
              OpenStreetMap Base
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Simulation Toggle */}
            {!isDelivered && (
              <button
                type="button"
                onClick={() => setIsSimulating(!isSimulating)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border shadow-sm ${
                  isSimulating
                    ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
                title={isSimulating ? 'Pause animated movement' : 'Resume animated movement'}
              >
                {isSimulating ? (
                  <>
                    <Pause className="w-3.5 h-3.5 text-amber-600 fill-current" />
                    <span>Pause Simulation</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 text-slate-600 fill-current" />
                    <span>Resume Simulation</span>
                  </>
                )}
              </button>
            )}

            {/* Reset Route Bounds */}
            <button
              type="button"
              onClick={() => setBoundsTrigger((c) => c + 1)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-bold transition-all shadow-sm"
              title="Fit map view to entire shipment corridor"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              <span>Reset Route</span>
            </button>

            {/* Center Whole India */}
            <button
              type="button"
              onClick={() => setCenterTrigger((c) => c + 1)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-bold transition-all shadow-sm"
              title="View full India geographic boundary"
            >
              <Compass className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">India View</span>
            </button>
          </div>

        </div>

        {/* Map Canvas Container */}
        {/* Responsive Heights: Desktop 500-600px, Tablet 400-500px, Mobile 320-400px */}
        <div className="relative w-full h-[340px] sm:h-[440px] lg:h-[540px] rounded-3xl overflow-hidden border border-slate-200/90 shadow-sm bg-slate-100">
          
          <MapContainer
            center={INDIA_MAP_CENTER}
            zoom={DEFAULT_MAP_ZOOM}
            scrollWheelZoom={true}
            style={{ width: '100%', height: '100%' }}
            attributionControl={false}
          >
            {/* Tile Layer: OpenStreetMap Standard */}
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              maxZoom={18}
            />

            {/* Map Lifecycle Controller for fitBounds and Resize */}
            <MapController
              boundsTrigger={boundsTrigger}
              centerTrigger={centerTrigger}
              boundsCoords={boundsCoords}
            />

            {/* Route Polyline (Full corridor) */}
            <Polyline
              positions={routeData.route}
              pathOptions={{
                color: '#0A6E79',
                weight: 4.5,
                opacity: 0.75,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />

            {/* Traversed segment (Solid Teal glow) */}
            {completedSegment.length > 1 && (
              <Polyline
                positions={completedSegment}
                pathOptions={{
                  color: '#0284C7',
                  weight: 5.5,
                  opacity: 0.95,
                  lineCap: 'round',
                }}
              />
            )}

            {/* Remaining segment (Dashed Amber path) */}
            {remainingSegment.length > 1 && !isDelivered && (
              <Polyline
                positions={remainingSegment}
                pathOptions={{
                  color: '#D97706',
                  weight: 4,
                  opacity: 0.85,
                  dashArray: '8, 8',
                }}
              />
            )}

            {/* 1. SELLER HOSPITAL MARKER */}
            <Marker
              position={[routeData.seller.latitude, routeData.seller.longitude]}
              icon={sellerIcon}
            >
              <Popup className="custom-leaflet-popup" minWidth={240}>
                <div className="p-3.5 space-y-2 text-xs">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-wider">
                      SELLER HOSPITAL
                    </span>
                    <span className="text-[11px] text-slate-400 font-bold">{routeData.seller.city}</span>
                  </div>

                  <div>
                    <h4 className="text-sm font-extrabold text-slate-900 leading-tight">
                      {routeData.seller.name}
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
                      Origin Dispatch Pharmacy
                    </p>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1 font-mono text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Medicine:</span>
                      <strong className="text-slate-800 truncate max-w-[130px]">{routeData.seller.medicine}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Quantity:</span>
                      <strong className="text-slate-800">{routeData.seller.quantity} units</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Status:</span>
                      <strong className="text-emerald-700 font-bold">{routeData.seller.status}</strong>
                    </div>
                  </div>
                </div>
              </Popup>
            </Marker>

            {/* 2. BUYER HOSPITAL MARKER */}
            <Marker
              position={[routeData.destination.latitude, routeData.destination.longitude]}
              icon={buyerIcon}
            >
              <Popup className="custom-leaflet-popup" minWidth={240}>
                <div className="p-3.5 space-y-2 text-xs">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px] font-black uppercase tracking-wider">
                      BUYER HOSPITAL
                    </span>
                    <span className="text-[11px] text-slate-400 font-bold">{routeData.destination.city}</span>
                  </div>

                  <div>
                    <h4 className="text-sm font-extrabold text-slate-900 leading-tight">
                      {routeData.destination.name}
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
                      Receiving Intake Dock
                    </p>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1 font-mono text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Medicine:</span>
                      <strong className="text-slate-800 truncate max-w-[130px]">{routeData.destination.medicine}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Quantity:</span>
                      <strong className="text-slate-800">{routeData.destination.quantity} units</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Expected arrival:</span>
                      <strong className="text-blue-700 font-bold">{routeData.destination.eta}</strong>
                    </div>
                  </div>
                </div>
              </Popup>
            </Marker>

            {/* 3. CURRENT VEHICLE / DELIVERY MARKER */}
            <Marker
              position={vehiclePosition}
              icon={vehicleIcon}
            >
              <Popup className="custom-leaflet-popup" minWidth={250}>
                <div className="p-3.5 space-y-2 text-xs">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-black uppercase tracking-wider">
                      {isDelivered ? 'DESTINATION REACHED' : 'CURRENT LOCATION'}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      {isDelivered ? 'Handoff signed' : 'Demo Live Location'}
                    </span>
                  </div>

                  <div>
                    <p className="text-[11px] font-medium text-slate-600">
                      {isDelivered 
                        ? 'Medicine successfully handed off at dock.' 
                        : 'Medicine shipment is in transit.'}
                    </p>
                    <h4 className="text-xs font-black text-slate-900 mt-1 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                      <span>{routeData.current.label}</span>
                    </h4>
                  </div>

                  <div className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-200/80 space-y-1 font-mono text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Status:</span>
                      <strong className="text-amber-900 font-bold">{routeData.current.status}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Last updated:</span>
                      <strong className="text-slate-800">{routeData.current.lastUpdated}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Vehicle:</span>
                      <strong className="text-slate-800">{routeData.current.vehicleNo?.split(' ')[0]}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Chamber Temp:</span>
                      <strong className="text-emerald-700 font-bold">{routeData.current.temperature?.split(' ')[0]} (Safe)</strong>
                    </div>
                  </div>

                  <p className="text-[10px] text-slate-400 italic">
                    * Demo tracking simulation • Not actual satellite GPS
                  </p>
                </div>
              </Popup>
            </Marker>

          </MapContainer>

          {/* Minimal Map Legend Overlay (Requirement 12) */}
          <div className="absolute bottom-3 left-3 z-[400] bg-white/95 backdrop-blur-md rounded-2xl p-2.5 border border-slate-200/90 shadow-md text-[11px] font-medium text-slate-700 space-y-1.5 pointer-events-auto">
            <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-1">
              Legend
            </div>
            <div className="flex items-center gap-2">
              <span>🏥</span>
              <span>Seller ({routeData.seller.city})</span>
            </div>
            <div className="flex items-center gap-2">
              <span>🚚</span>
              <span>Current Location</span>
            </div>
            <div className="flex items-center gap-2">
              <span>🏥</span>
              <span>Destination ({routeData.destination.city})</span>
            </div>
            <div className="flex items-center gap-2 text-slate-500">
              <span className="w-4 h-1 bg-[#0A6E79] rounded-full inline-block"></span>
              <span>Route</span>
            </div>
          </div>

          {/* Bottom Simulation Indicator Tag (Requirement 8 & 18) */}
          <div className="absolute top-3 right-3 z-[400] bg-slate-900/90 backdrop-blur-md text-white px-3 py-1.5 rounded-xl text-[10px] font-mono border border-white/15 shadow-md flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${isSimulating ? 'bg-amber-400 animate-ping' : 'bg-slate-400'}`}></span>
            <span>Demo tracking simulation</span>
          </div>

        </div>

        {/* Note below map clarifying demo status */}
        <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
          <span>Click any hospital or vehicle icon for consignment telemetry and order details.</span>
          <span className="font-mono">National Geographic Map (India)</span>
        </div>

      </div>
    </MapErrorBoundary>
  );
};

export default IndiaLiveMap;
