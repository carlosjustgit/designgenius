import { GoogleGenAI, Type, SchemaType } from "@google/genai";
import { DesignConcept, GroundingSource } from "../types";

// Helper to encode file to base64
export const fileToGenerativePart = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      // Remove data url prefix (e.g. "data:image/jpeg;base64,")
      const base64Data = base64String.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// Auto-fill company info from URL
export const getCompanyInfoFromUrl = async (url: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
  
  const prompt = `
    You are an expert web design strategist.
    Research the website at this URL: ${url}
    
    Write a concise design brief summary (approx 50-80 words) covering:
    1. What the company does.
    2. The target audience.
    3. The existing brand vibe (e.g. corporate, playful, minimalist).
    
    Do not use markdown formatting, just plain text suitable for a form field.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      }
    });
    return response.text || "";
  } catch (error) {
    console.error("Failed to fetch company info:", error);
    return "";
  }
};

// Step 1: Analyze and Create Prompts (The "Brain")
export const generateDesignConcepts = async (
  url: string,
  companyInfo: string,
  screenshotBase64: string
): Promise<{ concepts: DesignConcept[]; sources: GroundingSource[] }> => {
  // Always create a new instance to ensure we pick up the latest selected key
  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

  const prompt = `
    You are a world-class UI/UX Designer and Creative Director specialized in modern web design trends (2025+).
    
    Task:
    1. Research the provided website URL (${url}) using Google Search to gather up-to-date information about the company, its industry, competitors, and current branding.
    2. Analyze the provided website screenshot and company information.
    3. Based on your research and analysis, propose 3 distinct, high-fidelity modernization concepts for this website's homepage.
    
    Return a JSON array of 3 design concepts. For each concept, provide:
    1. 'name': A catchy name for the design direction (e.g., "Minimalist Tech", "Bold & Disruptive").
    2. 'description': A short explanation of the UX strategy.
    3. 'imagePrompt': A HIGHLY DETAILED prompt to generate a high-fidelity website mockup using an advanced AI image generator.
       The prompt MUST describe a FULL HOMEPAGE LAYOUT, not just a hero section. It must include details for: 
       - Hero Section (Headline, CTA)
       - Features/Services Grid (Middle section)
       - Trust Indicators or Testimonials
       - Footer area
       - Specific layout structure, color palette, typography, and UI elements.
       - Do NOT specify aspect ratio in this prompt.
       - Specific instruction: "High quality website mockup, UI/UX design, trending on Dribbble, 4k, photorealistic".
       
    Company Info: ${companyInfo}
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview", 
      contents: {
        parts: [
          { inlineData: { mimeType: "image/png", data: screenshotBase64 } },
          { text: prompt }
        ]
      },
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              description: { type: Type.STRING },
              imagePrompt: { type: Type.STRING },
            },
            required: ["name", "description", "imagePrompt"]
          }
        }
      }
    });

    const sources: GroundingSource[] = [];
    if (response.candidates?.[0]?.groundingMetadata?.groundingChunks) {
        for (const chunk of response.candidates[0].groundingMetadata.groundingChunks) {
            if (chunk.web?.uri) {
                sources.push({
                    title: chunk.web.title || new URL(chunk.web.uri).hostname,
                    uri: chunk.web.uri
                });
            }
        }
    }

    if (response.text) {
      const concepts = JSON.parse(response.text) as DesignConcept[];
      return { concepts, sources };
    }
    throw new Error("No JSON response received from design analysis.");
  } catch (error) {
    console.error("Error generating design concepts:", error);
    throw error;
  }
};

// Step 2: Render the Mockup (The "Artist")
export const generateMockupImage = async (
  concept: DesignConcept,
  logoBase64: string | null,
  deviceType: 'mobile' | 'desktop'
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

  // Use the specific model requested for high quality image generation
  const model = "gemini-3-pro-image-preview";

  let specificPrompt = concept.imagePrompt;
  let aspectRatio = "9:16";

  if (deviceType === 'mobile') {
    specificPrompt += " . GENERATE A MOBILE MOCKUP: Vertical layout, hamburger menu, stacked content, optimized for smartphone screen (9:16). Show the full length of the mobile page.";
    aspectRatio = "9:16";
  } else {
    // For desktop, we still use a vertical aspect ratio (9:16) to show the "Long Scroll" full page view,
    // but we instruct the model to render DESKTOP UI patterns (wide navbar, multi-column grids).
    specificPrompt += " . GENERATE A FULL-PAGE DESKTOP SCROLL MOCKUP: Vertical long-scrolling screenshot of the desktop website. Wide navigation bar at the top, multi-column grid layouts for content, small desktop-sized text. Show the Hero section, followed by Features/Services section, and ending with the Footer. Do NOT use mobile layout. High-fidelity desktop UI on a long vertical canvas.";
    aspectRatio = "9:16";
  }

  const parts: any[] = [
    { text: specificPrompt },
  ];

  if (logoBase64) {
    parts.push({
      inlineData: {
        mimeType: "image/png",
        data: logoBase64
      }
    });
    parts.push({
        text: "Incorporate this logo naturally into the website header."
    });
  }

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: {
        parts: parts
      },
      config: {
        imageConfig: {
          aspectRatio: aspectRatio, 
          imageSize: "2K" // High quality
        }
      }
    });

    // Extract image
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    
    throw new Error("No image data found in response");

  } catch (error) {
    console.error(`Error generating ${deviceType} mockup image:`, error);
    throw error;
  }
};

// Step 3: Orchestrator for Refinement (Regenerate)
export const refineAndRegenerateMockup = async (
    originalConcept: DesignConcept,
    companyInfo: string,
    deviceType: 'mobile' | 'desktop',
    logoBase64: string | null
): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
    
    // 1. Refine the Prompt (Orchestrator Role)
    const orchestratorPrompt = `
        You are a Senior Art Director and UI/UX Specialist. 
        We are refining a website mockup design.
        
        Company Context: ${companyInfo}
        Concept Name: ${originalConcept.name}
        Concept Description: ${originalConcept.description}
        Original Image Prompt: ${originalConcept.imagePrompt}
        
        Task: 
        Analyze the constraints and create a VASTLY IMPROVED, Version 2.0 image generation prompt for a ${deviceType} layout.
        The goal is to make it look even more professional, modern, and aligned with the brand.
        Focus on:
        - Better use of whitespace and typography.
        - More impactful hero section.
        - Clearer visual hierarchy.
        - Trending UI elements (glassmorphism, bento grids, etc. if appropriate).
        
        Output: JUST the new image prompt text. Do not explain.
    `;

    let refinedPrompt = originalConcept.imagePrompt;

    try {
        const textResponse = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: orchestratorPrompt
        });
        if (textResponse.text) {
            refinedPrompt = textResponse.text;
        }
    } catch (e) {
        console.warn("Orchestration step failed, falling back to original prompt", e);
    }

    // 2. Generate the Image with the Refined Prompt
    // We create a temporary concept object to pass to our existing image generator
    const refinedConcept: DesignConcept = {
        ...originalConcept,
        imagePrompt: refinedPrompt
    };

    return generateMockupImage(refinedConcept, logoBase64, deviceType);
};