import React from 'react';
import { Database, FileType, X, Upload, Loader2, AlertTriangle, Wand2 } from 'lucide-react';

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

export default SqlConnectView;