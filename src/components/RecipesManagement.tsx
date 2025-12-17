import { useEffect, useState, type ChangeEvent } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import { Input } from "./ui/input";
import { InfoTooltip } from "./InfoTooltip";
import { toast } from "sonner";
import {
  Upload,
  FileSpreadsheet,
  ChevronDown,
  ChevronRight,
  Pencil,
  Plus,
  Trash2,
  Link2,
} from "lucide-react";
import { tokenManager, API_BASE_URL } from "../lib/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Textarea } from "./ui/textarea";

type RecipeType = "catering" | "box";

const GROUP_UNIT = "__group__";

type CalcFile = {
  id: number;
  filename: string;
  recipe_type: RecipeType;
  size_bytes?: number | null;
  created_at?: string | null;
};

interface RecipeIngredient {
  id: number;
  product_name: string;
  weight_per_portion: number;
  unit: string;
}

interface RecipeComponentIngredient {
  id: number;
  product_name: string;
  weight_per_unit: number;  // Для інгредієнтів - вага інгредієнта, для підсекцій (GROUP_UNIT) - вихід підсекції з колонки B
  unit: string;
}

interface RecipeComponent {
  id: number;
  name: string;
  quantity_per_portion: number;
  weight_per_portion?: number | null;
  ingredients: RecipeComponentIngredient[];
}

interface Recipe {
  id: number;
  name: string;
  category: string | null;
  weight_per_portion: number | null;
  notes?: string | null;
  recipe_type: "catering" | "box";
  ingredients: RecipeIngredient[];
  components: RecipeComponent[];
}

interface ImportResult {
  recipes_imported: number;
  products_imported: number;
  errors: string[];
}

type EditableRecipe = {
  name: string;
  category: string;
  weight_per_portion: string;
  notes: string;
  recipe_type: "catering" | "box";
  ingredients: Array<{
    product_name: string;
    weight_per_portion: string;
    unit: string;
  }>;
  components: Array<{
    name: string;
    quantity_per_portion: string;
    weight_per_portion?: string;
    ingredients: Array<{
      product_name: string;
      weight_per_unit: string;
      unit: string;
    }>;
  }>;
};

