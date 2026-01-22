import { loadXlsxLib } from '../../utils/helpers';

export const parseExcelFile = async (file) => {
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

export const compareExcelSheets = (sheetData1, sheetData2) => {
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