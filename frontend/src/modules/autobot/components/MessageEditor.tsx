import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../components/ui/card';
import { Textarea } from '../../../components/ui/textarea';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Label } from '../../../components/ui/label';
import {
  MessageSquare,
  Copy,
  RotateCcw,
  Eye,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';

interface MessageEditorProps {
  message: string;
  onChange: (message: string) => void;
}

const DEFAULT_MESSAGE = `Добрий день! 👋

Це Бюро перекладів MT.

На жаль, зараз неробочий час, але ви можете:
• Написати ваше питання тут
• Відправити документ для перевірки

Наш менеджер зв'яжеться з вами в робочий час.

З цінами наших послуг ви можете ознайомитися на нашому сайті:
https://www.tlumaczeniamt.pl/cennik/

Для точної оцінки вартості, будь ласка, надішліть якісні фото або скани усіх сторінок документа.

Гарного дня! ☀️`;

const TEMPLATES = {
  professional: `Шановний клієнте,

Дякуємо за ваше звернення до Бюро перекладів MT.

Наразі наш офіс закритий. Робочі години: понеділок-п'ятниця, 9:00-18:00.

Ви можете залишити ваше повідомлення тут, і наш менеджер обов'язково з вами зв'яжеться в найближчий робочий час.

З повагою,
Команда MT Translation Bureau`,

  friendly: `Привіт! 😊

Спасибі, що написали нам!

Зараз ми не на робочому місці, але ваше повідомлення вже чекає на нас. Відповімо, як тільки повернемося в офіс!

Якщо маєте документи - сміливо надсилайте, ми їх переглянемо.

До зв'язку! 💙`,

  urgent: `⚡ ТЕРМІНОВО? Не хвилюйтесь!

Хоча зараз неробочий час, ми отримали ваше повідомлення.

Для термінових замовлень:
📧 Email: urgent@tlumaczeniamt.pl
📞 Гаряча лінія: +48 XXX XXX XXX

Для звичайних запитів - очікуйте на відповідь менеджера в робочі години.

Дякуємо за розуміння! 🙏`,
};

export function MessageEditor({ message, onChange }: MessageEditorProps) {
  const [isPreview, setIsPreview] = useState(false);
  const characterCount = message.length;
  const maxCharacters = 2000;

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(message);
    toast.success('Повідомлення скопійовано!');
  };

  const handleResetToDefault = () => {
    onChange(DEFAULT_MESSAGE);
    toast.success('Повідомлення скинуто до стандартного');
  };

  const applyTemplate = (template: keyof typeof TEMPLATES) => {
    onChange(TEMPLATES[template]);
    toast.success('Шаблон застосовано!');
  };

  // Змінні для підстановки
  const variables = [
    { key: '{company_name}', label: 'Назва компанії' },
    { key: '{client_name}', label: 'Ім\'я клієнта' },
    { key: '{current_time}', label: 'Поточний час' },
    { key: '{working_hours}', label: 'Робочі години' },
  ];

  const insertVariable = (variable: string) => {
    onChange(message + ' ' + variable);
  };

  return (
    <div className="space-y-6">
      {/* Шаблони */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-yellow-500" />
            Готові шаблони
          </CardTitle>
          <CardDescription>
            Виберіть один з готових шаблонів або створіть власне повідомлення
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => applyTemplate('professional')}
              className="p-4 text-left border-2 border-slate-200 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-all"
            >
              <div className="font-semibold text-slate-900 mb-1">
                Професійний
              </div>
              <div className="text-xs text-slate-600">
                Офіційний тон, формальна мова
              </div>
            </button>

            <button
              onClick={() => applyTemplate('friendly')}
              className="p-4 text-left border-2 border-slate-200 rounded-xl hover:border-green-400 hover:bg-green-50 transition-all"
            >
              <div className="font-semibold text-slate-900 mb-1">
                Дружній
              </div>
              <div className="text-xs text-slate-600">
                Неформальний, привітний стиль
              </div>
            </button>

            <button
              onClick={() => applyTemplate('urgent')}
              className="p-4 text-left border-2 border-slate-200 rounded-xl hover:border-red-400 hover:bg-red-50 transition-all"
            >
              <div className="font-semibold text-slate-900 mb-1">
                Термінові запити
              </div>
              <div className="text-xs text-slate-600">
                З контактами для термінових справ
              </div>
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Редактор */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Текст повідомлення</CardTitle>
              <CardDescription>
                Це повідомлення побачать клієнти поза робочим часом
              </CardDescription>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsPreview(!isPreview)}
              >
                <Eye className="w-4 h-4 mr-2" />
                {isPreview ? 'Редагувати' : 'Попередній перегляд'}
              </Button>
              <Button variant="outline" size="sm" onClick={handleCopyMessage}>
                <Copy className="w-4 h-4 mr-2" />
                Копіювати
              </Button>
              <Button variant="outline" size="sm" onClick={handleResetToDefault}>
                <RotateCcw className="w-4 h-4 mr-2" />
                Скинути
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isPreview ? (
            // Попередній перегляд
            <div className="p-6 bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl border-2 border-slate-200">
              <div className="max-w-md bg-white p-4 rounded-2xl shadow-lg">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center">
                    <MessageSquare className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900">
                      Бюро перекладів MT
                    </div>
                    <div className="text-xs text-slate-500">Автовідповідь</div>
                  </div>
                </div>
                <div className="text-sm text-slate-700 whitespace-pre-wrap">
                  {message}
                </div>
                <div className="text-xs text-slate-400 mt-3">
                  Зараз • Автоматичне повідомлення
                </div>
              </div>
            </div>
          ) : (
            // Редактор
            <>
              <div className="space-y-2">
                <Label htmlFor="message">Повідомлення</Label>
                <Textarea
                  id="message"
                  value={message}
                  onChange={(e) => onChange(e.target.value)}
                  rows={12}
                  className="font-mono text-sm"
                  placeholder="Введіть текст автоматичної відповіді..."
                />
                <div className="flex items-center justify-between text-xs">
                  <span
                    className={
                      characterCount > maxCharacters
                        ? 'text-red-600 font-semibold'
                        : 'text-slate-500'
                    }
                  >
                    {characterCount} / {maxCharacters} символів
                  </span>
                  {characterCount > maxCharacters && (
                    <span className="text-red-600 font-semibold">
                      Перевищено ліміт символів!
                    </span>
                  )}
                </div>
              </div>

              {/* Змінні для вставки */}
              <div className="space-y-2">
                <Label>Вставити змінні (не підтримується поки що)</Label>
                <div className="flex flex-wrap gap-2">
                  {variables.map((variable) => (
                    <Button
                      key={variable.key}
                      variant="outline"
                      size="sm"
                      onClick={() => insertVariable(variable.key)}
                      disabled
                    >
                      {variable.label}
                      <Badge variant="secondary" className="ml-2 text-xs">
                        {variable.key}
                      </Badge>
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-slate-500">
                  Змінні будуть автоматично замінені на реальні дані при надсиланні
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Поради */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-sm text-blue-900">
            💡 Поради для ефективного повідомлення
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-blue-800">
            <li className="flex items-start gap-2">
              <span className="text-blue-600">•</span>
              <span>Вкажіть робочі години, щоб клієнт знав, коли очікувати відповідь</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600">•</span>
              <span>Додайте посилання на сайт або прайс для самостійного ознайомлення</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600">•</span>
              <span>Запропонуйте відправити документи одразу для швидшої обробки</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600">•</span>
              <span>Використовуйте емодзі для дружнього тону (але не переборщуйте)</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

