import React, { useState, useEffect, useMemo } from 'react';
import { 
    Database, Search, CheckCircle, Settings, RotateCcw, 
    ChevronLeft, ChevronRight as ChevronRightIcon 
} from 'lucide-react';
import ResizableSidebar from '../../components/common/ResizableSidebar';

const SqlReportView = ({ comparisonResults, parsedData, activeTable, setActiveTable, setStep, sidebarWidth, setSidebarWidth }) => {
    const [filterDiffOnly, setFilterDiffOnly] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 50;

    const tableList = Object.keys(comparisonResults).map(table => {
        const r = comparisonResults[table];
        const hasDiff = r.added.length > 0 || r.removed.length > 0 || r.changed.length > 0;
        const totalDiff = r.added.length + r.removed.length + r.changed.length;
        return { name: table, hasDiff, totalDiff, details: r };
    }).filter(item => {
        if (filterDiffOnly && !item.hasDiff) return false;
        if (searchTerm && !item.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
        return true;
    });

    useEffect(() => {
        if (tableList.length > 0) {
             const currentInList = tableList.find(t => t.name === activeTable);
             if (!currentInList) {
                 setActiveTable(tableList[0].name);
                 setCurrentPage(1); 
             }
        }
    }, [filterDiffOnly, searchTerm]);

    const handleSwitchTable = (table) => {
        setActiveTable(table);
        setCurrentPage(1);
    }

    const activeResult = comparisonResults[activeTable];
    const activeColumns = parsedData.db1.schema[activeTable];

    const allDiffRows = useMemo(() => {
        if (!activeResult) return [];
        const rows = [];
        activeResult.changed.forEach(r => rows.push({ type: 'mod', data: r }));
        activeResult.added.forEach(r => rows.push({ type: 'add', data: r }));
        activeResult.removed.forEach(r => rows.push({ type: 'rem', data: r }));
        return rows;
    }, [activeResult]);

    const totalPages = Math.ceil(allDiffRows.length / pageSize);
    const currentRows = allDiffRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    const renderDiffCell = (row, col) => {
        if (row.diffs && row.diffs[col]) {
             return <div className="flex flex-col text-xs"><span className="bg-red-100 text-red-800 px-1 rounded line-through decoration-red-500 mb-0.5 w-fit break-all">{String(row.diffs[col].old)}</span><span className="bg-emerald-100 text-emerald-800 px-1 rounded font-medium w-fit break-all">{String(row.diffs[col].new)}</span></div>
        }
        let val = row[col];
        if (row.pk) val = row.pk[col];
        if (val === null || val === undefined) return <span className="text-slate-300 italic">null</span>;
        return <span className="text-slate-600 truncate max-w-[200px] block" title={String(val)}>{String(val)}</span>;
    };

    return (
      <div className="flex flex-1 w-full h-full bg-white rounded-xl shadow-lg border border-slate-100 overflow-hidden animate-in fade-in zoom-in duration-300">
        <ResizableSidebar width={sidebarWidth} setWidth={setSidebarWidth}>
            <div className="p-4 border-b border-slate-200 bg-white shrink-0">
                <h3 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
                    <Database className="w-4 h-4" /> 差异报告概览
                </h3>
                <div className="space-y-3">
                    <div className="relative">
                        <Search className="absolute left-2 top-2.5 w-4 h-4 text-slate-400" />
                        <input 
                            type="text" 
                            placeholder="搜索表名..." 
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                    </div>
                    <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
                        <input 
                            type="checkbox" 
                            checked={filterDiffOnly}
                            onChange={e => setFilterDiffOnly(e.target.checked)}
                            className="rounded text-emerald-600 focus:ring-emerald-500"
                        />
                        仅显示有差异的表
                    </label>
                </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {tableList.map(item => (
                    <button 
                        key={item.name} 
                        onClick={() => handleSwitchTable(item.name)}
                        className={`w-full text-left px-3 py-3 rounded-lg text-sm flex items-center justify-between transition-all ${activeTable === item.name ? 'bg-white shadow-md border border-slate-100 ring-1 ring-emerald-500/20' : 'hover:bg-slate-200/50 border border-transparent'}`}
                    >
                        <div className="flex items-center gap-2 overflow-hidden">
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${item.hasDiff ? 'bg-red-500' : 'bg-emerald-500'}`}></span>
                            <span className={`truncate font-medium ${activeTable === item.name ? 'text-slate-800' : 'text-slate-600'}`}>{item.name}</span>
                        </div>
                        {item.hasDiff ? (
                            <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full font-bold">{item.totalDiff}</span>
                        ) : (
                            <CheckCircle className="w-4 h-4 text-emerald-400 opacity-50" />
                        )}
                    </button>
                ))}
            </div>
            
            <div className="p-4 border-t border-slate-200 bg-slate-50 space-y-3 shrink-0">
                 <button onClick={() => setStep('config')} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all shadow-sm">
                    <Settings className="w-4 h-4" /> 返回调整配置
                 </button>
                 <button onClick={() => setStep('connect')} className="w-full bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all">
                    <RotateCcw className="w-4 h-4" /> 上传新文件
                 </button>
            </div>
        </ResizableSidebar>

        <div className="flex-1 flex flex-col bg-slate-50/30 min-w-0">
            {activeTable && activeResult ? (
                <>
                    <div className="p-6 border-b border-slate-200 bg-white flex justify-between items-center shadow-sm z-10 shrink-0">
                        <div>
                            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                <span className="font-mono text-emerald-700">{activeTable}</span>
                                {activeResult.added.length + activeResult.removed.length + activeResult.changed.length > 0 ? 
                                    <span className="bg-red-100 text-red-700 text-xs px-2 py-1 rounded-md font-medium">存在差异</span> : 
                                    <span className="bg-emerald-100 text-emerald-700 text-xs px-2 py-1 rounded-md font-medium">数据一致</span>
                                }
                            </h2>
                            <div className="flex gap-4 mt-2 text-sm text-slate-500">
                                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> 新增: <span className="font-mono font-medium text-slate-700">{activeResult.added.length}</span></div>
                                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500"></span> 删除: <span className="font-mono font-medium text-slate-700">{activeResult.removed.length}</span></div>
                                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500"></span> 变更: <span className="font-mono font-medium text-slate-700">{activeResult.changed.length}</span></div>
                                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-slate-300"></span> 相同: <span className="font-mono font-medium text-slate-700">{activeResult.identicalCount}</span></div>
                            </div>
                        </div>
                        
                        {totalPages > 1 && (
                            <div className="flex items-center gap-2 text-sm">
                                <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="p-1 rounded hover:bg-slate-100 disabled:opacity-30"><ChevronLeft className="w-5 h-5"/></button>
                                <span className="text-slate-600 font-medium">Page {currentPage} / {totalPages}</span>
                                <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="p-1 rounded hover:bg-slate-100 disabled:opacity-30"><ChevronRightIcon className="w-5 h-5"/></button>
                            </div>
                        )}
                    </div>
                    
                    <div className="flex-1 overflow-auto p-6">
                        <div className="bg-white rounded-lg shadow border border-slate-200 overflow-hidden inline-block min-w-full align-middle">
                            <table className="min-w-full text-left border-collapse">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase w-20 tracking-wider sticky top-0 bg-slate-50 z-10">状态</th>
                                        {activeColumns && activeColumns.map(col => (
                                            <th key={col} className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase border-l border-slate-100 whitespace-nowrap min-w-[100px] sticky top-0 bg-slate-50 z-10">{col}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="text-sm divide-y divide-slate-100">
                                    {currentRows.map((item, idx) => {
                                        const { type, data } = item;
                                        if (type === 'mod') {
                                            return (
                                                <tr key={`mod-${idx}`} className="bg-amber-50/60 hover:bg-amber-100/50 transition-colors">
                                                    <td className="px-4 py-3 font-bold text-amber-600 text-xs">变更</td>
                                                    {activeColumns.map(col => (
                                                        <td key={col} className="px-4 py-3 border-l border-slate-200/50">
                                                            {renderDiffCell(data, col)}
                                                        </td>
                                                    ))}
                                                </tr>
                                            );
                                        } else if (type === 'add') {
                                            return (
                                                <tr key={`add-${idx}`} className="bg-emerald-50/60 hover:bg-emerald-100/50 transition-colors">
                                                    <td className="px-4 py-3 font-bold text-emerald-600 text-xs">新增</td>
                                                    {activeColumns.map(col => (
                                                        <td key={col} className="px-4 py-3 border-l border-slate-200/50 text-slate-700">
                                                            {data[col] === null ? <span className="text-slate-300 italic">null</span> : String(data[col])}
                                                        </td>
                                                    ))}
                                                </tr>
                                            );
                                        } else { 
                                            return (
                                                <tr key={`rem-${idx}`} className="bg-red-50/60 hover:bg-red-100/50 transition-colors">
                                                    <td className="px-4 py-3 font-bold text-red-600 text-xs">删除</td>
                                                    {activeColumns.map(col => (
                                                        <td key={col} className="px-4 py-3 border-l border-slate-200/50 text-slate-400">
                                                            <span className="line-through decoration-red-300 decoration-2">{data[col] === null ? 'null' : String(data[col])}</span>
                                                        </td>
                                                    ))}
                                                </tr>
                                            );
                                        }
                                    })}
                                    
                                    {currentRows.length === 0 && (
                                        <tr>
                                            <td colSpan={100} className="py-20 text-center text-slate-400 flex flex-col items-center justify-center">
                                                <CheckCircle className="w-12 h-12 text-emerald-200 mb-2" />
                                                <p>数据完全一致</p>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            ) : (
                <div className="flex-1 flex items-center justify-center text-slate-400">
                    <p>请选择一个表格查看详情</p>
                </div>
            )}
        </div>
      </div>
    );
};

export default SqlReportView;