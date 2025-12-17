import { useState, FormEvent } from "react";
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
  onSwitchToForgotPassword?: () => void;
}

export function LoginForm({ onSuccess, onSwitchToRegister, onSwitchToForgotPassword }: LoginFormProps) {
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
      
      tokenManager.setToken(token);
      onSuccess();
    } catch (err: any) {
      if (err.status === 422) {
        setError("Невірний email або пароль");
      } else if (err.status === 401) {
        setError("Невірний email або пароль");
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

          <div className="text-center text-sm space-y-3 mt-4">
            <div>
              <button
                type="button"
                onClick={onSwitchToForgotPassword || (() => {})}
                className="text-[#FF5A00] hover:underline font-medium"
                disabled={loading || !onSwitchToForgotPassword}
              >
                Забули пароль?
              </button>
            </div>
            <div>
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
          </div>
        </form>
      </CardContent>
    </Card>
  );
}