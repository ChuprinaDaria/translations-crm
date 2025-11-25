import { useState } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Alert, AlertDescription } from "../ui/alert";
import { AlertCircle, Loader2 } from "lucide-react";
import { authApi, tokenManager } from "../../lib/api";

interface LoginFormProps {
  onSuccess: () => void;
  onSwitchToRegister: () => void;
}

export function LoginForm({ onSuccess, onSwitchToRegister }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!code || code.length !== 6) {
      setError("Введіть 6-значний код з Google Authenticator");
      return;
    }

    setLoading(true);

    try {
      // Response is a plain string token, not an object
      const token = await authApi.login({ 
        email, 
        password,
        code 
      });
      
      tokenManager.setToken(token);
      onSuccess();
    } catch (err: any) {
      if (err.status === 422) {
        setError("Невірний email або пароль");
      } else if (err.status === 401) {
        setError("Невірний код автентифікації або облікові дані");
      } else {
        setError(err.data?.detail || "Помилка при вході. Спробуйте пізніше");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Вхід в систему</CardTitle>
        <CardDescription>
          Введіть свої дані для входу в CRM систему
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
          </div>

          <div className="space-y-2">
            <Label htmlFor="code">Код з Google Authenticator</Label>
            <Input
              id="code"
              type="text"
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              required
              disabled={loading}
              maxLength={6}
              className="text-center text-xl tracking-wider"
            />
            <p className="text-xs text-gray-500">
              Введіть 6-значний код з вашого додатку для аутентифікації
            </p>
          </div>

          <Button
            type="submit"
            className="w-full bg-[#FF5A00] hover:bg-[#FF5A00]/90"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Вхід...
              </>
            ) : (
              "Увійти"
            )}
          </Button>

          <div className="text-center text-sm">
            <span className="text-gray-600">Немає акаунту? </span>
            <button
              type="button"
              onClick={onSwitchToRegister}
              className="text-[#FF5A00] hover:underline"
              disabled={loading}
            >
              Зареєструватися
            </button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}