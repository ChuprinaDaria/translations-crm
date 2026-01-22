import React, { useState } from 'react';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { Button } from '../../../../components/ui/button';
import { Calendar } from 'lucide-react';

interface DeadlineDialogContentProps {
  onConfirm: (deadline?: string) => void;
  onCancel: () => void;
}

export function DeadlineDialogContent({ onConfirm, onCancel }: DeadlineDialogContentProps) {
  const [deadline, setDeadline] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(deadline || undefined);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="deadline" className="flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          До коли зробити (необов'язково)
        </Label>
        <Input
          id="deadline"
          type="date"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
          min={new Date().toISOString().split('T')[0]}
        />
        <p className="text-xs text-gray-500">
          Якщо не вказано, дедлайн буде встановлено автоматично
        </p>
      </div>
      
      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Скасувати
        </Button>
        <Button type="submit">
          Utwórz zlecenie
        </Button>
      </div>
    </form>
  );
}

