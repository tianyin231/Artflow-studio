import { Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import AppLayout from './components/Layout/AppLayout';
import ProtectedRoute from './components/ProtectedRoute';
import { LoadingSpinner } from './components/common/LoadingSpinner';

// Lazy load page components for code splitting
const Dashboard = lazy(() => import('./pages/Dashboard'));
const AiIntegration = lazy(() => import('./pages/AiIntegration'));
const WorkflowSchedules = lazy(() => import('./pages/WorkflowSchedules'));
const PixivCollection = lazy(() => import('./pages/PixivCollection'));
const VideoStudio = lazy(() => import('./pages/VideoStudio'));
const PublishJobs = lazy(() => import('./pages/PublishJobs'));
const CommandPresets = lazy(() => import('./pages/CommandPresets'));
const Config = lazy(() => import('./pages/Config'));
const Download = lazy(() => import('./pages/Download'));
const UrlDownload = lazy(() => import('./pages/UrlDownload'));
const History = lazy(() => import('./pages/History'));
const Logs = lazy(() => import('./pages/Logs'));
const Files = lazy(() => import('./pages/Files'));
const Login = lazy(() => import('./pages/Login'));
const Accounts = lazy(() => import('./pages/Accounts'));
const PublishPlatforms = lazy(() => import('./pages/PublishPlatforms'));
const TemplateLibrary = lazy(() => import('./pages/TemplateLibrary'));
const PublishCalendar = lazy(() => import('./pages/PublishCalendar'));
const Plugins = lazy(() => import('./pages/Plugins'));

/**
 * AppRoutes component - contains all route definitions
 * This is separated from App to allow testing with different Router providers
 */
export function AppRoutes() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/accounts" element={<Accounts />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route
            path="dashboard"
            element={
              <Suspense fallback={<LoadingSpinner />}>
                <Dashboard />
              </Suspense>
            }
          />
          <Route
            path="config"
            element={
              <Suspense fallback={<LoadingSpinner />}>
                <Config />
              </Suspense>
            }
          />
          <Route
            path="ai"
            element={
              <Suspense fallback={<LoadingSpinner />}>
                <AiIntegration />
              </Suspense>
            }
          />
          <Route
            path="schedules"
            element={
              <Suspense fallback={<LoadingSpinner />}>
                <WorkflowSchedules />
              </Suspense>
            }
          />
          <Route
            path="collection"
            element={
              <Suspense fallback={<LoadingSpinner />}>
                <PixivCollection />
              </Suspense>
            }
          />
          <Route
            path="video"
            element={
              <Suspense fallback={<LoadingSpinner />}>
                <VideoStudio />
              </Suspense>
            }
          />
          <Route
            path="templates"
            element={
              <Suspense fallback={<LoadingSpinner />}>
                <TemplateLibrary />
              </Suspense>
            }
          />
          <Route
            path="calendar"
            element={
              <Suspense fallback={<LoadingSpinner />}>
                <PublishCalendar />
              </Suspense>
            }
          />
          <Route
            path="plugins"
            element={
              <Suspense fallback={<LoadingSpinner />}>
                <Plugins />
              </Suspense>
            }
          />
          <Route
            path="publish-platforms"
            element={
              <Suspense fallback={<LoadingSpinner />}>
                <PublishPlatforms />
              </Suspense>
            }
          />
          <Route
            path="accounts"
            element={
              <Suspense fallback={<LoadingSpinner />}>
                <Accounts />
              </Suspense>
            }
          />
          <Route
            path="publish"
            element={
              <Suspense fallback={<LoadingSpinner />}>
                <PublishJobs />
              </Suspense>
            }
          />
          <Route
            path="presets"
            element={
              <Suspense fallback={<LoadingSpinner />}>
                <CommandPresets />
              </Suspense>
            }
          />
          <Route
            path="download"
            element={
              <Suspense fallback={<LoadingSpinner />}>
                <Download />
              </Suspense>
            }
          />
          <Route
            path="url-download"
            element={
              <Suspense fallback={<LoadingSpinner />}>
                <UrlDownload />
              </Suspense>
            }
          />
          <Route
            path="history"
            element={
              <Suspense fallback={<LoadingSpinner />}>
                <History />
              </Suspense>
            }
          />
          <Route
            path="logs"
            element={
              <Suspense fallback={<LoadingSpinner />}>
                <Logs />
              </Suspense>
            }
          />
          <Route
            path="files"
            element={
              <Suspense fallback={<LoadingSpinner />}>
                <Files />
              </Suspense>
            }
          />
        </Route>
      </Routes>
    </Suspense>
  );
}
