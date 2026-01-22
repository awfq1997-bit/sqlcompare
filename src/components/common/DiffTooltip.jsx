// src/components/common/DiffTooltip.jsx
import React from 'react';
import { ChevronRight as ChevronRightIcon } from 'lucide-react';

const DiffTooltip = ({ data }) => {
    if (!data) return null;
    const { x, y, oldVal, newVal } = data;
    
    return (
        <div 
            className="fixed z-50 bg-white border border-slate-200 rounded-lg shadow-xl p-3 text-sm animate-in fade-in zoom-in-95 duration-150 pointer-events-none max-w-xs"
            style={{ top: y - 10, left: x, transform: 'translate(-50%, -100%)' }}
        >
            <div className="flex flex-col gap-2">
                <div className="bg-red-50 text-red-800 px-2 py-1 rounded border border-red-100">
                    <span className="text-xs font-bold text-red-500 block mb-0.5">变更前 (Old):</span>
                    <span className="break-words font-mono">{String(oldVal)}</span>
                </div>
                <div className="flex justify-center">
                    <div className="bg-slate-100 rounded-full p-0.5">
                        <ChevronRightIcon className="w-3 h-3 text-slate-400 rotate-90" />
                    </div>
                </div>
                <div className="bg-emerald-50 text-emerald-800 px-2 py-1 rounded border border-emerald-100">
                    <span className="text-xs font-bold text-emerald-500 block mb-0.5">变更后 (New):</span>
                    <span className="break-words font-mono">{String(newVal)}</span>
                </div>
            </div>
            {/* Arrow */}
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-3 h-3 bg-white border-b border-r border-slate-200 rotate-45"></div>
        </div>
    );
};

export default DiffTooltip;