import { useState, useEffect } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Alert, AlertDescription } from "../ui/alert";
import { AlertCircle, CheckCircle2, Loader2, CheckCircle, Smartphone } from "lucide-react";
import { authApi, type RegisterResponse } from "../../lib/api";
import QRCode from "qrcode";

interface RegisterFormProps {
  onSwitchToLogin: () => void;
}

export function RegisterForm({ onSwitchToLogin }: RegisterFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [registrationData, setRegistrationData] = useState<RegisterResponse | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");

  // Generate QR code when registration is successful
  useEffect(() => {
    if (registrationData?.otpauth_url) {
      QRCode.toDataURL(registrationData.otpauth_url)
        .then(url => setQrCodeUrl(url))
        .catch(err => console.error("QR code generation error:", err));
    }
  }, [registrationData]);

  const validateForm = (): boolean => {
    if (!email || !password) {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const response = await authApi.register({ email, password });
      setRegistrationData(response);
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

  // Show QR code screen after successful registration
  if (registrationData) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </div>
          <CardTitle className="text-center">Реєстрація успішна!</CardTitle>
          <CardDescription className="text-center">
            Налаштуйте двофакторну аутентифікацію
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert>
            <Smartphone className="h-4 w-4" />
            <AlertDescription>
              Встановіть Google Authenticator або Authy на ваш смартфон
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-4">
                Скануйте цей QR код у вашому додатку для аутентифікації:
              </p>
              {qrCodeUrl ? (
                <div className="flex justify-center">
                  <div className="p-4 bg-white border-2 border-gray-200 rounded-lg">
                    <img src={qrCodeUrl} alt="QR Code" className="w-48 h-48" />
                  </div>
                </div>
              ) : (
                <div className="flex justify-center">
                  <Loader2 className="w-12 h-12 animate-spin text-gray-400" />
                </div>
              )}
            </div>

            <div className="bg-gray-50 p-4 rounded-lg space-y-2">
              <p className="text-xs text-gray-600">
                <strong>Інструкція:</strong>
              </p>
              <ol className="text-xs text-gray-600 space-y-1 list-decimal list-inside">
                <li>Відкрийте Google Authenticator або Authy</li>
                <li>Натисніть "Додати акаунт" або "+"</li>
                <li>Виберіть "Сканувати QR код"</li>
                <li>Наведіть камеру на QR код вище</li>
                <li>Збережіть 6-значний код для входу</li>
              </ol>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-gray-700">
                <strong>Email:</strong> {registrationData.email}
              </p>
              <p className="text-xs text-gray-500">
                Використовуйте цей email та код з authenticator для входу
              </p>
            </div>
          </div>

          <Button
            onClick={onSwitchToLogin}
            className="w-full bg-[#FF5A00] hover:bg-[#FF5A00]/90"
          >
            Продовжити до логіну
          </Button>
        </CardContent>
      </Card>
    );
  }

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
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

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
