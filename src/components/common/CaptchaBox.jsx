import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { RotateCw, ShieldCheck, Volume2, CheckCircle2, AlertCircle } from 'lucide-react';

const CHAR_SET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const CODE_LENGTH = 5;

/**
 * Generate an unambiguous random alphanumeric CAPTCHA code.
 */
const generateRandomCode = (previousCode = '') => {
  let code = '';
  do {
    code = '';
    for (let i = 0; i < CODE_LENGTH; i++) {
      const randomIndex = Math.floor(Math.random() * CHAR_SET.length);
      code += CHAR_SET[randomIndex];
    }
  } while (code === previousCode);
  return code;
};

/**
 * Render distorted, noise-protected but human-readable characters onto an HTML5 canvas.
 * Crucial security note: Code is drawn as pixel raster; no plain text is exposed in the DOM.
 */
const drawCaptchaCanvas = (canvas, code) => {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const width = canvas.width;
  const height = canvas.height;

  // 1. Clear background
  ctx.clearRect(0, 0, width, height);

  // 2. Background gradient
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#F0FDFA'); // light teal
  gradient.addColorStop(0.5, '#F8FAFC'); // slate
  gradient.addColorStop(1, '#E0F2FE'); // light sky
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // 3. Subtle background noise lines
  ctx.lineWidth = 1.2;
  const lineColors = ['#CBD5E1', '#94A3B8', '#99F6E4', '#BAE6FD'];
  for (let i = 0; i < 4; i++) {
    ctx.strokeStyle = lineColors[i % lineColors.length];
    ctx.beginPath();
    ctx.moveTo(Math.random() * 10, Math.random() * height);
    ctx.bezierCurveTo(
      Math.random() * width * 0.4, Math.random() * height,
      Math.random() * width * 0.7, Math.random() * height,
      width - Math.random() * 10, Math.random() * height
    );
    ctx.stroke();
  }

  // 4. Subtle background dots
  for (let i = 0; i < 30; i++) {
    ctx.fillStyle = lineColors[Math.floor(Math.random() * lineColors.length)];
    ctx.beginPath();
    ctx.arc(Math.random() * width, Math.random() * height, 1.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // 5. Draw individual characters with slight rotation & distinct colors
  const charColors = ['#0F172A', '#0D9488', '#0369A1', '#4338CA', '#047857', '#1E293B'];
  const startX = 16;
  const spacing = (width - startX * 2) / (code.length - 1);

  ctx.textBaseline = 'middle';
  ctx.font = 'bold 22px "Consolas", "Courier New", "SF Mono", monospace';

  for (let i = 0; i < code.length; i++) {
    const char = code[i];
    const x = startX + i * spacing;
    const y = height / 2 + (Math.random() * 6 - 3);
    const angle = (Math.random() * 26 - 13) * (Math.PI / 180); // -13deg to +13deg

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = charColors[i % charColors.length];

    // Shadow for depth and contrast
    ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
    ctx.shadowBlur = 2;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;

    ctx.fillText(char, -8, 0);
    ctx.restore();
  }

  // 6. Delicate foreground wave line across text for OCR disruption
  ctx.beginPath();
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.2)';
  ctx.lineWidth = 1;
  ctx.moveTo(8, height / 2 + Math.sin(0) * 8);
  for (let x = 8; x < width - 8; x += 4) {
    ctx.lineTo(x, height / 2 + Math.sin(x / 14) * 6);
  }
  ctx.stroke();
};

export const CaptchaBox = forwardRef(({
  value = '',
  onChange,
  onVerifyChange,
  errorMessage = '',
  className = ''
}, ref) => {
  const canvasRef = useRef(null);
  const [currentCode, setCurrentCode] = useState('');
  const [isRotating, setIsRotating] = useState(false);

  // Initialize and regenerate CAPTCHA challenge
  const regenerate = () => {
    setIsRotating(true);
    setCurrentCode((prev) => {
      const nextCode = generateRandomCode(prev);
      if (canvasRef.current) {
        drawCaptchaCanvas(canvasRef.current, nextCode);
      }
      return nextCode;
    });
    if (onChange) onChange('');
    if (onVerifyChange) onVerifyChange(false);
    setTimeout(() => setIsRotating(false), 450);
  };

  // Expose imperative methods to parent (e.g. for failed login attempts)
  useImperativeHandle(ref, () => ({
    regenerate,
    validate: (inputVal) => {
      const trimmed = (inputVal || value || '').trim().toUpperCase();
      return trimmed.length === CODE_LENGTH && trimmed === currentCode.toUpperCase();
    },
    reset: () => {
      regenerate();
    }
  }));

  // Initial draw
  useEffect(() => {
    regenerate();
  }, []);

  // Redraw when code or canvas changes
  useEffect(() => {
    if (currentCode && canvasRef.current) {
      drawCaptchaCanvas(canvasRef.current, currentCode);
    }
  }, [currentCode]);

  // Handle user input changes and report verification status
  const handleInputChange = (e) => {
    const rawVal = e.target.value.replace(/[^a-zA-Z0-9]/g, '').slice(0, CODE_LENGTH).toUpperCase();
    if (onChange) onChange(rawVal);
    const isMatch = rawVal.length === CODE_LENGTH && rawVal === currentCode.toUpperCase();
    if (onVerifyChange) onVerifyChange(isMatch);
  };

  // Accessible audio narration
  const handleAudioSpeak = () => {
    if (!('speechSynthesis' in window) || !currentCode) return;
    try {
      window.speechSynthesis.cancel();
      const textToSpeak = `Security code: ${currentCode.split('').join(', ')}`;
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.rate = 0.85;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('Speech synthesis unavailable', e);
    }
  };

  const isVerified = value.length === CODE_LENGTH && value.toUpperCase() === currentCode.toUpperCase();

  return (
    <div className={`space-y-2 select-none ${className}`}>
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
          <span>Security Verification</span>
          <span className="text-rose-500">*</span>
        </label>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-bold border border-slate-200">
          Anti-Bot Challenge
        </span>
      </div>

      <div className="flex items-center gap-2.5">
        {/* Raster Canvas Display Box */}
        <div className="relative rounded-xl overflow-hidden border border-slate-300 bg-slate-50 shadow-inner flex-shrink-0 flex items-center justify-center p-0.5">
          <canvas
            ref={canvasRef}
            width={140}
            height={42}
            className="block rounded-lg cursor-pointer transition-opacity hover:opacity-95"
            onClick={regenerate}
            title="Click image to refresh CAPTCHA challenge"
            aria-label="Security CAPTCHA verification image"
          />
        </div>

        {/* Action Controls: Refresh & Audio */}
        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={regenerate}
            title="Generate new CAPTCHA challenge"
            aria-label="Generate new CAPTCHA challenge"
            className="p-1.5 rounded-lg bg-slate-100 hover:bg-teal-50 text-slate-600 hover:text-teal-700 border border-slate-200 hover:border-teal-300 transition-all shadow-xs"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isRotating ? 'animate-spin text-teal-600' : ''}`} />
          </button>
          
          <button
            type="button"
            onClick={handleAudioSpeak}
            title="Read CAPTCHA aloud for accessibility"
            aria-label="Read CAPTCHA aloud for accessibility"
            className="p-1.5 rounded-lg bg-slate-100 hover:bg-teal-50 text-slate-600 hover:text-teal-700 border border-slate-200 hover:border-teal-300 transition-all shadow-xs"
          >
            <Volume2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* User Code Input */}
        <div className="relative flex-1">
          <input
            type="text"
            required
            autoComplete="off"
            spellCheck="false"
            maxLength={CODE_LENGTH}
            value={value}
            onChange={handleInputChange}
            placeholder="Enter code"
            className={`w-full px-3 py-2.5 text-xs font-mono font-bold tracking-widest uppercase rounded-xl border bg-slate-50/60 focus:bg-white focus:outline-none transition-all placeholder:normal-case placeholder:tracking-normal placeholder:font-sans placeholder:font-normal ${
              errorMessage
                ? 'border-rose-300 focus:border-rose-500 focus:ring-2 focus:ring-rose-200 text-rose-900 bg-rose-50/20'
                : isVerified
                  ? 'border-emerald-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 text-emerald-900 bg-emerald-50/30'
                  : 'border-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-200 text-slate-800'
            }`}
          />
          {isVerified && (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          )}
        </div>
      </div>

      {/* Dynamic Validation Status / Error Message */}
      {errorMessage ? (
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-rose-600 animate-fadeIn">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      ) : (
        <p className="text-[10px] text-slate-400 font-medium">
          Type the {CODE_LENGTH} characters shown in the graphic image above.
        </p>
      )}
    </div>
  );
});

export default CaptchaBox;
