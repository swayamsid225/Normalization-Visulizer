const express = require('express');
const multer = require('multer');
const fs = require('fs');
const pool = require('../db'); // PostgreSQL pool
const { parseInput, normalizeSteps, parseSQLFile } = require('../utils/normalizer');

const upload = multer({ dest: 'tmp/' });
const router = express.Router();

// Helper: Save schema to Postgres with authenticated userId
async function saveSchema(schemaName, sqlText, userId = null) {
  try {
    const safeSql = typeof sqlText === 'string'
      ? Buffer.from(sqlText, 'utf8').toString('base64')
      : '';

    await pool.query(
      `INSERT INTO schemas (user_id, schema_name, sql_text)
       VALUES ($1, $2, $3)`,
      [userId, schemaName, safeSql]
    );
  } catch (err) {
    console.error('Error saving schema to database:', err);
  }
}

// Helper: Convert relation objects to strings for frontend compatibility
function formatRelationsForFrontend(relations) {
  if (!Array.isArray(relations)) return [];
  
  return relations.map(rel => {
    if (typeof rel === 'string') {
      return rel;
    }
    
    if (rel && typeof rel === 'object') {
      const name = rel.name || 'R';
      const attrs = rel.attributes || rel.attrs || [];
      if (Array.isArray(attrs) && attrs.length > 0) {
        return `${name}(${attrs.join(', ')})`;
      }
      return `${name}()`;
    }
    
    return String(rel);
  });
}

// Helper: Format normalization results for frontend
function formatNormalizationResults(steps) {
  const formatted = {};
  
  for (const [nf, relations] of Object.entries(steps)) {
    formatted[nf] = formatRelationsForFrontend(relations);
  }
  
  return formatted;
}

// POST /api/normalize/steps
router.post('/steps', async (req, res) => {
  try {
    const { input, fds, schemaName } = req.body;
    
    if (!input || input.trim() === '') {
      return res.status(400).json({ 
        error: 'No input provided',
        success: false 
      });
    }

    const userId = req.auth?.userId || null;

    // Parse relations from input (schema)
    const parsed = parseInput(input);
    let relations = parsed.relations;
    let fdList = parsed.fds || [];

    // If additional FDs are provided separately, merge them
    if (fds && typeof fds === 'string') {
      const additionalFDs = fds
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean)
        .map(fdStr => {
          // Parse FD string like "A -> B" into {left: ['A'], right: ['B']}
          const match = fdStr.match(/(.+?)\s*(?:->|→)\s*(.+)/);
          if (match) {
            const leftAttrs = match[1].split(',').map(s => s.trim());
            const rightAttrs = match[2].split(',').map(s => s.trim());
            return { left: leftAttrs, right: rightAttrs };
          }
          return null;
        })
        .filter(Boolean);
      
      fdList = [...fdList, ...additionalFDs];
    }

    // Perform normalization
    const steps = normalizeSteps(relations, fdList);
    
    // Format results for frontend compatibility
    const formattedSteps = formatNormalizationResults(steps);

    // Save schema to database
    try {
      await saveSchema(schemaName || 'Untitled Schema', input, userId);
    } catch (saveError) {
      console.warn('Failed to save schema:', saveError);
      // Continue with response even if save fails
    }

    return res.json({
      success: true,
      ...formattedSteps,
      metadata: {
        originalRelations: relations.length,
        functionalDependencies: fdList.length,
        parsedInput: !!parsed.relations.length
      }
    });
    
  } catch (err) {
    console.error('Normalization error:', err);
    return res.status(500).json({ 
      error: 'Failed to compute normalization steps',
      message: err.message,
      success: false
    });
  }
});

