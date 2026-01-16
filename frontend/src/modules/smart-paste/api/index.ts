import { apiFetch } from "../../../lib/api";
import { ParsedOrderData } from "../components/SmartPasteButton";

export const smartPasteApi = {
  async parseOrder(text: string): Promise<ParsedOrderData> {
    return apiFetch<ParsedOrderData>("/smart-paste/parse-order", {
      method: "POST",
      body: JSON.stringify({ text }),
    });
  },
};

