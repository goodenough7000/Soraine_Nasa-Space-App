export function sourcesByResults(sources, measurements) {
 const counts = new Map();
 for (const row of measurements) counts.set(row.source_id, (counts.get(row.source_id) || 0) + 1);
 return [...sources].sort((a,b) => (counts.get(b.source_id)||0)-(counts.get(a.source_id)||0)
   || String(a.title||a.source_id).localeCompare(String(b.title||b.source_id)));
}

// Relevance is an editorial order based on the contents of these specific files,
// not a claim that source rows are extracted measurements or independent trials.
const FILE_ORDER = ['saffire-ii','bass-ii','saffire-i','same-r','saffire-iii','bass'];
export function originalFilesByRelevance(datasets) {
 const rank = id => FILE_ORDER.includes(id) ? FILE_ORDER.indexOf(id) : FILE_ORDER.length;
 return [...datasets].sort((a,b) => rank(a.id)-rank(b.id) || a.title.localeCompare(b.title));
}
