import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Database, Settings, Play, CheckCircle, AlertCircle, ChevronRight, Server, ArrowRightLeft, EyeOff, Key, RotateCcw, Upload, FileType, X, Loader2, AlertTriangle, Wand2, Search, CheckSquare, Square, ArrowLeft, Download, UploadCloud, GripVertical, ChevronLeft, ChevronRight as ChevronRightIcon, Filter } from 'lucide-react';

// --- 工具函数：Levenshtein 距离计算 ---
const getLevenshteinDistance = (a, b) => {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1));
      }
    }
  }
  return matrix[b.length][a.length];
};

// --- 核心对比算法 ---
const compareTableData = (tableName, config, data1, data2, columnRegex) => {
  const { pks, ignore } = config;
  const results = { added: [], removed: [], changed: [], identicalCount: 0 };

  if (!pks || pks.length === 0) return results;

  const processValue = (val, col) => {
    const strVal = (val === null || val === undefined) ? '' : String(val);
    const regexStr = columnRegex?.[tableName]?.[col];
    if (regexStr) {
        try {
            const regex = new RegExp(regexStr);
            const match = strVal.match(regex);
            return match ? match[0] : ''; 
        } catch (e) {
            console.warn(`Invalid regex for ${tableName}.${col}:`, e);
            return strVal;
        }
    }
    return strVal;
  };

  const getPkKey = (row) => pks.map(k => String(row[k])).join('::');

  const map1 = new Map();
  data1.forEach(row => map1.set(getPkKey(row), row));
  
  const map2Keys = new Set(); 

  data2.forEach(row2 => {
    const key = getPkKey(row2);
    map2Keys.add(key);

    if (!map1.has(key)) {
      results.added.push(row2);
    } else {
      const row1 = map1.get(key);
      const diffs = {};
      let hasDiff = false;
      
      const allCols = new Set([...Object.keys(row1), ...Object.keys(row2)]);
      
      allCols.forEach(col => {
        if (ignore.includes(col) || pks.includes(col)) return;
        
        const val1 = row1[col];
        const val2 = row2[col];

        const str1 = processValue(val1, col);
        const str2 = processValue(val2, col);

        if (str1 !== str2) {
            hasDiff = true;
            diffs[col] = { old: val1, new: val2, oldProcessed: str1, newProcessed: str2, isRegexDiff: !!columnRegex?.[tableName]?.[col] };
        }
      });

      if (hasDiff) {
        results.changed.push({ pk: row2, diffs });
      } else {
        results.identicalCount++;
      }
    }
  });

  map1.forEach((row1, key) => {
    if (!map2Keys.has(key)) {
      results.removed.push(row1);
    }
  });

  return results;
};

// --- 组件定义 ---

const ResizableSidebar = ({ width, setWidth, children, minWidth = 200, maxWidth = 800 }) => {
    const isResizing = useRef(false);
    const sidebarRef = useRef(null);

    const startResizing = React.useCallback((e) => {
        e.preventDefault();
        isResizing.current = true;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    }, []);

    const stopResizing = React.useCallback(() => {
        isResizing.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
    }, []);

    const resize = React.useCallback(
        (mouseMoveEvent) => {
            if (isResizing.current && sidebarRef.current) {
                const sidebarRect = sidebarRef.current.getBoundingClientRect();
                const newWidth = mouseMoveEvent.clientX - sidebarRect.left;
                if (newWidth >= minWidth && newWidth <= maxWidth) {
                    setWidth(newWidth);
                }
            }
        },
        [minWidth, maxWidth, setWidth]
    );

    useEffect(() => {
        window.addEventListener("mousemove", resize);
        window.addEventListener("mouseup", stopResizing);
        return () => {
            window.removeEventListener("mousemove", resize);
            window.removeEventListener("mouseup", stopResizing);
        };
    }, [resize, stopResizing]);

    return (
        <div ref={sidebarRef} className="flex flex-col border-r border-slate-200 bg-slate-50 relative shrink-0" style={{ width: width }}>
            {children}
            <div
                className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-blue-400 transition-colors z-20 flex items-center justify-center group opacity-0 hover:opacity-100"
                onMouseDown={startResizing}
            >
                <div className="w-0.5 h-full bg-blue-400"></div>
            </div>
        </div>
    );
};

