// src/pages/Home.jsx
import { Link } from 'react-router-dom';
import { Sun, Moon } from 'lucide-react';
import { motion } from 'framer-motion';
import { useMemo, useState, useEffect } from 'react';

function generateERDiagram(numTables = 20) {
  const tableNames = ['STUDENT', 'COURSE', 'ENROLLMENT', 'PROFESSOR', 'DEPARTMENT', 'GRADE', 'CLASSROOM', 'SUBJECT', 'INSTRUCTOR', 'FACULTY'];
  const attrNames = ['ID', 'Name', 'Title', 'RollNo', 'Dept', 'Credits', 'Date', 'Room', 'Section'];

  return Array.from({ length: numTables }, (_, i) => {
    const depth = Math.random(); // 0 = far, 1 = close
    return {
      id: i,
      name: tableNames[Math.floor(Math.random() * tableNames.length)],
      attrs: Array.from({ length: 2 + Math.floor(Math.random() * 4) }, () => attrNames[Math.floor(Math.random() * attrNames.length)]),
      x: Math.random() * 1200,
      y: Math.random() * 800,
      width: 80 + depth * 80,
      color: `hsl(${Math.random() * 360}, 50%, ${50 + depth * 20}%)`,
      depth,
      opacity: 0.1 + depth * 0.4
    };
  });
}

export default function Home() {
  const tables = useMemo(() => generateERDiagram(22), []);

  // Create random joins
  const lines = useMemo(() => {
    const l = [];
    for (let i = 0; i < tables.length; i++) {
      const toIndex = Math.floor(Math.random() * tables.length);
      if (toIndex !== i) {
        l.push({ from: tables[i].id, to: toIndex });
      }
    }
    return l;
  }, [tables]);

  // Theme toggle state
  const [theme, setTheme] = useState('dark');

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 flex flex-col items-center text-center p-8 relative overflow-hidden transition-colors duration-300">

      {/* Theme Toggle Button */}
<button
  onClick={toggleTheme}
  className="absolute top-6 right-6 p-3 rounded-full 
             bg-gray-200 dark:bg-gray-700 shadow-lg 
             hover:scale-105 transition-transform"
>
  {theme === 'light' ? (
    <Moon className="text-gray-800 stroke-[2] fill-gray-800" size={20} />
  ) : (
    <Sun className="text-yellow-400 stroke-[2] fill-yellow-400" size={20} />
  )}
</button>


      {/* 3D ER Diagram Background */}
      <svg className="absolute inset-0 pointer-events-none" width="100%" height="100%" viewBox="0 0 1400 900">
        <defs>
          <marker id="arrow" markerWidth="10" markerHeight="10" refX="5" refY="3" orient="auto">
            <path d="M0,0 L0,6 L9,3 z" fill="#6b7280" />
          </marker>
        </defs>

        {/* Lines */}
        {lines.map((l, idx) => {
          const from = tables.find(t => t.id === l.from);
          const to = tables.find(t => t.id === l.to);
          return (
            <motion.line
              key={idx}
              x1={from.x + from.width / 2}
              y1={from.y + 20}
              x2={to.x + to.width / 2}
              y2={to.y + 20}
              stroke="#6b7280"
              strokeWidth={1 + from.depth}
              opacity={(from.opacity + to.opacity) / 2}
              markerEnd="url(#arrow)"
              animate={{
                x1: [from.x + from.width / 2, from.x + from.width / 2 + (Math.random() * 10 - 5)],
                y1: [from.y + 20, from.y + 20 + (Math.random() * 10 - 5)],
                x2: [to.x + to.width / 2, to.x + to.width / 2 + (Math.random() * 10 - 5)],
                y2: [to.y + 20, to.y + 20 + (Math.random() * 10 - 5)]
              }}
              transition={{
                duration: 6 + Math.random() * 3,
                repeat: Infinity,
                repeatType: 'mirror',
                ease: 'easeInOut'
              }}
            />
          );
        })}

        {/* Tables */}
        {tables.map((t, i) => (
          <motion.g
            key={i}
            initial={{ x: t.x, y: t.y }}
            animate={{
              x: [t.x, t.x + (Math.random() * 15 - 7), t.x],
              y: [t.y, t.y + (Math.random() * 15 - 7), t.y]
            }}
            transition={{
              duration: 6 + Math.random() * 3,
              repeat: Infinity,
              repeatType: 'mirror',
              ease: 'easeInOut'
            }}
          >
            <rect
              width={t.width}
              height={40 + t.attrs.length * 12}
              rx="6"
              fill={t.color}
              opacity={t.opacity}
            />
            <text x={8} y={18} fill="white" fontSize={10 + t.depth * 4} fontWeight="bold" opacity={t.opacity}>
              {t.name}
            </text>
            {t.attrs.map((attr, idx) => (
              <text
                key={idx}
                x={8}
                y={32 + idx * 12}
                fill="white"
                fontSize={8 + t.depth * 3}
                opacity={t.opacity}
              >
                {attr}
              </text>
            ))}
          </motion.g>
        ))}
      </svg>

      {/* Hero Title */}
      <motion.h1
        className="text-5xl font-extrabold mb-4 text-gray-800 dark:text-white z-10"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8 }}
      >
        Normalization <span className="text-blue-600">Visualizer</span>
      </motion.h1>

      <motion.p
        className="text-lg text-gray-600 dark:text-gray-300 mb-10 max-w-2xl z-10"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.8 }}
      >
        Upload your SQL schema or write one from scratch. 
        Visualize and normalize your database up to BCNF, 
        with step-by-step guidance and community collaboration.
      </motion.p>

      {/* Action Cards */}
      <motion.div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 w-full max-w-4xl z-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6, duration: 0.8 }}
      >
        {[
          {
            to: "/upload",
            title: "Upload SQL File",
            desc: "Import a schema from an SQL dump file.",
            icon: "https://cdn.lordicon.com/ilgqmqtz.json",
            color: "blue",
          },
          {
            to: "/write",
            title: "Write SQL Schema",
            desc: "Manually input and edit your schema.",
            icon: "https://cdn.lordicon.com/eeolefdw.json",
            color: "green",
          },
          {
            to: "/normalize",
            title: "Normalize Schema",
            desc: "Step-by-step normalization to BCNF.",
            icon: "https://cdn.lordicon.com/noncoqhc.json",
            color: "purple",
          },
          {
            to: "/community",
            title: "Community",
            desc: "Get feedback & share optimizations.",
            icon: "https://cdn.lordicon.com/aksvbzmu.json",
            color: "indigo",
          },
        ].map((card, idx) => (
          <Link
            key={idx}
            to={card.to}
            className={`flex flex-col items-center p-6 rounded-2xl shadow-lg bg-gradient-to-br from-${card.color}-50 to-white dark:from-gray-800 dark:to-gray-700 hover:scale-105 transition-transform`}
          >
            <script src="https://cdn.lordicon.com/lordicon.js"></script>
            <lord-icon
              src={card.icon}
              trigger="hover"
              stroke="bold"
              colors="primary:#2563eb,secondary:#60a5fa"
              style={{ width: "120px", height: "120px", marginBottom: "1rem" }}
            ></lord-icon>
            <h2 className="font-semibold text-lg mb-2 text-gray-800 dark:text-white">{card.title}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-300 text-center">{card.desc}</p>
          </Link>
        ))}
      </motion.div>

    </div>
  );
}
