import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  Database, Settings, Play, CheckCircle, AlertCircle, ChevronRight, Server, 
  ArrowRightLeft, EyeOff, Key, RotateCcw, Upload, FileType, X, Loader2, 
  AlertTriangle, Wand2, Search, CheckSquare, Square, ArrowLeft, Download, 
  UploadCloud, GripVertical, ChevronLeft, ChevronRight as ChevronRightIcon, 
  Filter, FileSpreadsheet, Home, Table, Eye, MousePointer2, Info,
  DraftingCompass, Layers
} from 'lucide-react';

/* ==========================================================================
   1. 工具函数 (Utilities)
   ========================================================================== 
*/

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

const loadXlsxLib = async () => {
    if (window.XLSX) return window.XLSX;
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
        script.onload = () => resolve(window.XLSX);
        script.onerror = () => reject(new Error('无法加载 Excel 解析库 (XLSX)'));
        document.body.appendChild(script);
    });
};

const loadSqlJs = async () => {
    if (window.initSqlJs) return window.initSqlJs;
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/sql-wasm.js';
      script.onload = () => resolve(window.initSqlJs);
      script.onerror = () => reject(new Error('无法从 CDN 加载 sql.js，请检查网络连接'));
      document.body.appendChild(script);
    });
};

/* ==========================================================================
   2. 通用 UI 组件 (Common UI)
   ========================================================================== 
*/

