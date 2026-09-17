import React, { useState, useEffect } from 'react';
import { Pill, Maximize2, X, Image as ImageIcon, Sparkles } from 'lucide-react';

/**
 * MedicineImageGallery
 * 
 * Renders high-quality pharmaceutical packaging imagery with:
 * - Interactive thumbnail switcher ([Front], [Back], [Strip], [Package])
 * - Fullscreen modal zoom view
 * - Graceful fallback ("Medicine image unavailable" with package icon)
 */
export const MedicineImageGallery = ({ medicine }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isZoomOpen, setIsZoomOpen] = useState(false);
  const [imageErrorMap, setImageErrorMap] = useState({});

  // Reset selected image when medicine changes
  useEffect(() => {
    setSelectedIndex(0);
    setImageErrorMap({});
  }, [medicine?.id]);

  if (!medicine) return null;

  // Compile image list: prioritize medicine.images array, fallback to medicine.image
  const imageList = Array.isArray(medicine.images) && medicine.images.length > 0
    ? medicine.images
    : medicine.image
    ? [{ label: 'Front', url: medicine.image, alt: `${medicine.brandName} packaging` }]
    : [];

  const currentImage = imageList[selectedIndex];
  const hasError = currentImage ? imageErrorMap[currentImage.url] : true;
  const isImageAvailable = currentImage && !hasError;

  const handleImageError = (url) => {
    setImageErrorMap((prev) => ({ ...prev, [url]: true }));
  };

  return (
    <div className="space-y-3">
      {/* MAIN IMAGE CONTAINER */}
      <div 
        onClick={() => isImageAvailable && setIsZoomOpen(true)}
        className={`relative w-full h-64 sm:h-72 rounded-2xl bg-gradient-to-b from-slate-50 to-slate-100/80 border border-slate-200/90 overflow-hidden flex items-center justify-center transition-all ${
          isImageAvailable ? 'cursor-zoom-in group hover:border-primary-400 hover:shadow-md' : ''
        }`}
      >
        {isImageAvailable ? (
          <>
            <img
              src={currentImage.url}
              alt={currentImage.alt || `${medicine.brandName} packaging`}
              onError={() => handleImageError(currentImage.url)}
              className="w-full h-full object-contain p-4 group-hover:scale-105 transition-transform duration-300"
            />

            {/* Quick Zoom Trigger Badge */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsZoomOpen(true);
              }}
              className="absolute bottom-3 right-3 p-2 rounded-xl bg-white/90 hover:bg-white text-slate-700 shadow-sm border border-slate-200/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5 text-[11px] font-bold"
              title="Click to expand image"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Zoom</span>
            </button>

            {/* Current View Badge */}
            <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-white/90 backdrop-blur-sm text-slate-700 border border-slate-200/80 text-[10px] font-mono font-bold tracking-wider uppercase shadow-xs">
              {currentImage.label || 'Packaging'}
            </div>
          </>
        ) : (
          /* PROFESSIONAL FALLBACK IF IMAGE UNAVAILABLE */
          <div className="p-6 text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-slate-200/70 border border-slate-300/80 text-slate-400 flex items-center justify-center mx-auto shadow-inner">
              <Pill className="w-7 h-7 rotate-45 text-slate-400" />
            </div>
            <div>
              <p className="text-xs font-extrabold text-slate-700">
                Medicine image unavailable
              </p>
              <p className="text-[11px] text-slate-500 max-w-[200px] mx-auto mt-0.5 font-medium">
                Verified pharmaceutical lot: {medicine.brandName} ({medicine.power})
              </p>
            </div>
          </div>
        )}
      </div>

      {/* THUMBNAIL SELECTOR STRIP */}
      {imageList.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {imageList.map((img, idx) => {
            const isSelected = selectedIndex === idx;
            const imgHasError = imageErrorMap[img.url];

            return (
              <button
                key={img.label || idx}
                type="button"
                onClick={() => setSelectedIndex(idx)}
                className={`relative flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all flex-shrink-0 ${
                  isSelected
                    ? 'bg-primary-50 border-primary-500 text-primary-700 shadow-sm ring-1 ring-primary-500'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <div className="w-5 h-5 rounded-md bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center flex-shrink-0">
                  {!imgHasError ? (
                    <img 
                      src={img.url} 
                      alt="" 
                      className="w-full h-full object-cover" 
                      onError={() => handleImageError(img.url)}
                    />
                  ) : (
                    <ImageIcon className="w-3 h-3 text-slate-400" />
                  )}
                </div>
                <span>[{img.label}]</span>
              </button>
            );
          })}
        </div>
      )}

      {/* FULLSCREEN ZOOM MODAL */}
      {isZoomOpen && isImageAvailable && (
        <div 
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => setIsZoomOpen(false)}
        >
          <div 
            className="relative max-w-3xl w-full bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 overflow-hidden space-y-4 animate-scaleUp"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  {medicine.brandName} • Packaging View [{currentImage.label}]
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  {medicine.genericName} ({medicine.power})
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsZoomOpen(false)}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                title="Close zoom view"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="w-full h-[450px] bg-slate-50 rounded-2xl flex items-center justify-center p-6 border border-slate-100">
              <img
                src={currentImage.url}
                alt={currentImage.alt || medicine.brandName}
                className="max-h-full max-w-full object-contain"
              />
            </div>

            <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
              <span className="font-mono text-[11px]">Batch: {medicine.batchNo} • Expiry: {medicine.expiryDate}</span>
              <span className="text-slate-400">Click anywhere outside to close</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MedicineImageGallery;
