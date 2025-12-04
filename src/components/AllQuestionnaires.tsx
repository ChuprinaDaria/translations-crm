import { useState, useEffect } from "react";
import { FileText, Loader2, Eye, Edit, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Badge } from "./ui/badge";
import { questionnairesApi, type ClientQuestionnaire } from "../lib/api";
import { toast } from "sonner";

interface AllQuestionnairesProps {
  onEdit?: (questionnaireId: number) => void;
}

export function AllQuestionnaires({ onEdit }: AllQuestionnairesProps) {
  const [questionnaires, setQuestionnaires] = useState<ClientQuestionnaire[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredQuestionnaires, setFilteredQuestionnaires] = useState<ClientQuestionnaire[]>([]);

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
          q.client_company_name?.toLowerCase().includes(searchLower)
        );
      });
      setFilteredQuestionnaires(filtered);
    } else {
      setFilteredQuestionnaires(questionnaires);
    }
  }, [searchQuery, questionnaires]);

  const formatDate = (dateString?: string) => {
    if (!dateString) return "—";
    const date = new Date(dateString);
    return date.toLocaleDateString("uk-UA", { day: "2-digit", month: "2-digit", year: "numeric" });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Всі анкети</h1>
        <Button onClick={loadQuestionnaires} variant="outline" size="sm">
          Оновити
        </Button>
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
                  <TableHead>Контакт</TableHead>
                  <TableHead>Компанія</TableHead>
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
                ) : filteredQuestionnaires.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                      {searchQuery ? "Анкет не знайдено" : "Ще немає жодної анкети"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredQuestionnaires.map((questionnaire) => (
                    <TableRow key={questionnaire.id}>
                      <TableCell className="font-medium">#{questionnaire.id}</TableCell>
                      <TableCell>
                        {questionnaire.event_date ? (
                          <Badge variant="outline">{questionnaire.event_date}</Badge>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="max-w-[200px] truncate" title={questionnaire.location || ""}>
                          {questionnaire.location || "—"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium text-sm">{questionnaire.contact_person || "—"}</div>
                          <div className="text-xs text-gray-500">{questionnaire.contact_phone || ""}</div>
                        </div>
                      </TableCell>
                      <TableCell>{questionnaire.client_company_name || "—"}</TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {formatDate(questionnaire.created_at)}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {onEdit && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => onEdit(questionnaire.id)}
                            >
                              <Edit className="w-3 h-3 mr-1" />
                              Редагувати
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

