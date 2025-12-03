import React, { useState, useEffect } from "react";
import { Plus, Edit2, Trash2, Percent, Gift, Loader2 } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Switch } from "./ui/switch";
import { toast } from "sonner";
import { benefitsApi, type Benefit, type BenefitCreate, type BenefitUpdate } from "../lib/api";

export function BenefitsManagement() {
  const [benefits, setBenefits] = useState<Benefit[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingBenefit, setEditingBenefit] = useState<Benefit | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formData, setFormData] = useState<BenefitCreate>({
    name: "",
    type: "discount",
    value: 0,
    description: "",
    is_active: true,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadBenefits();
  }, []);

  const loadBenefits = async () => {
    setLoading(true);
    try {
      const data = await benefitsApi.getBenefits(undefined, false);
      setBenefits(data);
    } catch (error: any) {
      toast.error("Помилка завантаження бенфітів");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingBenefit(null);
    setFormData({
      name: "",
      type: "discount",
      value: 0,
      description: "",
      is_active: true,
    });
    setIsFormOpen(true);
  };

  const handleEdit = (benefit: Benefit) => {
    setEditingBenefit(benefit);
    setFormData({
      name: benefit.name,
      type: benefit.type,
      value: benefit.value,
      description: benefit.description || "",
      is_active: benefit.is_active,
    });
    setIsFormOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name || formData.value <= 0) {
      toast.error("Заповніть назву та значення");
      return;
    }

    setSaving(true);
    try {
      if (editingBenefit) {
        await benefitsApi.updateBenefit(editingBenefit.id, formData);
        toast.success("Бенфіт оновлено");
      } else {
        await benefitsApi.createBenefit(formData);
        toast.success("Бенфіт створено");
      }
      setIsFormOpen(false);
      loadBenefits();
    } catch (error: any) {
      toast.error("Помилка збереження бенфіту");
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Ви впевнені, що хочете видалити цей бенфіт?")) {
      return;
    }

    try {
      await benefitsApi.deleteBenefit(id);
      toast.success("Бенфіт видалено");
      loadBenefits();
    } catch (error: any) {
      toast.error("Помилка видалення бенфіту");
      console.error(error);
    }
  };

  const discounts = benefits.filter((b) => b.type === "discount");
  const cashbacks = benefits.filter((b) => b.type === "cashback");

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl text-gray-900 mb-2">Бенфіти</h1>
          <p className="text-sm md:text-base text-gray-600">
            Управління рівнями знижок та кешбеку
          </p>
        </div>
        <Button onClick={handleCreate} className="bg-[#FF5A00] hover:bg-[#FF5A00]/90">
          <Plus className="mr-2 h-4 w-4" />
          Додати бенфіт
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-[#FF5A00]" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Знижки */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Percent className="w-5 h-5 text-[#FF5A00]" />
                Знижки
              </CardTitle>
            </CardHeader>
            <CardContent>
              {discounts.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">
                  Немає знижок
                </p>
              ) : (
                <div className="space-y-2">
                  {discounts.map((benefit) => (
                    <div
                      key={benefit.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div>
                        <div className="font-medium">{benefit.name}</div>
                        <div className="text-sm text-gray-500">
                          {benefit.value}%
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={benefit.is_active ? "default" : "secondary"}>
                          {benefit.is_active ? "Активна" : "Неактивна"}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(benefit)}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(benefit.id)}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Кешбек */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gift className="w-5 h-5 text-[#FF5A00]" />
                Кешбек
              </CardTitle>
            </CardHeader>
            <CardContent>
              {cashbacks.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">
                  Немає кешбеку
                </p>
              ) : (
                <div className="space-y-2">
                  {cashbacks.map((benefit) => (
                    <div
                      key={benefit.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div>
                        <div className="font-medium">{benefit.name}</div>
                        <div className="text-sm text-gray-500">
                          {benefit.value}%
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={benefit.is_active ? "default" : "secondary"}>
                          {benefit.is_active ? "Активний" : "Неактивний"}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(benefit)}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(benefit.id)}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Діалог створення/редагування */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingBenefit ? "Редагувати бенфіт" : "Новий бенфіт"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="type">Тип</Label>
              <Select
                value={formData.type}
                onValueChange={(value) =>
                  setFormData({ ...formData, type: value as "discount" | "cashback" })
                }
              >
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="discount">Знижка</SelectItem>
                  <SelectItem value="cashback">Кешбек</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">
                Назва <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="Наприклад: Знижка 5%"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="value">
                Значення (%) <span className="text-red-500">*</span>
              </Label>
              <Input
                id="value"
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={formData.value}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    value: parseFloat(e.target.value) || 0,
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Опис</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Опис бенфіту (необов'язково)"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, is_active: checked })
                }
              />
              <Label htmlFor="is_active" className="cursor-pointer">
                Активний
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFormOpen(false)}>
              Скасувати
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-[#FF5A00] hover:bg-[#FF5A00]/90"
            >
              {saving ? "Збереження..." : "Зберегти"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

