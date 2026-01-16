import { Card, CardContent } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { FileText, DollarSign, User, Calendar, Package, MessageSquare } from 'lucide-react';
import { cn } from '../../../components/ui/utils';
import { ProgressTimelineCompact } from '../../crm/components/ProgressTimelineCompact';

export interface OrderNote {
  id: string;
  text: string;
  author: string;
  created_at: string;
}

export interface OrderCardData {
  id: string;
  order_number: string;
  document_type?: string;
  language?: string;
  price?: number;
  translator?: string;
  translator_price?: number;
  deadline?: string | Date;
  status: string;
  progress_steps?: number; // Загальна кількість етапів
  completed_steps?: number; // Кількість завершених етапів
  notes?: OrderNote[];
}

interface OrderCardProps {
  order: OrderCardData;
  className?: string;
}

export function OrderCard({ order, className }: OrderCardProps) {
  const progressSteps = order.progress_steps || 7;
  const completedSteps = order.completed_steps || 0;

  const formatDate = (date: string | Date | undefined) => {
    if (!date) return 'Не вказано';
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('uk-UA', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const formatNoteDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('uk-UA', {
      day: '2-digit',
      month: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    const statusLower = status.toLowerCase();
    if (statusLower.includes('готово') || statusLower.includes('закрито') || statusLower.includes('closed')) {
      return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    }
    if (statusLower.includes('роботі') || statusLower.includes('виконан') || statusLower.includes('wydania')) {
      return 'bg-blue-100 text-blue-700 border-blue-200';
    }
    if (statusLower.includes('очікує') || statusLower.includes('очікування') || statusLower.includes('poswiadcz')) {
      return 'bg-amber-100 text-amber-700 border-amber-200';
    }
    return 'bg-gray-100 text-gray-700 border-gray-200';
  };

  return (
    <Card className={cn('border border-gray-200 rounded-xl shadow-sm', className)}>
      <CardContent className="p-5 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center shrink-0">
              <Package className="w-5 h-5 text-[#FF5A00]" />
            </div>
            <h3 className="font-bold text-base text-gray-900">
              {order.order_number}
            </h3>
          </div>
          <Badge className={cn('text-xs font-medium border', getStatusColor(order.status))}>
            {order.status}
          </Badge>
        </div>

        {/* Progress Timeline - компактна версія */}
        <div className="bg-gray-50 rounded-xl p-4">
          <ProgressTimelineCompact 
            steps={Array.from({ length: progressSteps }, (_, i) => ({
              step: i + 1,
              completed: i < completedSteps,
            }))}
            completedSteps={completedSteps}
          />
        </div>

          {/* Order Details */}
        <div className="space-y-4">
          {/* Info Grid */}
          <div className="grid grid-cols-1 gap-3 text-sm">
            {order.document_type && (
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <FileText className="w-5 h-5 text-gray-400 shrink-0" />
                <div>
                  <span className="text-gray-500">Документ: </span>
                <span className="font-medium text-gray-900">
                  {order.document_type}
                    {order.language && <span className="text-blue-600"> ({order.language})</span>}
                </span>
                </div>
              </div>
            )}

            {order.price !== undefined && (
              <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-lg">
                <DollarSign className="w-5 h-5 text-emerald-500 shrink-0" />
                <div>
                  <span className="text-gray-500">Ціна: </span>
                  <span className="font-bold text-emerald-600">{order.price} zł</span>
                </div>
              </div>
            )}

            {order.translator && (
              <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg">
                <User className="w-5 h-5 text-purple-500 shrink-0" />
                <div>
                  <span className="text-gray-500">Перекладач: </span>
                  <span className="font-medium text-gray-900">{order.translator}</span>
                  {order.translator_price && (
                    <span className="text-purple-600 ml-1">({order.translator_price} zł)</span>
                  )}
                </div>
              </div>
            )}

            {order.deadline && (
              <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-lg">
                <Calendar className="w-5 h-5 text-amber-500 shrink-0" />
                <div>
                  <span className="text-gray-500">Дедлайн: </span>
                  <span className="font-medium text-gray-900">{formatDate(order.deadline)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Internal Notes */}
          {order.notes && order.notes.length > 0 && (
            <div className="pt-4 border-t border-gray-200">
              <div className="flex items-center gap-2 mb-3">
                <MessageSquare className="w-4 h-4 text-amber-500" />
                <span className="text-sm font-semibold text-gray-700">
                  Нотатки ({order.notes.length})
                </span>
              </div>
              <div className="space-y-2">
                {order.notes.map((note) => (
                  <div
                    key={note.id}
                    className="p-3 bg-amber-50/70 rounded-xl border border-amber-100"
                  >
                    <div className="flex items-center gap-2 mb-1.5 text-xs text-amber-700">
                      <span className="font-semibold">{note.author}</span>
                      <span className="text-amber-400">•</span>
                      <span>{formatNoteDate(note.created_at)}</span>
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed">
                      {note.text}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

