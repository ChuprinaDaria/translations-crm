import { useState } from "react";
import {
  MessageCircle,
  Send,
  Paperclip,
  Mail,
  MessageSquare,
  Facebook,
  Phone,
  MoreVertical,
  FileText,
} from "lucide-react";
// import { ContextSidebar } from "../../context-sidebar";
import { ScrollArea } from "../../../components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "../../../components/ui/avatar";
import { Badge } from "../../../components/ui/badge";
import { Textarea } from "../../../components/ui/textarea";
import { Button } from "../../../components/ui/button";
import { cn } from "../../../components/ui/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../../components/ui/dropdown-menu";

// Types
type Platform = "telegram" | "facebook" | "email" | "phone";
type MessageDirection = "INBOUND" | "OUTBOUND";

interface Message {
  id: string;
  direction: MessageDirection;
  text: string;
  timestamp: Date;
  attachments?: string[];
}

interface Conversation {
  id: string;
  clientId: number;
  clientName: string;
  clientAvatar?: string;
  platform: Platform;
  lastMessage: string;
  lastMessageTime: Date;
  unreadCount: number;
  messages: Message[];
}

// Mock data
const mockConversations: Conversation[] = [
  {
    id: "1",
    clientId: 1,
    clientName: "Олександр Петренко",
    clientAvatar: undefined,
    platform: "telegram",
    lastMessage: "Дякую за швидку відповідь!",
    lastMessageTime: new Date(Date.now() - 5 * 60 * 1000),
    unreadCount: 2,
    messages: [
      {
        id: "m1",
        direction: "INBOUND",
        text: "Добрий день! Чи можна замовити кейтеринг на 50 осіб?",
        timestamp: new Date(Date.now() - 30 * 60 * 1000),
      },
      {
        id: "m2",
        direction: "OUTBOUND",
        text: "Добрий день! Так, звичайно. Коли вам потрібно?",
        timestamp: new Date(Date.now() - 25 * 60 * 1000),
      },
      {
        id: "m3",
        direction: "INBOUND",
        text: "Наступного тижня, в п'ятницю",
        timestamp: new Date(Date.now() - 20 * 60 * 1000),
      },
      {
        id: "m4",
        direction: "OUTBOUND",
        text: "Відмінно! Надішлю вам комерційну пропозицію за 5 хвилин.",
        timestamp: new Date(Date.now() - 15 * 60 * 1000),
      },
      {
        id: "m5",
        direction: "INBOUND",
        text: "Дякую за швидку відповідь!",
        timestamp: new Date(Date.now() - 5 * 60 * 1000),
      },
    ],
  },
  {
    id: "2",
    clientId: 2,
    clientName: "Марія Коваленко",
    clientAvatar: undefined,
    platform: "facebook",
    lastMessage: "Можна детальніше про меню?",
    lastMessageTime: new Date(Date.now() - 2 * 60 * 60 * 1000),
    unreadCount: 0,
    messages: [
      {
        id: "m6",
        direction: "INBOUND",
        text: "Привіт! Цікавить банкетне меню",
        timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000),
      },
      {
        id: "m7",
        direction: "OUTBOUND",
        text: "Привіт! Надішлю вам меню зараз",
        timestamp: new Date(Date.now() - 2.5 * 60 * 60 * 1000),
      },
      {
        id: "m8",
        direction: "INBOUND",
        text: "Можна детальніше про меню?",
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
      },
    ],
  },
  {
    id: "3",
    clientId: 3,
    clientName: "Володимир Сидоренко",
    clientAvatar: undefined,
    platform: "email",
    lastMessage: "Надішліть, будь ласка, комерційну пропозицію",
    lastMessageTime: new Date(Date.now() - 24 * 60 * 60 * 1000),
    unreadCount: 1,
    messages: [
      {
        id: "m9",
        direction: "INBOUND",
        text: "Добрий день! Надішліть, будь ласка, комерційну пропозицію для корпоративного заходу на 100 осіб.",
        timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
    ],
  },
  {
    id: "4",
    clientId: 4,
    clientName: "Анна Мельник",
    clientAvatar: undefined,
    platform: "telegram",
    lastMessage: "Дякую!",
    lastMessageTime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    unreadCount: 0,
    messages: [
      {
        id: "m10",
        direction: "INBOUND",
        text: "Дякую!",
        timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      },
    ],
  },
];

// Platform icon component
function PlatformIcon({ platform, className }: { platform: Platform; className?: string }) {
  const iconMap = {
    telegram: MessageSquare,
    facebook: Facebook,
    email: Mail,
    phone: Phone,
  };

  const Icon = iconMap[platform];
  const colorMap = {
    telegram: "text-blue-500",
    facebook: "text-blue-600",
    email: "text-gray-600",
    phone: "text-green-600",
  };

  return <Icon className={cn("w-4 h-4", colorMap[platform], className)} />;
}

// Format time helper
function formatTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "щойно";
  if (diffMins < 60) return `${diffMins} хв`;
  if (diffHours < 24) return `${diffHours} год`;
  if (diffDays < 7) return `${diffDays} дн`;
  return date.toLocaleDateString("uk-UA", { day: "numeric", month: "short" });
}

