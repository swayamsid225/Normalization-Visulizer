// src/pages/Community.jsx
import { useState, useEffect, useRef } from 'react';

export default function Community() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [shapes, setShapes] = useState([]);
  const animationRef = useRef(null);

  // Fetch posts
  useEffect(() => {
    const fetchPosts = async () => {
      try {
        const res = await fetch('http://localhost:3000/api/community/posts');
        const data = await res.json();
        if (Array.isArray(data)) {
          setPosts(data);
        } else {
          console.error('Invalid data format:', data);
          setPosts([]);
        }
      } catch (err) {
        console.error('Failed to fetch posts:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchPosts();
  }, []);

  // Create floating shapes
  useEffect(() => {
    const icons = ['table', 'key', 'diamond', 'circle'];
    const count = 15;
    const newShapes = [];
    for (let i = 0; i < count; i++) {
      newShapes.push({
        type: icons[Math.floor(Math.random() * icons.length)],
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        rotation: Math.random() * 360,
        size: 40 + Math.random() * 60,
        dx: (Math.random() - 0.5) * 0.3,
        dy: (Math.random() - 0.5) * 0.3,
        dr: (Math.random() - 0.5) * 0.1,
        opacityPhase: Math.random() * Math.PI * 2, // for pulsing
      });
    }
    setShapes(newShapes);
  }, []);

  // Animate drifting + rotation + pulsing
  useEffect(() => {
    const animate = () => {
      setShapes((prevShapes) =>
        prevShapes.map((s) => {
          let x = s.x + s.dx;
          let y = s.y + s.dy;
          let rotation = s.rotation + s.dr;
          let opacityPhase = s.opacityPhase + 0.02;
          if (x < -100) x = window.innerWidth + 100;
          if (x > window.innerWidth + 100) x = -100;
          if (y < -100) y = window.innerHeight + 100;
          if (y > window.innerHeight + 100) y = -100;
          return { ...s, x, y, rotation, opacityPhase };
        })
      );
      animationRef.current = requestAnimationFrame(animate);
    };
    animationRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationRef.current);
  }, []);

  const renderShape = (shape, idx) => {
    const opacity = 0.2 + 0.1 * Math.sin(shape.opacityPhase); // shimmer effect
    const commonProps = {
      transform: `translate(${shape.x}, ${shape.y}) rotate(${shape.rotation})`,
      fill: `rgba(147, 51, 234, ${opacity})`, // purple hologram
      stroke: `rgba(147, 51, 234, ${opacity})`,
      strokeWidth: 2,
    };
    switch (shape.type) {
      case 'table':
        return <rect key={idx} x={-shape.size / 2} y={-shape.size / 2} width={shape.size} height={shape.size * 0.6} rx="4" {...commonProps} />;
      case 'key':
        return <circle key={idx} r={shape.size / 3} {...commonProps} />;
      case 'diamond':
        return <polygon key={idx} points={`0,-${shape.size / 2} ${shape.size / 2},0 0,${shape.size / 2} -${shape.size / 2},0`} {...commonProps} />;
      case 'circle':
        return <circle key={idx} r={shape.size / 2} {...commonProps} />;
      default:
        return null;
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-gray-50">
      {/* Floating ER shapes background */}
      <svg
        className="absolute top-0 left-0 w-full h-full pointer-events-none"
        style={{ zIndex: 0 }}
      >
        {shapes.map((shape, idx) => renderShape(shape, idx))}
      </svg>

      {/* Foreground content */}
      <div className="relative p-6 max-w-5xl mx-auto z-10">
        <h2 className="text-2xl font-bold mb-6 text-purple-800">Community Contributions</h2>

        {loading && <p>Loading posts...</p>}

        {!loading && posts.length === 0 && (
          <p className="text-gray-600">
            No community posts yet. Be the first to share your normalization!
          </p>
        )}

        <div className="space-y-6">
          {Array.isArray(posts) &&
            posts.map((post) => (
              <div
                key={post.id}
                className="bg-white shadow rounded p-4 border-l-4 border-purple-600"
              >
                <h3 className="text-xl font-semibold">{post.title}</h3>
                <p className="text-sm text-gray-700 mb-2 italic">
                  by {post.author || 'Anonymous'}
                </p>

                <div className="bg-gray-100 p-3 rounded mb-3">
                  <h4 className="font-semibold mb-1 text-violet-500">Original Schema:</h4>
                  <pre className="text-sm text-gray-800 whitespace-pre-wrap">
                    {post.schema}
                  </pre>
                  <h4 className="font-semibold mt-3 mb-1 text-pink-500">Functional Dependencies:</h4>
                  <pre className="text-sm text-gray-800 whitespace-pre-wrap">
                    {post.fds || 'N/A'}
                  </pre>
                </div>

                {Array.isArray(post.optimizations) && post.optimizations.length > 0 && (
                  <div className="bg-blue-50 border border-blue-200 p-3 rounded mt-3">
                    <h4 className="font-semibold mb-2 text-teal-400">Community Suggestions:</h4>
                    {post.optimizations.map((opt, idx) => (
                      <div key={idx} className="mb-2">
                        <p className="text-sm text-gray-700">
                          <strong className='text-yellow-400'>{opt.user || 'Contributor'}:</strong> {opt.suggestion}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-4 flex gap-4">
                  <button className="text-sm text-purple-700 hover:underline">
                    📝 Contribute Optimization
                  </button>
                  <button className="text-sm text-blue-700 hover:underline">
                    💬 View Comments
                  </button>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
