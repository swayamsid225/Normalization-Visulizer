// src/App.jsx
import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import UploadSQL from './pages/UploadSQL';
import WriteSQL from './pages/WriteSQL';
import Normalize from './pages/Normalize';
import Community from './pages/Community';
import Navbar from './components/Navbar'; // optional, see below
import Footer from './components/Footer';

const App = () => {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/upload" element={<UploadSQL />} />
        <Route path="/write" element={<WriteSQL />} />
        <Route path="/normalize" element={<Normalize />} />
        <Route path="/community" element={<Community />} />
      </Routes>
    </>
  );
};

export default App;
