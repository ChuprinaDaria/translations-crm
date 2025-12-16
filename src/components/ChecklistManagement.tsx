import { useState, useEffect } from "react";
import { 
  Package, 
  ChefHat, 
  Plus, 
  Search, 
  Calendar, 
  Users, 
  MapPin,
  Clock,
  Trash2,
  Edit,
  FileText,
  ArrowRight,
  Filter
} from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
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
import { toast } from "sonner";
import { checklistsApi, Checklist, ChecklistListResponse } from "../lib/api";
import { ChecklistWizardBox } from "./checklists/ChecklistWizardBox";
import { ChecklistWizardCatering } from "./checklists/ChecklistWizardCatering";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: "Чернетка", color: "bg-gray-100 text-gray-700" },
  in_progress: { label: "В роботі", color: "bg-blue-100 text-blue-700" },
  completed: { label: "Завершено", color: "bg-green-100 text-green-700" },
  sent_to_kp: { label: "Відправлено в КП", color: "bg-purple-100 text-purple-700" },
};

const EVENT_REASONS = [
  "Корпоратив",
  "День народження",
  "Весілля",
  "Ювілей",
  "Конференція",
  "Презентація",
  "Нетворкінг",
  "Тренінг",
  "Інше",
];

export function ChecklistManagement() {
  const [activeTab, setActiveTab] = useState<"box" | "catering">("box");
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [filteredChecklists, setFilteredChecklists] = useState<Checklist[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [stats, setStats] = useState({ total: 0, box_count: 0, catering_count: 0 });
  
  // Модальні вікна
  const [showWizard, setShowWizard] = useState(false);
  const [wizardType, setWizardType] = useState<"box" | "catering">("box");
  const [editingChecklist, setEditingChecklist] = useState<Checklist | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [checklistToDelete, setChecklistToDelete] = useState<number | null>(null);

  useEffect(() => {
    loadChecklists();
  }, []);

  useEffect(() => {
    filterChecklists();
  }, [checklists, activeTab, searchQuery, statusFilter]);

  const loadChecklists = async () => {
    try {
      setLoading(true);
      const response: ChecklistListResponse = await checklistsApi.getAll(0, 100);
      setChecklists(response.checklists);
      setStats({
        total: response.total,
        box_count: response.box_count,
        catering_count: response.catering_count,
      });
    } catch (error) {
      console.error("Error loading checklists:", error);
      toast.error("Помилка завантаження чеклістів");
    } finally {
      setLoading(false);
    }
  };

  const filterChecklists = () => {
    let filtered = checklists.filter(c => c.checklist_type === activeTab);
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(c => 
        c.contact_name?.toLowerCase().includes(query) ||
        c.contact_phone?.includes(query) ||
        c.event_format?.toLowerCase().includes(query) ||
        c.location_address?.toLowerCase().includes(query)
      );
    }
    
    if (statusFilter !== "all") {
      filtered = filtered.filter(c => c.status === statusFilter);
    }
    
    setFilteredChecklists(filtered);
  };

  const handleCreateNew = (type: "box" | "catering") => {
    setWizardType(type);
    setEditingChecklist(null);
    setShowWizard(true);
  };

  const handleEdit = (checklist: Checklist) => {
    setWizardType(checklist.checklist_type);
    setEditingChecklist(checklist);
    setShowWizard(true);
  };

  const handleDelete = async () => {
    if (!checklistToDelete) return;
    
    try {
      await checklistsApi.delete(checklistToDelete);
      toast.success("Чекліст видалено");
      loadChecklists();
    } catch (error) {
      console.error("Error deleting checklist:", error);
      toast.error("Помилка видалення чекліста");
    } finally {
      setDeleteDialogOpen(false);
      setChecklistToDelete(null);
    }
  };

  const handleCreateKP = async (checklistId: number) => {
    try {
      const result = await checklistsApi.createKP(checklistId);
      toast.success(`КП #${result.kp_id} створено успішно!`);
      loadChecklists();
    } catch (error) {
      console.error("Error creating KP:", error);
      toast.error("Помилка створення КП");
    }
  };

  const handleWizardSave = async () => {
    setShowWizard(false);
    loadChecklists();
    toast.success(editingChecklist ? "Чекліст оновлено" : "Чекліст створено");
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "—";
    try {
      return new Date(dateString).toLocaleDateString("uk-UA", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  // Якщо показуємо wizard - відображаємо його на весь екран (як анкету)
  if (showWizard) {
    return wizardType === "box" ? (
      <ChecklistWizardBox
        checklist={editingChecklist}
        onSave={handleWizardSave}
        onCancel={() => setShowWizard(false)}
      />
    ) : (
      <ChecklistWizardCatering
        checklist={editingChecklist}
        onSave={handleWizardSave}
        onCancel={() => setShowWizard(false)}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-gradient-to-r from-gray-50 to-gray-100 p-6 rounded-xl border-2 border-gray-200">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Чекліст</h1>
          <p className="text-gray-600 mt-2 text-base">
            Збір інформації для формування комерційних пропозицій
          </p>
        </div>
        
        <div className="flex gap-3">
          <Button
            onClick={() => handleCreateNew("box")}
            size="lg"
            className="!bg-gradient-to-r !from-amber-500 !to-amber-600 hover:!from-amber-600 hover:!to-amber-700 !text-white shadow-lg hover:shadow-xl transition-all px-6"
          >
            <Package className="w-5 h-5 mr-2" />
            Новий бокс
          </Button>
          <Button
            onClick={() => handleCreateNew("catering")}
            size="lg"
            className="!bg-gradient-to-r !from-[#FF5A00] !to-orange-600 hover:!from-[#FF5A00]/90 hover:!to-orange-700 !text-white shadow-lg hover:shadow-xl transition-all px-6"
          >
            <ChefHat className="w-5 h-5 mr-2" />
            Новий кейтеринг
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="hover:shadow-lg transition-all cursor-pointer border border-gray-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium mb-1">Бокси</p>
                <p className="text-3xl font-bold text-gray-900">{stats.box_count}</p>
              </div>
              <div className="w-14 h-14 rounded-xl bg-orange-100 flex items-center justify-center">
                <Package className="w-7 h-7 text-[#FF5A00]" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="hover:shadow-lg transition-all cursor-pointer border border-gray-200 bg-orange-50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium mb-1">Кейтеринг</p>
                <p className="text-3xl font-bold text-gray-900">{stats.catering_count}</p>
              </div>
              <div className="w-14 h-14 rounded-xl bg-orange-100 flex items-center justify-center">
                <ChefHat className="w-7 h-7 text-[#FF5A00]" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="hover:shadow-lg transition-all cursor-pointer border border-gray-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium mb-1">Всього</p>
                <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
              </div>
              <div className="w-14 h-14 rounded-xl bg-orange-100 flex items-center justify-center">
                <FileText className="w-7 h-7 text-[#FF5A00]" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "box" | "catering")}>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
          <TabsList className="bg-gray-100">
            <TabsTrigger 
              value="box" 
              className="data-[state=active]:bg-amber-500 data-[state=active]:text-white"
            >
              <Package className="w-4 h-4 mr-2" />
              Бокси
            </TabsTrigger>
            <TabsTrigger 
              value="catering"
              className="data-[state=active]:bg-[#FF5A00] data-[state=active]:text-white"
            >
              <ChefHat className="w-4 h-4 mr-2" />
              Кейтеринг
            </TabsTrigger>
          </TabsList>
          
          {/* Filters */}
          <div className="flex gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Пошук..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 w-64"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2"
                >
                  <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
                </button>
              )}
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Статус" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Всі статуси</SelectItem>
                <SelectItem value="draft">Чернетка</SelectItem>
                <SelectItem value="in_progress">В роботі</SelectItem>
                <SelectItem value="completed">Завершено</SelectItem>
                <SelectItem value="sent_to_kp">В КП</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <TabsContent value="box" className="mt-0">
          <ChecklistList 
            checklists={filteredChecklists}
            loading={loading}
            onEdit={handleEdit}
            onDelete={(id) => {
              setChecklistToDelete(id);
              setDeleteDialogOpen(true);
            }}
            onCreateKP={handleCreateKP}
            formatDate={formatDate}
            type="box"
          />
        </TabsContent>
        
        <TabsContent value="catering" className="mt-0">
          <ChecklistList 
            checklists={filteredChecklists}
            loading={loading}
            onEdit={handleEdit}
            onDelete={(id) => {
              setChecklistToDelete(id);
              setDeleteDialogOpen(true);
            }}
            onCreateKP={handleCreateKP}
            formatDate={formatDate}
            type="catering"
          />
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Видалити чекліст?</AlertDialogTitle>
            <AlertDialogDescription>
              Ця дія незворотня. Чекліст буде видалено назавжди.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Скасувати</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-500 hover:bg-red-600"
            >
              Видалити
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Компонент списку чеклістів
interface ChecklistListProps {
  checklists: Checklist[];
  loading: boolean;
  onEdit: (checklist: Checklist) => void;
  onDelete: (id: number) => void;
  onCreateKP: (id: number) => void;
  formatDate: (date?: string) => string;
  type: "box" | "catering";
}

function ChecklistList({ 
  checklists, 
  loading, 
  onEdit, 
  onDelete, 
  onCreateKP,
  formatDate,
  type 
}: ChecklistListProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-3"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-2/3"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (checklists.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-12 text-center">
          <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${
            type === "box" ? "bg-amber-100" : "bg-orange-100"
          }`}>
            {type === "box" ? (
              <Package className={`w-8 h-8 ${type === "box" ? "text-amber-600" : "text-orange-600"}`} />
            ) : (
              <ChefHat className={`w-8 h-8 ${type === "box" ? "text-amber-600" : "text-orange-600"}`} />
            )}
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {type === "box" ? "Чеклістів на бокси поки немає" : "Чеклістів на кейтеринг поки немає"}
          </h3>
          <p className="text-gray-500 mb-4">
            Створіть перший чекліст для збору інформації
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {checklists.map((checklist) => (
        <Card 
          key={checklist.id} 
          className={`hover:shadow-lg transition-shadow cursor-pointer border-l-4 ${
            type === "box" ? "border-l-amber-500" : "border-l-[#FF5A00]"
          }`}
          onClick={() => onEdit(checklist)}
        >
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 truncate">
                  {checklist.contact_name || "Без імені"}
                </h3>
                <p className="text-sm text-gray-500">
                  {checklist.event_format || (type === "box" ? "Доставка боксів" : "Кейтеринг")}
                </p>
              </div>
              <Badge className={STATUS_LABELS[checklist.status || "draft"]?.color || "bg-gray-100"}>
                {STATUS_LABELS[checklist.status || "draft"]?.label || "Чернетка"}
              </Badge>
            </div>
            
            <div className="space-y-2 text-sm">
              {checklist.event_date && (
                <div className="flex items-center gap-2 text-gray-600">
                  <Calendar className="w-4 h-4" />
                  <span>{formatDate(checklist.event_date)}</span>
                </div>
              )}
              
              {checklist.guest_count && (
                <div className="flex items-center gap-2 text-gray-600">
                  <Users className="w-4 h-4" />
                  <span>{checklist.guest_count} гостей</span>
                </div>
              )}
              
              {checklist.location_address && (
                <div className="flex items-center gap-2 text-gray-600">
                  <MapPin className="w-4 h-4" />
                  <span className="truncate">{checklist.location_address}</span>
                </div>
              )}
              
              {checklist.delivery_time && (
                <div className="flex items-center gap-2 text-gray-600">
                  <Clock className="w-4 h-4" />
                  <span>{checklist.delivery_time}</span>
                </div>
              )}
            </div>
            
            <div className="flex gap-2 mt-4 pt-3 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(checklist);
                }}
                className="flex-1 border-2 border-orange-500 text-orange-500 hover:bg-orange-50 min-h-[44px]"
              >
                <Edit className="w-4 h-4 mr-1" />
                Редагувати
              </Button>
              
              {checklist.status !== "sent_to_kp" && (
                <Button
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCreateKP(checklist.id);
                  }}
                  className="bg-orange-500 text-white hover:bg-orange-600 min-h-[44px]"
                >
                  <ArrowRight className="w-4 h-4 mr-1" />
                  КП
                </Button>
              )}
              
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(checklist.id);
                }}
                className="text-gray-400 hover:text-red-500 hover:bg-red-50 min-h-[44px]"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

