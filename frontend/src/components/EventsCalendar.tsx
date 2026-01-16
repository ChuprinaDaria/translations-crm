import React, { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, MapPin, Users, X } from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
      const [clientsData, kps] = await Promise.all([
        clientsApi.getClients(),
        kpApi.getKPs(),
      ]);

      const eventsList: Event[] = [];
      const clients = clientsData.clients || [];

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
    
    // getDay() повертає 0 (неділя) до 6 (субота)
    // Конвертуємо до понеділок = 0, вівторок = 1, ..., неділя = 6
    let startingDayOfWeek = firstDay.getDay() - 1;
    if (startingDayOfWeek < 0) startingDayOfWeek = 6; // Неділя стає 6

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

  const weekDays = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"];

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
      <style>{`
        .calendar {
          width: 100%;
        }
        
        .calendar-weekdays {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          border-bottom: 2px solid #e5e7eb;
          margin-bottom: 0;
        }
        
        .calendar-grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 1px;
          background: #e5e7eb;
          border: 1px solid #e5e7eb;
        }
        
        .calendar-cell {
          min-height: 100px;
          background: white;
          padding: 8px;
          position: relative;
          display: flex;
          flex-direction: column;
          transition: background-color 0.2s;
        }
        
        @media (min-width: 768px) {
          .calendar-cell {
            min-height: 120px;
            padding: 12px;
          }
        }
        
        .calendar-cell-empty {
          background: #f9fafb;
        }
        
        .calendar-cell-default {
          cursor: pointer;
        }
        
        .calendar-cell-default:hover {
          background: #f9fafb;
        }
        
        .calendar-cell-today {
          background: #fff7ed;
          border: 2px solid #ff5a00;
          border-radius: 4px;
        }
        
        .day-number {
          position: absolute;
          top: 8px;
          right: 8px;
          font-weight: 600;
          font-size: 14px;
          color: #374151;
        }
        
        @media (min-width: 768px) {
          .day-number {
            top: 12px;
            right: 12px;
            font-size: 16px;
          }
        }
        
        .day-number-today {
          color: #ff5a00;
          font-weight: 700;
        }
        
        .events {
          margin-top: 24px;
          display: flex;
          flex-direction: column;
          gap: 4px;
          flex: 1;
          overflow: hidden;
        }
        
        @media (min-width: 768px) {
          .events {
            margin-top: 28px;
            gap: 6px;
          }
        }
        
        .event-badge {
          display: block;
          font-size: 11px;
          padding: 3px 8px;
          color: white;
          border-radius: 4px;
          cursor: pointer;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          transition: opacity 0.2s;
          line-height: 1.4;
        }
        
        @media (min-width: 768px) {
          .event-badge {
            font-size: 12px;
            padding: 4px 10px;
          }
        }
        
        .event-badge:hover {
          opacity: 0.8;
        }
        
        .event-badge-more {
          background: #e5e7eb !important;
          color: #6b7280 !important;
          font-weight: 500;
        }
      `}</style>
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
            <div className="calendar">
              {/* Заголовки днів тижня */}
              <div className="calendar-weekdays">
                {weekDays.map((day) => (
                  <div
                    key={day}
                    className="text-center text-xs md:text-sm font-semibold text-gray-700 py-2"
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* Grid календаря */}
              <div className="calendar-grid">
                {days.map((date, index) => {
                  const dayEvents = getEventsForDay(date);
                  const isCurrentDay = isToday(date);

                  return (
                    <div
                      key={index}
                      className={`calendar-cell ${
                        date
                          ? isCurrentDay
                            ? "calendar-cell-today"
                            : "calendar-cell-default"
                          : "calendar-cell-empty"
                      }`}
                    >
                      {date && (
                        <>
                          <span
                            className={`day-number ${
                              isCurrentDay ? "day-number-today" : ""
                            }`}
                          >
                            {date.getDate()}
                          </span>
                          <div className="events">
                            {dayEvents.slice(0, 3).map((event) => (
                              <span
                                key={`${event.type}-${event.id}`}
                                onClick={() => {
                                  setSelectedEvent(event);
                                  setIsEventDialogOpen(true);
                                }}
                                className="event-badge"
                                style={{
                                  backgroundColor: event.type === "kp" ? "#fb923c" : "#22c55e",
                                }}
                                title={event.title}
                              >
                                {event.title}
                              </span>
                            ))}
                            {dayEvents.length > 3 && (
                              <span className="event-badge event-badge-more">
                                +{dayEvents.length - 3}
                              </span>
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
            <DialogDescription>
              Перегляд детальної інформації про подію
            </DialogDescription>
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

