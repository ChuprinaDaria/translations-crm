import { useState, useEffect } from "react";
import { Plus, Loader2, RefreshCw, Edit, Trash2 } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Card, CardContent } from "./ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import { toast } from "sonner";
import { categoriesApi, subcategoriesApi, type Category, type Subcategory } from "../lib/api";
import { Skeleton } from "./ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

export function CategoriesManagement() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [isSubcategoryDialogOpen, setIsSubcategoryDialogOpen] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [subcategoryName, setSubcategoryName] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<number>(0);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [categoriesData, subcategoriesData] = await Promise.all([
        categoriesApi.getCategories(),
        subcategoriesApi.getSubcategories(),
      ]);

      setCategories(categoriesData);
      setSubcategories(subcategoriesData);
    } catch (error: any) {
      toast.error(error.data?.detail || "Помилка завантаження даних");
      console.error("Load error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    loadData();
    toast.success("Дані оновлено");
  };

  const handleCreateCategory = async () => {
    if (!categoryName.trim()) {
      toast.error("Введіть назву категорії");
      return;
    }

    setActionLoading(true);
    try {
      await categoriesApi.createCategory(categoryName);
      toast.success("Категорію створено");
      setCategoryName("");
      setIsCategoryDialogOpen(false);
      loadData();
    } catch (error: any) {
      toast.error(error.data?.detail || "Помилка створення категорії");
      console.error("Create category error:", error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateSubcategory = async () => {
    if (!subcategoryName.trim() || !selectedCategoryId) {
      toast.error("Заповніть всі поля");
      return;
    }

    setActionLoading(true);
    try {
      await subcategoriesApi.createSubcategory({
        name: subcategoryName,
        category_id: selectedCategoryId,
      });
      toast.success("Підкатегорію створено");
      setSubcategoryName("");
      setSelectedCategoryId(0);
      setIsSubcategoryDialogOpen(false);
      loadData();
    } catch (error: any) {
      toast.error(error.data?.detail || "Помилка створення підкатегорії");
      console.error("Create subcategory error:", error);
    } finally {
      setActionLoading(false);
    }
  };

  const getSubcategoriesCount = (categoryId: number) => {
    return subcategories.filter(sub => sub.category_id === categoryId).length;
  };

  if (loading) {
    return (
      <div className="space-y-4 md:space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl text-gray-900 mb-2">Категорії та підкатегорії</h1>
          <p className="text-sm md:text-base text-gray-600">
            Управління структурою каталогу товарів
          </p>
        </div>
        <Button
          variant="outline"
          onClick={handleRefresh}
          disabled={loading}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Categories */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg text-gray-900">Категорії</h2>
              <Button
                size="sm"
                className="bg-[#FF5A00] hover:bg-[#FF5A00]/90"
                onClick={() => setIsCategoryDialogOpen(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Додати
              </Button>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Назва</TableHead>
                    <TableHead className="text-right">Підкатегорій</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center py-8 text-gray-500">
                        Додайте першу категорію
                      </TableCell>
                    </TableRow>
                  ) : (
                    categories.map((category) => (
                      <TableRow key={category.id}>
                        <TableCell className="text-gray-900">{category.name}</TableCell>
                        <TableCell className="text-right text-gray-600">
                          {getSubcategoriesCount(category.id)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Subcategories */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg text-gray-900">Підкатегорії</h2>
              <Button
                size="sm"
                className="bg-[#FF5A00] hover:bg-[#FF5A00]/90"
                onClick={() => setIsSubcategoryDialogOpen(true)}
                disabled={categories.length === 0}
              >
                <Plus className="w-4 h-4 mr-2" />
                Додати
              </Button>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Назва</TableHead>
                    <TableHead>Категорія</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subcategories.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center py-8 text-gray-500">
                        {categories.length === 0
                          ? "Спочатку додайте категорію"
                          : "Додайте першу підкатегорію"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    subcategories.map((subcategory) => (
                      <TableRow key={subcategory.id}>
                        <TableCell className="text-gray-900">{subcategory.name}</TableCell>
                        <TableCell className="text-gray-600">
                          {categories.find(c => c.id === subcategory.category_id)?.name || "—"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Create Category Dialog */}
      <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Додати категорію</DialogTitle>
            <DialogDescription>
              Створіть нову категорію для організації товарів
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="categoryName">
                Назва категорії <span className="text-red-500">*</span>
              </Label>
              <Input
                id="categoryName"
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                placeholder="Закуски"
              />
            </div>

            <div className="flex gap-3">
              <Button
                onClick={handleCreateCategory}
                className="flex-1 bg-[#FF5A00] hover:bg-[#FF5A00]/90"
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Створення...
                  </>
                ) : (
                  "Створити"
                )}
              </Button>
              <Button
                onClick={() => setIsCategoryDialogOpen(false)}
                variant="outline"
                className="flex-1"
                disabled={actionLoading}
              >
                Скасувати
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Subcategory Dialog */}
      <Dialog open={isSubcategoryDialogOpen} onOpenChange={setIsSubcategoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Додати підкатегорію</DialogTitle>
            <DialogDescription>
              Створіть нову підкатегорію в існуючій категорії
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="parentCategory">
                Категорія <span className="text-red-500">*</span>
              </Label>
              <Select
                value={selectedCategoryId.toString()}
                onValueChange={(value) => setSelectedCategoryId(Number(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Оберіть категорію" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id.toString()}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="subcategoryName">
                Назва підкатегорії <span className="text-red-500">*</span>
              </Label>
              <Input
                id="subcategoryName"
                value={subcategoryName}
                onChange={(e) => setSubcategoryName(e.target.value)}
                placeholder="Холодні закуски"
              />
            </div>

            <div className="flex gap-3">
              <Button
                onClick={handleCreateSubcategory}
                className="flex-1 bg-[#FF5A00] hover:bg-[#FF5A00]/90"
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Створення...
                  </>
                ) : (
                  "Створити"
                )}
              </Button>
              <Button
                onClick={() => setIsSubcategoryDialogOpen(false)}
                variant="outline"
                className="flex-1"
                disabled={actionLoading}
              >
                Скасувати
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
