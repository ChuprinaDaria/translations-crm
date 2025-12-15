import { useEffect, useState } from "react";
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
import { Upload, FileSpreadsheet, ChevronDown, ChevronRight } from "lucide-react";
import { tokenManager, API_BASE_URL } from "../lib/api";

interface RecipeIngredient {
  id: number;
  product_name: string;
  weight_per_portion: number;
  unit: string;
}

interface Recipe {
  id: number;
  name: string;
  category: string | null;
  weight_per_portion: number | null;
  ingredients: RecipeIngredient[];
}

interface ImportResult {
  recipes_imported: number;
  products_imported: number;
  errors: string[];
}

export function RecipesManagement() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [search, setSearch] = useState("");
  const [expandedRecipes, setExpandedRecipes] = useState<Set<number>>(new Set());

  const loadRecipes = async () => {
    setLoading(true);
    try {
      const token = tokenManager.getToken();
      const response = await fetch(`${API_BASE_URL}/recipes`, {
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

  useEffect(() => {
    loadRecipes();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
      const response = await fetch(`${API_BASE_URL}/recipes/import`, {
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

  return (
    <div className="space-y-6">
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
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <CardTitle>
              Техкарти ({filteredRecipes.length})
            </CardTitle>
          </div>
          <Input
            placeholder="Пошук по назві або категорії"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full md:w-64"
          />
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
              {Object.entries(recipesByCategory).map(([category, categoryRecipes]) => (
                <div key={category}>
                  <h3 className="text-lg font-semibold text-gray-700 mb-3 border-b pb-2">
                    {category} ({categoryRecipes.length})
                  </h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10"></TableHead>
                        <TableHead>Назва страви</TableHead>
                        <TableHead>Вага порції, г</TableHead>
                        <TableHead>Інгредієнтів</TableHead>
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
                              {recipe.weight_per_portion || "—"}
                            </TableCell>
                            <TableCell>{recipe.ingredients.length}</TableCell>
                          </TableRow>
                          {expandedRecipes.has(recipe.id) && (
                            <TableRow>
                              <TableCell colSpan={4} className="bg-gray-50 p-4">
                                <div className="text-sm">
                                  <h4 className="font-semibold mb-2">
                                    Інгредієнти:
                                  </h4>
                                  {recipe.ingredients.length > 0 ? (
                                    <ul className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                      {recipe.ingredients.map((ing) => (
                                        <li
                                          key={ing.id}
                                          className="flex justify-between bg-white p-2 rounded border"
                                        >
                                          <span>{ing.product_name}</span>
                                          <span className="text-gray-500">
                                            {ing.weight_per_portion} {ing.unit}
                                          </span>
                                        </li>
                                      ))}
                                    </ul>
                                  ) : (
                                    <p className="text-gray-500">
                                      Інгредієнти не вказано
                                    </p>
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
    </div>
  );
}

