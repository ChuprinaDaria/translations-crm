import React, { useState, useEffect, ChangeEvent } from "react";
import {
  itemsApi,
  categoriesApi,
  subcategoriesApi,
  type ItemCreate,
  getImageUrl,
} from "../lib/api";
import type { Item, Category, Subcategory } from "../lib/api";
import { toast } from "sonner";
import {
  Monitor,
  Plus,
  Search,
  Pencil,
  Trash2,
  FolderOpen,
  Tag,
  Loader2,
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

const EQUIPMENT_CATEGORY_NAME = "Обладнання";

export function EquipmentManagement() {
  // States
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [loading, setLoading] = useState(false);
  
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
    stock_quantity: 0,
    loss_price: 0,
    weight: 0,
    volume: "",
    unit: "",
    photo_url: "",
    active: true,
    subcategory_id: 0,
  });
  const [itemPhotoFile, setItemPhotoFile] = useState<File | null>(null);
  const [itemPhotoPreview, setItemPhotoPreview] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("");
  
  // Form - Category
  const [categoryFormData, setCategoryFormData] = useState({ name: EQUIPMENT_CATEGORY_NAME });
  
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
      const [itemsData, categoriesData, subcategoriesData] = await Promise.all([
        itemsApi.getItems(0, 1000),
        categoriesApi.getCategories(),
        subcategoriesApi.getSubcategories(),
      ]);
      
      // Фільтруємо тільки обладнання (категорія "Обладнання")
      const equipmentCategory = categoriesData.find(cat => cat.name === EQUIPMENT_CATEGORY_NAME);
      const equipmentItems = equipmentCategory
        ? itemsData.filter(item => item.subcategory?.category_id === equipmentCategory.id)
        : [];
      
      setItems(equipmentItems);
      setCategories(categoriesData);
      setSubcategories(subcategoriesData);
      
      // Якщо категорії "Обладнання" немає, створюємо її
      if (!equipmentCategory) {
        try {
          const newCategory = await categoriesApi.createCategory(EQUIPMENT_CATEGORY_NAME);
          setCategories([...categoriesData, newCategory]);
        } catch (error) {
          console.error("Помилка створення категорії Обладнання:", error);
        }
      }
      
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

  // Filtered subcategories
  const filteredSubcategories = subcategories.filter(
    sub => !selectedCategory || sub.category_id === parseInt(selectedCategory)
  );

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
      stock_quantity: 0,
      loss_price: 0,
      weight: 0,
      volume: "",
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
      toast.error("Введіть назву обладнання");
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
      toast.success("Обладнання створено!");
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
      stock_quantity: item.stock_quantity || 0,
      loss_price: item.loss_price || 0,
      weight: item.weight || 0,
      volume: item.volume || "",
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
      toast.success("Обладнання оновлено!");
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
      toast.success("Обладнання видалено!");
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
      const newCategory = await categoriesApi.createCategory(categoryFormData.name.trim());
      setCategories([...categories, newCategory]);
      setIsCreateCategoryModalOpen(false);
      setCategoryFormData({ name: EQUIPMENT_CATEGORY_NAME });
      toast.success("Категорію створено!");
    } catch (error: any) {
      toast.error(error.data?.detail || "Помилка створення категорії");
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
      toast.error(error.data?.detail || "Помилка видалення категорії");
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
      const newSubcategory = await subcategoriesApi.createSubcategory({
        name: subcategoryFormData.name.trim(),
        category_id: subcategoryFormData.category_id,
      });
      setSubcategories([...subcategories, newSubcategory]);
      setIsCreateSubcategoryModalOpen(false);
      setSubcategoryFormData({ name: "", category_id: 0 });
      setSelectedCategoryForSubcategory(null);
      toast.success("Підкатегорію створено!");
    } catch (error: any) {
      toast.error(error.data?.detail || "Помилка створення підкатегорії");
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
      toast.error(error.data?.detail || "Помилка видалення підкатегорії");
    } finally {
      setLoading(false);
    }
  };

  // Фільтруємо категорії тільки для обладнання
  const equipmentCategories = categories.filter(cat => cat.name === EQUIPMENT_CATEGORY_NAME);
  const equipmentSubcategories = subcategories.filter(sub => 
    equipmentCategories.some(cat => cat.id === sub.category_id)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl text-gray-900">Обладнання</h1>
          <p className="text-gray-500">Управління обладнанням та його категоріями</p>
        </div>
        <Button
          onClick={() => setIsCreateItemModalOpen(true)}
          className="bg-[#FF5A00] hover:bg-[#FF5A00]/90"
        >
          <Plus className="mr-2 h-4 w-4" />
          Додати обладнання
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="items" className="space-y-6">
        <TabsList>
          <TabsTrigger value="items">
            <Monitor className="mr-2 h-4 w-4" />
            Обладнання
          </TabsTrigger>
          <TabsTrigger value="categories">
            <FolderOpen className="mr-2 h-4 w-4" />
            Категорії
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
                    placeholder="Шукати обладнання..."
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
                  {equipmentSubcategories.map(sub => (
                    <option key={sub.id} value={sub.category_id}>{sub.name}</option>
                  ))}
                </select>
                
                <select
                  className="border rounded-md px-3 py-2"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="">Всі статуси</option>
                  <option value="active">Активні</option>
                  <option value="inactive">Неактивні</option>
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
                <Monitor className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Немає обладнання
                </h3>
                <p className="text-gray-500 mb-6">
                  Додайте перше обладнання
                </p>
                <Button
                  onClick={() => setIsCreateItemModalOpen(true)}
                  className="bg-[#FF5A00] hover:bg-[#FF5A00]/90"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Додати обладнання
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredItems.map((item) => (
                <Card
                  key={item.id}
                  className="hover:shadow-md transition-shadow h-full"
                >
                  <CardContent className="p-4 flex flex-col h-full">
                    <div className="flex gap-3 mb-3">
                      <div className="w-20 h-20 rounded-lg overflow-hidden border bg-gray-50 flex-shrink-0">
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
                        <h3 className="font-medium text-gray-900 truncate mb-1">
                          {item.name}
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

                    <div className="space-y-2 mb-3 text-sm">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-lg font-semibold text-gray-900">
                            {item.price} грн
                          </div>
                          <div className="text-xs text-gray-500">Прокат</div>
                        </div>
                        <Badge
                          variant={item.active ? "default" : "secondary"}
                          className={
                            item.active ? "bg-green-100 text-green-800" : ""
                          }
                        >
                          {item.active ? "Активне" : "Неактивне"}
                        </Badge>
                      </div>
                      {item.stock_quantity !== undefined && item.stock_quantity !== null && (
                        <div className="text-xs text-gray-600">
                          На складі: <span className="font-medium">{item.stock_quantity} шт</span>
                        </div>
                      )}
                      {item.loss_price !== undefined && item.loss_price !== null && (
                        <div className="text-xs text-gray-600">
                          Ціна втрати: <span className="font-medium">{item.loss_price} грн</span>
                        </div>
                      )}
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
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setIsCreateSubcategoryModalOpen(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Додати підкатегорію
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
          ) : equipmentCategories.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <FolderOpen className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Немає категорій
                </h3>
                <p className="text-gray-500 mb-6">
                  Створіть першу категорію для обладнання
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {equipmentCategories.map(category => {
                const categorySubcategories = equipmentSubcategories.filter(
                  sub => sub.category_id === category.id
                );
                const categoryItemsCount = items.filter(
                  item => item.subcategory?.category_id === category.id
                ).length;
                
                return (
                  <Card key={category.id}>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-100 rounded-lg">
                            <FolderOpen className="h-5 w-5 text-blue-600" />
                          </div>
                          <div>
                            <h3 className="text-lg text-gray-900">{category.name}</h3>
                            <p className="text-sm text-gray-500">
                              {categorySubcategories.length} підкатегорій • {categoryItemsCount} одиниць обладнання
                            </p>
                          </div>
                        </div>
                      </div>
                      
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
                                    {subcategoryItemsCount} одиниць
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
      </Tabs>

      {/* MODALS FOR ITEMS */}
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
              {editingItem ? 'Редагувати обладнання' : 'Нове обладнання'}
            </DialogTitle>
            <DialogDescription>
              {editingItem ? 'Оновіть інформацію про обладнання' : 'Додайте нове обладнання до бази'}
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={editingItem ? handleUpdateItem : handleCreateItem} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="name">Назва обладнання *</Label>
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
                  {equipmentCategories.map(cat => (
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
                <Label htmlFor="price">Ціна прокату за шт/грн *</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={itemFormData.price}
                  onChange={(e) => setItemFormData({...itemFormData, price: parseFloat(e.target.value) || 0})}
                  onFocus={(e) => e.target.select()}
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="stock_quantity">Кількість на складі</Label>
                <Input
                  id="stock_quantity"
                  type="number"
                  step="1"
                  min="0"
                  value={itemFormData.stock_quantity || ""}
                  onChange={(e) => setItemFormData({...itemFormData, stock_quantity: e.target.value ? parseInt(e.target.value) : 0})}
                  onFocus={(e) => e.target.select()}
                  placeholder="Необов'язково"
                />
              </div>
              
              <div>
                <Label htmlFor="loss_price">Ціна втрати шт/грн</Label>
                <Input
                  id="loss_price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={itemFormData.loss_price || ""}
                  onChange={(e) => setItemFormData({...itemFormData, loss_price: e.target.value ? parseFloat(e.target.value) : 0})}
                  onFocus={(e) => e.target.select()}
                  placeholder="Необов'язково"
                />
              </div>
              
              <div>
                <Label htmlFor="volume">Об'єм</Label>
                <Input
                  id="volume"
                  type="number"
                  step="0.01"
                  min="0"
                  value={itemFormData.volume || ""}
                  onChange={(e) => setItemFormData({...itemFormData, volume: e.target.value ? parseFloat(e.target.value) : ""})}
                  onFocus={(e) => e.target.select()}
                  placeholder="Необов'язково"
                />
              </div>
              
              <div className="col-span-2 space-y-2">
                <Label htmlFor="photo">Фото обладнання</Label>
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
                <Label htmlFor="active">Активне обладнання (показувати в списку)</Label>
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
            <AlertDialogTitle>Видалити обладнання?</AlertDialogTitle>
            <AlertDialogDescription>
              Ця дія не може бути скасована. Обладнання "{itemToDelete?.name}" буде видалено назавжди.
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

      {/* Create Subcategory Dialog */}
      <Dialog open={isCreateSubcategoryModalOpen} onOpenChange={setIsCreateSubcategoryModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Нова підкатегорія</DialogTitle>
            <DialogDescription>
              Створіть нову підкатегорію для обладнання
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleCreateSubcategory} className="space-y-4">
            <div>
              <Label htmlFor="subcategory-name">Назва підкатегорії *</Label>
              <Input
                id="subcategory-name"
                value={subcategoryFormData.name}
                onChange={(e) => setSubcategoryFormData({...subcategoryFormData, name: e.target.value})}
                placeholder="Наприклад: Столи, Стільці, Навіс"
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
                {equipmentCategories.map(cat => (
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

