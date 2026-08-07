import React from 'react';
import { Link } from 'react-router-dom';

/**
 * A portfolio piece gets linked into, and links rot. Without this route an
 * unknown path rendered the chrome around an empty <main>.
 */
export const NotFoundView: React.FC = () => {
  return (
    <div className="max-w-xl mx-auto py-20 px-4 sm:px-8 text-center">
      <span className="font-mono-data text-[10px] uppercase tracking-[0.3em] text-[#8C6E43] block mb-2">
        Error 404 · Off the printed index
      </span>
      <h1 className="font-display text-4xl sm:text-5xl text-[#1A1715] tracking-tight">
        NO SUCH PAGE
      </h1>
      <p className="font-serif-body text-base text-[#6B635A] italic mt-3 mb-8">
        This edition of the menu does not carry that entry.
      </p>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        <Link
          to="/"
          className="w-full sm:w-auto px-8 py-3 bg-[#1A1715] text-[#F7F4EE] hover:bg-[#7A2322] text-xs uppercase tracking-[0.2em] font-sans-ui transition-colors"
        >
          Return to Overview
        </Link>
        <Link
          to="/menu"
          className="w-full sm:w-auto px-8 py-3 border border-[#38322D] text-[#1A1715] hover:border-[#7A2322] hover:text-[#7A2322] text-xs uppercase tracking-[0.2em] font-sans-ui transition-colors"
        >
          Read the Printed Menu
        </Link>
      </div>
    </div>
  );
};
