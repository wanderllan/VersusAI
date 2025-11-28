
// Definições de tipos para a aplicação

export interface ProductInfo {
  name: string;
  priceEstimate: string;
  pros: string[];
  cons: string[];
}

export interface ComparisonPoint {
  feature: string;
  values: string[]; // Array of values corresponding to the products array order
  winnerIndex: number | -1; // Index of the winner in the products array, or -1 for Tie/NA
  isKeyDifference?: boolean; // Indicates if this is a critical differentiator
}

export interface RadarDataPoint {
  subject: string;
  [key: string]: number | string; // Dynamic keys for products (e.g., "Product A": 90)
  fullMark: number;
}

export interface TrendDataPoint {
  month: string;
  value: number; // 0-100 interest scale
}

export interface PersonaDefinition {
  id: string;
  label: string;
  description: string;
  icon: 'gamepad' | 'student' | 'briefcase' | 'wallet' | 'camera' | 'heart' | 'zap' | 'star' | 'music' | 'home';
}

export interface ComparisonData {
  products: ProductInfo[]; // Changed from productA/productB to array
  summary: string;
  verdict: string;
  rivalryScore: number; // 0 to 100
  rivalryText: string;
  comparisonTable: ComparisonPoint[];
  scores: RadarDataPoint[];
  searchTrend?: TrendDataPoint[]; // Historical search interest data
  personas: PersonaDefinition[]; // Dynamic list of personas
  suggestedPersona: string; // ID of the suggested persona
}

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface AnalysisResult {
  data: ComparisonData | null;
  sources: GroundingSource[];
  rawText?: string;
  query: string;
  timestamp?: number;
}

export enum LoadingState {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface SavedComparison extends AnalysisResult {
  id: string;
  savedAt: number;
}

export interface LeaderboardItem {
  id: string;
  query: string;
  votes: number;
  trend: 'up' | 'down' | 'stable';
}

export interface HistoryItem {
  query: string;
  timestamp: number;
}