// POST /api/normalize/raw
router.post('/raw', async (req, res) => {
  try {
    const { sql, fds, schemaName } = req.body;
    
    if (!sql || sql.trim() === '') {
      return res.status(400).json({ 
        error: 'No SQL provided',
        success: false 
      });
    }

    const userId = req.auth?.userId || null;

    const parsed = parseInput(sql);
    let relations = parsed.relations;
    let fdList = parsed.fds || [];

    // Handle additional FDs
    if (fds && typeof fds === 'string') {
      const additionalFDs = fds
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean)
        .map(fdStr => {
          const match = fdStr.match(/(.+?)\s*(?:->|→)\s*(.+)/);
          if (match) {
            const leftAttrs = match[1].split(',').map(s => s.trim());
            const rightAttrs = match[2].split(',').map(s => s.trim());
            return { left: leftAttrs, right: rightAttrs };
          }
          return null;
        })
        .filter(Boolean);
      
      fdList = [...fdList, ...additionalFDs];
    }

    const steps = normalizeSteps(relations, fdList);
    const formattedSteps = formatNormalizationResults(steps);

    try {
      await saveSchema(schemaName || 'Untitled Schema', sql, userId);
    } catch (saveError) {
      console.warn('Failed to save schema:', saveError);
    }

    return res.json({
      success: true,
      formatted: sql.trim(),
      relations: formatRelationsForFrontend(relations),
      fds: fdList,
      ...formattedSteps
    });
    
  } catch (err) {
    console.error('Raw normalization error:', err);
    return res.status(500).json({ 
      error: 'Failed to normalize raw SQL',
      message: err.message,
      success: false
    });
  }
});

// POST /api/normalize/upload
router.post('/upload', upload.single('sqlFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        error: 'No file uploaded',
        success: false 
      });
    }

    const userId = req.auth?.userId || null;

    // Read as raw buffer, then convert to UTF-8 for parsing
    const rawBuffer = fs.readFileSync(req.file.path);
    const contentUtf8 = rawBuffer.toString('utf8');

    const parsed = parseSQLFile(contentUtf8);

    // Generate Mermaid diagram
    let diagram = `%%{init: {
      "theme": "base",
      "themeVariables": {
        "primaryColor": "#ffffff",
        "primaryBorderColor": "#000000",
        "primaryTextColor": "#000000",
        "lineColor": "#000000",
        "secondaryColor": "#f8f8f8",
        "tertiaryColor": "#ffffff"
      },
      "themeCSS": ".er rect { fill: #fff !important; stroke: #000 !important; } 
                   .er text, .er tspan { fill: #000 !important; font-size: 14px !important; font-weight: 500 !important; }"
    }}%%
    erDiagram
    `;

    for (const tableName in parsed.tables) {
      diagram += `  ${tableName} {\n`;
      const columns = parsed.tables[tableName] || [];
      columns.forEach((col) => {
        let label = `${col.type || 'VARCHAR'} ${col.name}`;
        if (col.isPK) label += ' PK';
        if (col.isFK && col.fkRef) {
          const refInfo = typeof col.fkRef === 'object' 
            ? `${col.fkRef.table}.${col.fkRef.cols?.join(',') || 'id'}`
            : col.fkRef;
          label += ` FK -> ${refInfo}`;
        }
        diagram += `    ${label}\n`;
      });
      diagram += '  }\n';
    }

    if (parsed.relationships && parsed.relationships.length > 0) {
      parsed.relationships.forEach((rel) => {
        diagram += `  ${rel.from} ||--o{ ${rel.to} : "${rel.name || 'references'}"\n`;
      });
    }

    // Save original file content
    try {
      await saveSchema(
        req.file.originalname || 'Uploaded Schema', 
        contentUtf8, 
        userId
      );
    } catch (saveError) {
      console.warn('Failed to save uploaded schema:', saveError);
    }

    // Clean up uploaded file
    try { 
      fs.unlinkSync(req.file.path); 
    } catch (cleanupError) {
      console.warn('Failed to cleanup uploaded file:', cleanupError);
    }

    return res.json({
      success: true,
      ...parsed,
      mermaid: diagram
    });
    
  } catch (err) {
    console.error('Upload processing error:', err);
    
    // Clean up file on error
    try {
      if (req.file && req.file.path) fs.unlinkSync(req.file.path);
    } catch (cleanupError) {
      console.warn('Failed to cleanup file after error:', cleanupError);
    }
    
    return res.status(500).json({ 
      error: 'Failed to parse uploaded SQL file',
      message: err.message,
      success: false
    });
  }
});

module.exports = router;