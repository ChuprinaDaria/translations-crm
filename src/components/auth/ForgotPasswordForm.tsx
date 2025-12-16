import { useState, FormEvent } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Alert, AlertDescription } from "../ui/alert";
import { AlertCircle, Loader2, CheckCircle2, ArrowLeft } from "lucide-react";
import { authApi } from "../../lib/api";

interface ForgotPasswordFormProps {
  onBack: () => void;
}

type Step = "email" | "code" | "newPassword" | "success";

export function ForgotPasswordForm({ onBack }: ForgotPasswordFormProps) {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRequestCode = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    setLoading(true);
    try {
      await authApi.forgotPassword({ email });
      setSuccess("Код скидання пароля відправлено на вашу пошту");
      setStep("code");
    } catch (err: any) {
      setError(err.data?.detail || "Помилка відправки коду. Спробуйте пізніше");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (code.length !== 6) {
      setError("Код має містити 6 цифр");
      return;
    }

    setLoading(true);
    try {
      await authApi.verifyResetCode({ email, code });
      setSuccess("Код підтверджено");
      setStep("newPassword");
    } catch (err: any) {
      setError(err.data?.detail || "Невірний або прострочений код");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (newPassword.length < 6) {
      setError("Пароль має містити мінімум 6 символів");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Паролі не співпадають");
      return;
    }

    setLoading(true);
    try {
      await authApi.resetPassword({ email, code, new_password: newPassword });
      setSuccess("Пароль успішно змінено");
      setStep("success");
    } catch (err: any) {
      setError(err.data?.detail || "Помилка зміни пароля. Спробуйте пізніше");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Скидання пароля</CardTitle>
        <CardDescription>
          {step === "email" && "Введіть email для отримання коду скидання"}
          {step === "code" && "Введіть 6-значний код з email"}
          {step === "newPassword" && "Встановіть новий пароль"}
          {step === "success" && "Пароль успішно змінено"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {step === "success" ? (
          <div className="space-y-4">
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                Пароль успішно змінено. Тепер ви можете увійти з новим паролем.
              </AlertDescription>
            </Alert>
            <Button
              onClick={onBack}
              className="w-full bg-[#FF5A00] hover:bg-[#FF5A00]/90"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Повернутися до входу
            </Button>
          </div>
        ) : (
          <form
            onSubmit={
              step === "email"
                ? handleRequestCode
                : step === "code"
                ? handleVerifyCode
                : handleResetPassword
            }
            className="space-y-4"
          >
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {success && (
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>{success}</AlertDescription>
              </Alert>
            )}

            {step === "email" && (
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
            )}

            {step === "code" && (
              <div className="space-y-2">
                <Label htmlFor="code">Код з email</Label>
                <Input
                  id="code"
                  type="text"
                  placeholder="123456"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  required
                  disabled={loading}
                  maxLength={6}
                  className="text-center text-2xl tracking-widest"
                />
                <p className="text-xs text-gray-500">
                  Введіть 6-значний код, який було відправлено на {email}
                </p>
              </div>
            )}

            {step === "newPassword" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="newPassword">Новий пароль</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    disabled={loading}
                    minLength={6}
                  />
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
                </div>
              </>
            )}

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={step === "email" ? onBack : () => setStep(step === "code" ? "email" : "code")}
                disabled={loading}
                className="flex-1"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Назад
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-[#FF5A00] hover:bg-[#FF5A00]/90"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Обробка...
                  </>
                ) : (
                  step === "email"
                    ? "Відправити код"
                    : step === "code"
                    ? "Підтвердити"
                    : "Змінити пароль"
                )}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

