import { useState, useRef, useEffect } from "react";
import { Mic, Square, Loader2 } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { toast } from "sonner";
import { audioNotesApi } from "../api";

interface AudioNoteButtonProps {
  orderId: string | number;
  onTranscriptionComplete?: (text: string) => void;
  className?: string;
}

export function AudioNoteButton({
  orderId,
  onTranscriptionComplete,
  className,
}: AudioNoteButtonProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    return () => {
      // Очищення при розмонтуванні
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        await processAudio(audioBlob);
        
        // Зупиняємо всі треки
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      toast.success("Запис розпочато");
    } catch (error: any) {
      console.error("Failed to start recording:", error);
      toast.error("Не вдалося отримати доступ до мікрофона");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      toast.info("Запис завершено, обробка...");
    }
  };

  const processAudio = async (audioBlob: Blob) => {
    setIsProcessing(true);
    try {
      // Відправляємо аудіо на сервер для транскрипції
      const result = await audioNotesApi.transcribeAudio(orderId, audioBlob);
      
      toast.success("Транскрипція завершена!");
      onTranscriptionComplete?.(result.text);
    } catch (error: any) {
      console.error("Transcription error:", error);
      toast.error(error.message || "Не вдалося обробити аудіо");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClick = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  return (
    <Button
      onClick={handleClick}
      disabled={isProcessing}
      variant={isRecording ? "destructive" : "outline"}
      className={className}
    >
      {isProcessing ? (
        <>
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          Обробка...
        </>
      ) : isRecording ? (
        <>
          <Square className="w-4 h-4 mr-2" />
          Зупинити запис
        </>
      ) : (
        <>
          <Mic className="w-4 h-4 mr-2" />
          Голосова нотатка
        </>
      )}
    </Button>
  );
}

