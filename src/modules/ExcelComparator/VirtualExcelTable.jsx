import React, { useState, useEffect, useRef, useMemo } from 'react';
import DiffTooltip from '../../components/common/DiffTooltip';

const VirtualExcelTable = ({ columns, rows, showDiffOnly }) => {
    const [scrollTop, setScrollTop] = useState(0);
    const [containerHeight, setContainerHeight] = useState(600); // 默认高度
    const [hoveredTooltip, setHoveredTooltip] = useState(null); // Tooltip state
    
    const rowHeight = 40; 
    const visibleCount = 20; 
    const buffer = 10; 

    const displayRows = useMemo(() => {
        if (!showDiffOnly) return rows;
        return rows.filter(r => r.type !== 'same');
    }, [rows, showDiffOnly]);
    
    // 当 rows 改变时（例如切换 Sheet），重置滚动状态
    useEffect(() => {
        setScrollTop(0);
        if (leftRef.current) leftRef.current.scrollTop = 0;
        if (rightRef.current) rightRef.current.scrollTop = 0;
    }, [rows]);

    // 使用 leftRef 来测量容器实际高度
    useEffect(() => {
        const updateHeight = () => {
             if (leftRef.current) {
                 setContainerHeight(leftRef.current.clientHeight);
             }
        };
        
        // 初始测量
        updateHeight();
        
        // 监听 resize
        const observer = new ResizeObserver(updateHeight);
        if (leftRef.current) observer.observe(leftRef.current);
        
        return () => observer.disconnect();
    }, []);

    const totalHeight = displayRows.length * rowHeight;
    const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - buffer);
    // 使用动态测量的 containerHeight 计算结束索引
    const endIndex = Math.min(displayRows.length, Math.ceil((scrollTop + containerHeight) / rowHeight) + buffer);
    
    const visibleRows = displayRows.slice(startIndex, endIndex);
    const offsetY = startIndex * rowHeight;

    const handleScroll = (e) => {
        setScrollTop(e.target.scrollTop);
        // Hide tooltip on scroll to prevent misalignment
        if(hoveredTooltip) setHoveredTooltip(null);
    };

    const leftRef = useRef(null);
    const rightRef = useRef(null);
    const isSyncingLeft = useRef(false);
    const isSyncingRight = useRef(false);

    const onLeftScroll = (e) => {
        if (!isSyncingLeft.current) {
            isSyncingRight.current = true;
            if (rightRef.current) {
                rightRef.current.scrollTop = e.target.scrollTop;
                rightRef.current.scrollLeft = e.target.scrollLeft;
            }
        }
        isSyncingLeft.current = false;
        handleScroll(e);
    };

    const onRightScroll = (e) => {
        if (!isSyncingRight.current) {
            isSyncingLeft.current = true;
            if (leftRef.current) {
                leftRef.current.scrollTop = e.target.scrollTop;
                leftRef.current.scrollLeft = e.target.scrollLeft;
            }
        }
        isSyncingRight.current = false;
        handleScroll(e);
    };

    // Tooltip Handlers
    const handleCellMouseEnter = (e, row, cIdx) => {
        if (row.type === 'modify' && row.diffs && row.diffs[cIdx]) {
            const rect = e.target.getBoundingClientRect();
            setHoveredTooltip({
                x: rect.left + rect.width / 2,
                y: rect.top,
                oldVal: row.diffs[cIdx].old,
                newVal: row.diffs[cIdx].new
            });
        }
    };

    const handleCellMouseLeave = () => {
        setHoveredTooltip(null);
    };

    return (
        <div className="flex flex-1 h-full overflow-hidden border-t border-slate-200 relative">
            {/* Tooltip Rendered at Root of Table */}
            <DiffTooltip data={hoveredTooltip} />

            {/* Left Panel: Base */}
            <div className="flex-1 flex flex-col border-r border-slate-300 min-w-0 bg-slate-50">
                <div className="bg-slate-100 p-2 text-xs font-bold text-slate-500 uppercase border-b border-slate-200 sticky top-0 z-10 flex justify-between">
                    <span>基准文件 (Base)</span>
                    <span className="text-slate-400 font-normal">Total: {displayRows.length}</span>
                </div>
                <div 
                    ref={leftRef}
                    className="flex-1 overflow-auto relative custom-scrollbar"
                    onScroll={onLeftScroll}
                >
                    <div style={{ height: totalHeight, position: 'relative' }}>
                        <div style={{ transform: `translateY(${offsetY}px)` }}>
                            <table className="w-full table-fixed border-collapse">
                                <colgroup>
                                    <col className="w-12" /> 
                                    {columns.map((_, i) => <col key={i} className="w-32" />)}
                                </colgroup>
                                <thead>
                                    <tr className="h-10 bg-slate-100 border-b border-slate-200">
                                        <th className="sticky top-0 left-0 bg-slate-100 z-30 border-r border-slate-200">#</th>
                                        {columns.map((c, i) => (
                                            <th key={i} className="px-2 py-1 text-left text-xs font-semibold text-slate-600 truncate border-r border-slate-200 sticky top-0 bg-slate-100 z-20" title={c}>{c}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {visibleRows.map((row, idx) => {
                                        const realIndex = startIndex + idx;
                                        const isRemove = row.type === 'remove';
                                        const isModify = row.type === 'modify';
                                        const isEmpty = row.type === 'add'; 
                                        
                                        let bgClass = 'bg-white';
                                        if (isRemove) bgClass = 'bg-red-50';
                                        if (isModify) bgClass = 'bg-yellow-50';
                                        if (isEmpty) bgClass = 'bg-slate-50/50';

                                        return (
                                            <tr key={realIndex} className={`h-10 border-b border-slate-100 text-sm ${bgClass}`}>
                                                <td className="text-center text-xs text-slate-400 border-r border-slate-200 select-none bg-slate-50 sticky left-0 z-10">
                                                    {isEmpty ? '-' : realIndex + 1}
                                                </td>
                                                {isEmpty ? (
                                                    <td colSpan={columns.length} className="px-4 text-xs text-slate-300 italic text-center select-none">
                                                        (此行在基准文件中不存在)
                                                    </td>
                                                ) : (
                                                    columns.map((col, cIdx) => {
                                                        const cellVal = row.base ? row.base[cIdx] : '';
                                                        const isCellDiff = row.diffs && row.diffs[cIdx];
                                                        return (
                                                            <td 
                                                                key={cIdx} 
                                                                className={`px-2 py-1 border-r border-slate-100 truncate relative group cursor-default ${isCellDiff ? 'bg-yellow-100 text-yellow-900 font-medium' : 'text-slate-600'}`}
                                                                onMouseEnter={(e) => handleCellMouseEnter(e, row, cIdx)}
                                                                onMouseLeave={handleCellMouseLeave}
                                                            >
                                                                <span className="block truncate" title={String(cellVal)}>{cellVal}</span>
                                                            </td>
                                                        );
                                                    })
                                                )}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Panel: Target */}
            <div className="flex-1 flex flex-col min-w-0 bg-white">
                <div className="bg-slate-100 p-2 text-xs font-bold text-slate-500 uppercase border-b border-slate-200 sticky top-0 z-10 flex justify-between">
                    <span>目标文件 (Target)</span>
                </div>
                <div 
                    ref={rightRef}
                    className="flex-1 overflow-auto relative custom-scrollbar"
                    onScroll={onRightScroll}
                >
                    <div style={{ height: totalHeight, position: 'relative' }}>
                        <div style={{ transform: `translateY(${offsetY}px)` }}>
                            <table className="w-full table-fixed border-collapse">
                                <colgroup>
                                    <col className="w-12" />
                                    {columns.map((_, i) => <col key={i} className="w-32" />)}
                                </colgroup>
                                <thead>
                                    <tr className="h-10 bg-slate-100 border-b border-slate-200">
                                        <th className="sticky top-0 left-0 bg-slate-100 z-30 border-r border-slate-200">#</th>
                                        {columns.map((c, i) => (
                                            <th key={i} className="px-2 py-1 text-left text-xs font-semibold text-slate-600 truncate border-r border-slate-200 sticky top-0 bg-slate-100 z-20" title={c}>{c}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {visibleRows.map((row, idx) => {
                                        const realIndex = startIndex + idx;
                                        const isAdd = row.type === 'add';
                                        const isModify = row.type === 'modify';
                                        const isEmpty = row.type === 'remove'; 
                                        
                                        let bgClass = 'bg-white';
                                        if (isAdd) bgClass = 'bg-emerald-50';
                                        if (isModify) bgClass = 'bg-yellow-50';
                                        if (isEmpty) bgClass = 'bg-slate-50/50';

                                        return (
                                            <tr key={realIndex} className={`h-10 border-b border-slate-100 text-sm ${bgClass}`}>
                                                <td className="text-center text-xs text-slate-400 border-r border-slate-200 select-none bg-slate-50 sticky left-0 z-10">
                                                    {isEmpty ? '-' : realIndex + 1}
                                                </td>
                                                {isEmpty ? (
                                                    <td colSpan={columns.length} className="px-4 text-xs text-slate-300 italic text-center select-none">
                                                        (此行已删除)
                                                    </td>
                                                ) : (
                                                    columns.map((col, cIdx) => {
                                                        const cellVal = row.target ? row.target[cIdx] : '';
                                                        const isCellDiff = row.diffs && row.diffs[cIdx];
                                                        return (
                                                            <td 
                                                                key={cIdx} 
                                                                className={`px-2 py-1 border-r border-slate-100 truncate relative group cursor-default ${isCellDiff ? 'bg-yellow-100 text-yellow-900 font-medium' : 'text-slate-600'}`}
                                                                onMouseEnter={(e) => handleCellMouseEnter(e, row, cIdx)}
                                                                onMouseLeave={handleCellMouseLeave}
                                                            >
                                                                <span className="block truncate" title={String(cellVal)}>{cellVal}</span>
                                                            </td>
                                                        );
                                                    })
                                                )}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VirtualExcelTable;