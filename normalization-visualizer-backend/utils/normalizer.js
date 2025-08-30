// utils/normalizer.js
// Fixed & improved normalizer for frontend/backend use.
// Exports: parseInput, parseSQLFile, normalizeSteps, canonicalCover, candidateKeys, closure, inferFDsFromTables, generateChenNotation

/* ---------- small helpers ---------- */
function trim(s) { return (s || '').trim(); }
function uniq(arr) { return Array.from(new Set(arr)); }
function arrEq(a,b) { return a.length===b.length && a.every((v,i)=>v===b[i]); }

/* ---------- FD parsing & relation shorthand parsing ---------- */
function parseInput(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const relations = []; // { name, attrs: [] }
  const fds = []; // { left:[], right:[] }

  // relation shorthand like R(A, B, C)
  const relationRegex = /^([A-Za-z0-9_]+)\s*\(\s*([A-Za-z0-9_,\s]+)\s*\)\s*$/;
  for (const line of lines) {
    const m = line.match(relationRegex);
    if (m) {
      const name = m[1];
      const attrs = m[2].split(',').map(a => a.trim()).filter(Boolean);
      relations.push({ name, attrs });
    }
  }

  // parse FDs from lines that contain arrows (-> or →)
  const remaining = lines.filter(l => !relationRegex.test(l)).join(' ');
  if (remaining) {
    // split on commas/semicolons that separate FD expressions but keep arrows intact
    const parts = remaining.split(/[,;]+/).map(p => p.trim()).filter(Boolean);
    for (const p of parts) {
      const arrow = p.match(/(.+?)\s*(?:->|→)\s*(.+)/);
      if (arrow) {
        // left and right can be comma/space separated lists of attribute names
        const leftAttrs = (arrow[1].match(/[A-Za-z0-9_]+/g) || []).map(s => s.trim());
        const rightAttrs = (arrow[2].match(/[A-Za-z0-9_]+/g) || []).map(s => s.trim());
        if (leftAttrs.length && rightAttrs.length) {
          fds.push({ left: uniq(leftAttrs), right: uniq(rightAttrs) });
        }
      }
    }
  }

  // fallback: if no relations parsed, try CREATE TABLE parse
  if (relations.length === 0) {
    const parsed = parseSQLFile(text);
    for (const t in parsed.tables) {
      relations.push({ name: t, attrs: parsed.tables[t].map(c => c.name) });
    }
    // Also add inferred FDs from PKs/FKs
    const inferred = inferFDsFromTables(parsed.tables, parsed.relationships);
    inferred.forEach(fd => fds.push(fd));
  }

  // if still no relations but fds present, create R from fd attrs
  if (relations.length === 0 && fds.length) {
    const attrsSet = new Set();
    fds.forEach(fd => fd.left.forEach(a => attrsSet.add(a)));
    fds.forEach(fd => fd.right.forEach(a => attrsSet.add(a)));
    relations.push({ name: 'R', attrs: Array.from(attrsSet) });
  }

  return { relations, fds };
}

/* ---------- SQL parser (CREATE TABLE) ---------- */

function splitTopLevelCommas(s) {
  const parts = [];
  let buf = '';
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '(') depth++;
    if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) {
      parts.push(buf);
      buf = '';
    } else {
      buf += ch;
    }
  }
  if (buf.trim()) parts.push(buf);
  return parts.map(p => p.trim()).filter(Boolean);
}