const ConnectView = ({ files, setFiles, isProcessing, processingStatus, errorMsg, onProcess }) => {
  const handleFileSelect = (key, e) => {
    if (e.target.files && e.target.files[0]) {
      setFiles(prev => ({ ...prev, [key]: e.target.files[0] }));
    }
  };
  const removeFile = (key) => setFiles(prev => ({ ...prev, [key]: null }));

  return (
    <div className="w-full max-w-4xl mx-auto mt-10 p-8 bg-white rounded-xl shadow-lg border border-slate-100">
      <div className="text-center mb-10">
        <div className="bg-emerald-100 p-4 rounded-full inline-block mb-4">
          <Database className="w-8 h-8 text-emerald-600" />
        </div>
        <h2 className="text-2xl font-bold text-slate-800">SQLite 数据库深度对比</h2>
        <p className="text-slate-500 mt-2">支持正则忽略、批量配置、导入导出配置</p>
      </div>

      {errorMsg && (
        <div className="mb-6 p-4 bg-red-50 text-red-700 border border-red-200 rounded-lg flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            {errorMsg}
        </div>
      )}

      <div className="flex flex-col md:flex-row items-center gap-8 justify-center">
        {['db1', 'db2'].map((key) => (
            <div key={key} className="flex-1 w-full max-w-sm">
                <label className="block text-sm font-bold text-slate-700 mb-2 text-center">
                    {key === 'db1' ? '基准数据库 (Source)' : '目标数据库 (Target)'}
                </label>
                <div className={`relative group border-2 border-dashed rounded-xl p-8 transition-all flex flex-col items-center justify-center h-48 bg-slate-50 hover:bg-slate-100 ${files[key] ? (key==='db1'?'border-emerald-400 bg-emerald-50/30':'border-blue-400 bg-blue-50/30') : 'border-slate-300'}`}>
                    {files[key] ? (
                        <div className="text-center animate-in fade-in zoom-in duration-300">
                            <FileType className={`w-12 h-12 mb-2 mx-auto ${key==='db1'?'text-emerald-600':'text-blue-600'}`} />
                            <p className="font-semibold text-slate-700 truncate max-w-[200px]">{files[key].name}</p>
                            <p className="text-xs text-slate-400">{(files[key].size / 1024).toFixed(1)} KB</p>
                            <button onClick={() => removeFile(key)} className="absolute top-2 right-2 p-1 hover:bg-slate-200 rounded-full text-slate-400 hover:text-red-500 transition-colors">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    ) : (
                        <>
                            <Upload className="w-10 h-10 text-slate-400 mb-3 group-hover:scale-110 transition-transform" />
                            <p className="text-sm text-slate-500 font-medium">点击选择文件</p>
                            <input type="file" accept=".db,.sqlite,.sqlite3" onChange={(e) => handleFileSelect(key, e)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                        </>
                    )}
                </div>
            </div>
        ))}
      </div>

      <div className="mt-10">
        {isProcessing ? (
             <div className="w-full max-w-md mx-auto text-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-2" />
                <p className="text-slate-600 font-medium">{processingStatus}</p>
             </div>
        ) : (
            <button 
                onClick={onProcess}
                disabled={!files.db1 || !files.db2}
                className="w-full bg-slate-800 hover:bg-slate-900 disabled:bg-slate-300 disabled:cursor-not-allowed text-white py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all shadow-lg shadow-slate-200/50"
            >
                {(!files.db1 || !files.db2) ? '请先选择两个文件' : '智能解析并配置'} 
                <Wand2 className="w-5 h-5" />
            </button>
        )}
      </div>
    </div>
  );
};

const ConfigView = ({ 
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
      <div className="flex h-[calc(100vh-140px)] bg-white rounded-xl shadow-lg border border-slate-100 overflow-hidden">
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

const ReportView = ({ comparisonResults, parsedData, activeTable, setActiveTable, setStep, sidebarWidth, setSidebarWidth }) => {
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
      <div className="flex flex-1 w-full h-full bg-white rounded-xl shadow-lg border border-slate-100 overflow-hidden">
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

export default function DBComparatorApp() {
  const [step, setStep] = useState('connect');
  const [files, setFiles] = useState({ db1: null, db2: null });
  
  const [parsedData, setParsedData] = useState({ 
    db1: { tables: {}, schema: {}, realPks: {} }, 
    db2: { tables: {}, schema: {}, realPks: {} } 
  });

  const [tableConfigs, setTableConfigs] = useState({});
  const [activeTable, setActiveTable] = useState('');
  const [comparisonResults, setComparisonResults] = useState(null);
  
  const [selectedTables, setSelectedTables] = useState(new Set()); 
  const [columnRegex, setColumnRegex] = useState({}); 
  const [sidebarWidth, setSidebarWidth] = useState(288); 

  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
  const [errorMsg, setErrorMsg] = useState(null);

  const loadSqlJs = async () => {
    if (window.initSqlJs) return window.initSqlJs;

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/sql-wasm.js';
      script.onload = () => {
        resolve(window.initSqlJs);
      };
      script.onerror = () => reject(new Error('无法从 CDN 加载 sql.js，请检查网络连接'));
      document.body.appendChild(script);
    });
  };

  const parseSqliteFile = async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const uInt8Array = new Uint8Array(reader.result);
          const initSqlJs = await loadSqlJs();
          const SQL = await initSqlJs({
            locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`
          });
          
          const db = new SQL.Database(uInt8Array);
          
          const tablesResult = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
          if (!tablesResult.length) {
            resolve({ tables: {}, schema: {}, realPks: {} });
            return;
          }
          
          const tableNames = tablesResult[0].values.map(v => v[0]);
          const resultData = { tables: {}, schema: {}, realPks: {} };

          for (const tableName of tableNames) {
            const dataRes = db.exec(`SELECT * FROM "${tableName}"`);
            let columns = [];
            let rows = [];

            if (dataRes.length > 0) {
                columns = dataRes[0].columns;
                const values = dataRes[0].values;
                rows = values.map(row => {
                    const rowObj = {};
                    columns.forEach((col, idx) => rowObj[col] = row[idx]);
                    return rowObj;
                });
            } else {
                const schemaRes = db.exec(`PRAGMA table_info("${tableName}")`);
                if (schemaRes.length) {
                    columns = schemaRes[0].values.map(row => row[1]); 
                }
            }

            resultData.tables[tableName] = rows;
            resultData.schema[tableName] = columns;

            const infoRes = db.exec(`PRAGMA table_info("${tableName}")`);
            const pks = [];
            if (infoRes.length > 0) {
                infoRes[0].values.forEach(row => {
                    const colName = row[1];
                    const isPk = row[5]; 
                    if (isPk > 0) pks.push(colName);
                });
            }
            resultData.realPks[tableName] = pks;
          }
          
          db.close();
          resolve(resultData);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(file);
    });
  };

  const handleProcessFiles = async () => {
    if (!files.db1 || !files.db2) return;
    
    setIsProcessing(true);
    setErrorMsg(null);
    try {
        setProcessingStatus(`正在加载解析库...`);
        await loadSqlJs();

        setProcessingStatus(`正在解析 ${files.db1.name}...`);
        const db1Data = await parseSqliteFile(files.db1);
        
        setProcessingStatus(`正在解析 ${files.db2.name}...`);
        const db2Data = await parseSqliteFile(files.db2);
        
        const tables1 = Object.keys(db1Data.tables);
        const tables2 = Object.keys(db2Data.tables);
        const commonTables = tables1.filter(t => tables2.includes(t));
        
        if (commonTables.length === 0) {
            throw new Error("两个数据库中没有发现同名的表，无法进行对比。");
        }

        const initialConfig = {};
        commonTables.forEach(table => {
            let detectedPks = db1Data.realPks[table] || [];
            if (detectedPks.length === 0) {
                const cols = db1Data.schema[table] || [];
                const guess = cols.find(c => /^(id|uuid|code|_id)$/i.test(c)) || 
                              cols.find(c => c.toLowerCase().includes('id'));
                if (guess) {
                    detectedPks = [guess];
                } else if (cols.length > 0) {
                    detectedPks = [cols[0]];
                }
            }
            initialConfig[table] = { pks: detectedPks, ignore: [] };
        });

        setParsedData({ db1: db1Data, db2: db2Data });
        setTableConfigs(initialConfig);
        setSelectedTables(new Set(commonTables)); 
        setColumnRegex({}); 
        setActiveTable(commonTables[0]);
        setStep('config');

    } catch (e) {
        console.error(e);
        setErrorMsg(e.message || "解析失败");
    } finally {
        setIsProcessing(false);
        setProcessingStatus('');
    }
  };

  return (
    <div className="h-screen bg-slate-50 text-slate-800 font-sans flex flex-col overflow-hidden">
        <header className="bg-slate-900 text-white shadow-lg shrink-0 z-50">
            <div className="w-full px-6 h-14 flex items-center justify-between">
                <div className="flex items-center gap-3"><Database className="w-6 h-6 text-emerald-400" /><h1 className="font-bold text-lg tracking-wide">SQLite Diff Pro <span className="opacity-50 font-normal">| 本地真实解析版</span></h1></div>
            </div>
        </header>
        <main className="flex-1 w-full px-4 py-4 flex flex-col min-h-0">
            <div className="mb-4 flex justify-center shrink-0">
                <div className="flex items-center text-sm font-medium">
                    <span className={step === 'connect' ? 'text-emerald-600' : 'text-slate-400'}>1. 上传与解析</span>
                    <span className="mx-4 text-slate-300">→</span>
                    <span className={step === 'config' ? 'text-emerald-600' : 'text-slate-400'}>2. 字段配置</span>
                    <span className="mx-4 text-slate-300">→</span>
                    <span className={step === 'report' ? 'text-emerald-600' : 'text-slate-400'}>3. 差异报告</span>
                </div>
            </div>
            <div className="flex-1 min-h-0 w-full flex flex-col">
                {step === 'connect' && <ConnectView 
                    files={files} 
                    setFiles={setFiles} 
                    isProcessing={isProcessing} 
                    processingStatus={processingStatus} 
                    errorMsg={errorMsg} 
                    onProcess={handleProcessFiles} 
                />}
                {step === 'config' && <ConfigView 
                    parsedData={parsedData} 
                    tableConfigs={tableConfigs} 
                    setTableConfigs={setTableConfigs} 
                    activeTable={activeTable} 
                    setActiveTable={setActiveTable} 
                    selectedTables={selectedTables}
                    setSelectedTables={setSelectedTables}
                    columnRegex={columnRegex}
                    setColumnRegex={setColumnRegex}
                    sidebarWidth={sidebarWidth}
                    setSidebarWidth={setSidebarWidth}
                    isProcessing={isProcessing} 
                    setIsProcessing={setIsProcessing} 
                    setComparisonResults={setComparisonResults} 
                    setStep={setStep} 
                />}
                {step === 'report' && <ReportView 
                    comparisonResults={comparisonResults} 
                    parsedData={parsedData} 
                    activeTable={activeTable} 
                    setActiveTable={setActiveTable} 
                    setStep={setStep} 
                    sidebarWidth={sidebarWidth}
                    setSidebarWidth={setSidebarWidth}
                />}
            </div>
        </main>
    </div>
  );
}
