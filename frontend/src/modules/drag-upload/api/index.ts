import { apiFetchMultipart } from "../../../lib/api";

export const dragUploadApi = {
  async uploadFile(orderId: string | number, file: File): Promise<{ url: string }> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("order_id", orderId.toString());

    return apiFetchMultipart<{ url: string }>("/drag-upload/upload", formData, "POST");
  },
};

