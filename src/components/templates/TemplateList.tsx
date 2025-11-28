import { useState, useEffect } from "react";
import { templatesApi, Template, getImageUrl } from "../../lib/api";

export function TemplateList() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const data = await templatesApi.getTemplates();
      setTemplates(data);
    } catch (err: any) {
      setError(err.message || "Помилка завантаження шаблонів");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div>Завантаження...</div>;
  }

  if (error) {
    return <div className="text-red-600">{error}</div>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {templates.map((template) => (
        <div
          key={template.id}
          className="border rounded-lg p-4 hover:shadow-lg transition-shadow"
        >
          {/* Прев'ю зображення */}
          {template.preview_image_url && (
            <div className="mb-4">
              <img
                src={getImageUrl(template.preview_image_url)}
                alt={template.name}
                className="w-full h-48 object-cover rounded"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
          )}

          {/* Назва та опис */}
          <h3 className="font-semibold text-lg mb-2">{template.name}</h3>
          {template.description && (
            <p className="text-sm text-gray-600 mb-2">{template.description}</p>
          )}

          {/* Додаткова інформація */}
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>
              {template.is_default && (
                <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                  За замовчуванням
                </span>
              )}
            </span>
            {template.created_at && (
              <span>
                {new Date(template.created_at).toLocaleDateString('uk-UA')}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

