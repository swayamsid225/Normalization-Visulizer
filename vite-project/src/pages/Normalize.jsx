// src/pages/Normalize.jsx
import React, { useState } from 'react';
import ReactFlow, { MiniMap, Controls, Background } from 'react-flow-renderer';

const Normalize = () => {
  const [schemaText, setSchemaText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleNormalize = async () => {
    try {
      setUploading(true);
      setResult(null);
      setError(null);

      const res = await fetch('http://localhost:3000/api/normalize/steps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: schemaText }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || `Server error: ${res.status}`);
      }

      const data = await res.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Normalization failed');
      }
      
      setResult(data);
    } catch (err) {
      console.error('Normalization error:', err);
      setError('Error normalizing schema: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  // Safe relation string processing
  const safeProcessRelation = (relation) => {
    try {
      if (typeof relation === 'string') {
        return relation;
      }
      
      if (relation && typeof relation === 'object') {
        const name = relation.name || 'R';
        const attrs = relation.attributes || relation.attrs || [];
        if (Array.isArray(attrs)) {
          return `${name}(${attrs.join(', ')})`;
        }
      }
      
      return String(relation || 'Unknown');
    } catch (err) {
      console.warn('Error processing relation:', relation, err);
      return 'Error processing relation';
    }
  };

  // Auto-detect nodes & edges from relation definitions
  const generateDiagramElements = (relations) => {
    if (!relations || !Array.isArray(relations) || relations.length === 0) {
      return { nodes: [], edges: [] };
    }

    const nodes = [];
    const edges = [];
    const tableMap = {}; // Map: tableName -> nodeId

    try {
      relations.forEach((relation, idx) => {
        const relationStr = safeProcessRelation(relation);
        const tableName = relationStr.split("(")[0].trim();
        const nodeId = `node-${idx}`;
        tableMap[tableName] = nodeId;

        // Extract attributes from relation string
        const attrMatch = relationStr.match(/\(([^)]*)\)/);
        const attributes = attrMatch 
          ? attrMatch[1].split(',').map(attr => attr.trim()).filter(Boolean)
          : [];

        nodes.push({
          id: nodeId,
          data: { 
            label: (
              <div style={{ padding: '8px', textAlign: 'left' }}>
                <div style={{ fontWeight: 'bold', borderBottom: '1px solid #ccc', paddingBottom: '4px' }}>
                  {tableName}
                </div>
                {attributes.length > 0 ? (
                  <div style={{ marginTop: '4px', fontSize: '12px' }}>
                    {attributes.map((attr, i) => (
                      <div key={i}>{attr}</div>
                    ))}
                  </div>
                ) : (
                  <div style={{ marginTop: '4px', fontSize: '12px', fontStyle: 'italic' }}>
                    No attributes
                  </div>
                )}
              </div>
            )
          },
          position: { x: 0, y: 0 }, // will adjust later
          style: {
            border: '2px solid #333',
            borderRadius: 8,
            background: '#ffffff',
            minWidth: 150,
            fontSize: '14px',
          },
        });
      });

      // Simple layout: arrange in a grid
      const cols = Math.ceil(Math.sqrt(nodes.length));
      nodes.forEach((node, idx) => {
        const row = Math.floor(idx / cols);
        const col = idx % cols;
        node.position = {
          x: col * 200,
          y: row * 180,
        };
      });

      // Try to detect relationships from attribute names (simple heuristic)
      relations.forEach((relation, idx) => {
        const relationStr = safeProcessRelation(relation);
        const sourceTable = relationStr.split("(")[0].trim();
        const attrMatch = relationStr.match(/\(([^)]*)\)/);
        
        if (attrMatch) {
          const attributes = attrMatch[1].split(',').map(attr => attr.trim()).filter(Boolean);
          
          // Look for attributes that might be foreign keys (ending in _id or id)
          attributes.forEach(attr => {
            const lowerAttr = attr.toLowerCase();
            if (lowerAttr.endsWith('_id') || (lowerAttr === 'id' && sourceTable.toLowerCase() !== 'id')) {
              // Try to find a matching table
              const possibleTarget = lowerAttr.replace('_id', '').replace('id', '');
              Object.keys(tableMap).forEach(targetTable => {
                if (targetTable.toLowerCase().includes(possibleTarget) && targetTable !== sourceTable) {
                  const edgeId = `e-${sourceTable}-${targetTable}-${attr}`;
                  // Avoid duplicates
                  if (!edges.find(e => e.id === edgeId)) {
                    edges.push({
                      id: edgeId,
                      source: tableMap[sourceTable],
                      target: tableMap[targetTable],
                      label: attr,
                      type: 'smoothstep',
                      style: { stroke: '#666' },
                    });
                  }
                }
              });
            }
          });
        }
      });

    } catch (err) {
      console.warn('Error generating diagram elements:', err);
    }

    return { nodes, edges };
  };

  return (
    <div className="relative bg-gray-50 min-h-screen overflow-hidden">
      {/* Floating JOINs background */}
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="absolute text-gray-400 text-6xl font-bold animate-float"
            style={{
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 10}s`,
            }}
          >
            ⨝
          </div>
        ))}
      </div>

      {/* Foreground content */}
      <div className="relative p-6 max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold mb-4 text-blue-500">Normalization Visualizer</h1>

        <textarea
          value={schemaText}
          onChange={(e) => setSchemaText(e.target.value)}
          placeholder={`Example formats:
R(A, B, C, D, E)
A → B, B → C, AC → D, D → E

Or SQL:
CREATE TABLE users (
  id INT PRIMARY KEY,
  name VARCHAR(50),
  email VARCHAR(100)
);`}
          className="w-full h-40 p-3 border rounded mb-4 text-black font-mono text-sm"
        />

        <button
          onClick={handleNormalize}
          disabled={uploading || !schemaText.trim()}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {uploading ? 'Processing...' : 'Start Normalization'}
        </button>

        {uploading && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
            <p className="text-blue-600">Processing normalization...</p>
          </div>
        )}
        
        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded">
            <p className="text-red-600 font-medium">Error:</p>
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {result && (
          <div className="mt-6">
            <h2 className="text-xl font-semibold mb-2 text-purple-500">Normalization Steps</h2>

            {['1NF', '2NF', '3NF', 'BCNF'].map((nf) => (
              <div key={nf} className="mb-8">
                <h3 className="font-bold mb-2 text-black text-lg">{nf} Decomposition</h3>
                
                {result[nf] && Array.isArray(result[nf]) && result[nf].length > 0 ? (
                  <>
                    {/* Relations List */}
                    <div className="mb-4">
                      <h4 className="font-medium mb-2 text-gray-700">Relations:</h4>
                      <ul className="list-disc list-inside space-y-1">
                        {result[nf].map((r, idx) => (
                          <li className="text-black font-mono text-sm bg-gray-100 p-2 rounded" key={idx}>
                            {safeProcessRelation(r)}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Visual Diagram */}
                    <div className="border rounded-lg overflow-hidden bg-white">
                      <div className="p-3 bg-gray-100 border-b">
                        <h4 className="font-medium text-gray-700">Relations Diagram</h4>
                      </div>
                      <div style={{ height: 300 }}>
                        {(() => {
                          try {
                            const { nodes, edges } = generateDiagramElements(result[nf]);
                            return (
                              <ReactFlow 
                                nodes={nodes} 
                                edges={edges} 
                                fitView
                                fitViewOptions={{ padding: 20 }}
                              >
                                <MiniMap 
                                  nodeStrokeColor="#333"
                                  nodeColor="#fff"
                                  nodeBorderRadius={8}
                                />
                                <Controls />
                                <Background />
                              </ReactFlow>
                            );
                          } catch (flowError) {
                            console.error('ReactFlow error:', flowError);
                            return (
                              <div className="flex items-center justify-center h-full text-gray-500">
                                Error rendering diagram
                              </div>
                            );
                          }
                        })()}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="p-4 bg-gray-100 rounded border">
                    <p className="text-gray-600">No relations found for {nf}.</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Floating animation keyframes */}
      <style>
        {`
          @keyframes float {
            0% { transform: translateY(0px) rotate(0deg); }
            50% { transform: translateY(-20px) rotate(10deg); }
            100% { transform: translateY(0px) rotate(0deg); }
          }
          .animate-float {
            animation: float 8s ease-in-out infinite;
          }
        `}
      </style>
    </div>
  );
};

export default Normalize;