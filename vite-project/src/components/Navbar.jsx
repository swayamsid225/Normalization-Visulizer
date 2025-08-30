// Navbar.jsx
import { Link, useLocation } from 'react-router-dom';

const navItems = [
  { name: 'Home', path: '/' },
  { name: 'Upload SQL', path: '/upload' },
  { name: 'Write SQL', path: '/write' },
  { name: 'Normalize', path: '/normalize' },
  { name: 'Community', path: '/community' },
];

const Navbar = () => {
  const { pathname } = useLocation();

  return (
    <nav className="fixed top-0 w-full z-50 bg-purple-900/30 backdrop-blur-lg shadow-lg border-b border-purple-400/20">
      <div className="max-w-7xl mx-auto px-6 py-3 flex justify-between items-center">
        {/* Logo / Title */}
        <h1 className="text-xl font-bold text-white drop-shadow-lg">
          Normalization <span className="text-blue-300">Visualizer</span>
        </h1>

        {/* Nav Links */}
        <div className="flex space-x-6">
          {navItems.map((item) => {
            const isActive = pathname === item.path;
            return (
              <Link
                key={item.name}
                to={item.path}
                className="group relative px-3 py-2 text-sm font-medium text-white hover:text-blue-200 transition"
              >
                {item.name}
                {/* Underline animation */}
                <span
                  className={`absolute left-0 bottom-0 h-0.5 bg-blue-300 transition-all duration-300 ${
                    isActive ? 'w-full' : 'w-0 group-hover:w-full'
                  }`}
                ></span>
              </Link>
            );
          })}
        </div>
      </div>
      {/* Glow effect bottom border */}
      <div className="h-[2px] w-full bg-gradient-to-r from-blue-400 via-purple-300 to-pink-400 animate-pulse"></div>
    </nav>
  );
};

export default Navbar;
