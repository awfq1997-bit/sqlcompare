import React from 'react';
import { Database, FileSpreadsheet, DraftingCompass, ChevronRight } from 'lucide-react';

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

export default LandingPage;