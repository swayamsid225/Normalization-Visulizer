import { useState } from 'react';
import ReactFlow, { MiniMap, Controls, Background } from 'react-flow-renderer';

export default function WriteSQL() {
  const [sql, setSql] = useState('');
  const [normalizationResult, setNormalizationResult] = useState(null);
  const [comments, setComments] = useState([]);

  const handleNormalize = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/normalize/raw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql }),
      });
      if (!res.ok) throw new Error('Normalization failed');
      const data = await res.json();
      setNormalizationResult(data);
    } catch (error) {
      alert('Normalization failed');
    }
  };

  const handleAddComment = () => {
    const text = prompt('Enter your comment:');
    if (text) {
      setComments([...comments, { text, id: Date.now() }]);
    }
  };

const generateDiagramElements = (relations) => {
  if (!relations || relations.length === 0) return [];
  return relations.map((relation, idx) => ({
    id: `node-${idx}`,
    data: { label: relation },
    position: { x: idx * 200, y: 100 },
    style: {
      border: '1px solid #555',
      padding: 10,
      borderRadius: 8,
      background: '#fefefe',
      color: 'black',          
      fontWeight: 'bold'       
    },
  }));
};


  const keywords = [
    'SELECT', 'FROM', 'WHERE', 'JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN',
    'GROUP BY', 'ORDER BY', 'HAVING', 'INSERT', 'UPDATE', 'DELETE',
    'CREATE TABLE', 'PRIMARY KEY', 'FOREIGN KEY', 'INDEX', 'UNION', 'DISTINCT',
    'AS', 'ON', 'AVG()', 'SUM()', 'COUNT()', 'MAX()', 'MIN()', '⨝', '*', '=',
    '<>', 'AND', 'OR'
  ];

  return (
    <div className="relative bg-gray-50 min-h-screen w-full overflow-hidden">
      {/* Floating SQL keywords */}
      <div className="absolute inset-0 opacity-15 pointer-events-none">
        {Array.from({ length: 30 }).map((_, i) => {
          const word = keywords[Math.floor(Math.random() * keywords.length)];
          return (
            <div
              key={i}
              className="absolute text-gray-600 font-bold animate-float"
              style={{
                fontSize: `${Math.random() * 2 + 1.2}rem`,
                top: `${Math.random() * 100}%`,
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 10}s`,
                animationDuration: `${15 + Math.random() * 10}s`,
                opacity: 0.7 + Math.random() * 0.3
              }}
            >
              {word}
            </div>
          );
        })}
      </div>

      {/* Main content centered */}
      <div className="max-w-5xl mx-auto p-6 relative z-10">
        <h2 className="text-2xl font-semibold mb-4 text-gray-500">Write SQL Schema</h2>

        <textarea
          rows="10"
          value={sql}
          onChange={(e) => setSql(e.target.value)}
          placeholder="Write your CREATE TABLE statements here..."
          className="w-full p-4 border rounded mb-4 font-mono text-black bg-white"
        />

        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={handleNormalize}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Normalize
          </button>

          <button
            onClick={handleAddComment}
            className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
          >
            Add Comment
          </button>
        </div>

        {comments.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-2">Comments:</h3>
            <ul className="space-y-2">
              {comments.map((c) => (
                <li
                  key={c.id}
                  className="bg-white border p-3 rounded shadow-sm text-sm text-black"
                >
                  {c.text}
                </li>
              ))}
            </ul>
          </div>
        )}

        {normalizationResult && (
  <div className="bg-gray-100 p-4 rounded mt-4">
    <h3 className="font-semibold text-lg text-black mb-2">Normalization Result</h3>
    {['1NF', '2NF', '3NF', 'BCNF'].map((nf) => (
      <div key={nf} className="mb-8">
        <h4 className="font-bold mb-2 text-blue-600">{nf} Decomposition</h4>
        {normalizationResult[nf] && normalizationResult[nf].length > 0 ? (
          <>
            <ul className="list-disc list-inside mb-4 text-black">
              {normalizationResult[nf].map((r, idx) => (
                <li key={idx} className="text-black">{r}</li>
              ))}
            </ul>
            <div style={{ height: 250, border: '1px solid #ddd' }}>
              <ReactFlow
                nodes={generateDiagramElements(normalizationResult[nf])}
                edges={[]}
                fitView
              >
                <MiniMap />
                <Controls />
                <Background />
              </ReactFlow>
            </div>
          </>
        ) : (
                  <p className="text-gray-600">No output.</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
