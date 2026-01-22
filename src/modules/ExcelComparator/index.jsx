import React, { useState } from 'react';
import { 
    FileSpreadsheet, UploadCloud, Loader2, Wand2, ArrowLeft, ArrowRightLeft, 
    Info, Eye
} from 'lucide-react';
import { parseExcelFile, compareExcelSheets } from './utils';
import VirtualExcelTable from './VirtualExcelTable';

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

export default ExcelComparator;