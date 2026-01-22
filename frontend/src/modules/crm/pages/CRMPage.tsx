import { useState } from "react";
import { Package, List } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../components/ui/tabs";
import { BoardPage } from "./BoardPage";
import { OrdersListPage } from "./OrdersListPage";

export function CRMPage() {
  const [activeTab, setActiveTab] = useState("orders");

  return (
    <div className="h-[calc(100vh-8rem)]">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
        <TabsList className="self-start mb-4">
          <TabsTrigger value="orders" className="flex items-center gap-2">
            <Package className="w-4 h-4" />
            Zlecenia
          </TabsTrigger>
          <TabsTrigger value="list" className="flex items-center gap-2">
            <List className="w-4 h-4" />
            Список замовлень
          </TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="flex-1 m-0">
          <BoardPage />
        </TabsContent>

        <TabsContent value="list" className="flex-1 m-0">
          <OrdersListPage />
        </TabsContent>
      </Tabs>
    </div>
  );
}