function parseSQLFile(text) {
  const tables = {};
  const relationships = [];

  const tableRegex = /CREATE\s+TABLE\s+`?([A-Za-z0-9_]+)`?\s*\(([\s\S]*?)\)\s*;?/ig;
  let m;
  while ((m = tableRegex.exec(text)) !== null) {
    const tableName = m[1];
    const body = m[2];
    const colDefs = splitTopLevelCommas(body);
    const cols = [];
    const pkCols = [];
    const fks = [];

    for (let raw of colDefs) {
      let line = raw.trim();

      // column definition - improved regex to capture types like VARCHAR(10)
      const colMatch = line.match(/^\s*`?([A-Za-z0-9_]+)`?\s+([A-Za-z0-9_]+(?:\([^\)]*\))?)(.*)$/i);
      if (colMatch) {
        const colName = colMatch[1];
        const colType = colMatch[2].trim();
        const rest = (colMatch[3] || '').trim();

        const colObj = { name: colName, type: colType, isPK: false, isFK: false, fkRef: null };

        // inline PK
        if (/PRIMARY\s+KEY/i.test(rest)) {
          colObj.isPK = true;
          pkCols.push(colName);
        }

        // inline REFERENCES
        const inlineRef = rest.match(/REFERENCES\s+`?([A-Za-z0-9_]+)`?\s*\(([^)]+)\)/i);
        if (inlineRef) {
          const refTable = inlineRef[1];
          const refCols = inlineRef[2].split(',').map(s => s.replace(/`/g,'').trim());
          colObj.isFK = true;
          colObj.fkRef = { table: refTable, cols: refCols };
          fks.push({ columns: [colName], refTable, refCols });
          // relationship: child table -> parent table
          relationships.push({
            from: tableName,
            to: refTable,
            fkCols: [colName],
            refCols,
            name: `${colName} -> ${refCols.join(',')}`
          });
        }

        cols.push(colObj);
        continue;
      }

      // table-level PK
      const pkMatch = line.match(/PRIMARY\s+KEY\s*\(([^)]+)\)/i);
      if (pkMatch) {
        const pk = pkMatch[1].split(',').map(s => s.replace(/`/g,'').trim());
        pk.forEach(c => pkCols.push(c));
        continue;
      }

      // table-level FK
      const fkMatch = line.match(/FOREIGN\s+KEY\s*\(([^)]+)\)\s+REFERENCES\s+`?([A-Za-z0-9_]+)`?\s*\(([^)]+)\)/i);
      if (fkMatch) {
        const fkCols = fkMatch[1].split(',').map(s => s.replace(/`/g,'').trim());
        const refTable = fkMatch[2];
        const refCols = fkMatch[3].split(',').map(s => s.replace(/`/g,'').trim());
        fks.push({ columns: fkCols, refTable, refCols });
        relationships.push({
          from: tableName,
          to: refTable,
          fkCols,
          refCols,
          name: `${fkCols.join(',')} -> ${refCols.join(',')}`
        });
        continue;
      }

      // CONSTRAINT ... FOREIGN KEY ...
      const constraintFk = line.match(/CONSTRAINT\s+`?([A-Za-z0-9_]+)`?\s+FOREIGN\s+KEY\s*\(([^)]+)\)\s+REFERENCES\s+`?([A-Za-z0-9_]+)`?\s*\(([^)]+)\)/i);
      if (constraintFk) {
        const fkCols = constraintFk[2].split(',').map(s => s.replace(/`/g,'').trim());
        const refTable = constraintFk[3];
        const refCols = constraintFk[4].split(',').map(s => s.replace(/`/g,'').trim());
        fks.push({ columns: fkCols, refTable, refCols });
        relationships.push({
          from: tableName,
          to: refTable,
          fkCols,
          refCols,
          name: `${fkCols.join(',')} -> ${refCols.join(',')}`
        });
        continue;
      }
      // otherwise skip unknown line
    }

    // finalize columns
    const colsWithTags = cols.map(c => {
      const isPK = pkCols.includes(c.name) || c.isPK;
      const fk = fks.find(f => f.columns.includes(c.name));
      const isFK = !!(c.isFK || fk);
      const fkRef = c.fkRef || (fk ? { table: fk.refTable, cols: fk.refCols } : null);
      return { name: c.name, type: c.type, isPK, isFK, fkRef };
    });

    tables[tableName] = colsWithTags;
  }

  // Guess relationships if none found (use single-column PK parents as candidates)
  if (relationships.length === 0) {
    // map single-column PK -> table name (prefer tables with single-column PK)
    const pkExactMap = {};
    for (const [t, cols] of Object.entries(tables)) {
      const pkCols = cols.filter(c => c.isPK).map(c => c.name);
      if (pkCols.length === 1) {
        pkExactMap[pkCols[0].toLowerCase()] = t;
      }
    }

    for (const [t, cols] of Object.entries(tables)) {
      for (const c of cols) {
        const key = c.name.toLowerCase();
        const parent = pkExactMap[key];
        if (parent && parent !== t) {
          // avoid duplicates if something similar already present
          const exists = relationships.some(r => r.from === t && r.to === parent && (r.fkCols||[]).includes(c.name));
          if (!exists) {
            relationships.push({
              from: t,
              to: parent,
              fkCols: [c.name],
              refCols: [c.name],
              name: `${c.name} -> ${c.name}`
            });
          }
        }
      }
    }
  }

  // unique relationships (dedupe)
  const uniqueRelationships = [];
  const seen = new Set();
  for (const r of relationships) {
    const key = `${r.from}|${r.to}|${(r.fkCols||[]).join(',')}|${(r.refCols||[]).join(',')}`;
    if (!seen.has(key)) { seen.add(key); uniqueRelationships.push(r); }
  }

  return { tables, relationships: uniqueRelationships };
}

