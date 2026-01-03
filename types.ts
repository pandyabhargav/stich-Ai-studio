export interface FashionPrompt {
  id: string;
  label: string;
  thumbnail?: string;
  prompt: string;
}

export interface ShotGuide {
  title: string;
  pose: string;
  angle: string;
  why: string;
}

export interface DynamicGuide {
  category: string;
  shots: ShotGuide[];
}

export interface User {
  id: string;
  name: string;
  email: string;
  walletId: string;
  coins: number;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  suggestions?: FashionPrompt[];
  guide?: DynamicGuide;
  image?: string;
  isGenerating?: boolean;
}

export interface ProductDetails {
  category: string;
  color: string;
  fabricOrMaterial: string;
  style: string;
  context: string;
}

export interface Wallet {
  id: string;
  coins: number;
}