import React, { useState, useEffect } from 'react';
import { Globe, Plus, Edit, Trash2, Loader2 } from 'lucide-react';
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
  const [languages, setLanguages] = useState<Language[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingLanguage, setEditingLanguage] = useState<Language | null>(null);
  const [isSaving, setIsSaving] = useState(false);
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
      const data = await languagesApi.getLanguages();
      setLanguages(data);
    } catch (error: any) {
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
        await languagesApi.createLanguage(formData);
        toast.success('Мову додано');
      }
      setShowModal(false);
      setEditingLanguage(null);
      setFormData({ name_pl: '', name_en: '', base_client_price: 0 });
      fetchLanguages();
    } catch (error: any) {
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-8rem)]">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Globe className="w-6 h-6 text-gray-600" />
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Мови та ціни</h1>
            <p className="text-sm text-gray-500">Управління мовами та базовими цінами для клієнтів</p>
          </div>
        </div>
        
        <Button onClick={handleOpenCreate} className="bg-orange-500 hover:bg-orange-600">
          <Plus className="w-4 h-4 mr-2" />
          Додати мову
        </Button>
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
    </div>
  );
}

