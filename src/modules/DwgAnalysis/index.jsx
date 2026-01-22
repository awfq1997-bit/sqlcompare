import React, { useState } from 'react';
import { DraftingCompass, Layers, Upload, FileType, Wand2, Loader2, Download } from 'lucide-react';
import { parseDxfText, analyzeEntities } from './utils';

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
        // 读取为 ArrayBuffer 而不是 Text，以便手动处理编码
        reader.readAsArrayBuffer(f);
    };

    const runAnalysis = () => {
        if (!parsedData || !selectedLayer) return;
        const stats = analyzeEntities(parsedData.entities, selectedLayer);
        setAnalysisResult(stats);
    };

    // 新增：导出 JSON 功能
    const handleExportJson = () => {
        if (!analysisResult) return;
        
        const exportData = {
            fileName: file ? file.name : 'unknown.dxf',
            layer: selectedLayer,
            exportedAt: new Date().toLocaleString(),
            stats: analysisResult
        };

        const jsonStr = JSON.stringify(exportData, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const href = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = href;
        link.download = `dwg-analysis-${selectedLayer}-${Date.now()}.json`;
        document.body.appendChild(link);
        link.click();
        
        document.body.removeChild(link);
        URL.revokeObjectURL(href);
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
                            {/* 修改：标题栏增加导出按钮 */}
                            <div className="flex items-center gap-2 mb-6">
                                <div className="bg-purple-100 p-2 rounded-lg">
                                    <Layers className="w-5 h-5 text-purple-600" />
                                </div>
                                <h3 className="text-xl font-bold text-slate-800">
                                    图层分析报告: <span className="font-mono text-purple-700">{selectedLayer}</span>
                                </h3>
                                <button 
                                    onClick={handleExportJson}
                                    className="ml-auto bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm transition-all hover:text-purple-600"
                                    title="导出当前分析结果为 JSON"
                                >
                                    <Download className="w-4 h-4" />
                                    导出 JSON
                                </button>
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

export default DwgAnalysis;