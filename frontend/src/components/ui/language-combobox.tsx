"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "./utils";
import { Button } from "./button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "./command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./popover";

export interface LanguageOption {
  value: string;
  label: string;
  labelPl?: string;
}

interface LanguageComboboxProps {
  value: string;
  onValueChange: (value: string) => void;
  languages: LanguageOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
}

export function LanguageCombobox({
  value,
  onValueChange,
  languages,
  placeholder = "Оберіть мову...",
  searchPlaceholder = "Пошук мови...",
  emptyText = "Мову не знайдено",
  disabled = false,
  className,
  triggerClassName,
}: LanguageComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");

  const selectedLanguage = languages.find((lang) => lang.value === value);

  // Filter languages based on search query
  const filteredLanguages = React.useMemo(() => {
    if (!searchQuery.trim()) return languages;
    
    const query = searchQuery.toLowerCase();
    return languages.filter((lang) => 
      lang.label.toLowerCase().includes(query) ||
      lang.labelPl?.toLowerCase().includes(query) ||
      lang.value.toLowerCase().includes(query)
    );
  }, [languages, searchQuery]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal",
            !value && "text-muted-foreground",
            triggerClassName
          )}
        >
          <span className="truncate">
            {selectedLanguage ? selectedLanguage.label : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className={cn("w-[280px] p-0", className)} align="start">
        <Command shouldFilter={false}>
          <CommandInput 
            placeholder={searchPlaceholder}
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup className="max-h-[200px] overflow-y-auto">
              {filteredLanguages.map((lang) => (
                <CommandItem
                  key={lang.value}
                  value={lang.value}
                  onSelect={() => {
                    onValueChange(lang.value === value ? "" : lang.value);
                    setOpen(false);
                    setSearchQuery("");
                  }}
                  className="cursor-pointer"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === lang.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex flex-col">
                    <span className="text-sm">{lang.label}</span>
                    {lang.labelPl && lang.labelPl !== lang.label && (
                      <span className="text-xs text-muted-foreground">{lang.labelPl}</span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