export function InboxPage() {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(
    mockConversations[0]?.id || null
  );
  const [messageText, setMessageText] = useState("");
  const [contextSidebarOpen, setContextSidebarOpen] = useState(false);

  const selectedConversation = mockConversations.find(
    (c) => c.id === selectedConversationId
  );

  // Відкриваємо контекстну панель при виборі розмови
  const handleConversationSelect = (id: string) => {
    setSelectedConversationId(id);
    const conversation = mockConversations.find((c) => c.id === id);
    if (conversation?.clientId) {
      setContextSidebarOpen(true);
    }
  };

  const handleSendMessage = () => {
    if (!messageText.trim() || !selectedConversation) return;
    // TODO: Implement send message logic
    setMessageText("");
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
      <div className="flex items-center gap-3 mb-4">
        <MessageCircle className="w-6 h-6 text-gray-600" />
        <h1 className="text-xl font-semibold text-gray-900">Inbox</h1>
      </div>

      <div className="flex-1 flex border border-gray-200 rounded-lg bg-white overflow-hidden">
        {/* Sidebar - Chat List */}
        <div className="w-80 border-r border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-sm font-semibold text-gray-900">Повідомлення</h2>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2">
              {mockConversations.map((conversation) => (
                <button
                  key={conversation.id}
                  onClick={() => handleConversationSelect(conversation.id)}
                  className={cn(
                    "w-full flex items-start gap-3 p-3 rounded-lg transition-colors text-left",
                    selectedConversationId === conversation.id
                      ? "bg-gray-100 border-l-4 border-gray-400"
                      : "hover:bg-gray-50"
                  )}
                >
                  <Avatar className="w-12 h-12 shrink-0">
                    <AvatarImage src={conversation.clientAvatar} />
                    <AvatarFallback className="bg-gray-200 text-gray-600">
                      {conversation.clientName
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span
                        className={cn(
                          "text-sm font-medium truncate",
                          selectedConversationId === conversation.id
                            ? "text-gray-900 font-semibold"
                            : "text-gray-900"
                        )}
                      >
                        {conversation.clientName}
                      </span>
                      <PlatformIcon platform={conversation.platform} />
                    </div>
                    <p className="text-xs text-gray-600 truncate mb-1">
                      {conversation.lastMessage}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400">
                        {formatTime(conversation.lastMessageTime)}
                      </span>
                      {conversation.unreadCount > 0 && (
                        <Badge
                          className="bg-[#FF5A00] text-white border-0 h-5 min-w-5 px-1.5 text-xs"
                        >
                          {conversation.unreadCount}
                        </Badge>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Main Area - Chat Window */}
        <div className="flex-1 flex flex-col">
          {selectedConversation ? (
            <>
              {/* Header */}
              <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={selectedConversation.clientAvatar} />
                    <AvatarFallback className="bg-gray-200 text-gray-600">
                      {selectedConversation.clientName
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">
                        {selectedConversation.clientName}
                      </span>
                      <PlatformIcon platform={selectedConversation.platform} />
                    </div>
                    <span className="text-xs text-gray-500">
                      {selectedConversation.platform === "telegram" && "Telegram"}
                      {selectedConversation.platform === "facebook" && "Facebook"}
                      {selectedConversation.platform === "email" && "Email"}
                      {selectedConversation.platform === "phone" && "Телефон"}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-gray-300 hover:bg-gray-50"
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Створити замовлення
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>Переглянути профіль</DropdownMenuItem>
                      <DropdownMenuItem>Архівувати</DropdownMenuItem>
                      <DropdownMenuItem className="text-red-600">Заблокувати</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Message List */}
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {selectedConversation.messages.map((message) => (
                    <div
                      key={message.id}
                      className={cn(
                        "flex",
                        message.direction === "OUTBOUND" ? "justify-end" : "justify-start"
                      )}
                    >
                      <div
                        className={cn(
                          "max-w-[70%] rounded-lg px-4 py-2",
                          message.direction === "INBOUND"
                            ? "bg-white border border-gray-200"
                            : "bg-blue-500 text-white"
                        )}
                      >
                        <p className="text-sm whitespace-pre-wrap">{message.text}</p>
                        <span
                          className={cn(
                            "text-xs mt-1 block",
                            message.direction === "INBOUND"
                              ? "text-gray-400"
                              : "text-white/80"
                          )}
                        >
                          {formatTime(message.timestamp)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              {/* Input Area */}
              <div className="p-4 border-t border-gray-200">
                <div className="flex items-end gap-2">
                  <Button variant="ghost" size="sm" className="shrink-0">
                    <Paperclip className="w-5 h-5 text-gray-600" />
                  </Button>
                  <Textarea
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder="Напишіть повідомлення..."
                    className="min-h-[60px] max-h-[120px] resize-none"
                    rows={2}
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={!messageText.trim()}
                    size="sm"
                    className="bg-[#FF5A00] hover:bg-[#FF5A00]/90 text-white shrink-0"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <MessageCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600">Оберіть розмову для перегляду</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Context Sidebar */}
      {/* <ContextSidebar
        clientId={selectedConversation?.clientId || null}
        open={contextSidebarOpen}
        onOpenChange={setContextSidebarOpen}
        onCreateOrder={(clientId) => {
          // TODO: Відкрити модалку створення замовлення
          console.log("Create order for client:", clientId);
        }}
      /> */}
    </div>
  );
}
