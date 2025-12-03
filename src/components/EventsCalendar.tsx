import React, { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, MapPin, Users, X } from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { clientsApi, kpApi, type Client, type KP } from "../lib/api";
import { toast } from "sonner";

interface Event {
  id: number;
  type: "client" | "kp";
  title: string;
  date: Date;
  time?: string;
  location?: string;
  guests?: number;
  clientName?: string;
  format?: string;
  status?: string;
  data: Client | KP;
}

export function EventsCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [isEventDialogOpen, setIsEventDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    setLoading(true);
    try {
      const [clients, kps] = await Promise.all([
        clientsApi.getClients(),
        kpApi.getKPs(),
      ]);

      const eventsList: Event[] = [];

      // Додаємо події з клієнтів
      clients.forEach((client) => {
        if (client.event_date) {
          eventsList.push({
            id: client.id,
            type: "client",
            title: client.name,
            date: new Date(client.event_date),
            time: client.event_time || undefined,
            location: client.event_location || undefined,
            guests: undefined,
            clientName: client.name,
            format: client.event_format || undefined,
            status: client.status || undefined,
            data: client,
          });
        }
      });

      // Додаємо події з КП
      kps.forEach((kp) => {
        if (kp.event_date) {
          eventsList.push({
            id: kp.id,
            type: "kp",
            title: kp.client_name || kp.title,
            date: new Date(kp.event_date),
            time: kp.event_time || undefined,
            location: kp.event_location || undefined,
            guests: kp.people_count || undefined,
            clientName: kp.client_name || undefined,
            format: kp.event_format || undefined,
            status: kp.status || undefined,
            data: kp,
          });
        }
      });

      setEvents(eventsList);
    } catch (error: any) {
      toast.error("Помилка завантаження подій");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days: (Date | null)[] = [];

    // Додаємо порожні клітинки для днів перед початком місяця
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }

    // Додаємо дні місяця
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }

    return days;
  };

  const getEventsForDay = (date: Date | null): Event[] => {
    if (!date) return [];
    return events.filter((event) => {
      const eventDate = new Date(event.date);
      return (
        eventDate.getDate() === date.getDate() &&
        eventDate.getMonth() === date.getMonth() &&
        eventDate.getFullYear() === date.getFullYear()
      );
    });
  };

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const monthNames = [
    "Січень",
    "Лютий",
    "Березень",
    "Квітень",
    "Травень",
    "Червень",
    "Липень",
    "Серпень",
    "Вересень",
    "Жовтень",
    "Листопад",
    "Грудень",
  ];

  const weekDays = ["Нд", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

  const days = getDaysInMonth(currentDate);
  const today = new Date();

  const isToday = (date: Date | null) => {
    if (!date) return false;
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="w-5 h-5" />
              Календар подій
            </CardTitle>
            <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={goToToday}
                className="text-xs md:text-sm"
              >
                Сьогодні
              </Button>
              <div className="flex items-center gap-1 md:gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={goToPreviousMonth}
                  className="h-8 w-8 md:h-10 md:w-10"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm md:text-lg font-semibold min-w-[140px] md:min-w-[200px] text-center">
                  {monthNames[month]} {year}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={goToNextMonth}
                  className="h-8 w-8 md:h-10 md:w-10"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-12 text-center text-gray-500">
              Завантаження подій...
            </div>
          ) : (
            <div className="space-y-2">
              {/* Заголовки днів тижня */}
              <div className="grid grid-cols-7 gap-1 md:gap-2 mb-2">
                {weekDays.map((day) => (
                  <div
                    key={day}
                    className="p-1.5 md:p-2 text-center text-xs md:text-sm font-semibold text-gray-700 bg-gray-50 rounded-md"
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* Дні місяця */}
              <div className="grid grid-cols-7 gap-1 md:gap-2">
                {days.map((date, index) => {
                  const dayEvents = getEventsForDay(date);
                  const isCurrentDay = isToday(date);

                  return (
                    <div
                      key={index}
                      className={`min-h-[80px] md:min-h-[120px] border rounded-lg p-1 md:p-2 transition-colors ${
                        date
                          ? isCurrentDay
                            ? "bg-[#FF5A00]/10 border-2 border-[#FF5A00]"
                            : "bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm"
                          : "bg-gray-50/50 border-transparent"
                      }`}
                    >
                      {date && (
                        <>
                          <div
                            className={`text-xs md:text-sm font-semibold mb-1 md:mb-2 ${
                              isCurrentDay
                                ? "text-[#FF5A00]"
                                : "text-gray-900"
                            }`}
                          >
                            {date.getDate()}
                          </div>
                          <div className="space-y-1 md:space-y-1.5">
                            {dayEvents.slice(0, 2).map((event) => (
                              <div
                                key={`${event.type}-${event.id}`}
                                onClick={() => {
                                  setSelectedEvent(event);
                                  setIsEventDialogOpen(true);
                                }}
                                className="text-[10px] md:text-xs px-1.5 md:px-2 py-0.5 md:py-1 rounded-md bg-[#FF5A00] text-white cursor-pointer hover:bg-[#FF5A00]/90 transition-colors truncate"
                                title={event.title}
                              >
                                {event.title}
                              </div>
                            ))}
                            {dayEvents.length > 2 && (
                              <div className="text-[10px] md:text-xs text-gray-500 px-1.5 md:px-2 py-0.5 md:py-1 bg-gray-100 rounded-md">
                                +{dayEvents.length - 2} ще
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Діалог з деталями події */}
      <Dialog open={isEventDialogOpen} onOpenChange={setIsEventDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Деталі події</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsEventDialogOpen(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </DialogTitle>
          </DialogHeader>
          {selectedEvent && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {selectedEvent.title}
                </h3>
                {selectedEvent.status && (
                  <Badge
                    variant={
                      selectedEvent.status === "completed"
                        ? "default"
                        : selectedEvent.status === "approved"
                        ? "default"
                        : "outline"
                    }
                    className="mb-2"
                  >
                    {selectedEvent.status}
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-start gap-2">
                  <CalendarIcon className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <div className="text-sm text-gray-600">Дата</div>
                    <div className="text-sm font-medium text-gray-900">
                      {selectedEvent.date.toLocaleDateString("uk-UA", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </div>
                  </div>
                </div>

                {selectedEvent.time && (
                  <div className="flex items-start gap-2">
                    <Clock className="w-5 h-5 text-gray-400 mt-0.5" />
                    <div>
                      <div className="text-sm text-gray-600">Час</div>
                      <div className="text-sm font-medium text-gray-900">
                        {selectedEvent.time}
                      </div>
                    </div>
                  </div>
                )}

                {selectedEvent.location && (
                  <div className="flex items-start gap-2">
                    <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                    <div>
                      <div className="text-sm text-gray-600">Місце</div>
                      <div className="text-sm font-medium text-gray-900">
                        {selectedEvent.location}
                      </div>
                    </div>
                  </div>
                )}

                {selectedEvent.guests && (
                  <div className="flex items-start gap-2">
                    <Users className="w-5 h-5 text-gray-400 mt-0.5" />
                    <div>
                      <div className="text-sm text-gray-600">Гостей</div>
                      <div className="text-sm font-medium text-gray-900">
                        {selectedEvent.guests} осіб
                      </div>
                    </div>
                  </div>
                )}

                {selectedEvent.format && (
                  <div>
                    <div className="text-sm text-gray-600">Формат</div>
                    <div className="text-sm font-medium text-gray-900">
                      {selectedEvent.format}
                    </div>
                  </div>
                )}
              </div>

              {selectedEvent.type === "kp" && (
                <div className="pt-4 border-t">
                  <div className="text-sm text-gray-600 mb-2">Додаткова інформація</div>
                  <div className="space-y-1 text-sm">
                    {(selectedEvent.data as KP).total_price && (
                      <div>
                        Сума КП:{" "}
                        <span className="font-medium">
                          {(selectedEvent.data as KP).total_price} грн
                        </span>
                      </div>
                    )}
                    {(selectedEvent.data as KP).coordinator_name && (
                      <div>
                        Координатор:{" "}
                        <span className="font-medium">
                          {(selectedEvent.data as KP).coordinator_name}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {selectedEvent.type === "client" && (
                <div className="pt-4 border-t">
                  <div className="text-sm text-gray-600 mb-2">Додаткова інформація</div>
                  <div className="space-y-1 text-sm">
                    {(selectedEvent.data as Client).kp_total_amount && (
                      <div>
                        Сума КП:{" "}
                        <span className="font-medium">
                          {(selectedEvent.data as Client).kp_total_amount} грн
                        </span>
                      </div>
                    )}
                    {(selectedEvent.data as Client).phone && (
                      <div>
                        Телефон:{" "}
                        <span className="font-medium">
                          {(selectedEvent.data as Client).phone}
                        </span>
                      </div>
                    )}
                    {(selectedEvent.data as Client).email && (
                      <div>
                        Email:{" "}
                        <span className="font-medium">
                          {(selectedEvent.data as Client).email}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

