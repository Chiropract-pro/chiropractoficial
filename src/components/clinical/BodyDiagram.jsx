import { useState } from 'react';
import { Trash2 } from 'lucide-react';

/**
 * Body diagram con silueta anterior/posterior.
 * Click en la silueta agrega un punto de dolor.
 * Cada punto: { side: 'front'|'back', x: 0..1, y: 0..1, intensity: 1..10, type, notes }
 */

const PAIN_TYPES = [
  { value: 'agudo', label: 'Agudo' },
  { value: 'sordo', label: 'Sordo' },
  { value: 'irradiado', label: 'Irradiado' },
  { value: 'punzante', label: 'Punzante' },
  { value: 'ardiente', label: 'Ardiente' },
];

function intensityColor(intensity) {
  if (intensity >= 8) return '#dc2626'; // red-600
  if (intensity >= 5) return '#f59e0b'; // amber-500
  return '#10b981'; // emerald-500
}

// Silueta humana simplificada (anterior y posterior comparten path básico)
function BodySilhouette({ side, points, onAddPoint, onSelectPoint, selectedIdx, readOnly }) {
  const handleClick = (e) => {
    if (readOnly) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    onAddPoint({ side, x, y, intensity: 5, type: 'sordo', notes: '' });
  };

  const filtered = points.map((p, i) => ({ ...p, _idx: i })).filter((p) => p.side === side);

  return (
    <div className="flex-1 flex flex-col items-center">
      <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide mb-2">
        {side === 'front' ? 'Anterior' : 'Posterior'}
      </p>
      <div
        className={`relative w-full max-w-[180px] aspect-[1/2.4] ${readOnly ? '' : 'cursor-crosshair'}`}
        onClick={handleClick}
      >
        <svg viewBox="0 0 100 240" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
          <defs>
            <linearGradient id={`bodyGrad-${side}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#e5e7eb" />
              <stop offset="100%" stopColor="#d1d5db" />
            </linearGradient>
          </defs>
          {/* Cabeza */}
          <ellipse cx="50" cy="18" rx="11" ry="14" fill={`url(#bodyGrad-${side})`} stroke="#9ca3af" strokeWidth="0.5" />
          {/* Cuello */}
          <rect x="46" y="30" width="8" height="6" fill={`url(#bodyGrad-${side})`} stroke="#9ca3af" strokeWidth="0.5" />
          {/* Torso */}
          <path
            d="M 30 38 Q 28 42 28 50 L 26 88 Q 26 100 30 110 L 35 130 L 65 130 L 70 110 Q 74 100 74 88 L 72 50 Q 72 42 70 38 Z"
            fill={`url(#bodyGrad-${side})`}
            stroke="#9ca3af"
            strokeWidth="0.5"
          />
          {/* Brazo izq (desde la perspectiva del visor, derecho del paciente si es 'front') */}
          <path
            d="M 28 40 Q 22 50 18 70 Q 15 90 14 110 Q 13 120 16 122 Q 19 118 22 108 Q 26 90 28 70 Z"
            fill={`url(#bodyGrad-${side})`}
            stroke="#9ca3af"
            strokeWidth="0.5"
          />
          {/* Brazo der */}
          <path
            d="M 72 40 Q 78 50 82 70 Q 85 90 86 110 Q 87 120 84 122 Q 81 118 78 108 Q 74 90 72 70 Z"
            fill={`url(#bodyGrad-${side})`}
            stroke="#9ca3af"
            strokeWidth="0.5"
          />
          {/* Pierna izq */}
          <path
            d="M 35 130 L 33 170 L 35 210 L 42 230 L 46 230 L 47 210 L 48 170 L 48 130 Z"
            fill={`url(#bodyGrad-${side})`}
            stroke="#9ca3af"
            strokeWidth="0.5"
          />
          {/* Pierna der */}
          <path
            d="M 65 130 L 67 170 L 65 210 L 58 230 L 54 230 L 53 210 L 52 170 L 52 130 Z"
            fill={`url(#bodyGrad-${side})`}
            stroke="#9ca3af"
            strokeWidth="0.5"
          />

          {/* Puntos de dolor */}
          {filtered.map((p) => (
            <g key={p._idx} onClick={(e) => { e.stopPropagation(); onSelectPoint(p._idx); }} style={{ cursor: 'pointer' }}>
              <circle
                cx={p.x * 100}
                cy={p.y * 240}
                r={selectedIdx === p._idx ? 5 : 4}
                fill={intensityColor(p.intensity)}
                stroke="white"
                strokeWidth="1.5"
                opacity={0.9}
              />
              <text
                x={p.x * 100}
                y={p.y * 240 + 1.5}
                textAnchor="middle"
                fontSize="4.5"
                fontWeight="bold"
                fill="white"
                pointerEvents="none"
              >
                {p.intensity}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}

export default function BodyDiagram({ value = [], onChange, readOnly = false }) {
  const [selectedIdx, setSelectedIdx] = useState(null);

  const updatePoint = (idx, patch) => {
    const next = value.map((p, i) => (i === idx ? { ...p, ...patch } : p));
    onChange(next);
  };

  const removePoint = (idx) => {
    onChange(value.filter((_, i) => i !== idx));
    setSelectedIdx(null);
  };

  const addPoint = (point) => {
    onChange([...(value || []), point]);
    setSelectedIdx(value.length); // auto-select recién agregado
  };

  const selected = selectedIdx != null ? value[selectedIdx] : null;

  return (
    <div className="space-y-3">
      <div className="flex gap-3 bg-surface-container-low rounded-xl p-3">
        <BodySilhouette
          side="front"
          points={value}
          onAddPoint={addPoint}
          onSelectPoint={setSelectedIdx}
          selectedIdx={selectedIdx}
          readOnly={readOnly}
        />
        <BodySilhouette
          side="back"
          points={value}
          onAddPoint={addPoint}
          onSelectPoint={setSelectedIdx}
          selectedIdx={selectedIdx}
          readOnly={readOnly}
        />
      </div>

      {!readOnly && !selected && (value?.length === 0) && (
        <p className="text-xs text-on-surface-variant text-center">
          Click en la silueta para marcar un punto de dolor.
        </p>
      )}

      {/* Editor del punto seleccionado */}
      {selected && !readOnly && (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide">
              Punto #{selectedIdx + 1} · {selected.side === 'front' ? 'Anterior' : 'Posterior'}
            </span>
            <button
              onClick={() => removePoint(selectedIdx)}
              className="text-error hover:bg-error-container/30 p-1 rounded"
              title="Eliminar punto"
            >
              <Trash2 size={14} />
            </button>
          </div>

          <div>
            <label className="text-xs text-on-surface-variant block mb-1">
              Intensidad: <span className="font-bold text-on-surface">{selected.intensity}/10</span>
            </label>
            <input
              type="range"
              min={1}
              max={10}
              value={selected.intensity}
              onChange={(e) => updatePoint(selectedIdx, { intensity: parseInt(e.target.value) })}
              className="w-full accent-primary"
            />
          </div>

          <div>
            <label className="text-xs text-on-surface-variant block mb-1">Tipo</label>
            <select
              value={selected.type}
              onChange={(e) => updatePoint(selectedIdx, { type: e.target.value })}
              className="w-full px-2 py-1.5 rounded border border-outline-variant bg-surface-container-lowest text-on-surface text-sm"
            >
              {PAIN_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-on-surface-variant block mb-1">Notas</label>
            <input
              type="text"
              value={selected.notes || ''}
              onChange={(e) => updatePoint(selectedIdx, { notes: e.target.value })}
              maxLength={120}
              placeholder="Ej: irradia hacia pierna derecha"
              className="w-full px-2 py-1.5 rounded border border-outline-variant bg-surface-container-lowest text-on-surface text-sm"
            />
          </div>
        </div>
      )}

      {/* Lista de puntos cuando hay varios */}
      {value.length > 0 && (
        <div className="bg-surface-container-low rounded-xl p-2 space-y-1">
          {value.map((p, i) => (
            <button
              key={i}
              onClick={() => setSelectedIdx(i === selectedIdx ? null : i)}
              className={`w-full text-left px-2 py-1.5 rounded text-xs flex items-center gap-2 ${
                i === selectedIdx ? 'bg-primary/10 ring-1 ring-primary' : 'hover:bg-surface-container'
              }`}
            >
              <span
                className="inline-block w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: intensityColor(p.intensity) }}
              />
              <span className="font-semibold text-on-surface">#{i + 1}</span>
              <span className="text-on-surface-variant">
                {p.side === 'front' ? 'Anterior' : 'Posterior'} · {p.type} · {p.intensity}/10
              </span>
              {p.notes && <span className="text-on-surface-variant truncate flex-1">— {p.notes}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
