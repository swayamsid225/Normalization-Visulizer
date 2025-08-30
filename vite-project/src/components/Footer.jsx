// src/components/Footer.jsx
import React from "react";
import { motion } from "framer-motion";

export default function Footer() {
  return (
    <motion.footer
      initial={{ y: 50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="mt-10 py-4 bg-white border-t border-gray-200"
    >
      <p className="text-center text-sm text-gray-500">
        Made with <span className="text-red-500">❤️</span> by Swayam
      </p>
    </motion.footer>
  );
}
