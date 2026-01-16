import React, { useState, useEffect } from "react";
import { FileText, Loader2, Eye, Edit, Search, Download, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Badge } from "./ui/badge";
import { questionnairesApi, tokenManager, type ClientQuestionnaire } from "../lib/api";
import { toast } from "sonner";
import { QuestionnaireForm } from "./QuestionnaireForm";

interface QuestionnaireWithExtras extends ClientQuestionnaire {
  manager_name?: string;
  manager_email?: string;
  client_name?: string;
  client_phone?: string;
  client_company?: string;
}

interface AllQuestionnairesProps {
  onEdit?: (questionnaireId: number) => void;
  onCreate?: () => void;
}

interface GroupedQuestionnaires {
  clientId: number;
  clientName: string;
  clientPhone?: string;
  clientCompany?: string;
  latestQuestionnaire: QuestionnaireWithExtras;
  allQuestionnaires: QuestionnaireWithExtras[];
}

export function AllQuestionnaires({ onEdit, onCreate }: AllQuestionnairesProps) {
  const [questionnaires, setQuestionnaires] = useState<QuestionnaireWithExtras[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredQuestionnaires, setFilteredQuestionnaires] = useState<QuestionnaireWithExtras[]>([]);
  const [groupedQuestionnaires, setGroupedQuestionnaires] = useState<GroupedQuestionnaires[]>([]);
  const [expandedClients, setExpandedClients] = useState<Set<number>>(new Set());
  const [showQuestionnaireForm, setShowQuestionnaireForm] = useState(false);
  const [editingQuestionnaireId, setEditingQuestionnaireId] = useState<number | undefined>(undefined);

  useEffect(() => {
    loadQuestionnaires();
  }, []);

  const loadQuestionnaires = async () => {
    try {
      setIsLoading(true);
      const data = await questionnairesApi.getAll();
      setQuestionnaires(data.questionnaires || []);
      setFilteredQuestionnaires(data.questionnaires || []);
    } catch (error: any) {
      console.error(error);
      toast.error("Помилка завантаження анкет");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (searchQuery) {
      const filtered = questionnaires.filter((q) => {
        const searchLower = searchQuery.toLowerCase();
        return (
          q.location?.toLowerCase().includes(searchLower) ||
          q.contact_person?.toLowerCase().includes(searchLower) ||
          q.contact_phone?.toLowerCase().includes(searchLower) ||
          q.client_company_name?.toLowerCase().includes(searchLower) ||
          q.manager_name?.toLowerCase().includes(searchLower) ||
          q.client_name?.toLowerCase().includes(searchLower)
        );
      });
      setFilteredQuestionnaires(filtered);
    } else {
      setFilteredQuestionnaires(questionnaires);
    }
  }, [searchQuery, questionnaires]);

  // Групуємо анкети по клієнтах
  useEffect(() => {
    if (filteredQuestionnaires.length === 0) {
      setGroupedQuestionnaires([]);
      return;
    }

    // Групуємо по client_id (якщо є) або по client_name + client_phone
    const grouped = new Map<number | string, QuestionnaireWithExtras[]>();
    
    filteredQuestionnaires.forEach((q) => {
      // Використовуємо client_id якщо є, інакше комбінацію client_name + client_phone
      const clientId = (q as any).client_id;
      const key = clientId || `${q.client_name || ''}_${q.client_phone || ''}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(q);
    });

    // Сортуємо анкети в кожній групі за датою створення (новіші спочатку)
    const groupedArray: GroupedQuestionnaires[] = [];
    grouped.forEach((questionnairesList, key) => {
      const sorted = [...questionnairesList].sort((a, b) => {
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return dateB - dateA;
      });

      const latest = sorted[0];
      const clientId = (latest as any).client_id || (typeof key === 'number' ? key : 0);
      groupedArray.push({
        clientId: clientId,
        clientName: latest.client_name || "Невідомий клієнт",
        clientPhone: latest.client_phone,
        clientCompany: latest.client_company,
        latestQuestionnaire: latest,
        allQuestionnaires: sorted,
      });
    });

    // Сортуємо групи за датою останньої анкети
    groupedArray.sort((a, b) => {
      const dateA = a.latestQuestionnaire.created_at ? new Date(a.latestQuestionnaire.created_at).getTime() : 0;
      const dateB = b.latestQuestionnaire.created_at ? new Date(b.latestQuestionnaire.created_at).getTime() : 0;
      return dateB - dateA;
    });

    setGroupedQuestionnaires(groupedArray);
  }, [filteredQuestionnaires]);

  const handleDelete = async (questionnaireId: number) => {
    if (!window.confirm("Видалити цю анкету? Цю дію не можна скасувати.")) {
      return;
    }

    try {
      await questionnairesApi.delete(questionnaireId);
      setQuestionnaires((prev) => prev.filter((q) => q.id !== questionnaireId));
      setFilteredQuestionnaires((prev) => prev.filter((q) => q.id !== questionnaireId));
      toast.success("Анкету видалено");
    } catch (error: any) {
      console.error(error);
      toast.error("Не вдалося видалити анкету");
    }
  };

  const handleDownloadPDF = async (questionnaireId: number) => {
    try {
      toast.info("Генерація PDF...");
      
      // Використовуємо API_BASE_URL з конфігурації
      const API_BASE = window.location.origin.includes('localhost') 
        ? 'http://localhost:8000/api' 
        : '/api';
      
      const token = tokenManager.getToken();
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch(`${API_BASE}/questionnaires/${questionnaireId}/pdf`, {
        headers,
      });
      
      if (!response.ok) {
        throw new Error("Помилка генерації PDF");
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `anketa-${questionnaireId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success("PDF завантажено!");
    } catch (error: any) {
      console.error(error);
      toast.error("Помилка завантаження PDF");
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "—";
    const date = new Date(dateString);
    return date.toLocaleDateString("uk-UA", { day: "2-digit", month: "2-digit", year: "numeric" });
  };

  const toggleClientExpanded = (clientId: number) => {
    setExpandedClients((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(clientId)) {
        newSet.delete(clientId);
      } else {
        newSet.add(clientId);
      }
      return newSet;
    });
  };

  const handleEditQuestionnaire = (questionnaireId: number) => {
    setEditingQuestionnaireId(questionnaireId);
    setShowQuestionnaireForm(true);
  };

  const handleBackFromForm = () => {
    setShowQuestionnaireForm(false);
    setEditingQuestionnaireId(undefined);
    loadQuestionnaires();
  };

  const renderQuestionnaireRow = (questionnaire: QuestionnaireWithExtras, isLatest: boolean = false) => (
    <TableRow key={questionnaire.id} className={`hover:bg-gray-50 ${!isLatest ? 'bg-gray-50/50' : ''}`}>
      <TableCell className="font-medium">#{questionnaire.id}</TableCell>
      <TableCell>
        {questionnaire.event_date ? (
          <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
            {questionnaire.event_date}
          </Badge>
        ) : (
          "—"
        )}
      </TableCell>
      <TableCell>
        <div className="max-w-[180px] truncate text-sm" title={questionnaire.location || ""}>
          {questionnaire.location || "—"}
        </div>
      </TableCell>
      <TableCell>
        <div>
          <div className="font-medium text-sm">{questionnaire.client_name || "—"}</div>
          <div className="text-xs text-gray-500">{questionnaire.client_company || questionnaire.client_phone || ""}</div>
        </div>
      </TableCell>
      <TableCell>
        <div className="text-sm">{questionnaire.manager_name || "—"}</div>
      </TableCell>
      <TableCell className="text-sm text-gray-600">
        {formatDate(questionnaire.created_at)}
      </TableCell>
      <TableCell>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDownloadPDF(questionnaire.id)}
            title="Скачати PDF"
          >
            <Download className="w-3 h-3" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleEditQuestionnaire(questionnaire.id)}
            title="Редагувати"
          >
            <Edit className="w-3 h-3" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDelete(questionnaire.id)}
            className="text-red-600 hover:bg-red-50"
            title="Видалити анкету"
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );

  // Якщо показуємо форму редагування
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
        <h1 className="text-2xl font-semibold text-gray-900">Анкети</h1>
        <div className="flex items-center gap-2">
          {onCreate && (
            <Button onClick={onCreate} size="sm">
              Створити нову анкету
            </Button>
          )}
          <Button onClick={loadQuestionnaires} variant="outline" size="sm">
            Оновити
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Список анкет клієнтів</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Пошук за локацією, контактом, компанією..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Дата заходу</TableHead>
                  <TableHead>Локація</TableHead>
                  <TableHead>Клієнт</TableHead>
                  <TableHead>Менеджер</TableHead>
                  <TableHead>Створено</TableHead>
                  <TableHead>Дії</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" />
                    </TableCell>
                  </TableRow>
                ) : groupedQuestionnaires.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                      {searchQuery ? "Анкет не знайдено" : "Ще немає жодної анкети"}
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {groupedQuestionnaires.map((group) => {
                      const isExpanded = expandedClients.has(group.clientId);
                      const hasMultipleQuestionnaires = group.allQuestionnaires.length > 1;
                      
                      return (
                        <React.Fragment key={group.clientId}>
                          {/* Остання анкета клієнта - завжди видима */}
                          {renderQuestionnaireRow(group.latestQuestionnaire, true)}
                          
                          {/* Попередні анкети - показуються в акордеоні */}
                          {hasMultipleQuestionnaires && (
                            <>
                              <TableRow className="bg-gray-50/30">
                                <TableCell colSpan={7} className="p-0 border-0 bg-transparent">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => toggleClientExpanded(group.clientId)}
                                    className="w-full justify-start text-xs text-gray-600 hover:text-gray-900 py-2 hover:bg-gray-100"
                                  >
                                    {isExpanded ? (
                                      <ChevronUp className="w-4 h-4 mr-2" />
                                    ) : (
                                      <ChevronDown className="w-4 h-4 mr-2" />
                                    )}
                                    {isExpanded 
                                      ? `Приховати попередні анкети (${group.allQuestionnaires.length - 1})`
                                      : `Показати попередні анкети (${group.allQuestionnaires.length - 1})`
                                    }
                                  </Button>
                                </TableCell>
                              </TableRow>
                              {isExpanded && group.allQuestionnaires.slice(1).map((questionnaire) => 
                                renderQuestionnaireRow(questionnaire, false)
                              )}
                            </>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </>
                )}
              </TableBody>
            </Table>
          </div>

          {!isLoading && filteredQuestionnaires.length > 0 && (
            <div className="mt-4 text-sm text-gray-600">
              Всього анкет: {filteredQuestionnaires.length}
              {searchQuery && ` (знайдено ${filteredQuestionnaires.length} з ${questionnaires.length})`}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

