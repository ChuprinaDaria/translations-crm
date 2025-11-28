import { useState, FormEvent, ChangeEvent } from "react";
import { itemsApi, ItemCreate, getImageUrl } from "../../lib/api";

interface ItemFormProps {
  item?: ItemCreate;
  onSuccess: () => void;
  onCancel: () => void;
}

export function ItemForm({ item, onSuccess, onCancel }: ItemFormProps) {
  const [name, setName] = useState(item?.name || "");
  const [description, setDescription] = useState(item?.description || "");
  const [price, setPrice] = useState(item?.price?.toString() || "");
  const [weight, setWeight] = useState(item?.weight?.toString() || "");
  const [unit, setUnit] = useState(item?.unit || "");
  const [subcategoryId, setSubcategoryId] = useState(item?.subcategory_id?.toString() || "");
  const [active, setActive] = useState(item?.active ?? true);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(
    item?.photo_url ? getImageUrl(item.photo_url) || null : null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handlePhotoChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhoto(file);
      // Створюємо прев'ю
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const itemData: ItemCreate = {
        name,
        description: description || undefined,
        price: price ? parseFloat(price) : undefined,
        weight: weight ? parseFloat(weight) : undefined,
        unit: unit || undefined,
        subcategory_id: subcategoryId ? parseInt(subcategoryId) : undefined,
        active,
        photo: photo || undefined,
        photo_url: item?.photo_url || undefined,
      };

      if (item && 'id' in item) {
        await itemsApi.updateItem((item as any).id, itemData);
      } else {
        await itemsApi.createItem(itemData);
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message || "Помилка збереження страви");
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
          Назва страви *
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full px-3 py-2 border rounded-md"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          Опис
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border rounded-md"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">
            Ціна
          </label>
          <input
            type="number"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="w-full px-3 py-2 border rounded-md"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Вага
          </label>
          <input
            type="number"
            step="0.1"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            className="w-full px-3 py-2 border rounded-md"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          Одиниця виміру (г/кг/мл...)
        </label>
        <input
          type="text"
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          placeholder="г"
          className="w-full px-3 py-2 border rounded-md"
        />
      </div>

      {/* Завантаження фото */}
      <div>
        <label className="block text-sm font-medium mb-1">
          Фото страви
        </label>
        <input
          type="file"
          accept="image/*"
          onChange={handlePhotoChange}
          className="w-full px-3 py-2 border rounded-md"
        />
        {photoPreview && (
          <div className="mt-2">
            <img
              src={photoPreview}
              alt="Прев'ю"
              className="w-32 h-32 object-cover rounded"
            />
          </div>
        )}
      </div>

      <div>
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
          />
          <span>Активна</span>
        </label>
      </div>

      <div className="flex space-x-2">
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Збереження..." : item ? "Оновити" : "Створити"}
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

