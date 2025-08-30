function getCandidateKeys(attributes, fds) {
  // Safety checks
  if (!Array.isArray(attributes) || attributes.length === 0) {
    return [];
  }
  if (!Array.isArray(fds)) {
    fds = [];
  }

  // Standardize FDs to { lhs: [], rhs: [] }
  const safeFDs = fds.map(fd => ({
    lhs: Array.isArray(fd.lhs) ? fd.lhs : (Array.isArray(fd.left) ? fd.left : []),
    rhs: Array.isArray(fd.rhs) ? fd.rhs : (Array.isArray(fd.right) ? fd.right : [])
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
