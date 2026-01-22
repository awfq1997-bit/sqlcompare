import React, { useState } from 'react';
import { ArrowRightLeft, Home } from 'lucide-react';
import SqlComparator from './modules/SqlComparator';
import ExcelComparator from './modules/ExcelComparator';
import DwgAnalysis from './modules/DwgAnalysis';
import LandingPage from './pages/LandingPage';

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