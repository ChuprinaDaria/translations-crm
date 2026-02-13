import React, { useState, useEffect, useMemo } from 'react';
import { Globe, Plus, Edit, Trash2, Loader2, FileText, StickyNote, Settings } from 'lucide-react';
import { SidePanel } from '../../../components/ui';
import { useI18n } from '../../../lib/i18n';
import { QuickActionsSidebar, type QuickAction } from '../../communications/components/QuickActionsSidebar';

// Конфігурація для панелі бічних табів
const getLanguagesSidePanelTabs = (t: (key: string) => string) => [
  { id: 'info', icon: FileText, label: t('tabs.info') },
  { id: 'notes', icon: StickyNote, label: t('tabs.notes') },
  { id: 'settings', icon: Settings, label: t('tabs.settings') },
];
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../components/ui/dialog';
import { toast } from 'sonner';
import { languagesApi, type Language, type LanguageCreate } from '../api/languages';

export function LanguagesPage() {
  const { t } = useI18n();
  const [languages, setLanguages] = useState<Language[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingLanguage, setEditingLanguage] = useState<Language | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  const LANGUAGES_SIDE_PANEL_TABS = getLanguagesSidePanelTabs(t);
  const [sidePanelTab, setSidePanelTab] = useState<string | null>(null);
  const [formData, setFormData] = useState<LanguageCreate>({
    name_pl: '',
    name_en: '',
    base_client_price: 0,
  });

  useEffect(() => {
    fetchLanguages();
  }, []);

  const fetchLanguages = async () => {
    setIsLoading(true);
    try {
      const data = await languagesApi.getLanguages(false); // Завантажуємо всі мови (включно з неактивними)
      console.log('Fetched languages:', data);
      setLanguages(data);
    } catch (error: any) {
      console.error('Error fetching languages:', error);
      toast.error(`Помилка завантаження: ${error?.message || 'Невідома помилка'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name_pl.trim()) {
      toast.error('Введіть назву мови (PL)');
      return;
    }
    
    if (!formData.base_client_price || formData.base_client_price <= 0) {
      toast.error('Введіть коректну базову ціну');
      return;
    }

    setIsSaving(true);
    try {
      if (editingLanguage) {
        await languagesApi.updateLanguage(editingLanguage.id, formData);
        toast.success('Мову оновлено');
      } else {
        const newLanguage = await languagesApi.createLanguage(formData);
        toast.success('Мову додано');
        console.log('Created language:', newLanguage);
      }
      setShowModal(false);
      setEditingLanguage(null);
      setFormData({ name_pl: '', name_en: '', base_client_price: 0 });
      // Невелика затримка перед оновленням списку, щоб дати час базі даних
      await new Promise(resolve => setTimeout(resolve, 100));
      await fetchLanguages();
    } catch (error: any) {
      console.error('Error saving language:', error);
      toast.error(`Помилка: ${error?.message || 'Невідома помилка'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (lang: Language) => {
    setEditingLanguage(lang);
    setFormData({
      name_pl: lang.name_pl,
      name_en: lang.name_en || '',
      base_client_price: lang.base_client_price,
    });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Видалити мову?')) {
      return;
    }
    
    try {
      await languagesApi.deleteLanguage(id);
      toast.success('Мову видалено');
      fetchLanguages();
    } catch (error: any) {
      toast.error(`Помилка видалення: ${error?.message || 'Невідома помилка'}`);
    }
  };

  const handleOpenCreate = () => {
    setEditingLanguage(null);
    setFormData({ name_pl: '', name_en: '', base_client_price: 0 });
    setShowModal(true);
  };
  
  // Quick Actions для LanguagesPage
  const quickActions = useMemo<QuickAction[]>(() => [
    {
      id: 'add-language',
      icon: Plus,
      tooltip: 'Додати мову',
      onClick: handleOpenCreate,
      disabled: false,
    },
    {
      id: 'info',
      icon: FileText,
      tooltip: t('tabs.info'),
      onClick: () => setSidePanelTab(sidePanelTab === 'info' ? null : 'info'),
      disabled: false,
      isActive: sidePanelTab === 'info',
    },
    {
      id: 'notes',
      icon: StickyNote,
      tooltip: t('tabs.notes'),
      onClick: () => setSidePanelTab(sidePanelTab === 'notes' ? null : 'notes'),
      disabled: false,
      isActive: sidePanelTab === 'notes',
    },
    {
      id: 'settings',
      icon: Settings,
      tooltip: t('tabs.settings'),
      onClick: () => setSidePanelTab(sidePanelTab === 'settings' ? null : 'settings'),
      disabled: false,
      isActive: sidePanelTab === 'settings',
    },
  ], [t, sidePanelTab, handleOpenCreate]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-8rem)]">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-gray-50">
      {/* Ліва частина: Основний контент */}
      <div className="flex-1 min-w-0 flex flex-col p-6 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Globe className="w-8 h-8 text-[#FF5A00]" />
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Мови та ціни</h1>
            <p className="text-sm text-gray-500">Управління мовами та базовими цінами для клієнтів</p>
          </div>
        </div>

      {/* Languages Grid */}
      {languages.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-gray-500">
              <Globe className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium">Немає мов</p>
              <p className="text-sm mt-1">Додайте першу мову</p>
              <Button onClick={handleOpenCreate} className="mt-4" variant="outline">
                <Plus className="w-4 h-4 mr-2" />
                Додати мову
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {languages.map((lang) => (
            <Card key={lang.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{lang.name_pl}</CardTitle>
                    {lang.name_en && (
                      <p className="text-sm text-gray-500 mt-1">{lang.name_en}</p>
                    )}
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-3">
                <div>
                  <div className="text-2xl font-bold text-blue-600">
                    {lang.base_client_price} zł
                  </div>
                  <p className="text-xs text-gray-500">Базова ціна для клієнта</p>
                </div>
                
                <div className="flex gap-2 pt-2 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(lang)}
                    className="flex-1"
                  >
                    <Edit className="w-4 h-4 mr-1" />
                    Редагувати
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDelete(lang.id)}
                    className="flex-1"
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Видалити
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      </div>

      {/* Create/Edit Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingLanguage ? 'Редагувати мову' : 'Нова мова'}
            </DialogTitle>
            <DialogDescription>
              {editingLanguage 
                ? 'Оновіть інформацію про мову' 
                : 'Додайте нову мову з базовою ціною для клієнтів'}
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name_pl">
                  Назва (PL) *
                </Label>
                <Input
                  id="name_pl"
                  type="text"
                  value={formData.name_pl}
                  onChange={(e) => setFormData({...formData, name_pl: e.target.value})}
                  placeholder="Наприклад: Angielski"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="name_en">
                  Назва (EN)
                </Label>
                <Input
                  id="name_en"
                  type="text"
                  value={formData.name_en}
                  onChange={(e) => setFormData({...formData, name_en: e.target.value})}
                  placeholder="Наприклад: English"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="base_client_price">
                  Базова ціна для клієнта (zł) *
                </Label>
                <Input
                  id="base_client_price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.base_client_price}
                  onChange={(e) => setFormData({...formData, base_client_price: parseFloat(e.target.value) || 0})}
                  placeholder="0.00"
                  required
                />
              </div>
            </div>
            
            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setShowModal(false)}
                disabled={isSaving}
              >
                Скасувати
              </Button>
              <Button 
                type="submit" 
                className="bg-orange-500 hover:bg-orange-600"
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
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

      {/* QuickActionsSidebar - full height, right side */}
      <div className="flex-shrink-0 h-full">
        <QuickActionsSidebar actions={quickActions} />
      </div>

      {/* SidePanel - Бокова панель з контентом */}
      <SidePanel
        open={sidePanelTab !== null}
        onClose={() => setSidePanelTab(null)}
        title={LANGUAGES_SIDE_PANEL_TABS.find(tab => tab.id === sidePanelTab)?.label}
        width="md"
      >
        {sidePanelTab === 'info' && (
          <div className="space-y-4">
            <h4 className="font-semibold text-gray-900">Інформація про мови</h4>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-gray-500">Всього мов:</span>
                <span className="ml-2 font-medium text-gray-900">{languages.length}</span>
              </div>
            </div>
          </div>
        )}
        
        {sidePanelTab === 'notes' && (
          <div className="space-y-4">
            <h4 className="font-semibold text-gray-900">Нотатки</h4>
            <p className="text-sm text-gray-500">Функціонал нотаток буде додано пізніше</p>
          </div>
        )}
        
        {sidePanelTab === 'settings' && (
          <div className="space-y-4">
            <h4 className="font-semibold text-gray-900">Налаштування</h4>
            <p className="text-sm text-gray-500">Налаштування мов</p>
          </div>
        )}
      </SidePanel>
    </div>
  );
}