export function RecipesManagement() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [activeType, setActiveType] = useState<RecipeType>("catering");
  const [files, setFiles] = useState<CalcFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [search, setSearch] = useState("");
  const [expandedRecipes, setExpandedRecipes] = useState<Set<number>>(new Set());
  const [editOpen, setEditOpen] = useState(false);
  const [editingRecipeId, setEditingRecipeId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<EditableRecipe | null>(null);
  const [linking, setLinking] = useState(false);

  const loadRecipes = async () => {
    setLoading(true);
    try {
      const token = tokenManager.getToken();
      const response = await fetch(`${API_BASE_URL}/recipes?recipe_type=${activeType}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setRecipes(data);
      } else {
        toast.error("Не вдалося завантажити техкарти");
      }
    } catch (e) {
      console.error(e);
      toast.error("Помилка завантаження техкарт");
    } finally {
      setLoading(false);
    }
  };

  const loadFiles = async () => {
    try {
      const token = tokenManager.getToken();
      const response = await fetch(
        `${API_BASE_URL}/recipes/files?recipe_type=${activeType}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (response.ok) {
        const data = await response.json();
        setFiles(data);
      } else {
        let errorMessage = "Не вдалося завантажити список файлів";
        try {
          const err = await response.json();
          if (err?.detail) {
            errorMessage = `Не вдалося завантажити список файлів: ${typeof err.detail === 'string' ? err.detail : JSON.stringify(err.detail)}`;
          } else if (err?.message) {
            errorMessage = `Не вдалося завантажити список файлів: ${err.message}`;
          }
        } catch {
          // Якщо не вдалося розпарсити JSON, використовуємо стандартне повідомлення
        }
        toast.error(errorMessage);
        setFiles([]);
      }
    } catch {
      toast.error("Помилка завантаження списку файлів");
      setFiles([]);
    }
  };

  useEffect(() => {
    loadRecipes();
    loadFiles();
  }, [activeType]);

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
      toast.error("Файл має бути у форматі Excel (.xlsx)");
      return;
    }

    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const token = tokenManager.getToken();
      const response = await fetch(
        `${API_BASE_URL}/recipes/import?recipe_type=${activeType}`,
        {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (response.ok) {
        const result: ImportResult = await response.json();
        toast.success(
          `Імпортовано: ${result.recipes_imported} техкарт, ${result.products_imported} продуктів`
        );
        if (result.errors.length > 0) {
          console.warn("Помилки імпорту:", result.errors);
          toast.warning(`Помилок: ${result.errors.length}`);
        }
        loadRecipes();
        loadFiles();
      } else {
        const error = await response.json();
        toast.error(error.detail || "Помилка імпорту");
      }
    } catch (e) {
      console.error(e);
      toast.error("Не вдалося імпортувати файл");
    } finally {
      setImporting(false);
      // Скидаємо input
      e.target.value = "";
    }
  };

  const downloadCalcFile = async (f: CalcFile) => {
    try {
      const token = tokenManager.getToken();
      const response = await fetch(`${API_BASE_URL}/recipes/files/${f.id}/download`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || "Не вдалося скачати файл");
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = f.filename || "calculations.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e: any) {
      toast.error(e?.message || "Помилка скачування");
    }
  };

  const deleteCalcFile = async (f: CalcFile) => {
    try {
      const token = tokenManager.getToken();
      const response = await fetch(`${API_BASE_URL}/recipes/files/${f.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || "Не вдалося видалити файл");
      }
      toast.success("Файл видалено");
      loadFiles();
    } catch (e: any) {
      toast.error(e?.message || "Помилка видалення");
    }
  };

  const handleAutoLink = async () => {
    setLinking(true);
    try {
      const token = tokenManager.getToken();
      const response = await fetch(
        `${API_BASE_URL}/recipes/auto-link?recipe_type=${activeType}&create_missing_items=true&update_item_weight=true`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || "Не вдалося зв'язати техкарти зі стравами");
      }

      const result = await response.json();
      const linked = result.linked || 0;
      const created = result.created_items || 0;
      const updated = result.updated_item_weights || 0;
      const skipped = result.skipped || 0;

      let message = `Зв'язано: ${linked} техкарт`;
      if (created > 0) {
        message += `, створено: ${created} страв`;
      }
      if (updated > 0) {
        message += `, оновлено ваг: ${updated}`;
      }
      if (skipped > 0) {
        message += `, пропущено: ${skipped}`;
      }

      toast.success(message);
      
      if (result.errors && result.errors.length > 0) {
        console.warn("Помилки зв'язування:", result.errors);
        toast.warning(`Помилок: ${result.errors.length}`);
      }

      loadRecipes();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Помилка зв'язування техкарт зі стравами");
    } finally {
      setLinking(false);
    }
  };

  const toggleRecipeExpand = (recipeId: number) => {
    setExpandedRecipes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(recipeId)) {
        newSet.delete(recipeId);
      } else {
        newSet.add(recipeId);
      }
      return newSet;
    });
  };

  const countIngredients = (recipe: Recipe) => {
    const direct = recipe.ingredients?.length || 0;
    const fromComponents =
      recipe.components?.reduce((sum, c) => sum + (c.ingredients?.length || 0), 0) || 0;
    return direct + fromComponents;
  };

  // Розраховує суму ваги інгредієнтів (сирі інгредієнти ДО приготування)
  const calculateIngredientsWeight = (recipe: Recipe): number => {
    let total = 0;
    
    // Вага інгредієнтів страв (для catering або додаткових інгредієнтів боксів)
    recipe.ingredients?.forEach((ing) => {
      if (ing.unit !== GROUP_UNIT && ing.weight_per_portion) {
        total += ing.weight_per_portion;
      }
    });
    
    // Вага інгредієнтів компонентів (для боксів)
    recipe.components?.forEach((component) => {
      const componentQty = component.quantity_per_portion || 1;
      component.ingredients?.forEach((ing) => {
        if (ing.unit !== GROUP_UNIT && ing.weight_per_unit) {
          total += ing.weight_per_unit * componentQty;
        }
      });
    });
    
    return total;
  };

  // Розраховує суму ваги інгредієнтів підсекції (всі інгредієнти після підсекції до наступної підсекції)
  const calculateSubsectionIngredientsWeight = (
    ingredients: RecipeIngredient[],
    subsectionIndex: number
  ): number => {
    let total = 0;
    for (let i = subsectionIndex + 1; i < ingredients.length; i++) {
      const ing = ingredients[i];
      if (ing.unit === GROUP_UNIT) {
        // Зупиняємося на наступній підсекції
        break;
      }
      if (ing.weight_per_portion) {
        total += ing.weight_per_portion;
      }
    }
    return total;
  };

  // Розраховує суму ваги інгредієнтів підсекції всередині компонента
  const calculateComponentSubsectionIngredientsWeight = (
    ingredients: RecipeComponentIngredient[],
    subsectionIndex: number,
    componentQty: number
  ): number => {
    let total = 0;
    for (let i = subsectionIndex + 1; i < ingredients.length; i++) {
      const ing = ingredients[i];
      if (ing.unit === GROUP_UNIT) {
        // Зупиняємося на наступній підсекції
        break;
      }
      if (ing.weight_per_unit) {
        total += ing.weight_per_unit * componentQty;
      }
    }
    return total;
  };

  // Розраховує суму ваги інгредієнтів компонента
  const calculateComponentIngredientsWeight = (component: RecipeComponent): number => {
    const componentQty = component.quantity_per_portion || 1;
    return component.ingredients
      .filter((ing) => ing.unit !== GROUP_UNIT && ing.weight_per_unit)
      .reduce((sum, ing) => sum + ing.weight_per_unit * componentQty, 0);
  };

  const openEdit = (recipe: Recipe) => {
    setEditingRecipeId(recipe.id);
    setDraft({
      name: recipe.name || "",
      category: recipe.category || "",
      weight_per_portion:
        recipe.weight_per_portion === null || recipe.weight_per_portion === undefined
          ? ""
          : String(recipe.weight_per_portion),
      notes: recipe.notes ? String(recipe.notes) : "",
      recipe_type: recipe.recipe_type || "catering",
      ingredients: (recipe.ingredients || []).map((i) => ({
        product_name: i.product_name || "",
        weight_per_portion: String(i.weight_per_portion ?? ""),
        unit: i.unit || "г",
      })),
      components: (recipe.components || []).map((c) => ({
        name: c.name || "",
        quantity_per_portion: String(c.quantity_per_portion ?? "1"),
        weight_per_portion:
          c.weight_per_portion === null || c.weight_per_portion === undefined
            ? ""
            : String(c.weight_per_portion),
        ingredients: (c.ingredients || []).map((i) => ({
          product_name: i.product_name || "",
          weight_per_unit: String(i.weight_per_unit ?? ""),
          unit: i.unit || "г",
        })),
      })),
    });
    setEditOpen(true);
  };

  const openCreate = () => {
    setEditingRecipeId(null);
    setDraft({
      name: "",
      category: "",
      weight_per_portion: "",
      notes: "",
      recipe_type: activeType,
      ingredients: [{ product_name: "", weight_per_portion: "", unit: "г" }],
      components: [],
    });
    setEditOpen(true);
  };

  const saveRecipe = async () => {
    if (!draft) return;
    if (!draft.name.trim()) {
      toast.error("Вкажіть назву страви");
      return;
    }

    setSaving(true);
    try {
      const token = tokenManager.getToken();

      const payload: any = {
        name: draft.name.trim(),
        category: draft.category.trim() ? draft.category.trim() : null,
        weight_per_portion: draft.weight_per_portion.trim()
          ? Number(draft.weight_per_portion.replace(",", "."))
          : null,
        notes: draft.notes?.trim() ? draft.notes.trim() : null,
        recipe_type: draft.recipe_type,
        item_id: null,
      };

      if (draft.recipe_type === "box") {
        payload.components = (draft.components || [])
          .filter((c) => c.name.trim())
          .map((c) => ({
            name: c.name.trim(),
            quantity_per_portion: c.quantity_per_portion.trim()
              ? Number(c.quantity_per_portion.replace(",", "."))
              : 1,
            weight_per_portion: c.weight_per_portion?.trim()
              ? Number(c.weight_per_portion.replace(",", "."))
              : null,
            ingredients: (c.ingredients || [])
              .filter((i) => i.product_name.trim())
              .map((i) => ({
                product_name: i.product_name.trim(),
                    unit: i.unit?.trim() || "г",
                    weight_per_unit:
                      (i.unit?.trim() || "г") === GROUP_UNIT
                        ? (i.weight_per_unit.trim()
                            ? Number(i.weight_per_unit.replace(",", "."))
                            : 0)
                        : i.weight_per_unit.trim()
                          ? Number(i.weight_per_unit.replace(",", "."))
                          : 0,
              })),
          }));
        // Дозволяємо також прямі інгредієнти для box (якщо треба)
        payload.ingredients = (draft.ingredients || [])
          .filter((i) => i.product_name.trim())
          .map((i) => ({
            product_name: i.product_name.trim(),
            unit: i.unit?.trim() || "г",
            weight_per_portion:
              (i.unit?.trim() || "г") === GROUP_UNIT
                ? (i.weight_per_portion.trim()
                    ? Number(i.weight_per_portion.replace(",", "."))
                    : 0)
                : i.weight_per_portion.trim()
                  ? Number(i.weight_per_portion.replace(",", "."))
                  : 0,
          }));
      } else {
        payload.ingredients = (draft.ingredients || [])
          .filter((i) => i.product_name.trim())
          .map((i) => ({
            product_name: i.product_name.trim(),
            unit: i.unit?.trim() || "г",
            weight_per_portion:
              (i.unit?.trim() || "г") === GROUP_UNIT
                ? (i.weight_per_portion.trim()
                    ? Number(i.weight_per_portion.replace(",", "."))
                    : 0)
                : i.weight_per_portion.trim()
                  ? Number(i.weight_per_portion.replace(",", "."))
                  : 0,
          }));
        payload.components = [];
      }

      const url =
        editingRecipeId === null
          ? `${API_BASE_URL}/recipes`
          : `${API_BASE_URL}/recipes/${editingRecipeId}`;

      const response = await fetch(url, {
        method: editingRecipeId === null ? "POST" : "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || "Не вдалося зберегти техкарту");
      }

      toast.success("Техкарту збережено");
      setEditOpen(false);
      setDraft(null);
      setEditingRecipeId(null);
      loadRecipes();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Помилка збереження");
    } finally {
      setSaving(false);
    }
  };

  const filteredRecipes = recipes.filter((recipe) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      recipe.name.toLowerCase().includes(q) ||
      (recipe.category && recipe.category.toLowerCase().includes(q))
    );
  });

  // Групуємо по категоріях
  const recipesByCategory = filteredRecipes.reduce((acc, recipe) => {
    const cat = recipe.category || "Без категорії";
    if (!acc[cat]) {
      acc[cat] = [];
    }
    acc[cat].push(recipe);
    return acc;
  }, {} as Record<string, Recipe[]>);

  console.log("🔥🔥🔥 RECIPES_COMPONENT_LOADED_V1 🔥🔥🔥");

  return (
    <div className="space-y-6">
      <div style={{backgroundColor: "red", color: "white", padding: "20px", fontSize: "30px", zIndex: 9999, textAlign: "center", fontWeight: "bold"}}>
        !!! ТЕСТ ОНОВЛЕННЯ - КНОПКА ЗВ'ЯЗУВАННЯ ДОДАНА !!!
      </div>
      <div>
        <h1 className="text-2xl text-gray-900 mb-2">Техкарти (Калькуляції)</h1>
        <p className="text-gray-600">
          Управління техкартами страв. Імпортуйте файл калькуляцій для
          автоматичного розрахунку закупки продуктів.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <CardTitle>Імпорт калькуляцій</CardTitle>
            <InfoTooltip content="Завантажте файл Excel з техкартами (формат 'Оновлена закупка 2024')" />
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={activeType === "catering" ? "default" : "outline"}
              onClick={() => setActiveType("catering")}
            >
              Кейтерінг
            </Button>
            <Button
              variant={activeType === "box" ? "default" : "outline"}
              onClick={() => setActiveType("box")}
            >
              Бокси
            </Button>
          </div>
          <div className="flex items-center gap-4">
            <label className="cursor-pointer">
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
                className="hidden"
                disabled={importing}
              />
              <Button
                variant="outline"
                className="flex items-center gap-2"
                disabled={importing}
                asChild
              >
                <span>
                  <Upload className="w-4 h-4" />
                  {importing ? "Імпортування..." : "Завантажити файл калькуляцій"}
                </span>
              </Button>
            </label>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-gray-500">
            <p className="mb-2">
              <strong>Очікуваний формат файлу:</strong>
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>
                Лист "калькуляции" — техкарти страв з інгредієнтами та вагою
              </li>
              <li>Лист "список продуктов" — словник продуктів для закупки</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>
            Завантажені файли техкарт ({files.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {files.length === 0 ? (
            <div className="text-sm text-gray-500">
              Ще не було завантажених файлів для вкладки “{activeType === "catering" ? "Кейтерінг" : "Бокси"}”.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Назва файлу</TableHead>
                  <TableHead className="w-32">Розмір</TableHead>
                  <TableHead className="w-32 text-right">Дії</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {files.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell className="whitespace-normal break-all">
                      {f.filename}
                    </TableCell>
                    <TableCell className="text-gray-500">
                      {typeof f.size_bytes === "number"
                        ? `${Math.round(f.size_bytes / 1024)} KB`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => downloadCalcFile(f)}
                        >
                          Скачати
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deleteCalcFile(f)}
                        >
                          Видалити
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <CardTitle>
              Техкарти ({filteredRecipes.length})
            </CardTitle>
          </div>
          <div className="flex w-full md:w-auto gap-2">
            <Input
              placeholder="Пошук по назві або категорії"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full md:w-64"
            />
            <Button
              variant="outline"
              className="flex items-center gap-2"
              onClick={handleAutoLink}
              disabled={linking}
              title="Автоматично зв'язати техкарти зі стравами за назвами"
            >
              <Link2 className="w-4 h-4" />
              {linking ? "Зв'язування..." : "Зв'язати зі стравами"}
              <span>DEBUG_BUTTON_HERE</span>
            </Button>
            <Button
              variant="outline"
              className="flex items-center gap-2"
              onClick={openCreate}
            >
              <Plus className="w-4 h-4" />
              Додати
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-gray-500">
              Завантаження техкарт...
            </div>
          ) : filteredRecipes.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <FileSpreadsheet className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>Техкарти не знайдено</p>
              <p className="text-sm mt-2">
                Завантажте файл калькуляцій для імпорту техкарт
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(recipesByCategory as Record<string, Recipe[]>).map(
                ([category, categoryRecipes]) => (
                <div key={category}>
                  <h3 className="text-lg font-semibold text-gray-700 mb-3 border-b pb-2">
                    {category} ({categoryRecipes.length})
                  </h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10"></TableHead>
                        <TableHead>Назва страви</TableHead>
                        <TableHead>Вихід готової, г</TableHead>
                        <TableHead>Вага інгредієнтів, г</TableHead>
                        <TableHead>Інгредієнтів</TableHead>
                        <TableHead className="w-24 text-right">Дії</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {categoryRecipes.map((recipe) => (
                        <>
                          <TableRow
                            key={recipe.id}
                            className="cursor-pointer hover:bg-gray-50"
                            onClick={() => toggleRecipeExpand(recipe.id)}
                          >
                            <TableCell>
                              {expandedRecipes.has(recipe.id) ? (
                                <ChevronDown className="w-4 h-4" />
                              ) : (
                                <ChevronRight className="w-4 h-4" />
                              )}
                            </TableCell>
                            <TableCell className="font-medium">
                              {recipe.name}
                            </TableCell>
                            <TableCell>
                              {recipe.weight_per_portion ? `${recipe.weight_per_portion} г` : "—"}
                            </TableCell>
                            <TableCell>
                              {calculateIngredientsWeight(recipe) > 0 
                                ? `${Math.round(calculateIngredientsWeight(recipe))} г` 
                                : "—"}
                            </TableCell>
                            <TableCell>{countIngredients(recipe)}</TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-2"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEdit(recipe);
                                }}
                              >
                                <Pencil className="w-4 h-4" />
                                Редагувати
                              </Button>
                            </TableCell>
                          </TableRow>
                          {expandedRecipes.has(recipe.id) && (
                            <TableRow>
                              <TableCell colSpan={6} className="bg-gray-50 p-4">
                                <div className="text-sm">
                                  <div className="flex items-center justify-between mb-2">
                                    <div>
                                      <h4 className="font-semibold">Інгредієнти:</h4>
                                      <div className="flex gap-4 text-xs text-gray-600 mt-1">
                                        {recipe.weight_per_portion && (
                                          <span>Вихід готової страви: {recipe.weight_per_portion} г</span>
                                        )}
                                        {calculateIngredientsWeight(recipe) > 0 && (
                                          <span>Вага інгредієнтів (сирі): {Math.round(calculateIngredientsWeight(recipe))} г</span>
                                        )}
                                      </div>
                                    </div>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="gap-2"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openEdit(recipe);
                                      }}
                                    >
                                      <Pencil className="w-4 h-4" />
                                      Редагувати
                                    </Button>
                                  </div>
                                  {recipe.recipe_type === "box" ? (
                                    <div className="space-y-3">
                                      {recipe.components?.length ? (
                                        <div className="space-y-3">
                                          {recipe.components.map((c) => (
                                            <div key={c.id} className="bg-white border rounded p-3">
                                              <div className="flex justify-between items-center">
                                                <div className="font-semibold">{c.name}</div>
                                                <div className="flex gap-3 text-gray-500 text-sm">
                                                  {c.weight_per_portion && (
                                                    <span>Вихід готового: {c.weight_per_portion} г</span>
                                                  )}
                                                  {calculateComponentIngredientsWeight(c) > 0 && (
                                                    <span>Вага інгредієнтів: {Math.round(calculateComponentIngredientsWeight(c))} г</span>
                                                  )}
                                                  <span>x{c.quantity_per_portion}</span>
                                                </div>
                                              </div>
                                              {c.ingredients?.length ? (
                                                <ul className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                                                  {c.ingredients.map((ing, idx) => {
                                                    const subsectionWeight = ing.unit === GROUP_UNIT
                                                      ? calculateComponentSubsectionIngredientsWeight(c.ingredients, idx, c.quantity_per_portion || 1)
                                                      : 0;
                                                    return (
                                                      <li
                                                        key={ing.id}
                                                        className={
                                                          ing.unit === GROUP_UNIT
                                                            ? "col-span-full bg-gray-100 p-2 rounded border font-semibold text-gray-800"
                                                            : "flex justify-between bg-gray-50 p-2 rounded border"
                                                        }
                                                      >
                                                        {ing.unit === GROUP_UNIT ? (
                                                          <div className="flex justify-between items-center w-full">
                                                            <span>{ing.product_name}</span>
                                                            <div className="flex gap-2 text-gray-500 text-sm">
                                                              {ing.weight_per_unit && ing.weight_per_unit > 0 && (
                                                                <span>Вихід готового: {ing.weight_per_unit} г</span>
                                                              )}
                                                              {subsectionWeight > 0 && (
                                                                <span>Вага інгредієнтів: {Math.round(subsectionWeight)} г</span>
                                                              )}
                                                            </div>
                                                          </div>
                                                        ) : (
                                                          <>
                                                            <span>{ing.product_name}</span>
                                                            <span className="text-gray-500">
                                                              {ing.weight_per_unit} {ing.unit}
                                                            </span>
                                                          </>
                                                        )}
                                                      </li>
                                                    );
                                                  })}
                                                </ul>
                                              ) : (
                                                <p className="text-gray-500 mt-2">Інгредієнтів немає</p>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      ) : recipe.ingredients?.length ? null : (
                                        <p className="text-gray-500">Компоненти не вказано</p>
                                      )}

                                      {recipe.ingredients?.length ? (
                                        <div>
                                          <div className="font-semibold text-gray-700">
                                            Додаткові інгредієнти
                                          </div>
                                          <ul className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                                            {recipe.ingredients.map((ing, idx) => {
                                              const subsectionWeight = ing.unit === GROUP_UNIT
                                                ? calculateSubsectionIngredientsWeight(recipe.ingredients, idx)
                                                : 0;
                                              return (
                                                <li
                                                  key={ing.id}
                                                  className={
                                                    ing.unit === GROUP_UNIT
                                                      ? "col-span-full bg-gray-100 p-2 rounded border font-semibold text-gray-800"
                                                      : "flex justify-between bg-white p-2 rounded border"
                                                  }
                                                >
                                                  {ing.unit === GROUP_UNIT ? (
                                                    <div className="flex justify-between items-center w-full">
                                                      <span>{ing.product_name}</span>
                                                      <div className="flex gap-2 text-gray-500 text-sm">
                                                        {ing.weight_per_portion && ing.weight_per_portion > 0 && (
                                                          <span>Вихід готового: {ing.weight_per_portion} г</span>
                                                        )}
                                                        {subsectionWeight > 0 && (
                                                          <span>Вага інгредієнтів: {Math.round(subsectionWeight)} г</span>
                                                        )}
                                                      </div>
                                                    </div>
                                                  ) : (
                                                    <>
                                                      <span>{ing.product_name}</span>
                                                      <span className="text-gray-500">
                                                        {ing.weight_per_portion} {ing.unit}
                                                      </span>
                                                    </>
                                                  )}
                                                </li>
                                              );
                                            })}
                                          </ul>
                                        </div>
                                      ) : null}
                                    </div>
                                  ) : recipe.ingredients.length > 0 ? (
                                    <ul className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                      {recipe.ingredients.map((ing, idx) => {
                                        const subsectionWeight = ing.unit === GROUP_UNIT
                                          ? calculateSubsectionIngredientsWeight(recipe.ingredients, idx)
                                          : 0;
                                        return (
                                          <li
                                            key={ing.id}
                                            className={
                                              ing.unit === GROUP_UNIT
                                                ? "col-span-full bg-gray-100 p-2 rounded border font-semibold text-gray-800"
                                                : "flex justify-between bg-white p-2 rounded border"
                                            }
                                          >
                                            {ing.unit === GROUP_UNIT ? (
                                              <div className="flex justify-between items-center w-full">
                                                <span>{ing.product_name}</span>
                                                <div className="flex gap-2 text-gray-500 text-sm">
                                                  {ing.weight_per_portion && ing.weight_per_portion > 0 && (
                                                    <span>Вихід готового: {ing.weight_per_portion} г</span>
                                                  )}
                                                  {subsectionWeight > 0 && (
                                                    <span>Вага інгредієнтів: {Math.round(subsectionWeight)} г</span>
                                                  )}
                                                </div>
                                              </div>
                                            ) : (
                                              <>
                                                <span>{ing.product_name}</span>
                                                <span className="text-gray-500">
                                                  {ing.weight_per_portion} {ing.unit}
                                                </span>
                                              </>
                                            )}
                                          </li>
                                        );
                                      })}
                                    </ul>
                                  ) : (
                                    <p className="text-gray-500">Інгредієнти не вказано</p>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) {
            setDraft(null);
            setEditingRecipeId(null);
          }
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {editingRecipeId === null ? "Нова техкарта" : "Редагування техкарти"}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Редагування техкарти: назва, категорія, вага, примітки та інгредієнти.
            </DialogDescription>
          </DialogHeader>

          {draft && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <div className="text-sm text-gray-600 mb-1">Назва</div>
                  <Input
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    placeholder="Назва страви"
                  />
                </div>
                <div>
                  <div className="text-sm text-gray-600 mb-1">Вага порції (г)</div>
                  <Input
                    value={draft.weight_per_portion}
                    onChange={(e) =>
                      setDraft({ ...draft, weight_per_portion: e.target.value })
                    }
                    placeholder="Напр. 240"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <div className="text-sm text-gray-600 mb-1">Категорія</div>
                  <Input
                    value={draft.category}
                    onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                    placeholder="Напр. Холодні закуски"
                  />
                </div>
                <div>
                  <div className="text-sm text-gray-600 mb-1">Тип</div>
                  <Input value={draft.recipe_type} disabled />
                </div>
              </div>

              <div>
                <div className="text-sm text-gray-600 mb-1">Примітки</div>
                <Textarea
                  value={draft.notes}
                  onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                  placeholder="Будь-які примітки до техкарти..."
                  className="min-h-24"
                />
              </div>

              {draft.recipe_type === "box" ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold">Компоненти</div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() =>
                        setDraft({
                          ...draft,
                          components: [
                            ...(draft.components || []),
                            {
                              name: "",
                              quantity_per_portion: "1",
                              ingredients: [
                                { product_name: "", weight_per_unit: "", unit: "г" },
                              ],
                            },
                          ],
                        })
                      }
                    >
                      <Plus className="w-4 h-4" />
                      Додати компонент
                    </Button>
                  </div>

                  {(draft.components || []).map((c, cIdx) => (
                    <div key={cIdx} className="border rounded p-3 bg-gray-50 space-y-2">
                      <div className="flex gap-2">
                        <Input
                          value={c.name}
                          onChange={(e) => {
                            const next = [...draft.components];
                            next[cIdx] = { ...next[cIdx], name: e.target.value };
                            setDraft({ ...draft, components: next });
                          }}
                          placeholder="Назва компонента"
                        />
                        <Input
                          value={c.quantity_per_portion}
                          onChange={(e) => {
                            const next = [...draft.components];
                            next[cIdx] = {
                              ...next[cIdx],
                              quantity_per_portion: e.target.value,
                            };
                            setDraft({ ...draft, components: next });
                          }}
                          placeholder="К-сть"
                          className="w-28"
                        />
                        <Input
                          value={c.weight_per_portion || ""}
                          onChange={(e) => {
                            const next = [...draft.components];
                            next[cIdx] = {
                              ...next[cIdx],
                              weight_per_portion: e.target.value,
                            };
                            setDraft({ ...draft, components: next });
                          }}
                          placeholder="Вихід (г)"
                          className="w-32"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const next = [...draft.components];
                            next.splice(cIdx, 1);
                            setDraft({ ...draft, components: next });
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold">Інгредієнти компонента</div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            onClick={() => {
                              const next = [...draft.components];
                              const nextIngs = [
                                ...(next[cIdx].ingredients || []),
                                { product_name: "", weight_per_unit: "", unit: "г" },
                              ];
                              next[cIdx] = { ...next[cIdx], ingredients: nextIngs };
                              setDraft({ ...draft, components: next });
                            }}
                          >
                            <Plus className="w-4 h-4" />
                            Додати
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            onClick={() => {
                              const next = [...draft.components];
                              const nextIngs = [
                                ...(next[cIdx].ingredients || []),
                                { product_name: "", weight_per_unit: "0", unit: GROUP_UNIT },
                              ];
                              next[cIdx] = { ...next[cIdx], ingredients: nextIngs };
                              setDraft({ ...draft, components: next });
                            }}
                          >
                            <Plus className="w-4 h-4" />
                            Підсекція
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        {(c.ingredients || []).map((ing, iIdx) => (
                          <div key={iIdx} className="flex gap-2 items-center">
                            <Input
                              value={ing.product_name}
                              onChange={(e) => {
                                const next = [...draft.components];
                                const ings = [...next[cIdx].ingredients];
                                ings[iIdx] = { ...ings[iIdx], product_name: e.target.value };
                                next[cIdx] = { ...next[cIdx], ingredients: ings };
                                setDraft({ ...draft, components: next });
                              }}
                              placeholder="Інгредієнт"
                            />
                            {ing.unit === GROUP_UNIT ? (
                              <>
                                <Input
                                  value={ing.weight_per_unit}
                                  onChange={(e) => {
                                    const next = [...draft.components];
                                    const ings = [...next[cIdx].ingredients];
                                    ings[iIdx] = { ...ings[iIdx], weight_per_unit: e.target.value };
                                    next[cIdx] = { ...next[cIdx], ingredients: ings };
                                    setDraft({ ...draft, components: next });
                                  }}
                                  placeholder="Вихід (г)"
                                  className="w-32"
                                />
                                <div className="text-sm text-gray-500 w-20 text-right">підсекція</div>
                              </>
                            ) : (
                              <>
                                <Input
                                  value={ing.weight_per_unit}
                                  onChange={(e) => {
                                    const next = [...draft.components];
                                    const ings = [...next[cIdx].ingredients];
                                    ings[iIdx] = { ...ings[iIdx], weight_per_unit: e.target.value };
                                    next[cIdx] = { ...next[cIdx], ingredients: ings };
                                    setDraft({ ...draft, components: next });
                                  }}
                                  placeholder="г"
                                  className="w-28"
                                />
                                <Input
                                  value={ing.unit}
                                  onChange={(e) => {
                                    const next = [...draft.components];
                                    const ings = [...next[cIdx].ingredients];
                                    ings[iIdx] = { ...ings[iIdx], unit: e.target.value };
                                    next[cIdx] = { ...next[cIdx], ingredients: ings };
                                    setDraft({ ...draft, components: next });
                                  }}
                                  placeholder="од."
                                  className="w-20"
                                />
                              </>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const next = [...draft.components];
                                const ings = [...next[cIdx].ingredients];
                                ings.splice(iIdx, 1);
                                next[cIdx] = { ...next[cIdx], ingredients: ings };
                                setDraft({ ...draft, components: next });
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  <div className="border-t pt-3">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold">Додаткові інгредієнти (опційно)</div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() =>
                          setDraft({
                            ...draft,
                            ingredients: [
                              ...(draft.ingredients || []),
                              { product_name: "", weight_per_portion: "", unit: "г" },
                            ],
                          })
                        }
                      >
                        <Plus className="w-4 h-4" />
                        Додати
                      </Button>
                    </div>

                    <div className="space-y-2 mt-2">
                      {(draft.ingredients || []).map((ing, idx) => (
                        <div key={idx} className="flex gap-2 items-center">
                          <Input
                            value={ing.product_name}
                            onChange={(e) => {
                              const next = [...draft.ingredients];
                              next[idx] = { ...next[idx], product_name: e.target.value };
                              setDraft({ ...draft, ingredients: next });
                            }}
                            placeholder="Назва інгредієнта"
                          />
                          <Input
                            value={ing.weight_per_portion}
                            onChange={(e) => {
                              const next = [...draft.ingredients];
                              next[idx] = { ...next[idx], weight_per_portion: e.target.value };
                              setDraft({ ...draft, ingredients: next });
                            }}
                            placeholder="г"
                            className="w-28"
                          />
                          <Input
                            value={ing.unit}
                            onChange={(e) => {
                              const next = [...draft.ingredients];
                              next[idx] = { ...next[idx], unit: e.target.value };
                              setDraft({ ...draft, ingredients: next });
                            }}
                            placeholder="од."
                            className="w-20"
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const next = [...draft.ingredients];
                              next.splice(idx, 1);
                              setDraft({ ...draft, ingredients: next });
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold">Інгредієнти</div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() =>
                          setDraft({
                            ...draft,
                            ingredients: [
                              ...(draft.ingredients || []),
                              { product_name: "", weight_per_portion: "", unit: "г" },
                            ],
                          })
                        }
                      >
                        <Plus className="w-4 h-4" />
                        Додати інгредієнт
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() =>
                          setDraft({
                            ...draft,
                            ingredients: [
                              ...(draft.ingredients || []),
                              { product_name: "", weight_per_portion: "0", unit: GROUP_UNIT },
                            ],
                          })
                        }
                      >
                        <Plus className="w-4 h-4" />
                        Підсекція
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {(draft.ingredients || []).map((ing, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <Input
                          value={ing.product_name}
                          onChange={(e) => {
                            const next = [...draft.ingredients];
                            next[idx] = { ...next[idx], product_name: e.target.value };
                            setDraft({ ...draft, ingredients: next });
                          }}
                          placeholder="Назва інгредієнта"
                        />
                        {ing.unit === GROUP_UNIT ? (
                          <>
                            <Input
                              value={ing.weight_per_portion}
                              onChange={(e) => {
                                const next = [...draft.ingredients];
                                next[idx] = { ...next[idx], weight_per_portion: e.target.value };
                                setDraft({ ...draft, ingredients: next });
                              }}
                              placeholder="Вихід (г)"
                              className="w-32"
                            />
                            <div className="text-sm text-gray-500 w-20 text-right">підсекція</div>
                          </>
                        ) : (
                          <>
                            <Input
                              value={ing.weight_per_portion}
                              onChange={(e) => {
                                const next = [...draft.ingredients];
                                next[idx] = { ...next[idx], weight_per_portion: e.target.value };
                                setDraft({ ...draft, ingredients: next });
                              }}
                              placeholder="г"
                              className="w-28"
                            />
                            <Input
                              value={ing.unit}
                              onChange={(e) => {
                                const next = [...draft.ingredients];
                                next[idx] = { ...next[idx], unit: e.target.value };
                                setDraft({ ...draft, ingredients: next });
                              }}
                              placeholder="од."
                              className="w-20"
                            />
                          </>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const next = [...draft.ingredients];
                            next.splice(idx, 1);
                            setDraft({ ...draft, ingredients: next });
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>
              Скасувати
            </Button>
            <Button onClick={saveRecipe} disabled={saving}>
              {saving ? "Збереження..." : "Зберегти"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