/* ---------- infer basic FDs from schema (PKs and FKs) ---------- */
function inferFDsFromTables(tables, relationships) {
  const fds = [];
  // PK -> other attrs for each table
  for (const t in tables) {
    const cols = tables[t];
    const pkCols = cols.filter(c => c.isPK).map(c => c.name);
    const otherCols = cols.map(c => c.name).filter(n => !pkCols.includes(n));
    if (pkCols.length && otherCols.length) {
      fds.push({ left: uniq(pkCols), right: uniq(otherCols) });
    }
  }
  // FKs: child.fkCols -> parent.pkCols (we produce fd from fk to referenced PK)
  for (const rel of relationships || []) {
    const child = rel.from; // child table (where FK resides)
    const parent = rel.to;
    const fkCols = rel.fkCols || [];
    const parentPKs = (tables[parent] || []).filter(c => c.isPK).map(c => c.name);
    if (fkCols.length && parentPKs.length) {
      fds.push({ left: uniq(fkCols), right: uniq(parentPKs) });
      // Also parentPK -> parent non-PK attrs already created above
    }
  }
  // break multi-right into atomic right attributes (canonicalCover will split)
  return fds;
}

/* ---------- closure, canonical cover, candidate keys (fixed) ---------- */

function attrsUnion(arr) {
  const s = new Set();
  arr.forEach(a => (Array.isArray(a) ? a : [a]).forEach(x => s.add(x)));
  return Array.from(s);
}

function closure(attributes, fds) {
  // Safety checks
  if (!Array.isArray(attributes)) {
    return [];
  }
  if (!Array.isArray(fds)) {
    fds = [];
  }

  const closureSet = new Set(attributes);
  let changed = true;
  while (changed) {
    changed = false;
    for (const fd of fds) {
      // Handle both {left, right} and {lhs, rhs} formats
      const leftSide = fd.left || fd.lhs || [];
      const rightSide = fd.right || fd.rhs || [];
      
      if (Array.isArray(leftSide) && Array.isArray(rightSide)) {
        if (leftSide.every(a => closureSet.has(a))) {
          for (const b of rightSide) {
            if (!closureSet.has(b)) {
              closureSet.add(b);
              changed = true;
            }
          }
        }
      }
    }
  }
  return Array.from(closureSet);
}

