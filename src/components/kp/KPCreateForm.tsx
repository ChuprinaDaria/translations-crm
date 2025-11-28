import React, { useState, useEffect, FormEvent } from "react";
import { kpApi, templatesApi, Template, getImageUrl } from "../../lib/api";

interface KPCreateFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export function KPCreateForm({ onSuccess, onCancel }: KPCreateFormProps) {
  const [title, setTitle] = useState("");
  const [peopleCount, setPeopleCount] = useState(1);
  const [clientEmail, setClientEmail] = useState("");
  const [sendEmail, setSendEmail] = useState(false);
  const [emailMessage, setEmailMessage] = useState("");
  const [templateId, setTemplateId] = useState<number | undefined>();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Завантажуємо шаблони при монтуванні
  useEffect(() => {
    templatesApi.getTemplates().then(setTemplates).catch(console.error);
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const kp = await kpApi.createKP({
        title,
        people_count: peopleCount,
        client_email: clientEmail || undefined,
        send_email: sendEmail,
        email_message: emailMessage || undefined,
        template_id: templateId,
        items: [], // Тут мають бути вибрані страви
        total_price: 0,
        price_per_person: 0,
      });

      onSuccess();
    } catch (err: any) {
      setError(err.message || "Помилка створення КП");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium mb-1">
          Назва КП *
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className="w-full px-3 py-2 border rounded-md"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          Кількість гостей *
        </label>
        <input
          type="number"
          value={peopleCount}
          onChange={(e) => setPeopleCount(parseInt(e.target.value) || 1)}
          required
          min="1"
          className="w-full px-3 py-2 border rounded-md"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          Email клієнта
        </label>
        <input
          type="email"
          value={clientEmail}
          onChange={(e) => setClientEmail(e.target.value)}
          placeholder="client@example.com"
          className="w-full px-3 py-2 border rounded-md"
        />
      </div>

      <div>
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={sendEmail}
            onChange={(e) => setSendEmail(e.target.checked)}
          />
          <span>Відправити email одразу після створення</span>
        </label>
      </div>

      {sendEmail && (
        <div>
          <label className="block text-sm font-medium mb-1">
            Додаткове повідомлення для email
          </label>
          <textarea
            value={emailMessage}
            onChange={(e) => setEmailMessage(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border rounded-md"
            placeholder="Додаткове повідомлення для клієнта..."
          />
        </div>
      )}

      <div>
        <label className="block text-sm font-medium mb-1">
          Шаблон
        </label>
        <select
          value={templateId || ""}
          onChange={(e) => setTemplateId(e.target.value ? parseInt(e.target.value) : undefined)}
          className="w-full px-3 py-2 border rounded-md"
        >
          <option value="">Стандартний шаблон</option>
          {templates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex space-x-2">
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Створюється..." : "Створити КП"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
        >
          Скасувати
        </button>
      </div>
    </form>
  );
}

