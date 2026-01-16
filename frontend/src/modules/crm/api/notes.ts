/**
 * Internal Notes API
 */
import { apiFetch } from '../../../lib/api/client';

export interface InternalNote {
  id: number;
  entity_type: 'client' | 'order' | 'chat' | 'payment';
  entity_id: string;
  author_id: string;
  author_name: string;
  text: string;
  created_at: string;
}

export interface InternalNoteCreate {
  entity_type: 'client' | 'order' | 'chat' | 'payment';
  entity_id: string;
  text: string;
}

export const notesApi = {
  /**
   * Get notes for a specific entity
   */
  async getNotes(entityType: string, entityId: string): Promise<InternalNote[]> {
    return apiFetch<InternalNote[]>(
      `/crm/notes?entity_type=${entityType}&entity_id=${encodeURIComponent(entityId)}`
    );
  },

  /**
   * Create a new note
   */
  async createNote(data: InternalNoteCreate): Promise<InternalNote> {
    return apiFetch<InternalNote>('/crm/notes', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Delete a note
   */
  async deleteNote(noteId: number): Promise<void> {
    return apiFetch(`/crm/notes/${noteId}`, {
      method: 'DELETE',
    });
  },
};