const ResizableSidebar = ({ width, setWidth, children, minWidth = 200, maxWidth = 800 }) => {
    const isResizing = useRef(false);
    const sidebarRef = useRef(null);

    const startResizing = useCallback((e) => {
        e.preventDefault();
        isResizing.current = true;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    }, []);

    const stopResizing = useCallback(() => {
        isResizing.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
    }, []);

    const resize = useCallback((mouseMoveEvent) => {
            if (isResizing.current && sidebarRef.current) {
                const sidebarRect = sidebarRef.current.getBoundingClientRect();
                const newWidth = mouseMoveEvent.clientX - sidebarRect.left;
                if (newWidth >= minWidth && newWidth <= maxWidth) {
                    setWidth(newWidth);
                }
            }
        }, [minWidth, maxWidth, setWidth]);

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

/* ==========================================================================
   3. SQL 对比模块 (SQL Module)
   ========================================================================== 
*/

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

const SqlConnectView = ({ files, setFiles, isProcessing, processingStatus, errorMsg, onProcess }) => {
  const handleFileSelect = (key, e) => {
    if (e.target.files && e.target.files[0]) {
      setFiles(prev => ({ ...prev, [key]: e.target.files[0] }));
    }
  };
  const removeFile = (key) => setFiles(prev => ({ ...prev, [key]: null }));

  return (
    <div className="w-full max-w-4xl mx-auto mt-10 p-8 bg-white rounded-xl shadow-lg border border-slate-100 animate-in fade-in zoom-in duration-300">
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

const SqlComparator = () => {
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
        <div className="flex flex-col h-full">
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
                {step === 'connect' && <SqlConnectView 
                    files={files} 
                    setFiles={setFiles} 
                    isProcessing={isProcessing} 
                    processingStatus={processingStatus} 
                    errorMsg={errorMsg} 
                    onProcess={handleProcessFiles} 
                />}
                {step === 'config' && <SqlConfigView 
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
                {step === 'report' && <SqlReportView 
                    comparisonResults={comparisonResults} 
                    parsedData={parsedData} 
                    activeTable={activeTable} 
                    setActiveTable={setActiveTable} 
                    setStep={setStep} 
                    sidebarWidth={sidebarWidth}
                    setSidebarWidth={setSidebarWidth}
                />}
            </div>
        </div>
    );
};

/* ==========================================================================
   4. Excel 对比模块 (Excel Module)
   ========================================================================== 
*/

const parseExcelFile = async (file) => {
    const XLSX = await loadXlsxLib();
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const result = {};
                workbook.SheetNames.forEach(sheetName => {
                    const worksheet = workbook.Sheets[sheetName];
                    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }); // header:1 返回二维数组
                    result[sheetName] = jsonData;
                });
                resolve(result);
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
};

const compareExcelSheets = (sheetData1, sheetData2) => {
    const rows1 = sheetData1 || [];
    const rows2 = sheetData2 || [];
    const header1 = rows1[0] || [];
    const header2 = rows2[0] || [];
    const maxCols = Math.max(header1.length, header2.length);
    const columns = Array.from({ length: maxCols }, (_, i) => header1[i] || header2[i] || `Col ${i+1}`);

    let pkIndex = -1;
    const findPk = (rows, header) => {
        for (let i = 0; i < header.length; i++) {
            const colName = String(header[i]).toLowerCase();
            if (/id|code|no|key/.test(colName)) {
                const values = new Set();
                let isUnique = true;
                for (let r = 1; r < rows.length; r++) {
                    const val = rows[r][i];
                    if (values.has(val)) { isUnique = false; break; }
                    values.add(val);
                }
                if (isUnique && values.size > 0) return i;
            }
        }
        return -1;
    };

    pkIndex = findPk(rows1, header1);
    const diffResult = [];
    const map1 = new Map();

    for (let i = 1; i < rows1.length; i++) {
        const key = pkIndex !== -1 ? String(rows1[i][pkIndex]) : `__row_${i}`;
        map1.set(key, { row: rows1[i], index: i });
    }

    const processedKeys = new Set();
    for (let i = 1; i < rows2.length; i++) {
        const row2 = rows2[i];
        const key = pkIndex !== -1 ? String(row2[pkIndex]) : `__row_${i}`;
        processedKeys.add(key);

        if (!map1.has(key)) {
            diffResult.push({ type: 'add', data: row2, rowIndex: i });
        } else {
            const { row: row1 } = map1.get(key);
            let isDiff = false;
            const cellDiffs = {};
            for (let c = 0; c < maxCols; c++) {
                const val1 = row1[c];
                const val2 = row2[c];
                if (val1 != val2) { 
                    isDiff = true;
                    cellDiffs[c] = { old: val1, new: val2 };
                }
            }
            if (isDiff) {
                diffResult.push({ type: 'modify', data: row2, oldData: row1, diffs: cellDiffs, rowIndex: i });
            } else {
                diffResult.push({ type: 'same', data: row2, rowIndex: i });
            }
        }
    }

    map1.forEach((val, key) => {
        if (!processedKeys.has(key)) {
            diffResult.push({ type: 'remove', data: val.row, rowIndex: val.index });
        }
    });

    const mergedView = [];
    if (pkIndex === -1) {
        const maxLen = Math.max(rows1.length, rows2.length);
        for(let i=1; i<maxLen; i++) {
            const r1 = rows1[i];
            const r2 = rows2[i];
            if (r1 && !r2) mergedView.push({ type: 'remove', base: r1, target: null });
            else if (!r1 && r2) mergedView.push({ type: 'add', base: null, target: r2 });
            else {
                let isDiff = false;
                const diffs = {};
                for(let c=0; c<maxCols; c++) {
                    if (r1[c] != r2[c]) {
                        isDiff = true;
                        diffs[c] = { old: r1[c], new: r2[c] };
                    }
                }
                mergedView.push({ type: isDiff ? 'modify' : 'same', base: r1, target: r2, diffs });
            }
        }
    } else {
        const processedPks = new Set();
        for (let i=1; i<rows2.length; i++) {
            const r2 = rows2[i];
            const key = String(r2[pkIndex]);
            processedPks.add(key);
            if (map1.has(key)) {
                const { row: r1 } = map1.get(key);
                let isDiff = false;
                const diffs = {};
                for(let c=0; c<maxCols; c++) {
                    if (r1[c] != r2[c]) {
                        isDiff = true;
                        diffs[c] = { old: r1[c], new: r2[c] };
                    }
                }
                mergedView.push({ type: isDiff ? 'modify' : 'same', base: r1, target: r2, diffs });
            } else {
                mergedView.push({ type: 'add', base: null, target: r2 });
            }
        }
        map1.forEach((val, key) => {
            if (!processedPks.has(key)) {
                mergedView.push({ type: 'remove', base: val.row, target: null });
            }
        });
    }
    return { columns, rows: mergedView, pkIndex };
};

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

const ExcelComparator = () => {
    const [step, setStep] = useState('upload'); // upload, processing, report
    const [files, setFiles] = useState({ f1: null, f2: null });
    const [diffData, setDiffData] = useState(null);
    const [activeSheet, setActiveSheet] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [showDiffOnly, setShowDiffOnly] = useState(false);

    const handleFileChange = (key, e) => {
        if (e.target.files && e.target.files[0]) {
            setFiles(prev => ({ ...prev, [key]: e.target.files[0] }));
        }
    };

    const processFiles = async () => {
        if (!files.f1 || !files.f2) return;
        setIsProcessing(true);
        try {
            const data1 = await parseExcelFile(files.f1);
            const data2 = await parseExcelFile(files.f2);
            
            // 智能匹配 Sheet
            const allSheets = new Set([...Object.keys(data1), ...Object.keys(data2)]);
            const diffs = {};
            
            allSheets.forEach(sheet => {
                const s1 = data1[sheet];
                const s2 = data2[sheet];
                if (!s1 && s2) {
                    diffs[sheet] = { status: 'added', rows: s2.map(r => ({ type: 'add', target: r })) };
                } else if (s1 && !s2) {
                    diffs[sheet] = { status: 'removed', rows: s1.map(r => ({ type: 'remove', base: r })) };
                } else {
                    const compareRes = compareExcelSheets(s1, s2);
                    diffs[sheet] = { status: 'compared', ...compareRes };
                }
            });

            setDiffData(diffs);
            setActiveSheet(Object.keys(diffs)[0]);
            setStep('report');
        } catch (e) {
            console.error(e);
            alert("解析失败，请确保文件格式正确（.xlsx, .xls, .csv）且未加密。");
        } finally {
            setIsProcessing(false);
        }
    };

    if (step === 'upload') {
        return (
            <div className="flex flex-col items-center justify-center h-full animate-in fade-in zoom-in duration-300 p-8">
                <div className="bg-emerald-50 p-6 rounded-full mb-6">
                    <FileSpreadsheet className="w-16 h-16 text-emerald-600" />
                </div>
                <h2 className="text-3xl font-bold text-slate-800 mb-2">Excel 智能对比工具</h2>
                <p className="max-w-lg text-center text-slate-500 mb-10">
                    支持 .xlsx, .xls, .csv。上传两个表格，系统将自动匹配 Sheet 页并高亮显示增删改差异。无配置，纯自动。
                </p>
                
                <div className="flex flex-col md:flex-row gap-8 w-full max-w-4xl mb-10">
                    {['f1', 'f2'].map((k, i) => (
                        <div key={k} className="flex-1 relative group border-2 border-dashed border-slate-300 hover:border-emerald-400 hover:bg-emerald-50/20 rounded-2xl p-8 transition-all flex flex-col items-center justify-center h-48 cursor-pointer">
                            <input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => handleFileChange(k, e)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                            {files[k] ? (
                                <div className="text-center">
                                    <FileSpreadsheet className="w-10 h-10 text-emerald-600 mx-auto mb-2" />
                                    <p className="font-semibold text-slate-700 truncate max-w-[200px]">{files[k].name}</p>
                                    <p className="text-xs text-slate-400">{(files[k].size/1024).toFixed(1)} KB</p>
                                </div>
                            ) : (
                                <>
                                    <UploadCloud className="w-10 h-10 text-slate-300 mb-3 group-hover:scale-110 transition-transform" />
                                    <p className="font-bold text-slate-600">{i===0 ? '上传基准表格 (旧)' : '上传目标表格 (新)'}</p>
                                    <p className="text-xs text-slate-400 mt-1">点击或拖拽文件到此处</p>
                                </>
                            )}
                        </div>
                    ))}
                </div>

                <button 
                    onClick={processFiles}
                    disabled={!files.f1 || !files.f2 || isProcessing}
                    className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white px-10 py-4 rounded-xl font-bold text-lg flex items-center gap-3 shadow-lg shadow-emerald-200 transition-all"
                >
                    {isProcessing ? <Loader2 className="w-6 h-6 animate-spin" /> : <Wand2 className="w-6 h-6" />}
                    {isProcessing ? '正在智能解析对比...' : '开始全自动对比'}
                </button>
            </div>
        );
    }

    const currentSheetData = diffData ? diffData[activeSheet] : null;
    const diffCount = currentSheetData?.rows?.filter(r => r.type !== 'same').length || 0;

    return (
        <div className="flex h-full flex-col bg-white overflow-hidden animate-in fade-in duration-300">
            {/* Header Toolbar */}
            <div className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-4 shrink-0 shadow-sm z-20">
                <div className="flex items-center gap-4">
                    <button onClick={() => setStep('upload')} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h2 className="font-bold text-slate-800 flex items-center gap-2">
                            {files.f1.name} <ArrowRightLeft className="w-4 h-4 text-slate-400" /> {files.f2.name}
                        </h2>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                            <span className="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-medium">Sheet: {activeSheet}</span>
                            <span>•</span>
                            <span className={diffCount > 0 ? "text-red-500 font-bold" : "text-emerald-500"}>
                                {diffCount} 处差异
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded border border-slate-100">
                        <Info className="w-3 h-3" />
                        悬停查看变更详情
                    </div>
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-600 cursor-pointer bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors">
                        <Eye className="w-4 h-4" />
                        <span className="select-none">只看差异</span>
                        <input 
                            type="checkbox" 
                            checked={showDiffOnly} 
                            onChange={(e) => setShowDiffOnly(e.target.checked)} 
                            className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 ml-1" 
                        />
                    </label>
                </div>
            </div>

            <div className="flex flex-1 min-h-0">
                {/* Sheet Sidebar */}
                <div className="w-64 border-r border-slate-200 bg-slate-50 flex flex-col overflow-hidden shrink-0">
                    <div className="p-3 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase">
                        Sheet 列表
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                        {diffData && Object.keys(diffData).map(sheet => {
                            const info = diffData[sheet];
                            const dCount = info.rows?.filter(r => r.type !== 'same').length || 0;
                            return (
                                <button 
                                    key={sheet}
                                    onClick={() => setActiveSheet(sheet)}
                                    className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between transition-all ${activeSheet === sheet ? 'bg-white shadow text-emerald-700 font-medium ring-1 ring-emerald-200' : 'text-slate-600 hover:bg-slate-200/50'}`}
                                >
                                    <span className="truncate" title={sheet}>{sheet}</span>
                                    {dCount > 0 && <span className="bg-red-100 text-red-600 text-xs px-1.5 py-0.5 rounded-full font-bold">{dCount}</span>}
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* Main Diff Area */}
                <div className="flex-1 min-w-0 bg-white relative">
                    {currentSheetData && currentSheetData.columns ? (
                        <VirtualExcelTable 
                            columns={currentSheetData.columns} 
                            rows={currentSheetData.rows} 
                            showDiffOnly={showDiffOnly} 
                        />
                    ) : (
                        <div className="flex items-center justify-center h-full text-slate-400">
                            该 Sheet 页无法对比 (可能仅存在于一个文件中)
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

/* ==========================================================================
   5. DWG 图纸特征值对比模块 (DwgAnalysis) - 新增功能
   ========================================================================== 
*/

// --- 简易 DXF 解析器 ---
const parseDxfText = (text) => {
    const lines = text.split(/\r\n|\r|\n/);
    const entities = [];
    const layers = new Set();
    
    let section = null;
    let entity = null;
    
    for (let i = 0; i < lines.length - 1; i += 2) {
        const code = parseInt(lines[i].trim());
        const value = lines[i+1].trim();
        
        if (code === 0) {
            if (value === 'SECTION') {
                section = 'SECTION_START';
            } else if (value === 'ENDSEC') {
                section = null;
            } else if (section === 'ENTITIES') {
                if (entity) entities.push(entity);
                entity = { type: value, props: {} };
            }
        } else if (code === 2 && section === 'SECTION_START') {
            section = value; // ENTITIES, TABLES, etc.
        } else if (entity && section === 'ENTITIES') {
            if (code === 8) layers.add(value); // Layer Name
            
            // Store properties. 
            // Simplified: we store raw values. For repeating codes (like vertices), we use arrays.
            if (!entity.props[code]) {
                entity.props[code] = value;
            } else {
                if (!Array.isArray(entity.props[code])) {
                    entity.props[code] = [entity.props[code]];
                }
                entity.props[code].push(value);
            }
        }
    }
    if (entity) entities.push(entity);
    return { entities, layers: Array.from(layers).sort() };
};

// --- 实体分析策略 (JavaScript 版) ---
const analyzeEntities = (entities, layerName) => {
    // 过滤图层
    const targetEntities = entities.filter(e => e.props[8] === layerName || e.props[8] === layerName + ' @ 1');
    
    const stats = {
        'LWPOLYLINE': { total: 0, curves: 0, straight: 0 },
        'INSERT': { total: 0, byName: {}, byRotation: {} },
        'MULTILEADER': { total: 0, byStyle: {}, byContent: {} },
        'DIMENSION': { total: 0, byType: {}, byStyle: {}, byContent: {} },
        'TEXT': { total: 0, byStyle: {}, byContent: {} },
        'MTEXT': { total: 0, byStyle: {}, byContent: {}, byRotation: {} },
        'HATCH': { total: 0, byFillType: {}, byPattern: {}, byAssoc: {}, byStyle: {}, byScale: {}, byAngle: {} }
    };

    targetEntities.forEach(e => {
        const type = e.type;
        const p = e.props;

        if (type === 'LWPOLYLINE') {
            stats.LWPOLYLINE.total++;
            // Code 42 is bulge. If any bulge != 0, it has curves.
            let hasCurve = false;
            if (p[42]) {
                const bulges = Array.isArray(p[42]) ? p[42] : [p[42]];
                hasCurve = bulges.some(b => parseFloat(b) !== 0);
            }
            if (hasCurve) stats.LWPOLYLINE.curves++;
            else stats.LWPOLYLINE.straight++;
        } else if (type === 'INSERT') {
            stats.INSERT.total++;
            const name = p[2] || 'Unknown';
            const rot = Math.round(parseFloat(p[50] || 0));
            stats.INSERT.byName[name] = (stats.INSERT.byName[name] || 0) + 1;
            stats.INSERT.byRotation[rot] = (stats.INSERT.byRotation[rot] || 0) + 1;
        } else if (type === 'MULTILEADER') {
            stats.MULTILEADER.total++;
            const content = p[304] || p[1] || 'Unknown'; // 304 often used for MLeader content
            const style = p[340] || 'Standard'; // Handle
            stats.MULTILEADER.byContent[content] = (stats.MULTILEADER.byContent[content] || 0) + 1;
            stats.MULTILEADER.byStyle[style] = (stats.MULTILEADER.byStyle[style] || 0) + 1;
        } else if (type === 'DIMENSION') {
            stats.DIMENSION.total++;
            const dimType = p[70] || 0;
            const dimStyle = p[3] || 'Standard';
            const text = p[1] || 'Unknown';
            stats.DIMENSION.byType[dimType] = (stats.DIMENSION.byType[dimType] || 0) + 1;
            stats.DIMENSION.byStyle[dimStyle] = (stats.DIMENSION.byStyle[dimStyle] || 0) + 1;
            stats.DIMENSION.byContent[text] = (stats.DIMENSION.byContent[text] || 0) + 1;
        } else if (type === 'TEXT') {
            stats.TEXT.total++;
            const text = p[1] || 'Unknown';
            const style = p[7] || 'Standard';
            stats.TEXT.byContent[text] = (stats.TEXT.byContent[text] || 0) + 1;
            stats.TEXT.byStyle[style] = (stats.TEXT.byStyle[style] || 0) + 1;
        } else if (type === 'MTEXT') {
            stats.MTEXT.total++;
            const text = p[1] || p[3] || 'Unknown'; // MText content often split in 3 and 1
            const style = p[7] || 'Standard';
            const rot = parseFloat(p[50] || 0).toFixed(2);
            stats.MTEXT.byContent[text] = (stats.MTEXT.byContent[text] || 0) + 1;
            stats.MTEXT.byStyle[style] = (stats.MTEXT.byStyle[style] || 0) + 1;
            stats.MTEXT.byRotation[rot] = (stats.MTEXT.byRotation[rot] || 0) + 1;
        } else if (type === 'HATCH') {
            stats.HATCH.total++;
            const pattern = p[2] || 'SOLID';
            const fillType = (p[70] && (parseInt(p[70]) & 1)) ? '实体填充' : '图案填充'; // Bit 1 check
            const assoc = p[71] ? '关联' : '非关联';
            const scale = p[41] || 1;
            const angle = parseFloat(p[52] || 0).toFixed(2);
            
            stats.HATCH.byPattern[pattern] = (stats.HATCH.byPattern[pattern] || 0) + 1;
            stats.HATCH.byFillType[fillType] = (stats.HATCH.byFillType[fillType] || 0) + 1;
            stats.HATCH.byAssoc[assoc] = (stats.HATCH.byAssoc[assoc] || 0) + 1;
            stats.HATCH.byScale[scale] = (stats.HATCH.byScale[scale] || 0) + 1;
            stats.HATCH.byAngle[angle] = (stats.HATCH.byAngle[angle] || 0) + 1;
        }
    });
    
    return stats;
};

const DwgAnalysis = () => {
    const [file, setFile] = useState(null);
    const [parsedData, setParsedData] = useState(null); // { entities, layers }
    const [selectedLayer, setSelectedLayer] = useState('');
    const [analysisResult, setAnalysisResult] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);

    const handleFileUpload = (e) => {
        const f = e.target.files[0];
        if (!f) return;
        setFile(f);
        setIsProcessing(true);
        setAnalysisResult(null); // 清除旧结果
        setParsedData(null);
        setSelectedLayer('');
        
        const reader = new FileReader();
        reader.onload = (evt) => {
            const buffer = evt.target.result;
            let text = '';
            
            // 智能编码检测策略
            try {
                // 1. 尝试使用 UTF-8 (Fatal 模式: 遇到非法字节序列抛出异常)
                const decoder = new TextDecoder('utf-8', { fatal: true });
                text = decoder.decode(buffer);
            } catch (err) {
                // 2. 如果 UTF-8 失败，尝试 GB18030 (涵盖 GBK, GB2312，常用于中文 CAD 环境)
                try {
                    console.warn('UTF-8 decoding failed, trying GB18030 for Chinese characters support.');
                    const decoder = new TextDecoder('gb18030');
                    text = decoder.decode(buffer);
                } catch (err2) {
                    // 3. 如果都失败了，回退到宽松的 UTF-8
                    const decoder = new TextDecoder('utf-8');
                    text = decoder.decode(buffer);
                }
            }

            // 简单的防卡顿处理
            setTimeout(() => {
                const data = parseDxfText(text);
                setParsedData(data);
                if (data.layers.length > 0) setSelectedLayer(data.layers[0]);
                setIsProcessing(false);
            }, 100);
        };
        // 关键修改：读取为 ArrayBuffer 而不是 Text，以便手动处理编码
        reader.readAsArrayBuffer(f);
    };

    const runAnalysis = () => {
        if (!parsedData || !selectedLayer) return;
        const stats = analyzeEntities(parsedData.entities, selectedLayer);
        setAnalysisResult(stats);
    };

    const StatCard = ({ title, data }) => {
        if (data.total === 0) return null;
        return (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-4">
                <div className="flex justify-between items-center mb-2">
                    <h4 className="font-bold text-slate-700">{title}</h4>
                    <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-mono">Total: {data.total}</span>
                </div>
                <div className="space-y-2 text-sm">
                    {/* Specific render logic for different types */}
                    {data.curves !== undefined && (
                        <div className="grid grid-cols-2 gap-2">
                            <div className="bg-white p-2 rounded border border-slate-100 flex justify-between"><span>直线</span> <b>{data.straight}</b></div>
                            <div className="bg-white p-2 rounded border border-slate-100 flex justify-between"><span>曲线</span> <b>{data.curves}</b></div>
                        </div>
                    )}
                    
                    {/* Generic Map Render */}
                    {Object.keys(data).filter(k => k.startsWith('by')).map(key => {
                        const label = key.replace('by', '按'); // Simple translation
                        const mapData = data[key];
                        if (Object.keys(mapData).length === 0) return null;
                        return (
                            <div key={key} className="mt-2">
                                <p className="text-xs text-slate-400 mb-1">{label}分类:</p>
                                <div className="bg-white rounded border border-slate-100 max-h-40 overflow-y-auto custom-scrollbar">
                                    <table className="w-full text-left text-xs">
                                        <tbody>
                                            {Object.entries(mapData).map(([k, v]) => (
                                                <tr key={k} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                                                    <td className="p-1.5 truncate max-w-[150px]" title={k}>{k}</td>
                                                    <td className="p-1.5 text-right font-mono text-slate-600">{v}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    return (
        <div className="flex h-full flex-col bg-white animate-in fade-in duration-300">
            <div className="p-6 border-b border-slate-200 bg-white shrink-0 flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <DraftingCompass className="w-6 h-6 text-purple-600" />
                        DWG 图纸特征值分析
                    </h2>
                    <p className="text-slate-500 text-sm mt-1">本地解析 DXF 文件，统计指定图层的实体特征（多段线、块、文本等）</p>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Left Sidebar: Controls */}
                <div className="w-80 bg-slate-50 border-r border-slate-200 p-6 flex flex-col gap-6 shrink-0 overflow-y-auto">
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700 block">1. 上传文件 (.dxf)</label>
                        <div className="relative border-2 border-dashed border-slate-300 rounded-xl p-6 hover:bg-slate-100 transition-colors text-center cursor-pointer bg-white">
                            <input type="file" accept=".dxf" onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                            {file ? (
                                <div>
                                    <FileType className="w-8 h-8 text-purple-500 mx-auto mb-2" />
                                    <p className="text-sm font-medium text-slate-700 truncate">{file.name}</p>
                                    <p className="text-xs text-slate-400">{(file.size/1024/1024).toFixed(2)} MB</p>
                                </div>
                            ) : (
                                <div>
                                    <Upload className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                                    <p className="text-sm text-slate-500">点击上传 DXF 文件</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {parsedData && (
                        <div className="space-y-2 animate-in slide-in-from-left-2 fade-in">
                            <label className="text-sm font-bold text-slate-700 block">2. 选择图层</label>
                            <div className="relative">
                                <Layers className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                                <select 
                                    value={selectedLayer} 
                                    onChange={(e) => { setSelectedLayer(e.target.value); setAnalysisResult(null); }}
                                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none appearance-none bg-white"
                                >
                                    {parsedData.layers.map(l => <option key={l} value={l}>{l}</option>)}
                                </select>
                            </div>
                            <div className="text-xs text-slate-400 px-1">共发现 {parsedData.layers.length} 个图层</div>
                        </div>
                    )}

                    <button 
                        onClick={runAnalysis}
                        disabled={!parsedData || !selectedLayer}
                        className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-slate-300 text-white py-3 rounded-lg font-bold shadow-md transition-all flex items-center justify-center gap-2 mt-auto"
                    >
                        <Wand2 className="w-4 h-4" /> 开始分析
                    </button>
                </div>

                {/* Right Content: Report */}
                <div className="flex-1 bg-slate-50/50 p-8 overflow-y-auto">
                    {isProcessing && (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400">
                            <Loader2 className="w-10 h-10 animate-spin mb-4 text-purple-500" />
                            <p>正在解析 DXF 文件结构...</p>
                        </div>
                    )}

                    {!isProcessing && !analysisResult && (
                        <div className="flex flex-col items-center justify-center h-full text-slate-300">
                            <DraftingCompass className="w-16 h-16 mb-4 opacity-50" />
                            <p>请上传文件并选择图层进行分析</p>
                        </div>
                    )}

                    {analysisResult && (
                        <div className="max-w-4xl mx-auto animate-in zoom-in-95 duration-300">
                            <div className="flex items-center gap-2 mb-6">
                                <div className="bg-purple-100 p-2 rounded-lg">
                                    <Layers className="w-5 h-5 text-purple-600" />
                                </div>
                                <h3 className="text-xl font-bold text-slate-800">
                                    图层分析报告: <span className="font-mono text-purple-700">{selectedLayer}</span>
                                </h3>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                <StatCard title="多段线 (LWPOLYLINE)" data={analysisResult.LWPOLYLINE} />
                                <StatCard title="图块 (INSERT)" data={analysisResult.INSERT} />
                                <StatCard title="多重引线 (MULTILEADER)" data={analysisResult.MULTILEADER} />
                                <StatCard title="尺寸标注 (DIMENSION)" data={analysisResult.DIMENSION} />
                                <StatCard title="单行文本 (TEXT)" data={analysisResult.TEXT} />
                                <StatCard title="多行文本 (MTEXT)" data={analysisResult.MTEXT} />
                                <StatCard title="填充 (HATCH)" data={analysisResult.HATCH} />
                            </div>

                            {Object.values(analysisResult).every(v => v.total === 0) && (
                                <div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-300 text-slate-400">
                                    该图层下未找到支持分析的实体类型
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

/* ==========================================================================
   6. 首页与应用入口 (Entry)
   ========================================================================== 
*/

const LandingPage = ({ onSelectTool }) => {
    const tools = [
        {
            id: 'sql',
            title: 'SQLite 数据库对比',
            description: '深度对比两个 SQLite 数据库文件 (.db, .sqlite)。支持主键推断、正则忽略、差异导出。',
            icon: Database,
            color: 'bg-blue-500',
            textColor: 'text-blue-600',
            bgColor: 'bg-blue-50',
            borderColor: 'border-blue-100'
        },
        {
            id: 'excel',
            title: 'Excel 表格对比',
            description: '快速对比两个 Excel 文件 (.xlsx, .csv)。高亮显示单元格差异，悬浮查看变更详情。',
            icon: FileSpreadsheet,
            color: 'bg-emerald-500',
            textColor: 'text-emerald-600',
            bgColor: 'bg-emerald-50',
            borderColor: 'border-emerald-100'
        },
        {
            id: 'dwg',
            title: 'DWG 图纸特征分析',
            description: '解析 DXF 图纸文件，统计指定图层的实体特征（曲线、图块、文本等），辅助工程量统计。',
            icon: DraftingCompass,
            color: 'bg-purple-500',
            textColor: 'text-purple-600',
            bgColor: 'bg-purple-50',
            borderColor: 'border-purple-100'
        }
    ];

    return (
        <div className="flex flex-col items-center justify-center h-full px-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center mb-12">
                <h1 className="text-4xl font-extrabold text-slate-800 mb-4 tracking-tight">
                    数据差异对比工具集
                </h1>
                <p className="text-lg text-slate-500 max-w-2xl mx-auto">
                    选择您需要的工具，快速发现数据变更。专为开发者和数据分析师设计，安全、本地化运行。
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl w-full">
                {tools.map((tool) => (
                    <div 
                        key={tool.id}
                        onClick={() => onSelectTool(tool.id)}
                        className={`group relative p-8 rounded-2xl border ${tool.borderColor} bg-white hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer overflow-hidden`}
                    >
                        <div className={`absolute top-0 right-0 w-32 h-32 ${tool.bgColor} rounded-bl-full opacity-50 transition-transform group-hover:scale-110`} />
                        
                        <div className="relative z-10">
                            <div className={`w-14 h-14 ${tool.bgColor} ${tool.textColor} rounded-xl flex items-center justify-center mb-6 shadow-sm`}>
                                <tool.icon className="w-8 h-8" />
                            </div>
                            <h3 className="text-2xl font-bold text-slate-800 mb-3 group-hover:text-slate-900">
                                {tool.title}
                            </h3>
                            <p className="text-slate-500 leading-relaxed mb-6 text-sm h-12 overflow-hidden">
                                {tool.description}
                            </p>
                            <div className="flex items-center font-semibold text-sm text-slate-400 group-hover:text-slate-600 transition-colors">
                                启动工具 <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default function App() {
  const [currentTool, setCurrentTool] = useState('home'); // home, sql, excel, dwg

  const renderContent = () => {
      switch(currentTool) {
          case 'sql':
              return <SqlComparator />;
          case 'excel':
              return <ExcelComparator />;
          case 'dwg':
              return <DwgAnalysis />;
          default:
              return <LandingPage onSelectTool={setCurrentTool} />;
      }
  };

  return (
    <div className="h-screen bg-slate-50 text-slate-800 font-sans flex flex-col overflow-hidden">
        <header className="bg-slate-900 text-white shadow-lg shrink-0 z-50">
            <div className="w-full px-6 h-14 flex items-center justify-between">
                <div 
                    className="flex items-center gap-3 cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => setCurrentTool('home')}
                >
                    <div className="bg-slate-800 p-1.5 rounded-lg">
                        <ArrowRightLeft className="w-5 h-5 text-emerald-400" />
                    </div>
                    <h1 className="font-bold text-lg tracking-wide">
                        DB Diff Tool <span className="opacity-50 font-normal ml-1">| Suite</span>
                    </h1>
                </div>

                {currentTool !== 'home' && (
                    <button 
                        onClick={() => setCurrentTool('home')}
                        className="flex items-center gap-2 text-sm text-slate-300 hover:text-white transition-colors bg-slate-800/50 hover:bg-slate-800 px-3 py-1.5 rounded-full"
                    >
                        <Home className="w-4 h-4" />
                        返回首页
                    </button>
                )}
            </div>
        </header>
        
        <main className="flex-1 w-full px-4 py-4 flex flex-col min-h-0 overflow-hidden relative">
            {renderContent()}
        </main>
    </div>
  );
}