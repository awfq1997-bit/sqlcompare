import React, { useState } from 'react';
import { 
    CheckCircle, AlertCircle, AlertTriangle, Wand2, Filter, 
    Download, UploadCloud, Play, Settings
} from 'lucide-react';
import ResizableSidebar from '../../components/common/ResizableSidebar';
import { getLevenshteinDistance } from '../../utils/helpers';
import { compareTableData } from './utils';

const SqlConfigView = ({ 
    parsedData, tableConfigs, setTableConfigs, 
    activeTable, setActiveTable, 
    selectedTables, setSelectedTables,
    columnRegex, setColumnRegex,
    sidebarWidth, setSidebarWidth,
    isProcessing, setIsProcessing, setComparisonResults, setStep 
}) => {
    const columns = parsedData.db1.schema[activeTable] || [];
    const currentConfig = tableConfigs[activeTable] || { pks: [], ignore: [] };
    const currentRegex = columnRegex[activeTable] || {};
    const commonTables = Object.keys(tableConfigs);
    const db1RowCount = parsedData.db1.tables[activeTable]?.length || 0;
    const db2RowCount = parsedData.db2.tables[activeTable]?.length || 0;

    const [pkMatchKeyword, setPkMatchKeyword] = useState('');
    const [globalIgnoreKeyword, setGlobalIgnoreKeyword] = useState('');

    const toggleConfig = (type, col) => {
      setTableConfigs(prev => {
        const tableConf = prev[activeTable];
        const list = tableConf[type];
        const newList = list.includes(col) ? list.filter(c => c !== col) : [...list, col];
        let newConfig = { ...tableConf, [type]: newList };
        if (type === 'pks' && newList.includes(col)) newConfig.ignore = newConfig.ignore.filter(c => c !== col);
        if (type === 'ignore' && newList.includes(col)) newConfig.pks = newConfig.pks.filter(c => c !== col);
        return { ...prev, [activeTable]: newConfig };
      });
    };

    const handleRegexChange = (col, value) => {
        setColumnRegex(prev => ({
            ...prev,
            [activeTable]: {
                ...prev[activeTable],
                [col]: value
            }
        }));
    };

    const handleBatchGlobalIgnore = () => {
        if (!globalIgnoreKeyword.trim()) return;
        const ignoreList = globalIgnoreKeyword.split(/[,，\s]+/).map(s => s.trim().toLowerCase()).filter(s => s);
        if (ignoreList.length === 0) return;

        setTableConfigs(prevConfigs => {
            const newConfigs = { ...prevConfigs };
            Object.keys(newConfigs).forEach(table => {
                const schema = parsedData.db1.schema[table] || [];
                const currentIgnore = new Set(newConfigs[table].ignore);
                const currentPks = new Set(newConfigs[table].pks);
                schema.forEach(col => {
                    const colLower = col.toLowerCase();
                    if (ignoreList.includes(colLower) && !currentPks.has(col)) {
                        currentIgnore.add(col);
                    }
                });
                newConfigs[table] = { ...newConfigs[table], ignore: Array.from(currentIgnore) };
            });
            return newConfigs;
        });
        alert(`已尝试将 [${ignoreList.join(', ')}] 应用于所有表格的忽略列表`);
    };

    const exportConfig = () => {
        const configData = {
            tableConfigs,
            selectedTables: Array.from(selectedTables),
            columnRegex
        };
        const blob = new Blob([JSON.stringify(configData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'db-diff-config.json';
        a.click();
    };

    const importConfig = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                if (data.tableConfigs) setTableConfigs(data.tableConfigs);
                if (data.selectedTables) setSelectedTables(new Set(data.selectedTables));
                if (data.columnRegex) setColumnRegex(data.columnRegex);
                alert("配置导入成功！");
            } catch (err) {
                alert("配置文件格式错误");
            }
        };
        reader.readAsText(file);
    };

    const toggleAllIgnore = (e) => {
        const shouldSelectAll = e.target.checked;
        setTableConfigs(prev => {
            const tableConf = prev[activeTable];
            const availableCols = columns.filter(c => !tableConf.pks.includes(c));
            return {
                ...prev,
                [activeTable]: {
                    ...tableConf,
                    ignore: shouldSelectAll ? availableCols : []
                }
            };
        });
    };
    
    const isAllIgnored = columns.length > 0 && columns.filter(c => !currentConfig.pks.includes(c)).every(c => currentConfig.ignore.includes(c));
    const isIndeterminateIgnore = columns.some(c => currentConfig.ignore.includes(c)) && !isAllIgnored;

    const toggleTableSelection = (table) => {
        const newSet = new Set(selectedTables);
        if (newSet.has(table)) {
            newSet.delete(table);
        } else {
            newSet.add(table);
        }
        setSelectedTables(newSet);
    };

    const toggleAllTables = (e) => {
        if (e.target.checked) {
            setSelectedTables(new Set(commonTables));
        } else {
            setSelectedTables(new Set());
        }
    };
    
    const isAllTablesSelected = commonTables.length > 0 && selectedTables.size === commonTables.length;
    const isIndeterminateTables = selectedTables.size > 0 && selectedTables.size < commonTables.length;

    const handleRunCompare = () => {
      if (selectedTables.size === 0) {
          alert("请至少选择一个表格进行对比");
          return;
      }
      setIsProcessing(true);
      setTimeout(() => {
        try {
            const results = {};
            Array.from(selectedTables).forEach(table => {
              results[table] = compareTableData(
                  table, 
                  tableConfigs[table], 
                  parsedData.db1.tables[table] || [], 
                  parsedData.db2.tables[table] || [],
                  columnRegex
              );
            });
            setComparisonResults(results);
            setStep('report');
        } catch(e) {
            console.error(e);
            alert("对比出错: " + e.message);
        } finally {
            setIsProcessing(false);
        }
      }, 100);
    };

    const batchAutoConfigure = () => {
        if (selectedTables.size === 0) {
             alert("请先勾选需要推断的表格");
             return;
        }
        const newConfigs = { ...tableConfigs };
        const keyword = pkMatchKeyword.trim().toLowerCase();
        Array.from(selectedTables).forEach(table => {
            const tableCols = parsedData.db1.schema[table] || [];
            let finalPks = [];
            if (keyword && tableCols.length > 0) {
                const scoredColumns = tableCols.map(col => {
                    const colLower = col.toLowerCase();
                    let score = 0;
                    if (colLower.includes(keyword)) score += 100;
                    const dist = getLevenshteinDistance(colLower, keyword);
                    score -= dist;
                    return { col, score };
                });
                scoredColumns.sort((a, b) => b.score - a.score);
                if (scoredColumns.length > 0) {
                    finalPks = [scoredColumns[0].col];
                }
            }
            if (finalPks.length === 0) {
                 const detectedPks = parsedData.db1.realPks[table] || [];
                 finalPks = [...detectedPks];
                 if (finalPks.length === 0 && tableCols.length > 0) {
                      const guess = tableCols.find(c => /^(id|uuid|code|_id)$/i.test(c)) || tableCols[0];
                      if (guess) finalPks = [guess];
                 }
            }
            newConfigs[table] = { pks: finalPks, ignore: [] };
        });
        setTableConfigs(newConfigs);
    };

    return (
      <div className="flex h-[calc(100vh-140px)] bg-white rounded-xl shadow-lg border border-slate-100 overflow-hidden animate-in fade-in zoom-in duration-300">
        <ResizableSidebar width={sidebarWidth} setWidth={setSidebarWidth}>
          <div className="p-4 border-b border-slate-200 font-semibold text-slate-700 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
                <input 
                    type="checkbox"
                    checked={isAllTablesSelected}
                    ref={input => { if (input) input.indeterminate = isIndeterminateTables; }}
                    onChange={toggleAllTables}
                    className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                />
                <span className="whitespace-nowrap">表列表 ({selectedTables.size})</span>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {commonTables.map(table => (
              <div 
                key={table} 
                onClick={() => setActiveTable(table)}
                className={`w-full px-3 py-2 rounded-lg text-sm flex items-center gap-2 cursor-pointer transition-colors ${activeTable === table ? 'bg-white shadow text-blue-600 font-medium' : 'text-slate-600 hover:bg-slate-200'}`}
              >
                <input 
                    type="checkbox"
                    checked={selectedTables.has(table)}
                    onChange={(e) => { e.stopPropagation(); toggleTableSelection(table); }}
                    className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer shrink-0"
                />
                <div className="flex-1 flex justify-between items-center overflow-hidden">
                    <span className="truncate" title={table}>{table}</span>
                    {tableConfigs[table]?.pks?.length > 0 ? <CheckCircle className="w-3 h-3 text-emerald-500 shrink-0" /> : <AlertCircle className="w-3 h-3 text-amber-500 shrink-0" />}
                </div>
              </div>
            ))}
          </div>
        </ResizableSidebar>

        <div className="flex-1 flex flex-col min-w-0">
          <div className="p-4 border-b border-slate-100 bg-white space-y-4 shrink-0">
             <div className="flex justify-between items-center">
                 <div>
                    <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                      <Settings className="w-5 h-5 text-slate-500" />
                      配置: <span className="text-blue-600 font-mono">{activeTable}</span>
                    </h3>
                    <div className="flex items-center gap-4 mt-1 text-xs text-slate-500">
                        <span>行数: {db1RowCount} vs {db2RowCount}</span>
                        {currentConfig.pks.length === 0 && <span className="text-amber-600 font-bold flex items-center gap-1"><AlertTriangle className="w-3 h-3"/> 未设置主键！</span>}
                    </div>
                 </div>
                 <div className="flex gap-2">
                     <button onClick={exportConfig} className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1.5 rounded text-xs flex items-center gap-1">
                        <Download className="w-3 h-3" /> 导出配置
                     </button>
                     <label className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1.5 rounded text-xs flex items-center gap-1 cursor-pointer">
                        <UploadCloud className="w-3 h-3" /> 导入配置
                        <input type="file" onChange={importConfig} accept=".json" className="hidden" />
                     </label>
                     <button onClick={handleRunCompare} disabled={isProcessing} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 rounded font-semibold flex items-center gap-2 shadow-sm">
                        {isProcessing ? '计算中...' : '开始对比'} {!isProcessing && <Play className="w-4 h-4 fill-current" />}
                     </button>
                 </div>
             </div>

             <div className="flex flex-wrap items-center gap-4 text-sm bg-slate-50 p-2 rounded-lg border border-slate-200">
                 <div className="flex items-center gap-2 border-r border-slate-300 pr-4">
                    <span className="text-slate-500 font-medium">PK智能推断:</span>
                    <input 
                        type="text" 
                        placeholder="关键词(如id)" 
                        value={pkMatchKeyword}
                        onChange={(e) => setPkMatchKeyword(e.target.value)}
                        className="w-24 px-2 py-1 text-xs border rounded focus:ring-1 outline-none"
                    />
                    <button onClick={batchAutoConfigure} className="text-blue-600 hover:underline flex items-center gap-1">
                        <Wand2 className="w-3 h-3" /> 应用选中表
                    </button>
                 </div>

                 <div className="flex items-center gap-2">
                    <span className="text-slate-500 font-medium">批量忽略字段:</span>
                    <input 
                        type="text" 
                        placeholder="字段名, 逗号分隔" 
                        value={globalIgnoreKeyword}
                        onChange={(e) => setGlobalIgnoreKeyword(e.target.value)}
                        className="w-40 px-2 py-1 text-xs border rounded focus:ring-1 outline-none"
                    />
                    <button onClick={handleBatchGlobalIgnore} className="text-gray-600 hover:underline flex items-center gap-1">
                        <Filter className="w-3 h-3" /> 应用全部表
                    </button>
                 </div>
             </div>
          </div>
          
          <div className="flex-1 overflow-auto p-6 bg-slate-50/50">
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden inline-block min-w-full align-middle">
              <table className="min-w-full text-left border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase sticky top-0 bg-slate-50 z-10">字段名</th>
                    <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase w-32 bg-blue-50/50 text-blue-700 sticky top-0 z-10">主键 (PK)</th>
                    <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase w-32 bg-gray-50 text-gray-700 sticky top-0 z-10">
                        <div className="flex items-center justify-center gap-1 cursor-pointer" onClick={(e) => e.stopPropagation()}>
                            忽略
                            <input 
                                type="checkbox"
                                checked={isAllIgnored}
                                ref={input => { if (input) input.indeterminate = isIndeterminateIgnore; }}
                                onChange={toggleAllIgnore}
                                className="w-3 h-3 text-gray-600 rounded border-slate-300 focus:ring-gray-500 cursor-pointer"
                                title="全选/全不选"
                            />
                        </div>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase sticky top-0 bg-slate-50 z-10 min-w-[200px]">
                        正则内容匹配 (可选)
                        <span className="block text-[10px] text-gray-400 font-normal">输入正则表达式，仅对比匹配到的内容</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {columns.map(col => {
                    const isPk = currentConfig.pks.includes(col);
                    const isIgnore = currentConfig.ignore.includes(col);
                    const regexVal = currentRegex[col] || '';
                    return (
                      <tr key={col} className={`hover:bg-slate-50 transition-colors ${isPk ? 'bg-blue-50/30' : ''} ${isIgnore ? 'bg-gray-50/50 opacity-60' : ''}`}>
                        <td className="px-6 py-3 text-sm font-mono text-slate-700 whitespace-nowrap">{col}</td>
                        <td className="px-6 py-3 text-center"><input type="checkbox" checked={isPk} onChange={() => toggleConfig('pks', col)} className="w-5 h-5 text-blue-600 rounded cursor-pointer" /></td>
                        <td className="px-6 py-3 text-center"><input type="checkbox" checked={isIgnore} onChange={() => toggleConfig('ignore', col)} className="w-5 h-5 text-gray-500 rounded cursor-pointer" /></td>
                        <td className="px-6 py-3">
                            <input 
                                type="text" 
                                placeholder="例如: \[.*?\]" 
                                value={regexVal}
                                onChange={(e) => handleRegexChange(col, e.target.value)}
                                className="w-full px-2 py-1 text-sm border border-slate-200 rounded focus:ring-1 focus:ring-blue-500 outline-none font-mono text-slate-600 placeholder:text-slate-300"
                                disabled={isIgnore || isPk}
                            />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
};

export default SqlConfigView;