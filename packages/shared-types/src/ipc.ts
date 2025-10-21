export type ZvtEvent =
  | { type: 'connected' }
  | { type: 'disconnected' }
  | { type: 'status'; code: string; text?: string }
  | { type: 'receipt-line'; text: string }
  | { type: 'approved'; rrn?: string; authCode?: string }
  | { type: 'declined'; reason?: string }
  | { type: 'error'; message: string }
