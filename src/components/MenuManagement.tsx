import React, { useMemo, useState, useEffect, ChangeEvent } from "react";
import {
  itemsApi,
  categoriesApi,
  subcategoriesApi,
  menusApi,
  type ItemCreate,
  type Menu,
  type MenuItemCreate,
  getImageUrl,
  API_BASE_URL,
  tokenManager,
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
  Upload,
} from "lucide-react";

import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Card, CardContent } from "./ui/card";
import { Badge } from "./ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { CategoriesManagementEnhanced } from "./CategoriesManagementEnhanced";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Textarea } from "./ui/textarea";
import { Switch } from "./ui/switch";
import { AllergenIconPicker, getAllergenIcon, getAllergenName } from "./AllergenIconPicker";

export function MenuManagement() {
  // States
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [loading, setLoading] = useState(false);
  const itemsById = useMemo(() => new Map(items.map((it) => [it.id, it])), [items]);

  // Menus
  const [menus, setMenus] = useState<Menu[]>([]);
  const [selectedMenu, setSelectedMenu] = useState<Menu | null>(null);
  const [isMenuFormOpen, setIsMenuFormOpen] = useState(false);
  const [expandedMenuIds, setExpandedMenuIds] = useState<Set<number>>(new Set());
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
  
  // Menu form filters for dish selection
  const [menuFormSearchQuery, setMenuFormSearchQuery] = useState("");
  const [menuFormSelectedCategories, setMenuFormSelectedCategories] = useState<string[]>([]);
  
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
    weight: '',
    unit: "",
    photo_url: "",
    active: true,
    subcategory_id: 0,
  });
  const [itemPhotoFile, setItemPhotoFile] = useState<File | null>(null);
  const [itemPhotoPreview, setItemPhotoPreview] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("");
  
  // Excel upload for updating items
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [isUploadingExcel, setIsUploadingExcel] = useState(false);
  
  // Form - Category
  const [categoryFormData, setCategoryFormData] = useState({ name: "" });
  
  // Form - Subcategory
  const [subcategoryFormData, setSubcategoryFormData] = useState({
    name: "",
    category_id: 0,
  });

  // Load data
  useEffect(() => {
    loadData(true); // Показуємо toast при початковому завантаженні
  }, []);

  const loadData = async (showToast: boolean = false) => {
    setLoading(true);
    try {
      const [itemsData, categoriesData, subcategoriesData, menusData] = await Promise.all([
        itemsApi.getItems(0, 1000),
        categoriesApi.getCategories(),
        subcategoriesApi.getSubcategories(),
        menusApi.getMenus(),
      ]);
      
      const itemsMap = new Map(itemsData.map((it) => [it.id, it] as const));
      const menusWithItems = menusData.map((menu) => ({
        ...menu,
        items: (menu.items || []).map((mi) => ({
          ...mi,
          item: mi.item ?? itemsMap.get(mi.item_id),
        })),
      }));

      setItems(itemsData);
      setCategories(categoriesData);
      setSubcategories(subcategoriesData);
      setMenus(menusWithItems);
      
      if (showToast) {
        toast.success("Дані завантажено");
      }
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
      weight: '',
      unit: "",
      photo_url: "",
      icon_name: "",
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
    if (itemFormData.price === undefined || itemFormData.price === null || itemFormData.price <= 0) {
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
      // Оновлюємо список страв
      await loadData();
      setIsCreateItemModalOpen(false);
      resetItemForm();
      toast.success("Страву створено!");
    } catch (error: any) {
      console.error("Error creating item:", error);
      // Обробка помилок валідації (422) - detail може бути масивом
      let errorMessage = "Помилка створення страви";
      if (error.data?.detail) {
        if (Array.isArray(error.data.detail)) {
          errorMessage = error.data.detail.map((err: any) => {
            if (typeof err === 'string') return err;
            if (err.msg) return `${err.loc?.join('.') || ''}: ${err.msg}`;
            return JSON.stringify(err);
          }).join(', ');
        } else if (typeof error.data.detail === 'string') {
          errorMessage = error.data.detail;
        } else {
          errorMessage = JSON.stringify(error.data.detail);
        }
      }
      toast.error(errorMessage);
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
      weight: item.weight ? String(item.weight) : '',
      unit: item.unit || "",
      photo_url: item.photo_url || "",
      icon_name: item.icon_name || "",
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
      // Якщо фото не змінюється (немає нового файлу і photo_url не змінився), не передаємо photo_url
      const originalPhotoUrl = editingItem.photo_url || "";
      const photoUrlChanged = itemFormData.photo_url !== originalPhotoUrl;
      
      const payload: ItemCreate = {
        ...itemFormData,
        photo: itemPhotoFile || undefined,
        // Передаємо photo_url тільки якщо він змінився або є новий файл
        photo_url: (itemPhotoFile || photoUrlChanged) ? itemFormData.photo_url : undefined,
      };
      
      console.log("Оновлення страви:", editingItem.id, payload);
      const updatedItem = await itemsApi.updateItem(editingItem.id, payload);
      console.log("Оновлена страва отримана з API:", updatedItem);
      
      // Оновлюємо локально в списку
      setItems(items.map(item => item.id === editingItem.id ? updatedItem : item));
      
      // Оновлюємо також категорії та підкатегорії, якщо потрібно
      if (updatedItem.subcategory_id && updatedItem.subcategory) {
        // Перезавантажуємо підкатегорії, щоб оновити зв'язки
        const updatedSubcategories = await subcategoriesApi.getSubcategories();
        setSubcategories(updatedSubcategories);
      }
      
      setIsEditItemModalOpen(false);
      setEditingItem(null);
      resetItemForm();
      toast.success("Страву оновлено!");
    } catch (error: any) {
      toast.error(error.data?.detail || "Помилка оновлення");
      console.error("Error updating item:", error);
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
      // Оновлюємо дані для отримання актуального списку
      await loadData();
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
      // Оновлюємо дані для отримання актуального списку
      await loadData();
      toast.success("Підкатегорію створено!");
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
    setMenuFormSearchQuery("");
    setMenuFormSelectedCategories([]);
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

  const addItemToMenuForm = (itemId?: number, quantity: number = 1) => {
    if (items.length === 0) {
      toast.error("Спочатку додайте хоч одну страву");
      return;
    }
    const idToAdd = itemId || items[0].id;
    // Перевіряємо, чи страва вже додана
    const existingIndex = menuForm.items.findIndex((it) => it.item_id === idToAdd);
    if (existingIndex >= 0) {
      // Якщо вже є, збільшуємо кількість
      updateMenuFormItem(existingIndex, "quantity", (menuForm.items[existingIndex].quantity + quantity).toString());
    } else {
      // Додаємо нову страву
      setMenuForm((prev) => ({
        ...prev,
        items: [
          ...prev.items,
          {
            item_id: idToAdd,
            quantity: quantity,
          },
        ],
      }));
    }
  };

  const toggleMenuItem = (itemId: number, quantity: number = 1) => {
    const existingIndex = menuForm.items.findIndex((it) => it.item_id === itemId);
    if (existingIndex >= 0) {
      // Якщо страва вже вибрана, видаляємо її
      removeMenuFormItem(existingIndex);
    } else {
      // Додаємо страву
      addItemToMenuForm(itemId, quantity);
    }
  };

  const isMenuItemSelected = (itemId: number) => {
    return menuForm.items.some((it) => it.item_id === itemId);
  };

  const getMenuItemQuantity = (itemId: number) => {
    const item = menuForm.items.find((it) => it.item_id === itemId);
    return item ? item.quantity : 0;
  };

  // Фільтрація страв для форми меню
  const filteredMenuItems = items.filter((item) => {
    const matchesSearch = !menuFormSearchQuery || 
      item.name.toLowerCase().includes(menuFormSearchQuery.toLowerCase()) ||
      (item.description && item.description.toLowerCase().includes(menuFormSearchQuery.toLowerCase()));
    
    const matchesCategory = menuFormSelectedCategories.length === 0 || 
      menuFormSelectedCategories.includes(item.subcategory?.category?.name || "");
    
    return matchesSearch && matchesCategory && item.active;
  });

  // Отримуємо всі категорії для фільтрів
  const allMenuCategories: string[] = Array.from(
    new Set(
      items
        .filter((item) => item.active && item.subcategory?.category)
        .map((item) => item.subcategory?.category?.name || "")
        .filter((name): name is string => Boolean(name))
    )
  );

  const toggleMenuCategory = (categoryName: string) => {
    setMenuFormSelectedCategories((prev) =>
      prev.includes(categoryName)
        ? prev.filter((c) => c !== categoryName)
        : [...prev, categoryName]
    );
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
      setExpandedMenuIds((prev) => {
        if (!prev.has(menu.id)) return prev;
        const next = new Set(prev);
        next.delete(menu.id);
        return next;
      });
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

  const formatUAH = (value: number) =>
    new Intl.NumberFormat("uk-UA", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Number.isFinite(value) ? value : 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Меню та страви</h1>
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
        <TabsList className="w-full justify-start bg-transparent border-b border-gray-200 rounded-none p-0 h-auto">
          <TabsTrigger
            value="items"
            className="rounded-none bg-transparent border-b-[3px] border-transparent data-[state=active]:border-[#FF5A00] data-[state=active]:text-[#FF5A00] data-[state=active]:bg-transparent px-4 py-3 font-semibold"
          >
            <ChefHat className="mr-2 h-4 w-4" />
            Страви
          </TabsTrigger>
          <TabsTrigger
            value="categories"
            className="rounded-none bg-transparent border-b-[3px] border-transparent data-[state=active]:border-[#FF5A00] data-[state=active]:text-[#FF5A00] data-[state=active]:bg-transparent px-4 py-3 font-semibold"
          >
            <FolderOpen className="mr-2 h-4 w-4" />
            Категорії
          </TabsTrigger>
          <TabsTrigger
            value="menus"
            className="rounded-none bg-transparent border-b-[3px] border-transparent data-[state=active]:border-[#FF5A00] data-[state=active]:text-[#FF5A00] data-[state=active]:bg-transparent px-4 py-3 font-semibold"
          >
            <ListChecks className="mr-2 h-4 w-4" />
            Готові меню
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: ITEMS */}
        <TabsContent value="items" className="space-y-6">
          {/* Header with actions */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Страви</h2>
              <p className="text-sm text-gray-500">
                Управління стравами меню
              </p>
            </div>
            <div className="flex gap-2">
              {/* Excel Upload Button */}
              <div className="relative">
                <Input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setExcelFile(file);
                  }}
                  className="hidden"
                  id="excel-upload-input"
                />
                <Button
                  variant="outline"
                  onClick={() => {
                    document.getElementById("excel-upload-input")?.click();
                  }}
                  disabled={isUploadingExcel}
                  className="gap-2"
                >
                  <Upload className="h-4 w-4" />
                  {isUploadingExcel ? "Обробка..." : "Оновити з Excel"}
                </Button>
                {excelFile && (
                  <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-blue-700">{excelFile.name}</span>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={async () => {
                            if (!excelFile) return;
                            setIsUploadingExcel(true);
                            try {
                              const formData = new FormData();
                              formData.append("file", excelFile);
                              
                              const token = tokenManager.getToken();
                              
                              // Створюємо AbortController для великого timeout (5 хвилин)
                              const controller = new AbortController();
                              const timeoutId = setTimeout(() => controller.abort(), 5 * 60 * 1000); // 5 хвилин
                              
                              const response = await fetch(
                                `${API_BASE_URL}/items/update-from-excel`,
                                {
                                  method: "POST",
                                  headers: {
                                    Authorization: `Bearer ${token}`,
                                  },
                                  body: formData,
                                  signal: controller.signal,
                                }
                              );
                              
                              clearTimeout(timeoutId);
                              
                              if (!response.ok) {
                                const error = await response.json().catch(() => ({ detail: "Невідома помилка" }));
                                throw new Error(error.detail || "Помилка оновлення");
                              }
                              
                              const result = await response.json();
                              
                              console.log("Результат оновлення:", result);
                              
                              // Формуємо детальне повідомлення
                              let message = `Оновлено: ${result.updated || 0} страв`;
                              if (result.found !== undefined) {
                                message += `. Знайдено: ${result.found}`;
                              }
                              if (result.created_categories > 0) {
                                message += `. Створено категорій: ${result.created_categories}`;
                              }
                              if (result.created_subcategories > 0) {
                                message += `. Створено підкатегорій: ${result.created_subcategories}`;
                              }
                              
                              toast.success(message);
                              
                              if (result.not_found_count > 0) {
                                toast.warning(
                                  `Не знайдено страв: ${result.not_found_count}${result.not_found && result.not_found.length > 0 ? ` (наприклад: ${result.not_found.slice(0, 3).join(", ")})` : ""}`
                                );
                              }
                              
                              if (result.errors_count > 0) {
                                const errorMessages = result.errors && result.errors.length > 0 
                                  ? result.errors.slice(0, 2).join("; ")
                                  : "";
                                toast.error(`Помилок: ${result.errors_count}${errorMessages ? ` (${errorMessages})` : ""}`);
                              }
                              
                              // Перезавантажуємо дані
                              await loadData();
                              setExcelFile(null);
                              
                              // Очищаємо фільтри, щоб показати всі оновлені страви
                              setSearchQuery("");
                              setCategoryFilter("");
                              setStatusFilter("");
                            } catch (error: any) {
                              toast.error(error.message || "Помилка завантаження файлу");
                            } finally {
                              setIsUploadingExcel(false);
                              // Скидаємо input
                              const input = document.getElementById("excel-upload-input") as HTMLInputElement;
                              if (input) input.value = "";
                            }
                          }}
                          disabled={isUploadingExcel}
                          className="bg-[#FF5A00] hover:bg-[#FF5A00]/90 text-white"
                        >
                          Завантажити
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setExcelFile(null);
                            const input = document.getElementById("excel-upload-input") as HTMLInputElement;
                            if (input) input.value = "";
                          }}
                        >
                          Скасувати
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              <Button
                className="bg-[#FF5A00] hover:bg-[#FF5A00]/90"
                onClick={() => {
                  resetItemForm();
                  setIsCreateItemModalOpen(true);
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Додати страву
              </Button>
            </div>
          </div>
          
          {/* Info about Excel format */}
          {!excelFile && (
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="p-4">
                <p className="text-sm text-blue-700">
                  <strong>Оновлення страв з Excel:</strong> Завантажте Excel файл з аркушами (категорії) та рядками (страви).
                  Система оновить ціни, категорії та підкатегорії для існуючих страв по назві.
                </p>
              </CardContent>
            </Card>
          )}
          
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

          {/* Items Grid */}
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredItems.map((item) => (
                <Card
                  key={item.id}
                  className="hover:shadow-md transition-shadow h-full"
                >
                  <CardContent className="p-4 flex flex-col h-full">
                    <div className="flex gap-3 mb-3">
                      <div className="w-20 h-20 rounded-lg overflow-hidden border bg-gray-50 flex-shrink-0 relative">
                        {item.photo_url ? (
                          <img
                            src={getImageUrl(item.photo_url) || ""}
                            alt={item.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = "none";
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                            Нема фото
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-gray-900 truncate mb-1 flex items-center gap-2">
                          <span>{item.name}</span>
                          {item.icon_name && (
                            <span className="text-lg" title={getAllergenName(item.icon_name)}>
                              {getAllergenIcon(item.icon_name)}
                            </span>
                          )}
                        </h3>
                        {item.description && (
                          <p className="text-sm text-gray-500 line-clamp-2">
                            {item.description}
                          </p>
                        )}
                        <p className="text-xs text-gray-500 mt-1">
                          {item.subcategory?.category?.name}
                          {item.subcategory?.name
                            ? ` • ${item.subcategory.name}`
                            : ""}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mb-3 text-sm">
                      <div>
                        <div className="text-lg font-semibold text-gray-900">
                          {item.price} грн
                        </div>
                        <div className="text-xs text-gray-500">
                          {item.weight ? `${item.weight}${item.unit}` : "-"}
                        </div>
                      </div>
                      <Badge
                        variant={item.active ? "default" : "secondary"}
                        className={
                          item.active ? "bg-green-100 text-green-800" : ""
                        }
                      >
                        {item.active ? "В меню" : "Неактивна"}
                      </Badge>
                    </div>

                    <div className="mt-auto flex gap-2">
                      <Button
                        variant="outline"
                        className="flex-1 flex items-center justify-center gap-1 text-sm"
                        onClick={() => handleEditItem(item)}
                      >
                        <Pencil className="w-4 h-4" />
                        <span>Редагувати</span>
                      </Button>
                      <Button
                        variant="outline"
                        className="px-3 py-2 text-sm border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700"
                        onClick={() => {
                          setItemToDelete(item);
                          setIsDeleteItemDialogOpen(true);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* TAB 2: CATEGORIES */}
        <TabsContent value="categories" className="space-y-6">
          <CategoriesManagementEnhanced />
        </TabsContent>

        {/* TAB 3: MENUS – конструктор меню */}
        <TabsContent value="menus" className="space-y-6">
          <div className="rounded-xl border border-gray-200 bg-white p-5 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xl leading-none">💡</span>
                <h2 className="text-xl font-semibold text-gray-900">Готові меню</h2>
              </div>
              <p className="text-gray-500 text-sm mt-1">
                Збережіть часто використовувані набори страв, щоб швидше формувати КП.
              </p>
            </div>
            <Button className="bg-[#FF5A00] hover:bg-[#FF5A00]/90 shrink-0" onClick={openCreateMenu}>
              <Plus className="mr-2 h-4 w-4" />
              Створити готове меню
            </Button>
          </div>

          {/* Список меню */}
          {menus.length === 0 ? (
            <Card className="border border-gray-200 bg-white rounded-xl shadow-sm">
              <CardContent className="p-10 text-center space-y-4">
                <span className="text-6xl block mb-2">📝</span>
                <p className="text-sm text-gray-500">Ще немає жодного меню.</p>
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
                  const item = mi.item ?? itemsById.get(mi.item_id);
                  const price = item?.price || 0;
                  return sum + price * mi.quantity;
                }, 0);
                const peopleCount = menu.people_count && menu.people_count > 0 ? menu.people_count : undefined;
                const perGuest = peopleCount ? totalPrice / peopleCount : undefined;
                const isExpanded = expandedMenuIds.has(menu.id);
                const mobilePreviewCount = 3;
                const hasMoreMobile = menu.items.length > mobilePreviewCount;
                const mobileItems = isExpanded ? menu.items : menu.items.slice(0, mobilePreviewCount);

                return (
                  <Card key={menu.id} className="flex flex-col border border-gray-200 bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-6 flex-1 flex flex-col">
                      {/* Шапка картки */}
                      <div className="flex items-start justify-between gap-4 mb-4">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-lg font-semibold text-gray-900 mb-1 flex items-center gap-2">
                            <span className="text-lg">🍽️</span>
                            <span className="truncate">
                              Меню: {menu.name?.trim() ? menu.name : "Без назви"}
                            </span>
                          </h3>
                          <p className="text-sm text-gray-500 leading-relaxed">
                            {menu.description?.trim()
                              ? menu.description
                              : `Формат: ${menu.event_format || "—"} • Гостей: ${menu.people_count ?? "—"}`}
                          </p>
                        </div>
                        <div className="flex gap-2 shrink-0 ml-4">
                          <Button 
                            variant="outline" 
                            size="icon"
                            className="w-9 h-9 hover:bg-gray-100 rounded-lg transition-colors"
                            onClick={() => openEditMenu(menu)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            className="w-9 h-9 hover:bg-red-50 rounded-lg transition-colors text-red-500 hover:text-red-600"
                            onClick={() => handleDeleteMenu(menu)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Розділювач */}
                      <div className="border-t border-gray-200 my-4" />

                      {/* Статистика */}
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4 p-3 bg-gray-50 rounded-lg mb-4">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">💰</span>
                          <span className="text-sm font-medium text-gray-700">
                            ~{formatUAH(totalPrice)} грн
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-lg">📦</span>
                          <span className="text-sm font-medium text-gray-700">
                            {totalPositions} страв
                          </span>
                        </div>
                        {perGuest !== undefined && (
                          <div className="flex items-center gap-2">
                            <span className="text-lg">👤</span>
                            <span className="text-sm font-medium text-gray-700">
                              {formatUAH(perGuest)} грн/гість
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Розділювач */}
                      <div className="border-t border-gray-200 my-4" />

                      {/* Список страв або empty state */}
                      {menu.items.length === 0 ? (
                        <div className="text-center py-8 px-4">
                          <span className="text-5xl block mb-3">⚠️</span>
                          <p className="text-sm text-gray-500 mb-4">Додайте страви до меню</p>
                          <Button 
                            variant="outline"
                            className="bg-[#FF5A00] hover:bg-[#FF5A00]/90 text-white border-[#FF5A00]"
                            onClick={() => openEditMenu(menu)}
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            Додати страви
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {/* Mobile list (collapsed/expanded) */}
                          <ul className="sm:hidden space-y-2">
                            {mobileItems.map((mi) => {
                              const item = mi.item ?? itemsById.get(mi.item_id);
                              const linePrice = (item?.price || 0) * mi.quantity;
                              return (
                                <li key={mi.id} className="flex justify-between items-center py-2">
                                  <span className="text-sm text-gray-700 flex-1 min-w-0">
                                    • {item?.name || `Страва #${mi.item_id}`}{" "}
                                    <span className="text-gray-500">× {mi.quantity}</span>
                                  </span>
                                  <span className="text-sm font-medium text-gray-900 ml-4 shrink-0">
                                    {formatUAH(linePrice)} грн
                                  </span>
                                </li>
                              );
                            })}
                          </ul>

                          {hasMoreMobile && (
                            <div className="sm:hidden mt-3">
                              <Button
                                variant="ghost"
                                className="px-0 text-[#FF5A00] hover:text-[#FF5A00]/90"
                                onClick={() =>
                                  setExpandedMenuIds((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(menu.id)) next.delete(menu.id);
                                    else next.add(menu.id);
                                    return next;
                                  })
                                }
                              >
                                {isExpanded ? `Приховати` : `Показати всі ${menu.items.length} ↓`}
                              </Button>
                            </div>
                          )}

                          {/* Desktop list */}
                          <ul className="hidden sm:block space-y-2">
                            {menu.items.map((mi) => {
                              const item = mi.item ?? itemsById.get(mi.item_id);
                              const linePrice = (item?.price || 0) * mi.quantity;
                              return (
                                <li key={mi.id} className="flex justify-between items-center py-2">
                                  <span className="text-sm text-gray-700 flex-1 min-w-0">
                                    • {item?.name || `Страва #${mi.item_id}`}{" "}
                                    <span className="text-gray-500">× {mi.quantity}</span>
                                  </span>
                                  <span className="text-sm font-medium text-gray-900 ml-4 shrink-0">
                                    {formatUAH(linePrice)} грн
                                  </span>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Форма створення / редагування меню (inline, без модалки) */}
          {isMenuFormOpen && (
            <Card>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {selectedMenu ? "Редагувати меню" : "Нове меню"}
                  </h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIsMenuFormOpen(false);
                      resetMenuForm();
                    }}
                  >
                    Скасувати
                  </Button>
                </div>

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

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium text-gray-900">
                        Виберіть страви для меню
                      </h4>
                    </div>

                    {/* Пошук */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        placeholder="Пошук страв..."
                        value={menuFormSearchQuery}
                        onChange={(e) => setMenuFormSearchQuery(e.target.value)}
                        className="pl-9"
                      />
                    </div>

                    {/* Фільтри по категоріях */}
                    {allMenuCategories.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        <span className="text-sm text-gray-600 py-1">Категорії:</span>
                        {allMenuCategories.map((category) => (
                          <Badge
                            key={category}
                            variant={menuFormSelectedCategories.includes(category) ? "default" : "outline"}
                            className={`cursor-pointer ${
                              menuFormSelectedCategories.includes(category)
                                ? "bg-[#FF5A00] hover:bg-[#FF5A00]/90"
                                : "hover:bg-gray-100"
                            }`}
                            onClick={() => toggleMenuCategory(category)}
                          >
                            {category}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {/* Сітка страв */}
                    {filteredMenuItems.length === 0 ? (
                      <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
                        <Search className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500">
                          Не знайдено страв за вашим запитом
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 max-h-[400px] overflow-y-auto p-1 border rounded-lg">
                        {filteredMenuItems.map((item) => {
                          const isSelected = isMenuItemSelected(item.id);
                          const quantity = getMenuItemQuantity(item.id);
                          return (
                            <div
                              key={item.id}
                              onClick={() => toggleMenuItem(item.id, 1)}
                              className={`p-3 border-2 rounded-lg cursor-pointer transition-all ${
                                isSelected
                                  ? "border-[#FF5A00] bg-[#FF5A00]/5"
                                  : "border-gray-200 hover:border-gray-300"
                              }`}
                            >
                              <div className="flex gap-2">
                                <div className="w-12 h-12 rounded-md overflow-hidden border border-gray-200 flex-shrink-0 bg-gray-50 flex items-center justify-center">
                                  {item.photo_url ? (
                                    <img
                                      src={getImageUrl(item.photo_url) || ""}
                                      alt={item.name}
                                      className="w-full h-full object-cover"
                                      onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = "none";
                                      }}
                                    />
                                  ) : (
                                    <span className="text-[8px] text-gray-400 text-center px-1">
                                      Нема фото
                                    </span>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start justify-between gap-2 mb-1">
                                    <h5 className="text-sm font-medium text-gray-900 truncate flex items-center gap-1">
                                      <span>{item.name}</span>
                                      {item.icon_name && (
                                        <span className="text-base" title={getAllergenName(item.icon_name)}>
                                          {getAllergenIcon(item.icon_name)}
                                        </span>
                                      )}
                                    </h5>
                                    <div className="flex items-center gap-2">
                                      {isSelected && (
                                        <span className="text-xs text-[#FF5A00] font-medium">
                                          ×{quantity}
                                        </span>
                                      )}
                                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                                        isSelected
                                          ? "border-[#FF5A00] bg-[#FF5A00]"
                                          : "border-gray-300"
                                      }`}>
                                        {isSelected && (
                                          <span className="text-white text-xs">✓</span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  {item.description && (
                                    <p className="text-xs text-gray-600 line-clamp-1 mb-1">
                                      {item.description}
                                    </p>
                                  )}
                                  <div className="flex items-center justify-between">
                                    <div className="text-xs text-gray-600">
                                      {item.weight ? `${item.weight}${item.unit}` : '-'}
                                    </div>
                                    <div className="text-sm font-medium text-gray-900">
                                      {item.price} грн
                                    </div>
                                  </div>
                                  {item.subcategory && (
                                    <Badge variant="outline" className="mt-1 text-xs">
                                      {item.subcategory.name}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Вибрані страви */}
                    {menuForm.items.length > 0 && (
                      <div className="space-y-2 border-t pt-4">
                        <h5 className="text-sm font-medium text-gray-900">
                          Вибрані страви ({menuForm.items.length})
                        </h5>
                        <div className="space-y-2 max-h-[200px] overflow-y-auto">
                          {menuForm.items.map((mi, index) => {
                            const item = items.find((it) => it.id === mi.item_id);
                            if (!item) return null;
                            return (
                              <div
                                key={index}
                                className="flex items-center justify-between gap-3 p-2 border rounded-lg bg-gray-50"
                              >
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                  {item.photo_url && (
                                    <img
                                      src={getImageUrl(item.photo_url) || ""}
                                      alt={item.name}
                                      className="w-12 h-12 rounded object-cover border border-gray-200"
                                      onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = "none";
                                      }}
                                    />
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium text-gray-900 truncate flex items-center gap-1">
                                      <span>{item.name}</span>
                                      {item.icon_name && (
                                        <span className="text-base" title={getAllergenName(item.icon_name)}>
                                          {getAllergenIcon(item.icon_name)}
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      {item.price} грн × {mi.quantity} = {(item.price * mi.quantity).toFixed(2)} грн
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Input
                                    type="number"
                                    min={1}
                                    value={mi.quantity}
                                    onChange={(e) => {
                                      const newQuantity = parseInt(e.target.value) || 1;
                                      updateMenuFormItem(index, "quantity", newQuantity.toString());
                                    }}
                                    className="w-20"
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => removeMenuFormItem(index)}
                                    className="h-8 w-8"
                                  >
                                    <Trash2 className="h-4 w-4 text-red-500" />
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <div className="text-sm text-gray-600 pt-2 border-t">
                          Загальна вартість:{" "}
                          <span className="font-medium text-gray-900">
                            {menuForm.items.reduce((sum, mi) => {
                              const item = itemsById.get(mi.item_id);
                              return sum + (item?.price || 0) * mi.quantity;
                            }, 0).toFixed(2)} грн
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
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
                  </div>
                </form>
              </CardContent>
            </Card>
          )}
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
            <DialogDescription>
              {editingItem ? 'Оновіть інформацію про страву' : 'Додайте нову страву до меню'}
            </DialogDescription>
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
                  type="text"
                  inputMode="decimal"
                  value={itemFormData.price === 0 ? '' : itemFormData.price}
                  onFocus={(e) => {
                    // При фокусі - виділяємо весь текст для заміни
                    e.target.select();
                  }}
                  onChange={(e) => {
                    const value = e.target.value;
                    // Дозволяємо тільки цифри, крапку та кому
                    if (value === '' || /^[0-9]*[.,]?[0-9]*$/.test(value)) {
                      // Замінюємо кому на крапку
                      const normalizedValue = value.replace(',', '.');
                      const numValue = normalizedValue === '' ? 0 : parseFloat(normalizedValue);
                      if (!isNaN(numValue) && numValue >= 0) {
                        setItemFormData({...itemFormData, price: numValue});
                      } else if (normalizedValue === '') {
                        setItemFormData({...itemFormData, price: 0});
                      }
                    }
                  }}
                  onBlur={(e) => {
                    // При втраті фокусу - округлюємо до 2 знаків після коми
                    const value = parseFloat(e.target.value.replace(',', '.')) || 0;
                    setItemFormData({...itemFormData, price: Math.round(value * 100) / 100});
                  }}
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="weight">Вага (можна вводити через слеш, наприклад: 150/75)</Label>
                <div className="flex gap-2">
                  <Input
                    id="weight"
                    type="text"
                    placeholder="150 або 150/75"
                    value={itemFormData.weight ? String(itemFormData.weight) : ''}
                    onChange={(e) => setItemFormData({...itemFormData, weight: e.target.value || ''})}
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
              
              <div className="col-span-2">
                <AllergenIconPicker
                  value={itemFormData.icon_name || ""}
                  onChange={(icon) => setItemFormData({...itemFormData, icon_name: icon})}
                  label="Іконка алергену"
                />
              </div>
              
              <div className="col-span-2 space-y-2">
                <Label htmlFor="photo">Фото страви</Label>
                <div className="flex flex-col md:flex-row gap-4 items-start">
                  <div className="flex-1 space-y-2">
                    <Input
                      id="photo_url"
                      type="text"
                      placeholder="URL фото або шлях (наприклад: uploads/photos/photo.jpg)"
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
            <DialogDescription>
              Створіть нову категорію для страв
            </DialogDescription>
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
            <DialogDescription>
              Створіть нову підкатегорію для страв
            </DialogDescription>
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
