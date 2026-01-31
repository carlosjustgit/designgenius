export interface DesignConcept {
  name: string;
  description: string;
  imagePrompt: string;
}

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface GeneratedMockup {
  id: string;
  conceptName: string;
  description: string;
  mobileImageUrl: string | null;
  desktopImageUrl: string | null;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  regeneratingView?: 'mobile' | 'desktop' | null;
  error?: string;
}

export interface GenerationInput {
  url: string;
  companyInfo: string;
  screenshot: File | null;
  logo: File | null;
}