function canonicalCover(fds) {
  // Safety check
  if (!Array.isArray(fds) || fds.length === 0) {
    return [];
  }

  // 1. single attribute RHS
  let f = [];
  for (const fd of fds) {
    const leftSide = fd.left || fd.lhs || [];
    const rightSide = fd.right || fd.rhs || [];
    
    if (Array.isArray(leftSide) && Array.isArray(rightSide)) {
      for (const r of rightSide) {
        f.push({ left: uniq(leftSide.slice()), right: [r] });
      }
    }
  }

  // 2. remove extraneous attributes from LHS
  for (let i = 0; i < f.length; i++) {
    const fd = f[i];
    if (fd.left.length > 1) {
      for (let j = 0; j < fd.left.length; j++) {
        const a = fd.left[j];
        const tempLeft = fd.left.filter((_, idx) => idx !== j);
        const otherFDs = f.filter((_, idx) => idx !== i);
        const testFDs = otherFDs.concat([{ left: tempLeft, right: fd.right }]);
        const cl = closure(tempLeft, testFDs);
        if (cl.includes(fd.right[0])) {
          fd.left = tempLeft;
          j--;
        }
      }
    }
  }

  // 3. remove redundant FDs
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < f.length; i++) {
      const temp = f.slice(0, i).concat(f.slice(i + 1));
      const cl = closure(f[i].left, temp);
      if (cl.includes(f[i].right[0])) {
        f.splice(i, 1);
        changed = true;
        break;
      }
    }
  }

  // merge same-left
  const merged = {};
  for (const fd of f) {
    const key = fd.left.join(',');
    merged[key] = merged[key] || { left: fd.left, right: [] };
    if (!merged[key].right.includes(fd.right[0])) merged[key].right.push(fd.right[0]);
  }
  return Object.values(merged);
}

// Fixed candidate keys function with better error handling
function candidateKeys(attributes, fds) {
  // Safety checks
  if (!Array.isArray(attributes) || attributes.length === 0) {
    return [];
  }
  if (!Array.isArray(fds)) {
    fds = [];
  }

  // Standardize FDs to { left: [], right: [] } format
  const safeFDs = fds.map(fd => ({
    left: Array.isArray(fd.left) ? fd.left : (Array.isArray(fd.lhs) ? fd.lhs : []),
    right: Array.isArray(fd.right) ? fd.right : (Array.isArray(fd.rhs) ? fd.rhs : [])
  }));

  const allAttrs = [...attributes];
  const results = [];
  const n = allAttrs.length;

  // Generate all non-empty subsets
  const combos = [];
  for (let mask = 1; mask < (1 << n); mask++) {
    const set = [];
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) set.push(allAttrs[i]);
    }
    combos.push(set);
  }
  combos.sort((a, b) => a.length - b.length);

  for (const c of combos) {
    const cl = closure(c, safeFDs) || [];
    if (allAttrs.every(a => cl.includes(a))) {
      // Check minimality
      let isMinimal = true;
      for (const prev of results) {
        if (prev.every(p => c.includes(p))) {
          isMinimal = false;
          break;
        }
      }
      if (isMinimal) results.push(c);
    }
  }

  // If no key found, fallback to all attributes as a key
  if (results.length === 0) {
    results.push(allAttrs);
  }

  return results;
}

/* ---------- 3NF synthesis (fixed) ---------- */
function synthesize3NF(attrs, fds) {
  if (!Array.isArray(attrs) || !Array.isArray(fds)) {
    return [];
  }

  const c = canonicalCover(fds);
  const relations = c.map(fd => {
    const relAttrs = Array.from(new Set([...fd.left, ...fd.right]));
    return { attrs: relAttrs, reason: `from FD ${fd.left.join(',')} -> ${fd.right.join(',')}` };
  });

  // ensure a key exists in result relations
  const keys = candidateKeys(attrs, fds);
  if (keys.length > 0) {
    const key = keys[0];
    const hasKey = relations.some(r => key.every(k => r.attrs.includes(k)));
    if (!hasKey) relations.push({ attrs: key, reason: 'added to preserve key' });
  }

  // convert to string
  return relations.map(r => r.attrs.join(','));
}

/* ---------- BCNF decomposition (fixed) ---------- */

