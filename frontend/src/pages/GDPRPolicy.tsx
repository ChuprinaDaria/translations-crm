import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";

export function GDPRPolicy() {
  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Політика конфіденційності та GDPR</CardTitle>
          </CardHeader>
          <CardContent className="prose max-w-none">
            <div className="space-y-6">
              <section>
                <h2 className="text-xl font-semibold mb-4">1. Загальні положення</h2>
                <p>
                  Ця політика описує, як ми збираємо, використовуємо та захищаємо персональні дані користувачів відповідно до GDPR (General Data Protection Regulation).
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-4">2. Контролер даних</h2>
                <p>
                  Контролером персональних даних є адміністрація CRM системи. Всі питання щодо обробки даних можна направляти на контактну адресу.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-4">3. Які дані ми збираємо</h2>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Ім'я та контактна інформація</li>
                  <li>Дані про замовлення та переклади</li>
                  <li>Історія комунікацій з клієнтами</li>
                  <li>Технічні дані (IP адреса, тип браузера)</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-4">4. Мета обробки даних</h2>
                <p>
                  Персональні дані обробляються для надання послуг CRM системи, управління замовленнями та комунікації з клієнтами.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-4">5. Права користувачів</h2>
                <p>Відповідно до GDPR, ви маєте право:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Отримати доступ до своїх персональних даних</li>
                  <li>Виправити неточні дані</li>
                  <li>Видалити свої дані ("право на забуття")</li>
                  <li>Обмежити обробку даних</li>
                  <li>Перенести дані</li>
                  <li>Відкликати згоду на обробку</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-4">6. Видалення даних</h2>
                <p>
                  Для видалення ваших даних з Instagram інтеграції, використовуйте наступний endpoint:
                </p>
                <code className="block bg-gray-100 p-2 rounded mt-2">
                  POST /api/v1/communications/instagram/data-deletion
                </code>
                <p className="mt-4">
                  Або зверніться до адміністрації сервісу для видалення всіх ваших даних.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-4">7. Деавторизація</h2>
                <p>
                  Для відкликання доступу до Instagram даних, використовуйте:
                </p>
                <code className="block bg-gray-100 p-2 rounded mt-2">
                  POST /api/v1/communications/instagram/deauthorize
                </code>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-4">8. Захист даних</h2>
                <p>
                  Ми вживаємо технічних та організаційних заходів для захисту персональних даних від несанкціонованого доступу, втрати або знищення.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-4">9. Зберігання даних</h2>
                <p>
                  Дані зберігаються протягом необхідного періоду для надання послуг або відповідно до вимог законодавства.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-4">10. Контакти</h2>
                <p>
                  З питань щодо обробки персональних даних звертайтесь до адміністрації сервісу.
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

