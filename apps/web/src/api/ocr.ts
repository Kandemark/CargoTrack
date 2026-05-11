/**
 * ocr.ts — API client for document OCR extraction.
 */
import apiClient from './client'

export interface DocumentExtraction {
  document_type: string
  type_confidence: number
  suggested_review: boolean
  ocr_confidence: number
  raw_text: string
  extracted_fields: Record<string, unknown>
  matched_keywords: string[]
  processing_time_ms: number
  word_count: number
  page_count: number
  preprocess_steps: string[]
  extraction_id?: number
}

export interface StoredExtraction extends DocumentExtraction {
  id: number
  document_id: number
  extracted_at: string
}

export const ocrApi = {
  extract: (file: File, shipmentId?: number) => {
    const fd = new FormData()
    fd.append('file', file)
    if (shipmentId) fd.append('shipment_id', String(shipmentId))
    return apiClient.post<DocumentExtraction>('/api/v1/documents/extract/', fd)
  },

  getExtraction: (id: number) =>
    apiClient.get<StoredExtraction>(`/api/v1/documents/${id}/extraction/`),

  deleteExtraction: (id: number) =>
    apiClient.delete(`/api/v1/documents/${id}/extraction/`),
}
