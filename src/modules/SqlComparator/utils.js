// src/modules/SqlComparator/utils.js

export const compareTableData = (tableName, config, data1, data2, columnRegex) => {
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