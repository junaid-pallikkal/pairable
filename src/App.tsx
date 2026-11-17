import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { AuthProvider } from './lib/auth'
import { ToastProvider } from './components/Toast'
import { AppLayout, PublicLayout, RequireAuth } from './components/Layouts'
import { PageSpinner } from './components/ui'
import Home from './pages/Home'
import { About, HowItWorks, Privacy, Terms } from './pages/Static'
import { SignIn, SignUp } from './pages/Auth'

const Explore = lazy(() => import('./pages/Explore'))
const NewCase = lazy(() => import('./pages/NewCase'))
const CaseDetail = lazy(() => import('./pages/case/CaseDetail'))
const Connections = lazy(() => import('./pages/Connections'))
const Messages = lazy(() => import('./pages/Messages'))
const Notifications = lazy(() => import('./pages/Notifications'))
const Dashboard = lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })))
const Find = lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.Find })))
const Onboarding = lazy(() => import('./pages/Profile').then((m) => ({ default: m.Onboarding })))
const Resources = lazy(() => import('./pages/Resources'))
const Admin = lazy(() => import('./pages/Admin'))
const Settings = lazy(() => import('./pages/Profile').then((m) => ({ default: m.Settings })))

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <Suspense fallback={<PageSpinner />}>
            <Routes>
              <Route element={<PublicLayout />}>
                <Route index element={<Home />} />
                <Route path="explore" element={<Explore />} />
                <Route path="how-it-works" element={<HowItWorks />} />
                <Route path="about" element={<About />} />
                <Route path="privacy" element={<Privacy />} />
                <Route path="terms" element={<Terms />} />
                <Route path="sign-in" element={<SignIn />} />
                <Route path="sign-up" element={<SignUp />} />
              </Route>

              <Route path="app" element={<RequireAuth />}>
                <Route element={<AppLayout />}>
                  <Route index element={<Dashboard />} />
                  <Route path="welcome" element={<Onboarding />} />
                  <Route path="new" element={<NewCase />} />
                  <Route path="find" element={<Find />} />
                  <Route path="explore" element={<Explore />} />
                  <Route path="cases/:id" element={<CaseDetail />} />
                  <Route path="connections" element={<Connections />} />
                  <Route path="messages" element={<Messages />} />
                  <Route path="messages/:connId" element={<Messages />} />
                  <Route path="notifications" element={<Notifications />} />
                  <Route path="resources" element={<Resources />} />
                  <Route path="admin" element={<Admin />} />
                  <Route path="settings" element={<Settings />} />
                </Route>
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  )
}
