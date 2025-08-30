import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from '../pages/Home';
import UploadSQL from '../pages/UploadSQL';
import WriteSQL from '../pages/WriteSQL';
import Normalize from '../pages/Normalize';
import Community from '../pages/Community';

export default function AppRouter() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/upload" element={<UploadSQL />} />
        <Route path="/write" element={<WriteSQL />} />
        <Route path="/normalize" element={<Normalize />} />
        <Route path="/community" element={<Community />} />
      </Routes>
    </Router>
  );
}
