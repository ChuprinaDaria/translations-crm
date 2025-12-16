import { useState } from "react";
import { LoginForm } from "./LoginForm";
import { RegisterForm } from "./RegisterForm";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

interface AuthPageProps {
  onAuthSuccess: () => void;
}

export function AuthPage({ onAuthSuccess }: AuthPageProps) {
  const [mode, setMode] = useState<"login" | "register" | "forgotPassword">("login");

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-[#FF5A00] rounded-2xl mb-4">
            <svg
              className="w-8 h-8 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <h1 className="text-2xl text-gray-900 mb-2">CRM Система</h1>
          <p className="text-gray-600">
            Комерційні пропозиції • Продажі • Сервіс
          </p>
        </div>

        {/* Auth Forms */}
        {mode === "login" ? (
          <LoginForm
            onSuccess={onAuthSuccess}
            onSwitchToRegister={() => setMode("register")}
            onSwitchToForgotPassword={() => setMode("forgotPassword")}
          />
        ) : mode === "register" ? (
          <RegisterForm
            onSwitchToLogin={() => setMode("login")}
          />
        ) : (
          <ForgotPasswordForm
            onBack={() => setMode("login")}
          />
        )}

        {/* Footer */}
        <p className="text-center text-xs text-gray-500 mt-8">
          © 2024 CRM Система. Всі права захищені.
        </p>
      </div>
    </div>
  );
}