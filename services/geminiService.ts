
import { GoogleGenAI, Type } from "@google/genai";
import { FashionPrompt, ProductDetails, DynamicGuide } from "../types";

export interface ImageInput {
  data: string;
  mimeType: string;
}

export const parseProductAndGeneratePrompts = async (
  userInput: string, 
  imageInput?: ImageInput
): Promise<{ details: ProductDetails, prompts: FashionPrompt[], guide: DynamicGuide }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const parts: any[] = [
    { text: `You are a high-end commercial photographer. 
    Analyze this product request: "${userInput}". 
    
    TASK:
    1. EXTRACT: Category, Main Color, Material, and Context.
    2. PLAN 6 SHOTS: Create 6 distinct commercial angles.
    3. GUIDE: Create 4 tips for photographing this product.
    
    Return JSON only.` }
  ];

  if (imageInput) {
    parts.push({
      inlineData: {
        data: imageInput.data,
        mimeType: imageInput.mimeType
      }
    });
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            details: {
              type: Type.OBJECT,
              properties: {
                category: { type: Type.STRING },
                color: { type: Type.STRING },
                fabricOrMaterial: { type: Type.STRING },
                style: { type: Type.STRING },
                context: { type: Type.STRING }
              },
              required: ["category", "color", "fabricOrMaterial", "style", "context"]
            },
            prompts: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  label: { type: Type.STRING },
                  prompt: { type: Type.STRING }
                },
                required: ["id", "label", "prompt"]
              }
            },
            guide: {
              type: Type.OBJECT,
              properties: {
                category: { type: Type.STRING },
                shots: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      title: { type: Type.STRING },
                      pose: { type: Type.STRING },
                      angle: { type: Type.STRING },
                      why: { type: Type.STRING }
                    },
                    required: ["title", "pose", "angle", "why"]
                  }
                }
              },
              required: ["category", "shots"]
            }
          },
          required: ["details", "prompts", "guide"]
        }
      }
    });

    return JSON.parse(response.text || '{}');
  } catch (error: any) {
    if (error.message?.includes('429') || error.message?.toLowerCase().includes('quota')) {
      throw new Error("Quota exceeded. Please wait.");
    }
    throw error;
  }
};

export const generateStudioImage = async (
  prompt: string, 
  referenceImage?: ImageInput,
  isThumbnail: boolean = false
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const parts: any[] = [];

  if (referenceImage) {
    parts.push({
      inlineData: {
        data: referenceImage.data,
        mimeType: referenceImage.mimeType
      }
    });
    
    parts.push({
      text: `PHOTOGRAPHY SESSION:
      STRICT: Use the exact item from the photo.
      ACTION: Re-stage: "${prompt}".
      LOOK: High-end studio lighting, minimalist background, 8k, photorealistic, sharp focus.`
    });
  } else {
    parts.push({ 
      text: `Commercial product photography of ${prompt}. Clean studio background, professional lighting, 8k resolution, hyper-realistic.` 
    });
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts },
      config: {
        imageConfig: {
          aspectRatio: "1:1"
        }
      }
    });

    for (const candidate of response.candidates || []) {
      for (const part of candidate.content.parts) {
        if (part.inlineData) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
    }
  } catch (error: any) {
    if (error.message?.includes('429') || error.message?.toLowerCase().includes('quota')) {
      throw new Error("Quota limit reached.");
    }
    throw error;
  }

  throw new Error("No image data received.");
};
