import { useState, useEffect } from "react";
import { Plus, Search, Edit, Trash2, Loader2, RefreshCw } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Card, CardContent } from "./ui/card";
import { Badge } from "./ui/badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { Checkbox } from "./ui/checkbox";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { toast } from "sonner";
import { itemsApi, categoriesApi, subcategoriesApi, type Item, type Category, type Subcategory, type ItemCreate } from "../lib/api";
import { Skeleton } from "./ui/skeleton";

export function ItemsManagement() {
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [deleteItemId, setDeleteItemId] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const itemsPerPage = 20;

  // Form state
  const [formData, setFormData] = useState<ItemCreate>({
    name: "",
    description: "",
    price: 0,
    weight: 0,
    unit: "г",
    photo_url: "",
    active: true,
    subcategory_id: 0,
  });

  // Load initial data
  useEffect(() => {
    loadData();
  }, [currentPage]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [itemsData, categoriesData, subcategoriesData] = await Promise.all([
        itemsApi.getItems(currentPage * itemsPerPage, itemsPerPage),
        categoriesApi.getCategories(),
        subcategoriesApi.getSubcategories(),
      ]);

      // API returns array, not paginated response
      setItems(itemsData);
      setTotalItems(itemsData.length);
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

  // Filter subcategories by selected category
  const filteredSubcategories = selectedCategory
    ? subcategories.filter((sub) => sub.category_id === selectedCategory)
    : subcategories;

  // Filter items by search query
  const filteredItems = items.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const openCreateDialog = () => {
    setEditingItem(null);
    setFormData({
      name: "",
      description: "",
      price: 0,
      weight: 0,
      unit: "г",
      photo_url: "",
      active: true,
      subcategory_id: 0,
    });
    setSelectedCategory(null);
    setIsDialogOpen(true);
  };

  const openEditDialog = (item: Item) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      description: item.description || "",
      price: item.price,
      weight: item.weight || 0,
      unit: item.unit || "г",
      photo_url: item.photo_url || "",
      active: item.active,
      subcategory_id: item.subcategory_id,
    });
    setSelectedCategory(item.subcategory?.category_id || null);
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.subcategory_id) {
      toast.error("Заповніть всі обов'язкові поля");
      return;
    }

    setActionLoading(true);
    try {
      if (editingItem) {
        await itemsApi.updateItem(editingItem.id, formData);
        toast.success("Товар оновлено");
      } else {
        await itemsApi.createItem(formData);
        toast.success("Товар додано");
      }
      setIsDialogOpen(false);
      loadData();
    } catch (error: any) {
      toast.error(error.data?.detail || "Помилка збереження товару");
      console.error("Submit error:", error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteItemId) return;

    setActionLoading(true);
    try {
      await itemsApi.deleteItem(deleteItemId);
      toast.success("Товар видалено");
      setDeleteItemId(null);
      loadData();
    } catch (error: any) {
      toast.error(error.data?.detail || "Помилка видалення товару");
      console.error("Delete error:", error);
    } finally {
      setActionLoading(false);
    }
  };

  const totalPages = Math.ceil(totalItems / itemsPerPage);

  if (loading && items.length === 0) {
    return (
      <div className="space-y-4 md:space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl text-gray-900 mb-2">Управління товарами</h1>
          <p className="text-sm md:text-base text-gray-600">
            Каталог товарів та послуг для комерційних пропозицій
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            className="bg-[#FF5A00] hover:bg-[#FF5A00]/90 w-full sm:w-auto"
            onClick={openCreateDialog}
          >
            <Plus className="w-4 h-4 mr-2" />
            Додати товар
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Пошук товарів..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Items Table */}
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">Фото</TableHead>
                    <TableHead className="min-w-[150px]">Назва</TableHead>
                    <TableHead className="min-w-[200px] hidden lg:table-cell">Опис</TableHead>
                    <TableHead className="min-w-[100px]">Ціна</TableHead>
                    <TableHead className="min-w-[80px]">Вага</TableHead>
                    <TableHead className="min-w-[120px] hidden md:table-cell">Категорія</TableHead>
                    <TableHead className="min-w-[80px]">Статус</TableHead>
                    <TableHead className="text-right min-w-[100px]">Дії</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                        {searchQuery ? "Товари не знайдено" : "Додайте перший товар"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredItems.map((item) => (
                      <TableRow key={item.id} className="hover:bg-gray-50">
                        <TableCell>
                          <div className="w-12 h-12 rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
                            {item.photo_url ? (
                              <ImageWithFallback
                                src={item.photo_url}
                                alt={item.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-400">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-gray-900">{item.name}</div>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <div className="text-gray-600 max-w-[300px] truncate text-sm">
                            {item.description || "—"}
                          </div>
                        </TableCell>
                        <TableCell className="text-gray-900">{item.price} грн</TableCell>
                        <TableCell className="text-gray-600 text-sm">
                          {item.weight ? `${item.weight}${item.unit}` : "—"}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <div className="text-sm">
                            <div className="text-gray-900">{item.subcategory?.name}</div>
                            <div className="text-gray-500 text-xs">{item.subcategory?.category?.name}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={item.active ? "default" : "secondary"} className={item.active ? "bg-green-100 text-green-800" : ""}>
                            {item.active ? "Активний" : "Неактивний"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditDialog(item)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteItemId(item.id)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  Сторінка {currentPage + 1} з {totalPages} • Всього: {totalItems}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                    disabled={currentPage === 0 || loading}
                  >
                    Назад
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
                    disabled={currentPage >= totalPages - 1 || loading}
                  >
                    Вперед
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? "Редагувати товар" : "Додати новий товар"}
            </DialogTitle>
            <DialogDescription>
              {editingItem ? "Змініть інформацію про товар" : "Заповніть дані для створення товару"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">
                Назва <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Канапе з лососем"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Опис</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Детальний опис товару..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="price">
                  Ціна (грн) <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="price"
                  type="number"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                  min="0"
                  step="0.01"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="weight">Вага</Label>
                <div className="flex gap-2">
                  <Input
                    id="weight"
                    type="number"
                    value={formData.weight}
                    onChange={(e) => setFormData({ ...formData, weight: Number(e.target.value) })}
                    min="0"
                    className="flex-1"
                  />
                  <Select
                    value={formData.unit}
                    onValueChange={(value) => setFormData({ ...formData, unit: value })}
                  >
                    <SelectTrigger className="w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="г">г</SelectItem>
                      <SelectItem value="кг">кг</SelectItem>
                      <SelectItem value="мл">мл</SelectItem>
                      <SelectItem value="л">л</SelectItem>
                      <SelectItem value="шт">шт</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">
                  Категорія <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={selectedCategory?.toString() || ""}
                  onValueChange={(value) => {
                    setSelectedCategory(Number(value));
                    setFormData({ ...formData, subcategory_id: 0 });
                  }}
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
                <Label htmlFor="subcategory">
                  Підкатегорія <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.subcategory_id.toString()}
                  onValueChange={(value) => setFormData({ ...formData, subcategory_id: Number(value) })}
                  disabled={!selectedCategory}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Оберіть підкатегорію" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredSubcategories.map((sub) => (
                      <SelectItem key={sub.id} value={sub.id.toString()}>
                        {sub.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="photo_url">URL фото</Label>
              <Input
                id="photo_url"
                type="url"
                value={formData.photo_url}
                onChange={(e) => setFormData({ ...formData, photo_url: e.target.value })}
                placeholder="https://example.com/photo.jpg"
              />
              {formData.photo_url && (
                <div className="mt-2 rounded-lg overflow-hidden border border-gray-200">
                  <ImageWithFallback
                    src={formData.photo_url}
                    alt="Preview"
                    className="w-full h-48 object-cover"
                  />
                </div>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="active"
                checked={formData.active}
                onCheckedChange={(checked) => setFormData({ ...formData, active: !!checked })}
              />
              <Label htmlFor="active" className="cursor-pointer">
                Активний (відображається в каталозі)
              </Label>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                onClick={handleSubmit}
                className="flex-1 bg-[#FF5A00] hover:bg-[#FF5A00]/90"
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Збереження...
                  </>
                ) : editingItem ? (
                  "Зберегти зміни"
                ) : (
                  "Додати товар"
                )}
              </Button>
              <Button
                onClick={() => setIsDialogOpen(false)}
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

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteItemId} onOpenChange={() => setDeleteItemId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Підтвердження видалення</AlertDialogTitle>
            <AlertDialogDescription>
              Ви впевнені, що хочете видалити цей товар? Цю дію неможливо скасувати.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Скасувати</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
              disabled={actionLoading}
            >
              {actionLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Видалення...
                </>
              ) : (
                "Видалити"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}