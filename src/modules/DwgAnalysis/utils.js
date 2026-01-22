// --- 简易 DXF 解析器 ---
export const parseDxfText = (text) => {
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
export const analyzeEntities = (entities, layerName) => {
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