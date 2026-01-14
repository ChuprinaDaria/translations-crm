import { apiFetchMultipart } from "../../../lib/api";

export const audioNotesApi = {
  async transcribeAudio(orderId: string | number, audioBlob: Blob): Promise<{ text: string }> {
    const formData = new FormData();
    formData.append("audio", audioBlob, "recording.webm");
    formData.append("order_id", orderId.toString());

    return apiFetchMultipart<{ text: string }>("/audio-notes/transcribe", formData, "POST");
  },
};

