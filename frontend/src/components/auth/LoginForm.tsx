import { useState, FormEvent } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Alert, AlertDescription } from "../ui/alert";
import { AlertCircle, Loader2 } from "lucide-react";
import { authApi, tokenManager } from "../../lib/api";
import { useI18n } from "../../lib/i18n";

interface LoginFormProps {
  onSuccess: () => void;
  onSwitchToRegister: () => void;
  onSwitchToForgotPassword?: () => void;
}

export function LoginForm({ onSuccess, onSwitchToRegister, onSwitchToForgotPassword }: LoginFormProps) {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    setLoading(true);

    try {
      // Response is a plain string token, not an object
      const token = await authApi.login({ 
        email, 
        password
      });
      
      // Очищаємо dev_mode при нормальному логіні
      localStorage.removeItem('dev_mode');
      
      tokenManager.setToken(token);
      onSuccess();
    } catch (err: any) {
      if (err.status === 422) {
        setError(t("auth.login.errors.invalidCredentials"));
      } else if (err.status === 401) {
        setError(t("auth.login.errors.invalidCredentials"));
      } else {
        setError(err.data?.detail || t("auth.login.errors.loginError"));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDevLogin = () => {
    // Встановлюємо dev_mode для обходу автентифікації
    localStorage.setItem('dev_mode', 'true');
    
    // Створюємо тестовий токен для розробки (на випадок якщо потрібен)
    // Формат: header.payload.signature (мінімальний валідний JWT)
    const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
    const payload = btoa(JSON.stringify({
      sub: "1",
      email: "dev@test.com",
      role: "MANAGER",
      is_admin: false,
      exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 години
    }));
    const signature = "dev_signature"; // Фейкова підпис для розробки
    const devToken = `${header}.${payload}.${signature}`;
    
    tokenManager.setToken(devToken);
    console.log('[Dev] Dev mode enabled - skipping authentication');
    onSuccess();
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>{t("auth.login.title")}</CardTitle>
        <CardDescription>
          {t("auth.login.description")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">{t("auth.login.email")}</Label>
            <Input
              id="email"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">{t("auth.login.password")}</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              minLength={6}
            />
          </div>

          <Button
            type="submit"
            className="w-full bg-[#FF5A00] hover:bg-[#FF5A00]/90"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("auth.login.loggingIn")}
              </>
            ) : (
              t("auth.login.loginButton")
            )}
          </Button>

          {/* Dev Login Button - тільки для розробки */}
          {import.meta.env.DEV && (
            <Button
              type="button"
              onClick={handleDevLogin}
              variant="outline"
              className="w-full mt-2 border-gray-300 text-gray-600 hover:bg-gray-50"
              disabled={loading}
            >
              🔧 Dev Login (без логіну)
            </Button>
          )}

          <div className="text-center text-sm mt-4 space-y-3">
            <div>
              <button
                type="button"
                onClick={() => onSwitchToForgotPassword?.()}
                className="text-[#FF5A00] hover:underline font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={loading || !onSwitchToForgotPassword}
              >
                {t("auth.login.forgotPassword")}
              </button>
            </div>
            <div>
              <span className="text-gray-600">{t("auth.login.noAccount")} </span>
              <button
                type="button"
                onClick={onSwitchToRegister}
                className="text-[#FF5A00] hover:underline"
                disabled={loading}
              >
                {t("auth.login.register")}
              </button>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}