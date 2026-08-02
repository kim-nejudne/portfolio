import React, { useEffect } from "react";
import { BrowserRouter, Route, Routes, Navigate, useNavigate, useLocation } from "react-router-dom";
import { getToken } from "@/lib/api";
import AmbientBackground from "@/components/game/AmbientBackground";
import Toaster from "@/components/game/Toaster";
import Landing from "@/pages/Landing";
import SignIn from "@/pages/SignIn";
import SignUp from "@/pages/SignUp";
import Teams from "@/pages/Teams";
import TeamDetail from "@/pages/TeamDetail";
import TeamSettings from "@/pages/TeamSettings";
import Project from "@/pages/Project";
import ProjectSettings from "@/pages/ProjectSettings";
import InviteAccept from "@/pages/InviteAccept";
import TopBar from "@/components/game/TopBar";

function Protected({ children }) {
  const token = getToken();
  if (!token) return <Navigate to="/sign-in" replace />;
  return children;
}

function Shell({ children }) {
  return (
    <div className="min-h-screen relative">
      <AmbientBackground />
      <TopBar />
      <main className="px-3 sm:px-4 lg:px-6 py-6">{children}</main>
      <Toaster />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Shell>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/sign-in" element={<SignIn />} />
          <Route path="/sign-up" element={<SignUp />} />
          <Route path="/invite/:token" element={<InviteAccept />} />
          <Route path="/teams" element={<Protected><Teams /></Protected>} />
          <Route path="/teams/:teamId" element={<Protected><TeamDetail /></Protected>} />
          <Route path="/teams/:teamId/settings" element={<Protected><TeamSettings /></Protected>} />
          <Route path="/projects/:projectId" element={<Protected><Project /></Protected>} />
          <Route path="/projects/:projectId/settings" element={<Protected><ProjectSettings /></Protected>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Shell>
    </BrowserRouter>
  );
}
