import { useState, FormEvent } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Alert, AlertDescription } from "../ui/alert";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { authApi } from "../../lib/api";

interface RegisterFormProps {
  onSwitchToLogin: () => void;
}

export function RegisterForm({ onSwitchToLogin }: RegisterFormProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const validateForm = (): boolean => {
    if (!firstName || !lastName || !email || !password) {
      setError("Заповніть всі поля");
      return false;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Невірний формат email");
      return false;
    }

    if (password.length < 6) {
      setError("Пароль повинен містити мінімум 6 символів");
      return false;
    }

    if (password !== confirmPassword) {
      setError("Паролі не співпадають");
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      await authApi.register({
        email,
        password,
        first_name: firstName,
        last_name: lastName,
      });
      setSuccess(true);
      // After 2 seconds, switch to login
      setTimeout(() => {
        onSwitchToLogin();
      }, 2000);
    } catch (err: any) {
      if (err.status === 422) {
        setError("Невірні дані. Перевірте правильність введення");
      } else if (err.status === 400) {
        setError(err.data?.detail || "Користувач з таким email вже існує");
      } else {
        setError(err.data?.detail || "Помилка при реєстрації. Спробуйте пізніше");
      }
    } finally {
      setLoading(false);
    }
  };

  const getPasswordStrength = () => {
    if (!password) return null;
    
    let strength = 0;
    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^a-zA-Z0-9]/.test(password)) strength++;

    const colors = ["bg-red-500", "bg-orange-500", "bg-yellow-500", "bg-green-500"];
    const labels = ["Слабкий", "Середній", "Хороший", "Сильний"];
    
    return {
      color: colors[Math.min(strength - 1, 3)],
      label: labels[Math.min(strength - 1, 3)],
      width: `${Math.min((strength / 4) * 100, 100)}%`
    };
  };

  const passwordStrength = getPasswordStrength();

  // Show registration form
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Реєстрація</CardTitle>
        <CardDescription>
          Створіть новий акаунт для доступу до CRM системи
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {success && (
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Реєстрація успішна! Перенаправлення на сторінку входу...
              </AlertDescription>
            </Alert>
          )}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="firstName">Ім'я</Label>
            <Input
              id="firstName"
              type="text"
              placeholder="Іван"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="lastName">Прізвище</Label>
            <Input
              id="lastName"
              type="text"
              placeholder="Петренко"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
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
            <Label htmlFor="password">Пароль</Label>
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
            {passwordStrength && (
              <div className="space-y-1">
                <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${passwordStrength.color}`}
                    style={{ width: passwordStrength.width }}
                  />
                </div>
                <p className="text-xs text-gray-600">
                  Надійність: {passwordStrength.label}
                </p>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Підтвердіть пароль</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={loading}
              minLength={6}
            />
            {confirmPassword && (
              <div className="flex items-center gap-2 text-xs">
                {password === confirmPassword ? (
                  <>
                    <CheckCircle2 className="h-3 w-3 text-green-600" />
                    <span className="text-green-600">Паролі співпадають</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-3 w-3 text-red-600" />
                    <span className="text-red-600">Паролі не співпадають</span>
                  </>
                )}
              </div>
            )}
          </div>

          <Button
            type="submit"
            className="w-full bg-[#FF5A00] hover:bg-[#FF5A00]/90"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Реєстрація...
              </>
            ) : (
              "Зареєструватися"
            )}
          </Button>

          <div className="text-center text-sm">
            <span className="text-gray-600">Вже є акаунт? </span>
            <button
              type="button"
              onClick={onSwitchToLogin}
              className="text-[#FF5A00] hover:underline"
              disabled={loading}
            >
              Увійти
            </button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