function findViolatingFD(attrs, fds) {
  // look for fd where left is not superkey (i.e., closure(left) != attrs)
  for (const fd of fds) {
    const leftSide = fd.left || fd.lhs || [];
    const rightSide = fd.right || fd.rhs || [];
    
    if (!Array.isArray(leftSide) || !Array.isArray(rightSide)) {
      continue;
    }
    
    const cl = closure(leftSide, fds);
    if (!attrs.every(a => cl.includes(a))) {
      // Skip trivial FDs (where RHS is subset of LHS)
      if (rightSide.every(r => leftSide.includes(r))) continue;
      return { left: leftSide, right: rightSide };
    }
  }
  return null;
}

function bcnfDecompose(attrs, fds) {
  if (!Array.isArray(attrs) || !Array.isArray(fds)) {
    return [];
  }

  const result = [];
  function recurse(Rattrs, Rfds) {
    const viol = findViolatingFD(Rattrs, Rfds);
    if (!viol) {
      result.push(Rattrs.slice());
      return;
    }
    const X = viol.left;
    const Y = viol.right;
    const R1 = uniq([...X, ...Y]);
    const R2 = Rattrs.filter(a => !Y.includes(a) || X.includes(a));
    const projFDs1 = Rfds.filter(fd => {
      const left = fd.left || fd.lhs || [];
      const right = fd.right || fd.rhs || [];
      return left.concat(right).every(a => R1.includes(a));
    });
    const projFDs2 = Rfds.filter(fd => {
      const left = fd.left || fd.lhs || [];
      const right = fd.right || fd.rhs || [];
      return left.concat(right).every(a => R2.includes(a));
    });
    recurse(R1, projFDs1);
    recurse(R2, projFDs2);
  }
  recurse(attrs.slice(), fds.slice());
  
  // dedupe
  const uniqOut = [];
  const seen = new Set();
  for (const r of result) {
    const s = r.sort().join(',');
    if (!seen.has(s)) { seen.add(s); uniqOut.push(r); }
  }
  return uniqOut.map(r => r.join(','));
}

/* ---------- 2NF decomposition (fixed) ---------- */
function decompose2NF(relName, attrs, relPK, fds) {
  if (!Array.isArray(attrs) || !Array.isArray(fds)) {
    return [{ name: relName, attrs: attrs || [] }];
  }

  let remaining = attrs.slice();
  const newRels = [];
  
  if (!relPK || relPK.length === 0) {
    return [{ name: relName, attrs: remaining }];
  }
  
  for (const fd of fds) {
    const leftSide = fd.left || fd.lhs || [];
    const rightSide = fd.right || fd.rhs || [];
    
    if (!Array.isArray(leftSide) || !Array.isArray(rightSide)) {
      continue;
    }
    
    const leftIsSubsetOfPK = leftSide.every(a => relPK.includes(a));
    const leftEqualsPK = leftSide.length === relPK.length && leftSide.every(a => relPK.includes(a));
    
    if (leftIsSubsetOfPK && !leftEqualsPK) {
      const newAttrs = uniq([...leftSide, ...rightSide]);
      newRels.push({ name: `${relName}_${leftSide.join('')}`, attrs: newAttrs });
      remaining = remaining.filter(a => !rightSide.includes(a) || leftSide.includes(a));
    }
  }
  
  newRels.unshift({ name: relName, attrs: remaining });
  return newRels;
}

