import React, { useState } from 'react';
import SqlConnectView from './SqlConnectView';
import SqlConfigView from './SqlConfigView';
import SqlReportView from './SqlReportView';
import { loadSqlJs } from '../../utils/helpers';

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

export default SqlComparator;