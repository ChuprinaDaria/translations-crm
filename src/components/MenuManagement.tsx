import React, { useState, useEffect, ChangeEvent } from "react";
import {
  itemsApi,
  categoriesApi,
  subcategoriesApi,
  menusApi,
  type ItemCreate,
  type Menu,
  type MenuItemCreate,
  getImageUrl,
} from "../lib/api";
import type { Item, Category, Subcategory } from "../lib/api";
import { toast } from "sonner";
import {
  ChefHat,
  Plus,
  Search,
  Pencil,
  Trash2,
  FolderOpen,
  Tag,
  Loader2,
  ListChecks,
} from "lucide-react";

import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Card, CardContent } from "./ui/card";
import { Badge } from "./ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import { Textarea } from "./ui/textarea";
import { Switch } from "./ui/switch";

export function MenuManagement() {
  // States
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [loading, setLoading] = useState(false);

  // Menus
  const [menus, setMenus] = useState<Menu[]>([]);
  const [selectedMenu, setSelectedMenu] = useState<Menu | null>(null);
  const [isMenuFormOpen, setIsMenuFormOpen] = useState(false);
  const [menuForm, setMenuForm] = useState<{
    name: string;
    description: string;
    event_format: string;
    people_count: string;
    items: MenuItemCreate[];
  }>({
    name: "",
    description: "",
    event_format: "",
    people_count: "",
    items: [],
  });
  
  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  
  // Modals - Items
  const [isCreateItemModalOpen, setIsCreateItemModalOpen] = useState(false);
  const [isEditItemModalOpen, setIsEditItemModalOpen] = useState(false);
  const [isDeleteItemDialogOpen, setIsDeleteItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [itemToDelete, setItemToDelete] = useState<Item | null>(null);
  
  // Modals - Categories
  const [isCreateCategoryModalOpen, setIsCreateCategoryModalOpen] = useState(false);
  const [isDeleteCategoryDialogOpen, setIsDeleteCategoryDialogOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
  
  // Modals - Subcategories
  const [isCreateSubcategoryModalOpen, setIsCreateSubcategoryModalOpen] = useState(false);
  const [isDeleteSubcategoryDialogOpen, setIsDeleteSubcategoryDialogOpen] = useState(false);
  const [subcategoryToDelete, setSubcategoryToDelete] = useState<Subcategory | null>(null);
  const [selectedCategoryForSubcategory, setSelectedCategoryForSubcategory] = useState<number | null>(null);
  
  // Form - Item
  const [itemFormData, setItemFormData] = useState<ItemCreate>({
    name: "",
    description: "",
    price: 0,
    weight: 0,
    unit: "",
    photo_url: "",
    active: true,
    subcategory_id: 0,
  });
  const [itemPhotoFile, setItemPhotoFile] = useState<File | null>(null);
  const [itemPhotoPreview, setItemPhotoPreview] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("");
  
  // Form - Category
  const [categoryFormData, setCategoryFormData] = useState({ name: "" });
  
  // Form - Subcategory
  const [subcategoryFormData, setSubcategoryFormData] = useState({
    name: "",
    category_id: 0,
  });

  // Load data
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [itemsData, categoriesData, subcategoriesData, menusData] = await Promise.all([
        itemsApi.getItems(0, 1000),
        categoriesApi.getCategories(),
        subcategoriesApi.getSubcategories(),
        menusApi.getMenus(),
      ]);
      
      setItems(itemsData);
      setCategories(categoriesData);
      setSubcategories(subcategoriesData);
      setMenus(menusData);
      toast.success("Дані завантажено");
    } catch (error: any) {
      toast.error("Помилка завантаження даних");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Filtered items
  const filteredItems = items.filter(item => {
    const matchesSearch = !searchQuery || 
      item.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !categoryFilter || 
      item.subcategory?.category_id === parseInt(categoryFilter);
    const matchesStatus = !statusFilter || 
      (statusFilter === 'active' ? item.active : !item.active);
    
    return matchesSearch && matchesCategory && matchesStatus;
  });

  // ITEM HANDLERS
  const handleItemPhotoChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setItemPhotoFile(file);
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setItemPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setItemPhotoPreview(null);
    }
  };

  const resetItemForm = () => {
    setItemFormData({
      name: "",
      description: "",
      price: 0,
      weight: 0,
      unit: "",
      photo_url: "",
      active: true,
      subcategory_id: 0,
    });
    setSelectedCategory("");
    setItemPhotoFile(null);
    setItemPhotoPreview(null);
  };

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!itemFormData.name.trim()) {
      toast.error("Введіть назву страви");
      return;
    }
    if (itemFormData.price <= 0) {
      toast.error("Ціна повинна бути більше 0");
      return;
    }
    if (!itemFormData.subcategory_id) {
      toast.error("Виберіть категорію");
      return;
    }
    
    setLoading(true);
    try {
      const payload: ItemCreate = {
        ...itemFormData,
        photo: itemPhotoFile || undefined,
      };
      const newItem = await itemsApi.createItem(payload);
      setItems([...items, newItem]);
      setIsCreateItemModalOpen(false);
      resetItemForm();
      toast.success("Страву створено!");
    } catch (error: any) {
      toast.error(error.data?.detail || "Помилка створення");
    } finally {
      setLoading(false);
    }
  };

  const handleEditItem = (item: Item) => {
    setEditingItem(item);
    setItemFormData({
      name: item.name,
      description: item.description || "",
      price: item.price,
      weight: item.weight || 0,
      unit: item.unit || "",
      photo_url: item.photo_url || "",
      active: item.active,
      subcategory_id: item.subcategory_id,
    });
    setSelectedCategory(item.subcategory?.category_id?.toString() || "");
    setItemPhotoFile(null);
    setItemPhotoPreview(item.photo_url ? getImageUrl(item.photo_url) || null : null);
    setIsEditItemModalOpen(true);
  };

  const handleUpdateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    
    setLoading(true);
    try {
      const payload: ItemCreate = {
        ...itemFormData,
        photo: itemPhotoFile || undefined,
      };
      const updatedItem = await itemsApi.updateItem(editingItem.id, payload);
      setItems(items.map(item => item.id === editingItem.id ? updatedItem : item));
      setIsEditItemModalOpen(false);
      setEditingItem(null);
      resetItemForm();
      toast.success("Страву оновлено!");
    } catch (error: any) {
      toast.error(error.data?.detail || "Помилка оновлення");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteItem = async () => {
    if (!itemToDelete) return;
    
    setLoading(true);
    try {
      await itemsApi.deleteItem(itemToDelete.id);
      setItems(items.filter(item => item.id !== itemToDelete.id));
      setIsDeleteItemDialogOpen(false);
      setItemToDelete(null);
      toast.success("Страву видалено!");
    } catch (error: any) {
      toast.error(error.data?.detail || "Помилка видалення");
    } finally {
      setLoading(false);
    }
  };

  // CATEGORY HANDLERS
  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!categoryFormData.name.trim()) {
      toast.error("Введіть назву категорії");
      return;
    }
    
    setLoading(true);
    try {
      const newCategory = await categoriesApi.createCategory(categoryFormData.name);
      setCategories([...categories, newCategory]);
      setIsCreateCategoryModalOpen(false);
      setCategoryFormData({ name: "" });
      toast.success("Категорію створено!");
    } catch (error: any) {
      toast.error(error.data?.detail || "Помилка створення");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCategory = async () => {
    if (!categoryToDelete) return;
    
    setLoading(true);
    try {
      await categoriesApi.deleteCategory(categoryToDelete.id);
      setCategories(categories.filter(cat => cat.id !== categoryToDelete.id));
      setIsDeleteCategoryDialogOpen(false);
      setCategoryToDelete(null);
      toast.success("Категорію видалено!");
    } catch (error: any) {
      toast.error(error.data?.detail || "Помилка видалення");
    } finally {
      setLoading(false);
    }
  };

  // SUBCATEGORY HANDLERS
  const handleCreateSubcategory = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!subcategoryFormData.name.trim()) {
      toast.error("Введіть назву підкатегорії");
      return;
    }
    if (!subcategoryFormData.category_id) {
      toast.error("Виберіть категорію");
      return;
    }
    
    setLoading(true);
    try {
      const newSubcategory = await subcategoriesApi.createSubcategory(subcategoryFormData);
      setSubcategories([...subcategories, newSubcategory]);
      setIsCreateSubcategoryModalOpen(false);
      setSubcategoryFormData({ name: "", category_id: 0 });
      setSelectedCategoryForSubcategory(null);
      toast.success("Підкатегорію створено!");
      loadData(); // Reload to get updated data
    } catch (error: any) {
      toast.error(error.data?.detail || "Помилка створення");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSubcategory = async () => {
    if (!subcategoryToDelete) return;
    
    setLoading(true);
    try {
      await subcategoriesApi.deleteSubcategory(subcategoryToDelete.id);
      setSubcategories(subcategories.filter(sub => sub.id !== subcategoryToDelete.id));
      setIsDeleteSubcategoryDialogOpen(false);
      setSubcategoryToDelete(null);
      toast.success("Підкатегорію видалено!");
    } catch (error: any) {
      toast.error(error.data?.detail || "Помилка видалення");
    } finally {
      setLoading(false);
    }
  };

  // Filtered subcategories for item form
  const filteredSubcategories = selectedCategory
    ? subcategories.filter(sub => sub.category_id === parseInt(selectedCategory))
    : [];

  // MENU HELPERS
  const resetMenuForm = () => {
    setSelectedMenu(null);
    setMenuForm({
      name: "",
      description: "",
      event_format: "",
      people_count: "",
      items: [],
    });
  };

  const openCreateMenu = () => {
    resetMenuForm();
    setIsMenuFormOpen(true);
  };

  const openEditMenu = (menu: Menu) => {
    setSelectedMenu(menu);
    setMenuForm({
      name: menu.name,
      description: menu.description || "",
      event_format: menu.event_format || "",
      people_count: menu.people_count?.toString() || "",
      items: menu.items.map(mi => ({
        item_id: mi.item_id,
        quantity: mi.quantity,
      })),
    });
    setIsMenuFormOpen(true);
  };

  const addItemToMenuForm = () => {
    if (items.length === 0) {
      toast.error("Спочатку додайте хоч одну страву");
      return;
    }
    setMenuForm((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          item_id: items[0].id,
          quantity: 1,
        },
      ],
    }));
  };

  const updateMenuFormItem = (
    index: number,
    field: "item_id" | "quantity",
    value: string
  ) => {
    setMenuForm((prev) => {
      const updated = [...prev.items];
      if (field === "item_id") {
        updated[index] = { ...updated[index], item_id: parseInt(value, 10) || 0 };
      } else {
        updated[index] = {
          ...updated[index],
          quantity: parseInt(value, 10) || 0,
        };
      }
      return { ...prev, items: updated };
    });
  };

  const removeMenuFormItem = (index: number) => {
    setMenuForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const handleSaveMenu = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!menuForm.name.trim()) {
      toast.error("Введіть назву меню");
      return;
    }

    const payload = {
      name: menuForm.name.trim(),
      description: menuForm.description.trim() || undefined,
      event_format: menuForm.event_format.trim() || undefined,
      people_count: menuForm.people_count
        ? parseInt(menuForm.people_count, 10) || undefined
        : undefined,
      items: menuForm.items.filter((it) => it.item_id && it.quantity > 0),
    };

    if (payload.items.length === 0) {
      toast.error("Додайте хоча б одну страву до меню");
      return;
    }

    setLoading(true);
    try {
      let saved: Menu;
      if (selectedMenu) {
        saved = await menusApi.updateMenu(selectedMenu.id, payload);
        setMenus((prev) =>
          prev.map((m) => (m.id === selectedMenu.id ? saved : m))
        );
        toast.success("Меню оновлено");
      } else {
        saved = await menusApi.createMenu(payload);
        setMenus((prev) => [...prev, saved]);
        toast.success("Меню створено");
      }
      setIsMenuFormOpen(false);
      resetMenuForm();
    } catch (error: any) {
      toast.error(error?.data?.detail || "Помилка збереження меню");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMenu = async (menu: Menu) => {
    if (!window.confirm(`Видалити меню "${menu.name}"?`)) return;
    setLoading(true);
    try {
      await menusApi.deleteMenu(menu.id);
      setMenus((prev) => prev.filter((m) => m.id !== menu.id));
      if (selectedMenu?.id === menu.id) {
        resetMenuForm();
        setIsMenuFormOpen(false);
      }
      toast.success("Меню видалено");
    } catch (error: any) {
      toast.error(error?.data?.detail || "Помилка видалення меню");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl text-gray-900">Меню / Страви</h1>
          <p className="text-gray-500">Управління стравами та їх категоріями</p>
        </div>
        <Button
          onClick={() => setIsCreateItemModalOpen(true)}
          className="bg-[#FF5A00] hover:bg-[#FF5A00]/90"
        >
          <Plus className="mr-2 h-4 w-4" />
          Додати страву
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="items" className="space-y-6">
        <TabsList>
          <TabsTrigger value="items">
            <ChefHat className="mr-2 h-4 w-4" />
            Страви
          </TabsTrigger>
          <TabsTrigger value="categories">
            <FolderOpen className="mr-2 h-4 w-4" />
            Категорії
          </TabsTrigger>
          <TabsTrigger value="menus">
            <ListChecks className="mr-2 h-4 w-4" />
            Формувати меню
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: ITEMS */}
        <TabsContent value="items" className="space-y-6">
          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Шукати страву..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                
                <select
                  className="border rounded-md px-3 py-2"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                >
                  <option value="">Всі категорії</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
                
                <select
                  className="border rounded-md px-3 py-2"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="">Всі статуси</option>
                  <option value="active">В меню</option>
                  <option value="inactive">Не активні</option>
                </select>
              </div>
            </CardContent>
          </Card>

          {/* Items Table */}
          {loading ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Loader2 className="h-12 w-12 text-[#FF5A00] animate-spin mx-auto mb-4" />
                <p className="text-gray-500">Завантаження...</p>
              </CardContent>
            </Card>
          ) : filteredItems.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <ChefHat className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Немає страв
                </h3>
                <p className="text-gray-500 mb-6">
                  Додайте першу страву в меню
                </p>
                <Button
                  onClick={() => setIsCreateItemModalOpen(true)}
                  className="bg-[#FF5A00] hover:bg-[#FF5A00]/90"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Додати страву
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                {/* Mobile layout: компактні картки без горизонтального скролу */}
                <div className="md:hidden divide-y">
                  {filteredItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-col gap-2 p-3"
                    >
                      {/* Фото */}
                      <div className="w-full">
                        {item.photo_url ? (
                          <img
                            src={getImageUrl(item.photo_url) || ""}
                            alt={item.name}
                            className="w-full h-40 object-cover rounded border border-gray-200"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = "none";
                            }}
                          />
                        ) : (
                          <div className="w-full h-40 rounded border border-dashed border-gray-300 bg-gray-50 flex items-center justify-center text-[10px] leading-tight text-gray-400 text-center px-6">
                            Нема фото
                          </div>
                        )}
                      </div>

                      {/* Контент */}
                      <div className="flex-1 space-y-2 pt-1">
                        <div>
                          <div className="text-gray-900 font-medium leading-snug line-clamp-2">
                            {item.name}
                          </div>
                          <div className="text-[11px] text-gray-500">
                            {item.subcategory?.category?.name}
                            {item.subcategory?.name
                              ? ` • ${item.subcategory.name}`
                              : ""}
                          </div>
                        </div>

                        <div className="flex items-baseline justify-between gap-2">
                          <div className="text-[#FF5A00] font-semibold text-sm">
                            {item.price} грн
                          </div>
                          <div className="text-[11px] text-gray-500">
                            {item.weight ? `${item.weight}${item.unit}` : "-"}
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-2">
                          <Badge variant={item.active ? "default" : "secondary"}>
                            {item.active ? "В меню" : "Неактивна"}
                          </Badge>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleEditItem(item)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => {
                                setItemToDelete(item);
                                setIsDeleteItemDialogOpen(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop / tablet layout: таблиця */}
                <div className="hidden md:block">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[60px]">Фото</TableHead>
                          <TableHead>Страва</TableHead>
                          <TableHead className="whitespace-nowrap">Ціна / вага</TableHead>
                          <TableHead className="whitespace-nowrap">Статус</TableHead>
                          <TableHead className="w-[90px] text-right whitespace-nowrap">Дії</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredItems.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>
                              {item.photo_url ? (
                                <img
                                  src={getImageUrl(item.photo_url) || ""}
                                  alt={item.name}
                                  className="w-12 h-12 object-cover rounded border border-gray-200"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = "none";
                                  }}
                                />
                              ) : (
                                <div className="w-12 h-12 rounded border border-dashed border-gray-300 bg-gray-50 flex items-center justify-center text-[8px] leading-tight text-gray-400 text-center px-1">
                                  Нема фото
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="align-top">
                              <div className="text-gray-900 font-medium leading-snug max-w-xs line-clamp-2">
                                {item.name}
                              </div>
                              <div className="text-xs text-gray-500">
                                {item.subcategory?.category?.name}
                                {item.subcategory?.name
                                  ? ` • ${item.subcategory.name}`
                                  : ""}
                              </div>
                              {item.description && (
                                <div className="hidden xl:block text-xs text-gray-500 max-w-xs truncate">
                                  {item.description}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="align-top">
                              <div className="text-[#FF5A00] font-medium">
                                {item.price} грн
                              </div>
                              <div className="text-xs text-gray-500">
                                {item.weight ? `${item.weight}${item.unit}` : "-"}
                              </div>
                            </TableCell>
                            <TableCell className="align-top">
                              <Badge variant={item.active ? "default" : "secondary"}>
                                {item.active ? "В меню" : "Неактивна"}
                              </Badge>
                            </TableCell>
                            <TableCell className="align-top">
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleEditItem(item)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    setItemToDelete(item);
                                    setIsDeleteItemDialogOpen(true);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* TAB 2: CATEGORIES */}
        <TabsContent value="categories" className="space-y-6">
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setIsCreateCategoryModalOpen(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Додати категорію
            </Button>
          </div>

          {/* Categories List */}
          {loading ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Loader2 className="h-12 w-12 text-[#FF5A00] animate-spin mx-auto mb-4" />
                <p className="text-gray-500">Завантаження...</p>
              </CardContent>
            </Card>
          ) : categories.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <FolderOpen className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Немає категорій
                </h3>
                <p className="text-gray-500 mb-6">
                  Створіть першу категорію для страв
                </p>
                <Button
                  onClick={() => setIsCreateCategoryModalOpen(true)}
                  className="bg-[#FF5A00] hover:bg-[#FF5A00]/90"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Створити категорію
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {categories.map(category => {
                const categorySubcategories = subcategories.filter(
                  sub => sub.category_id === category.id
                );
                const categoryItemsCount = items.filter(
                  item => item.subcategory?.category_id === category.id
                ).length;
                
                return (
                  <Card key={category.id}>
                    <CardContent className="p-6">
                      {/* Category Header */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-100 rounded-lg">
                            <FolderOpen className="h-5 w-5 text-blue-600" />
                          </div>
                          <div>
                            <h3 className="text-lg text-gray-900">{category.name}</h3>
                            <p className="text-sm text-gray-500">
                              {categorySubcategories.length} підкатегорій • {categoryItemsCount} страв
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setCategoryToDelete(category);
                            setIsDeleteCategoryDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                      
                      {/* Subcategories */}
                      {categorySubcategories.length > 0 && (
                        <div className="space-y-2 ml-12 mb-4">
                          {categorySubcategories.map(subcategory => {
                            const subcategoryItemsCount = items.filter(
                              item => item.subcategory_id === subcategory.id
                            ).length;
                            
                            return (
                              <div
                                key={subcategory.id}
                                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                              >
                                <div className="flex items-center gap-3">
                                  <Tag className="h-4 w-4 text-gray-400" />
                                  <span>{subcategory.name}</span>
                                  <Badge variant="outline">
                                    {subcategoryItemsCount} страв
                                  </Badge>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    setSubcategoryToDelete(subcategory);
                                    setIsDeleteSubcategoryDialogOpen(true);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      
                      {/* Add Subcategory Button */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedCategoryForSubcategory(category.id);
                          setSubcategoryFormData({ name: "", category_id: category.id });
                          setIsCreateSubcategoryModalOpen(true);
                        }}
                        className="ml-12"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Додати підкатегорію
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* TAB 3: MENUS – конструктор меню */}
        <TabsContent value="menus" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl text-gray-900">Готові меню</h2>
              <p className="text-gray-500 text-sm">
                Створюйте типові набори страв (наприклад, «Фуршет 55 осіб»), щоб швидше формувати КП.
              </p>
            </div>
            <Button
              className="bg-[#FF5A00] hover:bg-[#FF5A00]/90"
              onClick={openCreateMenu}
            >
              <Plus className="mr-2 h-4 w-4" />
              Додати меню
            </Button>
          </div>

          {/* Список меню */}
          {menus.length === 0 ? (
            <Card>
              <CardContent className="p-10 text-center text-sm text-gray-500 space-y-3">
                <p>Ще немає жодного меню.</p>
                <Button
                  className="bg-[#FF5A00] hover:bg-[#FF5A00]/90"
                  onClick={openCreateMenu}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Створити перше меню
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {menus.map((menu) => {
                const totalPositions = menu.items.length;
                const totalPrice = menu.items.reduce((sum, mi) => {
                  const price = mi.item?.price || 0;
                  return sum + price * mi.quantity;
                }, 0);

                return (
                  <Card key={menu.id} className="flex flex-col">
                    <CardContent className="p-5 flex-1 flex flex-col space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">
                            {menu.name}
                          </h3>
                          <p className="text-xs text-gray-500">
                            Формат: {menu.event_format || "—"} • Гостей:{" "}
                            {menu.people_count ?? "—"}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => openEditMenu(menu)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteMenu(menu)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </div>

                      {menu.description && (
                        <p className="text-sm text-gray-600 line-clamp-2">
                          {menu.description}
                        </p>
                      )}

                      <div className="text-xs text-gray-500">
                        Позицій: {totalPositions} • Орієнтовна сума:{" "}
                        <span className="font-medium text-gray-900">
                          {totalPrice} грн
                        </span>
                      </div>

                      {menu.items.length > 0 && (
                        <div className="mt-2 rounded-md bg-gray-50 border border-gray-200 p-3 max-h-40 overflow-y-auto">
                          <ul className="text-xs space-y-1">
                            {menu.items.map((mi) => (
                              <li key={mi.id} className="flex justify-between">
                                <span className="truncate max-w-[60%]">
                                  {mi.item?.name || `Страва #${mi.item_id}`}
                                </span>
                                <span className="text-gray-600">
                                  × {mi.quantity} •{" "}
                                  {(mi.item?.price || 0) * mi.quantity} грн
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Форма створення / редагування меню */}
          <Dialog
            open={isMenuFormOpen}
            onOpenChange={(open) => {
              setIsMenuFormOpen(open);
              if (!open) {
                resetMenuForm();
              }
            }}
          >
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {selectedMenu ? "Редагувати меню" : "Нове меню"}
                </DialogTitle>
              </DialogHeader>

              <form
                onSubmit={handleSaveMenu}
                className="space-y-4"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="menu-name">Назва меню *</Label>
                    <Input
                      id="menu-name"
                      value={menuForm.name}
                      onChange={(e) =>
                        setMenuForm((prev) => ({ ...prev, name: e.target.value }))
                      }
                      placeholder="Наприклад, Фуршет 55 осіб"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="menu-format">Формат</Label>
                    <Input
                      id="menu-format"
                      value={menuForm.event_format}
                      onChange={(e) =>
                        setMenuForm((prev) => ({
                          ...prev,
                          event_format: e.target.value,
                        }))
                      }
                      placeholder="Фуршет, Банкет, Кава-брейк..."
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="menu-people">Кількість гостей</Label>
                    <Input
                      id="menu-people"
                      type="number"
                      min={1}
                      value={menuForm.people_count}
                      onChange={(e) =>
                        setMenuForm((prev) => ({
                          ...prev,
                          people_count: e.target.value,
                        }))
                      }
                      placeholder="Наприклад, 55"
                    />
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <Label htmlFor="menu-description">Опис</Label>
                    <Textarea
                      id="menu-description"
                      value={menuForm.description}
                      onChange={(e) =>
                        setMenuForm((prev) => ({
                          ...prev,
                          description: e.target.value,
                        }))
                      }
                      rows={3}
                      placeholder="Короткий опис меню для команди"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-gray-900">
                      Страви в меню
                    </h3>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addItemToMenuForm}
                    >
                      <Plus className="mr-1 h-4 w-4" />
                      Додати страву
                    </Button>
                  </div>

                  {menuForm.items.length === 0 ? (
                    <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 p-4 text-xs text-gray-500 text-center">
                      Поки що жодної страви. Натисніть «Додати страву», щоб зібрати меню.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {menuForm.items.map((mi, index) => (
                        <div
                          key={index}
                          className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end border rounded-lg p-3 bg-gray-50"
                        >
                          <div className="space-y-1 md:col-span-2">
                            <Label>Страва</Label>
                            <select
                              className="w-full border rounded-md px-3 py-2 text-sm"
                              value={mi.item_id}
                              onChange={(e) =>
                                updateMenuFormItem(index, "item_id", e.target.value)
                              }
                            >
                              <option value="">Оберіть страву</option>
                              {items.map((it) => (
                                <option key={it.id} value={it.id}>
                                  {it.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-1">
                            <Label>Кількість порцій</Label>
                            <Input
                              type="number"
                              min={0}
                              value={mi.quantity}
                              onChange={(e) =>
                                updateMenuFormItem(index, "quantity", e.target.value)
                              }
                            />
                          </div>
                          <div className="flex items-center justify-between md:justify-end gap-2">
                            <div className="text-xs text-gray-600">
                              Ціна за всі порції:{" "}
                              <span className="font-medium text-gray-900">
                                {(items.find((it) => it.id === mi.item_id)?.price || 0) *
                                  mi.quantity}{" "}
                                грн
                              </span>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeMenuFormItem(index)}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsMenuFormOpen(false);
                      resetMenuForm();
                    }}
                  >
                    Скасувати
                  </Button>
                  <Button
                    type="submit"
                    className="bg-[#FF5A00] hover:bg-[#FF5A00]/90"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Збереження...
                      </>
                    ) : selectedMenu ? (
                      "Зберегти меню"
                    ) : (
                      "Створити меню"
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </TabsContent>
      </Tabs>

      {/* MODALS FOR ITEMS */}
      {/* Create/Edit Item Dialog */}
      <Dialog 
        open={isCreateItemModalOpen || isEditItemModalOpen} 
        onOpenChange={(open) => {
          if (!open) {
            setIsCreateItemModalOpen(false);
            setIsEditItemModalOpen(false);
            resetItemForm();
            setEditingItem(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? 'Редагувати страву' : 'Нова страва'}
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={editingItem ? handleUpdateItem : handleCreateItem} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="name">Назва страви *</Label>
                <Input
                  id="name"
                  value={itemFormData.name}
                  onChange={(e) => setItemFormData({...itemFormData, name: e.target.value})}
                  required
                />
              </div>
              
              <div className="col-span-2">
                <Label htmlFor="description">Опис</Label>
                <Textarea
                  id="description"
                  value={itemFormData.description}
                  onChange={(e) => setItemFormData({...itemFormData, description: e.target.value})}
                  rows={3}
                />
              </div>
              
              <div>
                <Label htmlFor="category">Категорія *</Label>
                <select
                  className="w-full border rounded-md px-3 py-2"
                  value={selectedCategory}
                  onChange={(e) => {
                    setSelectedCategory(e.target.value);
                    setItemFormData({...itemFormData, subcategory_id: 0});
                  }}
                  required
                >
                  <option value="">Оберіть категорію</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <Label htmlFor="subcategory">Підкатегорія *</Label>
                <select
                  className="w-full border rounded-md px-3 py-2"
                  value={itemFormData.subcategory_id}
                  onChange={(e) => 
                    setItemFormData({...itemFormData, subcategory_id: parseInt(e.target.value)})
                  }
                  disabled={!selectedCategory}
                  required
                >
                  <option value="">Оберіть підкатегорію</option>
                  {filteredSubcategories.map(sub => (
                    <option key={sub.id} value={sub.id}>{sub.name}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <Label htmlFor="price">Ціна (₴) *</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={itemFormData.price}
                  onChange={(e) => setItemFormData({...itemFormData, price: parseFloat(e.target.value) || 0})}
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="weight">Вага</Label>
                <div className="flex gap-2">
                  <Input
                    id="weight"
                    type="number"
                    step="0.01"
                    min="0"
                    value={itemFormData.weight}
                    onChange={(e) => setItemFormData({...itemFormData, weight: parseFloat(e.target.value) || 0})}
                    className="flex-1"
                  />
                  <Input
                    placeholder="г/кг/мл..."
                    value={itemFormData.unit}
                    onChange={(e) => setItemFormData({...itemFormData, unit: e.target.value})}
                    className="w-20"
                  />
                </div>
              </div>
              
              <div className="col-span-2 space-y-2">
                <Label htmlFor="photo">Фото страви</Label>
                <div className="flex flex-col md:flex-row gap-4 items-start">
                  <div className="flex-1 space-y-2">
                    <Input
                      id="photo_url"
                      type="url"
                      placeholder="https://example.com/photo.jpg"
                      value={itemFormData.photo_url}
                      onChange={(e) =>
                        setItemFormData({
                          ...itemFormData,
                          photo_url: e.target.value,
                        })
                      }
                    />
                    <Input
                      id="photo"
                      type="file"
                      accept="image/*"
                      onChange={handleItemPhotoChange}
                    />
                    <p className="text-xs text-gray-500">
                      Ви можете або вставити URL, або завантажити файл. Якщо
                      завантажено файл, він буде використаний при збереженні.
                    </p>
                  </div>
                  <div className="w-24 h-24 rounded-lg overflow-hidden border border-gray-200 bg-gray-50 flex items-center justify-center">
                    {itemPhotoPreview || itemFormData.photo_url ? (
                      <img
                        src={
                          itemPhotoPreview ||
                          getImageUrl(itemFormData.photo_url) ||
                          ""
                        }
                        alt={itemFormData.name || "Прев'ю"}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <span className="text-xs text-gray-400 text-center px-2">
                        Прев'ю фото
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="col-span-2 flex items-center gap-2">
                <Switch
                  id="active"
                  checked={itemFormData.active}
                  onCheckedChange={(checked) => setItemFormData({...itemFormData, active: checked})}
                />
                <Label htmlFor="active">Активна страва (показувати в меню)</Label>
              </div>
            </div>
            
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsCreateItemModalOpen(false);
                  setIsEditItemModalOpen(false);
                  resetItemForm();
                  setEditingItem(null);
                }}
              >
                Скасувати
              </Button>
              <Button
                type="submit"
                className="bg-[#FF5A00] hover:bg-[#FF5A00]/90"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Збереження...
                  </>
                ) : editingItem ? (
                  'Зберегти'
                ) : (
                  'Створити'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Item Dialog */}
      <AlertDialog open={isDeleteItemDialogOpen} onOpenChange={setIsDeleteItemDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Видалити страву?</AlertDialogTitle>
            <AlertDialogDescription>
              Ця дія не може бути скасована. Страва "{itemToDelete?.name}" буде видалена назавжди.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Скасувати</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteItem}
              className="bg-red-600 hover:bg-red-700"
              disabled={loading}
            >
              Видалити
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* MODALS FOR CATEGORIES */}
      {/* Create Category Dialog */}
      <Dialog open={isCreateCategoryModalOpen} onOpenChange={setIsCreateCategoryModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Нова категорія</DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleCreateCategory} className="space-y-4">
            <div>
              <Label htmlFor="category-name">Назва категорії *</Label>
              <Input
                id="category-name"
                value={categoryFormData.name}
                onChange={(e) => setCategoryFormData({ name: e.target.value })}
                placeholder="Наприклад: Закуски, Супи, Десерти"
                required
              />
            </div>
            
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsCreateCategoryModalOpen(false);
                  setCategoryFormData({ name: "" });
                }}
              >
                Скасувати
              </Button>
              <Button
                type="submit"
                className="bg-[#FF5A00] hover:bg-[#FF5A00]/90"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Створення...
                  </>
                ) : (
                  'Створити'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Category Dialog */}
      <AlertDialog open={isDeleteCategoryDialogOpen} onOpenChange={setIsDeleteCategoryDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Видалити категорію?</AlertDialogTitle>
            <AlertDialogDescription>
              Ця дія не може бути скасована. Категорія "{categoryToDelete?.name}" та всі її підкатегорії будуть видалені.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Скасувати</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCategory}
              className="bg-red-600 hover:bg-red-700"
              disabled={loading}
            >
              Видалити
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create Subcategory Dialog */}
      <Dialog open={isCreateSubcategoryModalOpen} onOpenChange={setIsCreateSubcategoryModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Нова підкатегорія</DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleCreateSubcategory} className="space-y-4">
            <div>
              <Label htmlFor="subcategory-name">Назва підкатегорії *</Label>
              <Input
                id="subcategory-name"
                value={subcategoryFormData.name}
                onChange={(e) => setSubcategoryFormData({...subcategoryFormData, name: e.target.value})}
                placeholder="Наприклад: Холодні закуски, Гарячі супи"
                required
              />
            </div>
            
            <div>
              <Label htmlFor="subcategory-category">Категорія *</Label>
              <select
                id="subcategory-category"
                className="w-full border rounded-md px-3 py-2"
                value={subcategoryFormData.category_id}
                onChange={(e) => setSubcategoryFormData({...subcategoryFormData, category_id: parseInt(e.target.value)})}
                required
              >
                <option value="">Оберіть категорію</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
            
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsCreateSubcategoryModalOpen(false);
                  setSubcategoryFormData({ name: "", category_id: 0 });
                  setSelectedCategoryForSubcategory(null);
                }}
              >
                Скасувати
              </Button>
              <Button
                type="submit"
                className="bg-[#FF5A00] hover:bg-[#FF5A00]/90"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Створення...
                  </>
                ) : (
                  'Створити'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Subcategory Dialog */}
      <AlertDialog open={isDeleteSubcategoryDialogOpen} onOpenChange={setIsDeleteSubcategoryDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Видалити підкатегорію?</AlertDialogTitle>
            <AlertDialogDescription>
              Ця дія не може бути скасована. Підкатегорія "{subcategoryToDelete?.name}" буде видалена назавжди.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Скасувати</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSubcategory}
              className="bg-red-600 hover:bg-red-700"
              disabled={loading}
            >
              Видалити
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