// Fixed normalizeSteps with dependency loading
function normalizeSteps(relations, fdsInput) {
  // Ensure every relation has a valid attributes array
  relations = (relations || []).map(rel => {
    if (Array.isArray(rel.attributes)) {
      return { ...rel, attributes: rel.attributes };
    }
    if (Array.isArray(rel.attrs)) {
      return { ...rel, attributes: rel.attrs };
    }
    if (typeof rel === "string") {
      const match = rel.match(/\(([^)]+)\)/);
      if (match) {
        return {
          name: rel.split("(")[0].trim(),
          attributes: match[1].split(",").map(a => a.trim())
        };
      }
    }
    return { ...rel, attributes: [] };
  });

  // Safety: default empty arrays if missing
  const safeFds = (fdsInput || []).map(fd => ({
    left: Array.isArray(fd.left) ? fd.left : (Array.isArray(fd.lhs) ? fd.lhs : []),
    right: Array.isArray(fd.right) ? fd.right : (Array.isArray(fd.rhs) ? fd.rhs : [])
  }));

  // Determine all attributes
  let attrs = [];
  if (relations && relations.length === 1) {
    attrs = relations[0].attributes.slice();
  } else if (relations && relations.length > 1) {
    const set = new Set();
    relations.forEach(r => r.attributes.forEach(a => set.add(a)));
    attrs = Array.from(set);
  } else {
    attrs = safeFds.length ? attrsUnion(safeFds.map(fd => fd.left.concat(fd.right))) : [];
  }

  // 1NF: Basic relations (assuming already atomic values)
  const nf1 = relations.map(rel => ({
    name: rel.name,
    attributes: rel.attributes,
    reason: "Atomic values assumed"
  }));

  // 2NF: Remove partial dependencies
  const nf2Relations = [];
  if (relations && relations.length) {
    relations.forEach(r => {
      const rAttrs = r.attributes.slice();
      const localFDs = safeFds.filter(fd => fd.left.concat(fd.right).every(a => rAttrs.includes(a)));
      const keys = candidateKeys(rAttrs, localFDs);
      const pk = (keys.length ? keys[0] : [rAttrs[0]] || []);
      const decomposed = decompose2NF(r.name, rAttrs, pk, localFDs);
      decomposed.forEach(d => nf2Relations.push({
        name: d.name,
        attributes: d.attrs,
        reason: "Removed partial dependencies"
      }));
    });
  } else if (attrs.length) {
    nf2Relations.push({
      name: 'R',
      attributes: attrs,
      reason: "Single relation"
    });
  }

  // 3NF: Synthesis algorithm
  const nf3Strings = synthesize3NF(attrs, safeFds);
  const nf3Relations = nf3Strings.map((relStr, index) => ({
    name: `R${index + 1}`,
    attributes: relStr.split(','),
    reason: "3NF synthesis"
  }));

  // BCNF: Decomposition algorithm
  const bcnfStrings = bcnfDecompose(attrs, safeFds);
  const bcnfRelations = bcnfStrings.map((relStr, index) => ({
    name: `R${index + 1}`,
    attributes: relStr.split(','),
    reason: "BCNF decomposition"
  }));

  return {
    '1NF': nf1,
    '2NF': nf2Relations,
    '3NF': nf3Relations,
    'BCNF': bcnfRelations
  };
}

// Helper to generate SQL CREATE TABLE
function generateCreateTable(table) {
  if (!table || !table.attributes) {
    return '';
  }
  
  let pk = table.primaryKey || [];
  let cols = table.attributes.map(attr => {
    let pkFlag = pk.includes(attr) ? ' PRIMARY KEY' : '';
    return `  ${attr} TEXT${pkFlag}`;
  }).join(',\n');

  return `CREATE TABLE ${table.name || 'UnknownTable'} (\n${cols}\n);`;
}

function generateChenNotation(parsed) {
  if (!parsed || !parsed.tables) {
    return "@startchen\n@endchen";
  }
  
  let out = "@startchen\n";
  for (const tableName in parsed.tables) {
    out += `entity ${tableName} {\n`;
    const cols = parsed.tables[tableName] || [];
    cols.forEach(col => {
      const type = col.type || "STRING";
      if (col.isPK) out += `  ${col.name} : ${type} <<key>>\n`;
      else if (col.isFK) out += `  ${col.name} : ${type} <<FK>>\n`;
      else out += `  ${col.name} : ${type}\n`;
    });
    out += "}\n\n";
  }
  out += "@endchen";
  return out;
}

/* ---------- exports ---------- */
module.exports = {
  parseInput,
  parseSQLFile,
  inferFDsFromTables,
  normalizeSteps,
  canonicalCover,
  candidateKeys,
  closure,
  generateChenNotation,
  generateCreateTable,
  synthesize3NF,
  bcnfDecompose,
  decompose2NF
};