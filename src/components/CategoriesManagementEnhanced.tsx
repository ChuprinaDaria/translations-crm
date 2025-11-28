import { useState, useEffect, useMemo } from "react";
import { 
  Plus, Pencil, Trash2, Loader2, 
  FolderOpen, Tag, Package
} from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Card, CardContent } from "./ui/card";
import { Badge } from "./ui/badge";
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
import { toast } from "sonner";
import { itemsApi, categoriesApi, subcategoriesApi, type Item, type Category, type Subcategory } from "../lib/api";

export function CategoriesManagementEnhanced() {
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  
  // Dialogs
  const [isCreateCategoryModalOpen, setIsCreateCategoryModalOpen] = useState(false);
  const [isEditCategoryModalOpen, setIsEditCategoryModalOpen] = useState(false);
  const [isCreateSubcategoryModalOpen, setIsCreateSubcategoryModalOpen] = useState(false);
  const [isEditSubcategoryModalOpen, setIsEditSubcategoryModalOpen] = useState(false);
  const [isDeleteCategoryDialogOpen, setIsDeleteCategoryDialogOpen] = useState(false);
  const [isDeleteSubcategoryDialogOpen, setIsDeleteSubcategoryDialogOpen] = useState(false);
  
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingSubcategory, setEditingSubcategory] = useState<Subcategory | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
  const [subcategoryToDelete, setSubcategoryToDelete] = useState<Subcategory | null>(null);
  const [selectedCategoryForSubcategory, setSelectedCategoryForSubcategory] = useState<Category | null>(null);
  
  // Form data
  const [categoryName, setCategoryName] = useState("");
  const [subcategoryName, setSubcategoryName] = useState("");
  const [subcategoryCategoryId, setSubcategoryCategoryId] = useState<number>(0);

  // Load data
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [itemsData, categoriesData, subcategoriesData] = await Promise.all([
        itemsApi.getItems(0, 1000),
        categoriesApi.getCategories(),
        subcategoriesApi.getSubcategories(),
      ]);
      setItems(itemsData);
      setCategories(categoriesData);
      setSubcategories(subcategoriesData);
    } catch (error: any) {
      toast.error(error?.data?.detail || "Помилка завантаження даних");
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Statistics
  const stats = useMemo(() => {
    const totalCategories = categories.length;
    const totalSubcategories = subcategories.length;
    const totalItems = items.length;
    
    return { totalCategories, totalSubcategories, totalItems };
  }, [categories, subcategories, items]);

  // Reset forms
  const resetCategoryForm = () => {
    setCategoryName("");
    setEditingCategory(null);
  };

  const resetSubcategoryForm = () => {
    setSubcategoryName("");
    setSubcategoryCategoryId(0);
    setEditingSubcategory(null);
    setSelectedCategoryForSubcategory(null);
  };

  // Category handlers
  const handleCreateCategory = () => {
    resetCategoryForm();
    setIsCreateCategoryModalOpen(true);
  };

  const handleEditCategory = (category: Category) => {
    setEditingCategory(category);
    setCategoryName(category.name);
    setIsEditCategoryModalOpen(true);
  };

  const handleDeleteCategory = (category: Category) => {
    // Check if category has subcategories
    const categorySubcategories = subcategories.filter(sub => sub.category_id === category.id);
    if (categorySubcategories.length > 0) {
      toast.error(`Неможливо видалити категорію, яка має ${categorySubcategories.length} підкатегорій`);
      return;
    }
    
    setCategoryToDelete(category);
    setIsDeleteCategoryDialogOpen(true);
  };

  const submitCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!categoryName.trim()) {
      toast.error("Введіть назву категорії");
      return;
    }

    try {
      setActionLoading(true);
      
      if (editingCategory) {
        // Note: API doesn't have update endpoint, so we show a message
        toast.info("API не підтримує редагування категорій");
      } else {
        await categoriesApi.createCategory(categoryName);
        toast.success("Категорія успішно створена");
      }
      
      await loadData();
      setIsCreateCategoryModalOpen(false);
      setIsEditCategoryModalOpen(false);
      resetCategoryForm();
    } catch (error: any) {
      toast.error(error?.data?.detail || "Помилка збереження категорії");
      console.error("Error saving category:", error);
    } finally {
      setActionLoading(false);
    }
  };

  const confirmDeleteCategory = async () => {
    if (!categoryToDelete) return;

    try {
      setActionLoading(true);
      // Note: API doesn't have delete endpoint, so we show a message
      toast.info("API не підтримує видалення категорій");
      setIsDeleteCategoryDialogOpen(false);
      setCategoryToDelete(null);
    } catch (error: any) {
      toast.error(error?.data?.detail || "Помилка видалення категорії");
      console.error("Error deleting category:", error);
    } finally {
      setActionLoading(false);
    }
  };

  // Subcategory handlers
  const handleCreateSubcategory = (category: Category) => {
    resetSubcategoryForm();
    setSelectedCategoryForSubcategory(category);
    setSubcategoryCategoryId(category.id);
    setIsCreateSubcategoryModalOpen(true);
  };

  const handleEditSubcategory = (subcategory: Subcategory) => {
    setEditingSubcategory(subcategory);
    setSubcategoryName(subcategory.name);
    setSubcategoryCategoryId(subcategory.category_id);
    setIsEditSubcategoryModalOpen(true);
  };

  const handleDeleteSubcategory = (subcategory: Subcategory) => {
    // Check if subcategory has items
    const subcategoryItems = items.filter(item => item.subcategory_id === subcategory.id);
    if (subcategoryItems.length > 0) {
      toast.error(`Неможливо видалити підкатегорію, яка має ${subcategoryItems.length} товарів`);
      return;
    }
    
    setSubcategoryToDelete(subcategory);
    setIsDeleteSubcategoryDialogOpen(true);
  };

  const submitSubcategory = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!subcategoryName.trim()) {
      toast.error("Введіть назву підкатегорії");
      return;
    }

    if (!subcategoryCategoryId) {
      toast.error("Оберіть категорію");
      return;
    }

    try {
      setActionLoading(true);
      
      if (editingSubcategory) {
        // Note: API doesn't have update endpoint, so we show a message
        toast.info("API не підтримує редагування підкатегорій");
      } else {
        await subcategoriesApi.createSubcategory({
          name: subcategoryName,
          category_id: subcategoryCategoryId,
        });
        toast.success("Підкатегорія успішно створена");
      }
      
      await loadData();
      setIsCreateSubcategoryModalOpen(false);
      setIsEditSubcategoryModalOpen(false);
      resetSubcategoryForm();
    } catch (error: any) {
      toast.error(error?.data?.detail || "Помилка збереження підкатегорії");
      console.error("Error saving subcategory:", error);
    } finally {
      setActionLoading(false);
    }
  };

  const confirmDeleteSubcategory = async () => {
    if (!subcategoryToDelete) return;

    try {
      setActionLoading(true);
      // Note: API doesn't have delete endpoint, so we show a message
      toast.info("API не підтримує видалення підкатегорій");
      setIsDeleteSubcategoryDialogOpen(false);
      setSubcategoryToDelete(null);
    } catch (error: any) {
      toast.error(error?.data?.detail || "Помилка видалення підкатегорії");
      console.error("Error deleting subcategory:", error);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl text-gray-900">
          Категорії та підкатегорії
        </h1>
        <Button
          onClick={handleCreateCategory}
          className="bg-[#FF5A00] hover:bg-[#FF5A00]/90"
        >
          <Plus className="mr-2 h-4 w-4" />
          Додати категорію
        </Button>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <FolderOpen className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Категорій</p>
                <p className="text-2xl">{stats.totalCategories}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Tag className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Підкатегорій</p>
                <p className="text-2xl">{stats.totalSubcategories}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#FF5A00]/10 rounded-lg">
                <Package className="h-5 w-5 text-[#FF5A00]" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Всього товарів</p>
                <p className="text-2xl">{stats.totalItems}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Loading state */}
      {loading && (
        <Card>
          <CardContent className="p-12">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-12 w-12 text-[#FF5A00] animate-spin" />
              <p className="text-gray-500">Завантаження категорій...</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {!loading && categories.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <FolderOpen className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl text-gray-900 mb-2">
              Немає категорій
            </h3>
            <p className="text-gray-500 mb-6">
              Створіть першу категорію для організації товарів
            </p>
            <Button
              onClick={handleCreateCategory}
              className="bg-[#FF5A00] hover:bg-[#FF5A00]/90"
            >
              <Plus className="mr-2 h-4 w-4" />
              Створити категорію
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Categories list */}
      {!loading && categories.length > 0 && (
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
                  {/* Category header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <FolderOpen className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="text-lg">{category.name}</h3>
                        <p className="text-sm text-gray-500">
                          {categorySubcategories.length} підкатегорій • {categoryItemsCount} товарів
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEditCategory(category)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteCategory(category)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
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
                            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <Tag className="h-4 w-4 text-gray-400" />
                              <span className="font-medium">{subcategory.name}</span>
                              <Badge variant="outline">
                                {subcategoryItemsCount} товарів
                              </Badge>
                            </div>
                            
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEditSubcategory(subcategory)}
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteSubcategory(subcategory)}
                              >
                                <Trash2 className="h-3 w-3 text-red-500" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  
                  {/* Add subcategory button */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCreateSubcategory(category)}
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

      {/* Create Category Dialog */}
      <Dialog open={isCreateCategoryModalOpen} onOpenChange={(open) => {
        if (!open) {
          setIsCreateCategoryModalOpen(false);
          resetCategoryForm();
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Нова категорія</DialogTitle>
          </DialogHeader>
          
          <form onSubmit={submitCategory} className="space-y-4">
            <div>
              <Label htmlFor="category-name">Назва категорії *</Label>
              <Input
                id="category-name"
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                placeholder="Введіть назву категорії"
                required
              />
            </div>
            
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsCreateCategoryModalOpen(false);
                  resetCategoryForm();
                }}
              >
                Скасувати
              </Button>
              <Button
                type="submit"
                className="bg-[#FF5A00] hover:bg-[#FF5A00]/90"
                disabled={actionLoading}
              >
                {actionLoading ? (
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

      {/* Edit Category Dialog */}
      <Dialog open={isEditCategoryModalOpen} onOpenChange={(open) => {
        if (!open) {
          setIsEditCategoryModalOpen(false);
          resetCategoryForm();
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Редагувати категорію</DialogTitle>
          </DialogHeader>
          
          <form onSubmit={submitCategory} className="space-y-4">
            <div>
              <Label htmlFor="edit-category-name">Назва категорії *</Label>
              <Input
                id="edit-category-name"
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                placeholder="Введіть назву категорії"
                required
              />
            </div>
            
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsEditCategoryModalOpen(false);
                  resetCategoryForm();
                }}
              >
                Скасувати
              </Button>
              <Button
                type="submit"
                className="bg-[#FF5A00] hover:bg-[#FF5A00]/90"
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Збереження...
                  </>
                ) : (
                  'Зберегти'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create Subcategory Dialog */}
      <Dialog open={isCreateSubcategoryModalOpen} onOpenChange={(open) => {
        if (!open) {
          setIsCreateSubcategoryModalOpen(false);
          resetSubcategoryForm();
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Нова підкатегорія {selectedCategoryForSubcategory && `для "${selectedCategoryForSubcategory.name}"`}
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={submitSubcategory} className="space-y-4">
            <div>
              <Label htmlFor="subcategory-name">Назва підкатегорії *</Label>
              <Input
                id="subcategory-name"
                value={subcategoryName}
                onChange={(e) => setSubcategoryName(e.target.value)}
                placeholder="Введіть назву підкатегорії"
                required
              />
            </div>
            
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsCreateSubcategoryModalOpen(false);
                  resetSubcategoryForm();
                }}
              >
                Скасувати
              </Button>
              <Button
                type="submit"
                className="bg-[#FF5A00] hover:bg-[#FF5A00]/90"
                disabled={actionLoading}
              >
                {actionLoading ? (
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

      {/* Edit Subcategory Dialog */}
      <Dialog open={isEditSubcategoryModalOpen} onOpenChange={(open) => {
        if (!open) {
          setIsEditSubcategoryModalOpen(false);
          resetSubcategoryForm();
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Редагувати підкатегорію</DialogTitle>
          </DialogHeader>
          
          <form onSubmit={submitSubcategory} className="space-y-4">
            <div>
              <Label htmlFor="edit-subcategory-name">Назва підкатегорії *</Label>
              <Input
                id="edit-subcategory-name"
                value={subcategoryName}
                onChange={(e) => setSubcategoryName(e.target.value)}
                placeholder="Введіть назву підкатегорії"
                required
              />
            </div>
            
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsEditSubcategoryModalOpen(false);
                  resetSubcategoryForm();
                }}
              >
                Скасувати
              </Button>
              <Button
                type="submit"
                className="bg-[#FF5A00] hover:bg-[#FF5A00]/90"
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Збереження...
                  </>
                ) : (
                  'Зберегти'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Category Confirmation */}
      <AlertDialog open={isDeleteCategoryDialogOpen} onOpenChange={setIsDeleteCategoryDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Видалити категорію?</AlertDialogTitle>
            <AlertDialogDescription>
              Ви впевнені, що хочете видалити категорію "{categoryToDelete?.name}"? 
              Цю дію неможливо скасувати.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setCategoryToDelete(null)}>Скасувати</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteCategory}
              className="bg-red-600 hover:bg-red-700"
              disabled={actionLoading}
            >
              {actionLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Видалення...
                </>
              ) : (
                'Видалити'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Subcategory Confirmation */}
      <AlertDialog open={isDeleteSubcategoryDialogOpen} onOpenChange={setIsDeleteSubcategoryDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Видалити підкатегорію?</AlertDialogTitle>
            <AlertDialogDescription>
              Ви впевнені, що хочете видалити підкатегорію "{subcategoryToDelete?.name}"? 
              Цю дію неможливо скасувати.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSubcategoryToDelete(null)}>Скасувати</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteSubcategory}
              className="bg-red-600 hover:bg-red-700"
              disabled={actionLoading}
            >
              {actionLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Видалення...
                </>
              ) : (
                'Видалити'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}