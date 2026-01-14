import React, { useState } from "react";
import { GripVertical, Edit, Trash2, Plus } from "lucide-react";

interface DraggableSectionListProps {
  sections: string[];
  onChange: (sections: string[]) => void;
}

export function DraggableSectionList({ sections, onChange }: DraggableSectionListProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const addSection = () => {
    onChange([...sections, "Нова секція"]);
    setEditingIndex(sections.length);
  };

  const removeSection = (index: number) => {
    onChange(sections.filter((_, i) => i !== index));
  };

  const updateSection = (index: number, value: string) => {
    const newSections = [...sections];
    newSections[index] = value;
    onChange(newSections);
  };

  const moveSection = (fromIndex: number, toIndex: number) => {
    const newSections = [...sections];
    const [moved] = newSections.splice(fromIndex, 1);
    newSections.splice(toIndex, 0, moved);
    onChange(newSections);
  };

  return (
    <div className="space-y-2">
      {sections.map((section, index) => (
        <div key={index} className="flex items-center gap-2 group">
          {/* Drag handle */}
          <button
            type="button"
            className="p-2 text-gray-400 hover:text-gray-600 cursor-move"
            title="Перетягніть для зміни порядку"
          >
            <GripVertical className="w-4 h-4" />
          </button>

          {/* Input або текст */}
          {editingIndex === index ? (
            <input
              type="text"
              value={section}
              onChange={(e) => updateSection(index, e.target.value)}
              onBlur={() => setEditingIndex(null)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setEditingIndex(null);
                }
              }}
              className="flex-1 px-3 py-2 border-2 border-orange-500 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              autoFocus
            />
          ) : (
            <div
              onClick={() => setEditingIndex(index)}
              className="flex-1 px-3 py-2 border border-transparent rounded-lg hover:border-gray-300 cursor-text transition-colors"
            >
              {section}
            </div>
          )}

          {/* Кнопки */}
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={() => setEditingIndex(index)}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
              title="Редагувати"
            >
              <Edit className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => removeSection(index)}
              className="p-2 text-red-400 hover:text-red-600 transition-colors"
              title="Видалити"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={addSection}
        className="w-full px-3 py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-600 hover:border-orange-500 hover:text-orange-600 transition-colors"
      >
        <Plus className="w-4 h-4 inline mr-1" />
        Додати секцію
      </button>
    </div>
  );
}

