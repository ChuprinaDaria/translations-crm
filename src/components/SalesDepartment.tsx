import { useState, useEffect } from "react";
import { Search, UserPlus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import { clientsApi, questionnairesApi, type Client } from "../lib/api";
import { toast } from "sonner";
import { ClientDetailsDialog } from "./ClientDetailsDialog";
import { QuestionnaireForm } from "./QuestionnaireForm";

export function SalesDepartment() {
  const [clients, setClients] = useState<Client[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [selectedClientForDetails, setSelectedClientForDetails] = useState<Client | null>(null);
  
  // Стан для відображення форми анкети
  const [showQuestionnaireForm, setShowQuestionnaireForm] = useState(false);
  const [editingQuestionnaireId, setEditingQuestionnaireId] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (!showQuestionnaireForm) {
      loadClients();
    }
  }, [showQuestionnaireForm]);

  const loadClients = async () => {
    try {
      setIsLoading(true);
      const data = await clientsApi.getClients(0, 100, searchQuery);
      // Бекенд може повертати як { total, clients: [...] }, так і просто масив клієнтів.
      const list = Array.isArray(data) ? data : (data as any).clients || [];
      setClients(list);
    } catch (error: any) {
      toast.error("Помилка завантаження клієнтів");
      console.error(error);
      setClients([]); 
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (searchQuery !== undefined && !showQuestionnaireForm) {
      const timeoutId = setTimeout(() => {
        loadClients();
      }, 300);
      return () => clearTimeout(timeoutId);
    }
  }, [searchQuery, showQuestionnaireForm]);

  const handleClientSelect = async (client: Client) => {
    try {
      // Якщо у клієнта є questionnaire_id, використовуємо його напряму
      if (client.questionnaire_id) {
        setEditingQuestionnaireId(client.questionnaire_id);
        setShowQuestionnaireForm(true);
        return;
      }

      // Якщо немає questionnaire_id, перевіряємо через API
      const data = await clientsApi.getClient(client.id);
      if (data.questionnaire) {
        // Редагуємо існуючу анкету
        setEditingQuestionnaireId(data.questionnaire.id);
      } else {
        // Створюємо нову для існуючого клієнта
        setEditingQuestionnaireId(undefined);
      }
      setShowQuestionnaireForm(true);
    } catch (error: any) {
      toast.error("Помилка завантаження даних клієнта");
      console.error(error);
    }
  };

  const handleCreateNew = () => {
    setEditingQuestionnaireId(undefined);
    setShowQuestionnaireForm(true);
  };

  const handleBackFromForm = () => {
    setShowQuestionnaireForm(false);
    setEditingQuestionnaireId(undefined);
    // Очищаємо пошук щоб показати всіх клієнтів включно з новоствореним
    setSearchQuery("");
    // Затримка щоб форма закрилась і потім оновився список
    setTimeout(() => {
      loadClients();
    }, 100);
  };

  const handleDeleteQuestionnaire = async (client: Client) => {
    if (!client.questionnaire_id) {
      toast.error("У цього клієнта немає анкети");
      return;
    }

    if (!window.confirm(`Видалити анкету клієнта ${client.name}? Цю дію не можна скасувати.`)) {
      return;
    }

    try {
      await questionnairesApi.delete(client.questionnaire_id);
      toast.success("Анкету видалено");
      // Оновлюємо список клієнтів
      loadClients();
    } catch (error: any) {
      console.error("Error deleting questionnaire:", error);
      toast.error("Не вдалося видалити анкету");
    }
  };

  // Якщо показуємо форму анкети
  if (showQuestionnaireForm) {
    return (
      <QuestionnaireForm
        questionnaireId={editingQuestionnaireId}
        onBack={handleBackFromForm}
        onSave={handleBackFromForm}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Відділ Продажів</h1>
      </div>

      {/* Пошук клієнтів */}
      <Card>
        <CardHeader>
          <CardTitle>Анкета клієнта</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Пошук клієнта за ім'ям, телефоном, email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button onClick={handleCreateNew} className="flex items-center gap-2">
              <UserPlus className="w-4 h-4" />
              Створити нову анкету
            </Button>
          </div>

          {/* Список клієнтів */}
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ім'я</TableHead>
                  <TableHead>Компанія</TableHead>
                  <TableHead>Телефон</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Дії</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      Завантаження...
                    </TableCell>
                  </TableRow>
                ) : !clients || clients.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                      Клієнти не знайдено
                    </TableCell>
                  </TableRow>
                ) : (
                  clients.map((client) => (
                    <TableRow key={client.id}>
                      <TableCell className="font-medium">{client.name}</TableCell>
                      <TableCell>{client.company_name || "—"}</TableCell>
                      <TableCell>{client.phone}</TableCell>
                      <TableCell>{client.email || "—"}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedClientForDetails(client);
                              setIsDetailsDialogOpen(true);
                            }}
                          >
                            Деталі
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleClientSelect(client)}
                          >
                            Анкета
                          </Button>
                          {client.questionnaire_id && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteQuestionnaire(client)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              title="Видалити анкету"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Діалог з деталями клієнта */}
      {selectedClientForDetails && (
        <ClientDetailsDialog
          client={selectedClientForDetails}
          isOpen={isDetailsDialogOpen}
          onClose={() => {
            setIsDetailsDialogOpen(false);
            setSelectedClientForDetails(null);
          }}
          onEdit={() => {
            setIsDetailsDialogOpen(false);
            handleClientSelect(selectedClientForDetails);
          }}
        />
      )}
    </div>
  );
}
