import { Checkbox } from "./ui/checkbox";
import { Switch } from "./ui/switch";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { toast } from "sonner";
import { itemsApi, categoriesApi, subcategoriesApi, type Item, type Category, type Subcategory, type ItemCreate } from "../lib/api";

type SortBy = "name-asc" | "name-desc" | "price-asc" | "price-desc" | "date-asc" | "date-desc";

export function ItemsManagementEnhanced() {
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [subcategoryFilter, setSubcategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priceFrom, setPriceFrom] = useState("");
  const [priceTo, setPriceTo] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("name-asc");
  
  // Dialogs
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);
  const [viewItem, setViewItem] = useState<Item | null>(null);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [itemToDelete, setItemToDelete] = useState<Item | null>(null);
  
  // Bulk operations
  const [selectedItems, setSelectedItems] = useState<number[]>([]);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  
  // Selected category for form
  const [selectedCategory, setSelectedCategory] = useState("");

  // Form state
  const [formData, setFormData] = useState<ItemCreate>({
    name: "",
    description: "",
    price: 0,
    weight: 0,
    unit: "",
    photo_url: "",
    active: true,
    subcategory_id: 0,
  });

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
      toast.error(error?.data?.detail || "Помилка з��вантаження даних");
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Statistics
  const stats = useMemo(() => {
    const totalItems = items.length;
    const activeItems = items.filter(item => item.active).length;
    const inactiveItems = items.filter(item => !item.active).length;
    const avgPrice = items.length > 0 
      ? (items.reduce((sum, item) => sum + item.price, 0) / items.length).toFixed(2)
      : "0.00";
    
    return { totalItems, activeItems, inactiveItems, avgPrice };
  }, [items]);

  // Filtered subcategories based on selected category
  const filteredSubcategoriesForForm = useMemo(() => {
    if (!selectedCategory) return [];
    return subcategories.filter(sub => sub.category_id === parseInt(selectedCategory));
  }, [selectedCategory, subcategories]);

  // Filtered subcategories for filter dropdown
  const filteredSubcategoriesForFilter = useMemo(() => {
    if (!categoryFilter) return [];
    return subcategories.filter(sub => sub.category_id === parseInt(categoryFilter));
  }, [categoryFilter, subcategories]);

  // Filtered and sorted items
  const filteredItems = useMemo(() => {
    let result = [...items];
    
    // Search
    if (searchQuery) {
      result = result.filter(item =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    // Category
    if (categoryFilter) {
      result = result.filter(item =>
        item.subcategory?.category_id === parseInt(categoryFilter)
      );
    }
    
    // Subcategory
    if (subcategoryFilter) {
      result = result.filter(item =>
        item.subcategory_id === parseInt(subcategoryFilter)
      );
    }
    
    // Status
    if (statusFilter === 'active') {
      result = result.filter(item => item.active);
    } else if (statusFilter === 'inactive') {
      result = result.filter(item => !item.active);
    }
    
    // Price
    if (priceFrom) {
      result = result.filter(item => item.price >= parseFloat(priceFrom));
    }
    if (priceTo) {
      result = result.filter(item => item.price <= parseFloat(priceTo));
    }
    
    // Sorting
    result.sort((a, b) => {
      switch (sortBy) {
        case 'name-asc': return a.name.localeCompare(b.name);
        case 'name-desc': return b.name.localeCompare(a.name);
        case 'price-asc': return a.price - b.price;
        case 'price-desc': return b.price - a.price;
        case 'date-desc': 
          return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
        case 'date-asc':
          return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
        default: return 0;
      }
    });
    
    return result;
  }, [items, searchQuery, categoryFilter, subcategoryFilter, statusFilter, priceFrom, priceTo, sortBy]);

  // Paginated items
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return filteredItems.slice(start, end);
  }, [filteredItems, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);

  // Reset filters
  const resetFilters = () => {
    setSearchQuery("");
    setCategoryFilter("");
    setSubcategoryFilter("");
    setStatusFilter("");
    setPriceFrom("");
    setPriceTo("");
    setSortBy("name-asc");
    setCurrentPage(1);
  };

  // Reset form
  const resetForm = () => {
    setFormData({
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
    setEditingItem(null);
  };

  // Handle create
  const handleCreate = () => {
    resetForm();
    setIsCreateModalOpen(true);
  };

  // Handle edit
  const handleEdit = (item: Item) => {
    setEditingItem(item);
    setFormData({
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
    setIsEditModalOpen(true);
  };

  // Handle view
  const handleView = (item: Item) => {
    setViewItem(item);
  };

  // Handle delete
  const handleDelete = (item: Item) => {
    setItemToDelete(item);
    setIsDeleteDialogOpen(true);
  };

  // Submit form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.subcategory_id) {
      toast.error("Заповніть всі обов'язкові поля");
      return;
    }

    try {
      setActionLoading(true);
      
      if (editingItem) {
        await itemsApi.updateItem(editingItem.id, formData);
        toast.success("Товар успішно оновлено");
      } else {
        await itemsApi.createItem(formData);
        toast.success("Товар успішно створено");
      }
      
      await loadData();
      setIsCreateModalOpen(false);
      setIsEditModalOpen(false);
      resetForm();
    } catch (error: any) {
      toast.error(error?.data?.detail || "Помилка збереження товару");
      console.error("Error saving item:", error);
    } finally {
      setActionLoading(false);
    }
  };

  // Confirm delete
  const confirmDelete = async () => {
    if (!itemToDelete) return;

    try {
      setActionLoading(true);
      await itemsApi.deleteItem(itemToDelete.id);
      toast.success("Товар успішно видалено");
      await loadData();
      setIsDeleteDialogOpen(false);
      setItemToDelete(null);
    } catch (error: any) {
      toast.error(error?.data?.detail || "Помилка видалення товару");
      console.error("Error deleting item:", error);
    } finally {
      setActionLoading(false);
    }
  };

  // Bulk operations
  const toggleSelectAll = () => {
    if (selectedItems.length === paginatedItems.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(paginatedItems.map(item => item.id));
    }
  };

  const toggleSelectItem = (id: number) => {
    setSelectedItems(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const bulkActivate = async () => {
    try {
      setActionLoading(true);
      await Promise.all(
        selectedItems.map(id =>
          itemsApi.updateItem(id, { active: true })
        )
      );
      await loadData();
      setSelectedItems([]);
      toast.success(`Активовано ${selectedItems.length} товарів`);
    } catch (error: any) {
      toast.error("Помилка масового оновлення");
      console.error("Error bulk activating:", error);
    } finally {
      setActionLoading(false);
    }
  };

  const bulkDeactivate = async () => {
    try {
      setActionLoading(true);
      await Promise.all(
        selectedItems.map(id =>
          itemsApi.updateItem(id, { active: false })
        )
      );
      await loadData();
      setSelectedItems([]);
      toast.success(`Деактивовано ${selectedItems.length} товарів`);
    } catch (error: any) {
      toast.error("Помилка масового оновлення");
      console.error("Error bulk deactivating:", error);
    } finally {
      setActionLoading(false);
    }
  };

  const bulkDelete = () => {
    setIsBulkDeleteDialogOpen(true);
  };

  const confirmBulkDelete = async () => {
    try {
      setActionLoading(true);
      await Promise.all(
        selectedItems.map(id => itemsApi.deleteItem(id))
      );
      await loadData();
      setSelectedItems([]);
      setIsBulkDeleteDialogOpen(false);
      toast.success(`Видалено ${selectedItems.length} товарів`);
    } catch (error: any) {
      toast.error("Помилка масового видалення");
      console.error("Error bulk deleting:", error);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl text-gray-900">Управління товарами</h1>
        <Button
          onClick={handleCreate}
          className="bg-[#FF5A00] hover:bg-[#FF5A00]/90"
        >
          <Plus className="mr-2 h-4 w-4" />
          Додати товар
        </Button>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Package className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Всього товарів</p>
                <p className="text-2xl">{stats.totalItems}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Активні</p>
                <p className="text-2xl text-green-600">{stats.activeItems}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 rounded-lg">
                <XCircle className="h-5 w-5 text-gray-400" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Неактивні</p>
                <p className="text-2xl text-gray-500">{stats.inactiveItems}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#FF5A00]/10 rounded-lg">
                <DollarSign className="h-5 w-5 text-[#FF5A00]" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Середня ціна</p>
                <p className="text-2xl text-[#FF5A00]">₴{stats.avgPrice}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search */}
            <div className="lg:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Шукати товар..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            {/* Category */}
            <Select value={categoryFilter} onValueChange={(value) => {
              setCategoryFilter(value);
              setSubcategoryFilter("");
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Всі категорії" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Всі категорії</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat.id} value={cat.id.toString()}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {/* Subcategory */}
            <Select 
              value={subcategoryFilter} 
              onValueChange={setSubcategoryFilter}
              disabled={!categoryFilter}
            >
              <SelectTrigger>
                <SelectValue placeholder="Всі підкатегорії" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Всі підкатегорії</SelectItem>
                {filteredSubcategoriesForFilter.map(sub => (
                  <SelectItem key={sub.id} value={sub.id.toString()}>{sub.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {/* Status */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Всі ��татуси" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Всі статуси</SelectItem>
                <SelectItem value="active">Активні</SelectItem>
                <SelectItem value="inactive">Неактивні</SelectItem>
              </SelectContent>
            </Select>
            
            {/* Price from */}
            <Input
              type="number"
              placeholder="Ціна від"
              value={priceFrom}
              onChange={(e) => setPriceFrom(e.target.value)}
            />
            
            {/* Price to */}
            <Input
              type="number"
              placeholder="Ціна до"
              value={priceTo}
              onChange={(e) => setPriceTo(e.target.value)}
            />
            
            {/* Sort */}
            <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortBy)}>
              <SelectTrigger>
                <SelectValue placeholder="Сортування" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name-asc">Назва (А-Я)</SelectItem>
                <SelectItem value="name-desc">Назва (Я-А)</SelectItem>
                <SelectItem value="price-asc">Ціна (зростання)</SelectItem>
                <SelectItem value="price-desc">Ціна (спадання)</SelectItem>
                <SelectItem value="date-desc">Нові спочатку</SelectItem>
                <SelectItem value="date-asc">Старі спочатку</SelectItem>
              </SelectContent>
            </Select>
            
            {/* Reset button */}
            <Button variant="outline" onClick={resetFilters}>
              <X className="mr-2 h-4 w-4" />
              Скинути
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Bulk actions */}
      {selectedItems.length > 0 && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-4">
              <Checkbox
                checked={selectedItems.length === paginatedItems.length}
                onCheckedChange={toggleSelectAll}
              />
              <span className="font-medium">
                Обрано: {selectedItems.length} товарів
              </span>
              
              <div className="flex gap-2 ml-auto">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={bulkActivate}
                  disabled={actionLoading}
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Активувати
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={bulkDeactivate}
                  disabled={actionLoading}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Деактивувати
                </Button>
                
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={bulkDelete}
                  disabled={actionLoading}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Видалити ({selectedItems.length})
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading state */}
      {loading && (
        <Card>
          <CardContent className="p-12">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-12 w-12 text-[#FF5A00] animate-spin" />
              <p className="text-gray-500">Завантаження товарів...</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {!loading && filteredItems.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <Package className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl text-gray-900 mb-2">
              {searchQuery || categoryFilter || statusFilter 
                ? 'Товари не знайдено'
                : 'Немає товарів'}
            </h3>
            <p className="text-gray-500 mb-6">
              {searchQuery || categoryFilter || statusFilter
                ? 'Спробуйте змінити параметри пошуку'
                : 'Почніть з додавання вашого першого товару'}
            </p>
            {!(searchQuery || categoryFilter || statusFilter) && (
              <Button
                onClick={handleCreate}
                className="bg-[#FF5A00] hover:bg-[#FF5A00]/90"
              >
                <Plus className="mr-2 h-4 w-4" />
                Додати товар
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Desktop Table */}
      {!loading && filteredItems.length > 0 && (
        <>
          <div className="hidden md:block">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedItems.length === paginatedItems.length && paginatedItems.length > 0}
                          onCheckedChange={toggleSelectAll}
                        />
                      </TableHead>
                      <TableHead className="w-20">Фото</TableHead>
                      <TableHead>Назва</TableHead>
                      <TableHead>Категорія</TableHead>
                      <TableHead>Ціна</TableHead>
                      <TableHead>Вага</TableHead>
                      <TableHead>Статус</TableHead>
                      <TableHead className="w-32">Дії</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedItems.map(item => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedItems.includes(item.id)}
                            onCheckedChange={() => toggleSelectItem(item.id)}
                          />
                        </TableCell>
                        <TableCell>
                          <ImageWithFallback
                            src={item.photo_url || ''}
                            alt={item.name}
                            className="w-12 h-12 object-cover rounded"
                          />
                        </TableCell>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div className="text-gray-900">
                              {item.subcategory?.category?.name || 'N/A'}
                            </div>
                            <div className="text-gray-500">
                              {item.subcategory?.name || 'N/A'}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-[#FF5A00]">
                          ₴{item.price}
                        </TableCell>
                        <TableCell>
                          {item.weight && item.unit ? `${item.weight} ${item.unit}` : '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={item.active ? 'default' : 'secondary'} className={item.active ? 'bg-green-100 text-green-700' : ''}>
                            {item.active ? 'Активний' : 'Неактивний'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleView(item)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(item)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(item)}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-4">
            {paginatedItems.map(item => (
              <Card key={item.id}>
                <CardContent className="p-4">
                  <div className="flex gap-4">
                    <Checkbox
                      checked={selectedItems.includes(item.id)}
                      onCheckedChange={() => toggleSelectItem(item.id)}
                    />
                    
                    <ImageWithFallback
                      src={item.photo_url || ''}
                      alt={item.name}
                      className="w-20 h-20 object-cover rounded"
                    />
                    
                    <div className="flex-1">
                      <h3 className="font-semibold mb-1">{item.name}</h3>
                      <p className="text-sm text-gray-500 mb-1">
                        {item.subcategory?.category?.name} → {item.subcategory?.name}
                      </p>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg text-[#FF5A00]">
                          ₴{item.price}
                        </span>
                        <Badge variant={item.active ? 'default' : 'secondary'} className={item.active ? 'bg-green-100 text-green-700' : ''}>
                          {item.active ? 'Активний' : 'Неактивний'}
                        </Badge>
                      </div>
                      {item.weight && item.unit && (
                        <p className="text-sm text-gray-500">
                          {item.weight} {item.unit}
                        </p>
                      )}
                    </div>
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleView(item)}>
                          <Eye className="mr-2 h-4 w-4" />
                          Переглянути
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleEdit(item)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Редагувати
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() => handleDelete(item)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Видалити
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-sm text-gray-500">
              Показано {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, filteredItems.length)} з {filteredItems.length}
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => p - 1)}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
                Попередня
              </Button>
              
              <span className="text-sm">
                Сторінка {currentPage} з {totalPages}
              </span>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => p + 1)}
                disabled={currentPage === totalPages}
              >
                Наступна
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}

      {/* View Dialog */}
      <Dialog open={viewItem !== null} onOpenChange={() => setViewItem(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{viewItem?.name}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Photo */}
            <ImageWithFallback
              src={viewItem?.photo_url || ''}
              alt={viewItem?.name || ''}
              className="w-full h-64 object-cover rounded-lg"
            />
            
            {/* Status */}
            <div>
              <Badge variant={viewItem?.active ? 'default' : 'secondary'} className={`text-base px-3 py-1 ${viewItem?.active ? 'bg-green-100 text-green-700' : ''}`}>
                {viewItem?.active ? 'Активний' : 'Неактивний'}
              </Badge>
            </div>
            
            {/* Information */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-500">Категорія</Label>
                <p className="text-lg">{viewItem?.subcategory?.category?.name || 'N/A'}</p>
              </div>
              <div>
                <Label className="text-gray-500">Підкатегорія</Label>
                <p className="text-lg">{viewItem?.subcategory?.name || 'N/A'}</p>
              </div>
              <div>
                <Label className="text-gray-500">Ціна</Label>
                <p className="text-2xl text-[#FF5A00]">₴{viewItem?.price}</p>
              </div>
              <div>
                <Label className="text-gray-500">Вага</Label>
                <p className="text-lg">
                  {viewItem?.weight && viewItem?.unit ? `${viewItem.weight} ${viewItem.unit}` : 'Не вказано'}
                </p>
              </div>
            </div>
            
            {/* Description */}
            {viewItem?.description && (
              <div>
                <Label className="text-gray-500">Опис</Label>
                <p className="text-gray-900 mt-1">{viewItem.description}</p>
              </div>
            )}
            
            {/* Created date */}
            <div>
              <Label className="text-gray-500">Дата створення</Label>
              <p className="text-gray-900">
                {viewItem?.created_at 
                  ? new Date(viewItem.created_at).toLocaleDateString('uk-UA', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })
                  : 'Не вказано'}
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewItem(null)}>
              Закрити
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (viewItem) {
                  handleEdit(viewItem);
                  setViewItem(null);
                }
              }}
            >
              <Pencil className="mr-2 h-4 w-4" />
              Редагувати
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (viewItem) {
                  handleDelete(viewItem);
                  setViewItem(null);
                }
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Видалити
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Form Dialog */}
      <Dialog open={isCreateModalOpen || isEditModalOpen} onOpenChange={(open) => {
        if (!open) {
          setIsCreateModalOpen(false);
          setIsEditModalOpen(false);
          resetForm();
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? 'Редагувати товар' : 'Новий товар'}
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Name */}
              <div className="col-span-2">
                <Label htmlFor="name">Назва товару *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  required
                />
              </div>
              
              {/* Description */}
              <div className="col-span-2">
                <Label htmlFor="description">Опис</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  rows={3}
                />
              </div>
              
              {/* Category */}
              <div>
                <Label htmlFor="category">Категорія *</Label>
                <Select
                  value={selectedCategory}
                  onValueChange={(value) => {
                    setSelectedCategory(value);
                    setFormData({...formData, subcategory_id: 0});
                  }}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Оберіть категорію" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(cat => (
                      <SelectItem key={cat.id} value={cat.id.toString()}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Subcategory */}
              <div>
                <Label htmlFor="subcategory">Підкатегорія *</Label>
                <Select
                  value={formData.subcategory_id ? formData.subcategory_id.toString() : ""}
                  onValueChange={(value) => 
                    setFormData({...formData, subcategory_id: parseInt(value)})
                  }
                  disabled={!selectedCategory}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Оберіть підкатегорію" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredSubcategoriesForForm.map(sub => (
                      <SelectItem key={sub.id} value={sub.id.toString()}>{sub.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Price */}
              <div>
                <Label htmlFor="price">Ціна (₴) *</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.price || ''}
                  onChange={(e) => setFormData({...formData, price: parseFloat(e.target.value) || 0})}
                  required
                />
              </div>
              
              {/* Weight */}
              <div>
                <Label htmlFor="weight">Вага</Label>
                <Input
                  id="weight"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.weight || ''}
                  onChange={(e) => setFormData({...formData, weight: parseFloat(e.target.value) || 0})}
                />
              </div>
              
              {/* Unit */}
              <div className="col-span-2">
                <Label htmlFor="unit">Одиниця виміру</Label>
                <Select
                  value={formData.unit}
                  onValueChange={(value) => setFormData({...formData, unit: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Оберіть одиницю" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Не вказано</SelectItem>
                    <SelectItem value="г">грами (г)</SelectItem>
                    <SelectItem value="кг">кілограми (кг)</SelectItem>
                    <SelectItem value="мл">мілілітри (мл)</SelectItem>
                    <SelectItem value="л">літри (л)</SelectItem>
                    <SelectItem value="шт">штуки (шт)</SelectItem>
                    <SelectItem value="порц">порції (порц)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Photo URL */}
              <div className="col-span-2">
                <Label htmlFor="photo_url">URL фото</Label>
                <Input
                  id="photo_url"
                  type="url"
                  placeholder="https://example.com/photo.jpg"
                  value={formData.photo_url}
                  onChange={(e) => setFormData({...formData, photo_url: e.target.value})}
                />
                {formData.photo_url && (
                  <div className="mt-2">
                    <ImageWithFallback
                      src={formData.photo_url}
                      alt="Preview"
                      className="w-32 h-32 object-cover rounded"
                    />
                  </div>
                )}
              </div>
              
              {/* Active */}
              <div className="col-span-2 flex items-center gap-2">
                <Switch
                  id="active"
                  checked={formData.active}
                  onCheckedChange={(checked) => setFormData({...formData, active: checked})}
                />
                <Label htmlFor="active">Активний товар</Label>
              </div>
            </div>
            
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsCreateModalOpen(false);
                  setIsEditModalOpen(false);
                  resetForm();
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
                ) : editingItem ? (
                  'Зберегти зміни'
                ) : (
                  'Створити товар'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Видалити товар?</AlertDialogTitle>
            <AlertDialogDescription>
              Ви впевнені, що хочете видалити товар "{itemToDelete?.name}"? 
              Цю дію неможливо скасувати.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setItemToDelete(null)}>Скасувати</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
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

      {/* Bulk Delete Confirmation */}
      <AlertDialog open={isBulkDeleteDialogOpen} onOpenChange={setIsBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Видалити {selectedItems.length} товарів?</AlertDialogTitle>
            <AlertDialogDescription>
              Ви впевнені, що хочете видалити обрані товари? 
              Цю дію неможливо скасувати.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Скасувати</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmBulkDelete}
              className="bg-red-600 hover:bg-red-700"
              disabled={actionLoading}
            >
              {actionLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Видалення...
                </>
              ) : (
                'Видалити всі'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}