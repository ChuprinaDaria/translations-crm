/**
 * Languages and Specializations API
 */
import { apiFetch } from '../../../lib/api/client';

export interface Language {
  id: number;
  name_pl: string;
  name_en?: string;
  base_client_price: number;
  created_at?: string;
  updated_at?: string;
}

export interface LanguageCreate {
  name_pl: string;
  name_en?: string;
  base_client_price: number;
}

export interface LanguageUpdate {
  name_pl?: string;
  name_en?: string;
  base_client_price?: number;
}

export interface Specialization {
  id: number;
  name: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

export interface SpecializationCreate {
  name: string;
  description?: string;
}

export interface SpecializationUpdate {
  name?: string;
  description?: string;
}

export interface TranslatorLanguageRate {
  id?: number;
  translator_id: number;
  language_id: number;
  specialization_id?: number;
  translator_rate: number;
  custom_client_price?: number;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface TranslatorLanguageRateCreate {
  language_id: number;
  specialization_id?: number;
  translator_rate: number;
  custom_client_price?: number;
  notes?: string;
}

export const languagesApi = {
  /**
   * Get all languages
   */
  async getLanguages(): Promise<Language[]> {
    return apiFetch<Language[]>('/crm/languages');
  },

  /**
   * Get language by ID
   */
  async getLanguage(id: number): Promise<Language> {
    return apiFetch<Language>(`/crm/languages/${id}`);
  },

  /**
   * Create language
   */
  async createLanguage(data: LanguageCreate): Promise<Language> {
    return apiFetch<Language>('/crm/languages', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Update language
   */
  async updateLanguage(id: number, data: LanguageUpdate): Promise<Language> {
    return apiFetch<Language>(`/crm/languages/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  /**
   * Delete language
   */
  async deleteLanguage(id: number): Promise<void> {
    return apiFetch(`/crm/languages/${id}`, {
      method: 'DELETE',
    });
  },
};

export const specializationsApi = {
  /**
   * Get all specializations
   */
  async getSpecializations(): Promise<Specialization[]> {
    return apiFetch<Specialization[]>('/crm/specializations');
  },

  /**
   * Get specialization by ID
   */
  async getSpecialization(id: number): Promise<Specialization> {
    return apiFetch<Specialization>(`/crm/specializations/${id}`);
  },

  /**
   * Create specialization
   */
  async createSpecialization(data: SpecializationCreate): Promise<Specialization> {
    return apiFetch<Specialization>('/crm/specializations', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Update specialization
   */
  async updateSpecialization(id: number, data: SpecializationUpdate): Promise<Specialization> {
    return apiFetch<Specialization>(`/crm/specializations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  /**
   * Delete specialization
   */
  async deleteSpecialization(id: number): Promise<void> {
    return apiFetch(`/crm/specializations/${id}`, {
      method: 'DELETE',
    });
  },
};

export const translatorRatesApi = {
  /**
   * Get rates for a translator
   */
  async getTranslatorRates(translatorId: number): Promise<TranslatorLanguageRate[]> {
    return apiFetch<TranslatorLanguageRate[]>(`/crm/translators/${translatorId}/rates`);
  },

  /**
   * Create rate for a translator
   */
  async createTranslatorRate(
    translatorId: number,
    data: TranslatorLanguageRateCreate
  ): Promise<TranslatorLanguageRate> {
    return apiFetch<TranslatorLanguageRate>(`/crm/translators/${translatorId}/rates`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Update rate
   */
  async updateTranslatorRate(
    rateId: number,
    data: Partial<TranslatorLanguageRateCreate>
  ): Promise<TranslatorLanguageRate> {
    return apiFetch<TranslatorLanguageRate>(`/crm/translator-rates/${rateId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  /**
   * Delete rate
   */
  async deleteTranslatorRate(rateId: number): Promise<void> {
    return apiFetch(`/crm/translator-rates/${rateId}`, {
      method: 'DELETE',
    });
  },
};

