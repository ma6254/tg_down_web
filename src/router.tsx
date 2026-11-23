import { createBrowserRouter, Navigate } from "react-router-dom"
import { AuthGate } from "@/components/auth/AuthGate"
import { AppShell } from "@/components/layout/AppShell"
import { AccountsPage } from "@/pages/accounts"
import { DownloadsPage } from "@/pages/downloads"
import { LoginPage } from "@/pages/login"
import { NotFoundPage } from "@/pages/not-found"
import { QueuePage } from "@/pages/queue"
import { RouteErrorPage } from "@/pages/route-error"
import { SettingsPage } from "@/pages/settings"

export const router = createBrowserRouter([
  {
    element: <AuthGate />,
    errorElement: <RouteErrorPage />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <Navigate to="/accounts" replace /> },
          { path: "accounts", element: <AccountsPage /> },
          { path: "downloads", element: <DownloadsPage /> },
          { path: "queue", element: <QueuePage /> },
          { path: "settings", element: <SettingsPage /> },
          { path: "*", element: <NotFoundPage /> },
        ],
      },
    ],
  },
  { path: "/login", element: <LoginPage /> },
])
