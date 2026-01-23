import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";

export function TermsOfService() {
  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Умови використання сервісу</CardTitle>
          </CardHeader>
          <CardContent className="prose max-w-none">
            <div className="space-y-6">
              <section>
                <h2 className="text-xl font-semibold mb-4">1. Загальні положення</h2>
                <p>
                  Ці умови використання регулюють використання CRM системи для управління перекладами та комунікаціями з клієнтами.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-4">2. Прийняття умов</h2>
                <p>
                  Використовуючи цей сервіс, ви автоматично приймаєте та зобов'язуєтесь дотримуватись цих умов використання.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-4">3. Використання сервісу</h2>
                <p>
                  Користувачі зобов'язуються використовувати сервіс відповідно до чинного законодавства та не порушувати права третіх осіб.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-4">4. Конфіденційність</h2>
                <p>
                  Всі дані користувачів обробляються відповідно до нашої Політики конфіденційності та GDPR.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-4">5. Відповідальність</h2>
                <p>
                  Адміністрація сервісу не несе відповідальності за збитки, що виникли внаслідок використання або неможливості використання сервісу.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-4">6. Зміни умов</h2>
                <p>
                  Адміністрація залишає за собою право змінювати ці умови. Користувачі будуть повідомлені про зміни.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-4">7. Контакти</h2>
                <p>
                  З питань щодо умов використання звертайтесь до адміністрації сервісу.
                </p>
              </section>

              <p className="text-sm text-gray-500 mt-8">
                Останнє оновлення: {new Date().toLocaleDateString('uk-UA')}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

