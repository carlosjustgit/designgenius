<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# DesignGenius AI - Website Mockup Generator

An AI-powered application that generates modernized, high-fidelity website mockups based on current screenshots and company branding. Built with React, TypeScript, and Google's Gemini AI.

## Features

- **AI-Powered Design Generation**: Uses Gemini AI to analyze websites and generate 3 unique design concepts
- **Google Search Integration**: Researches company information and design trends automatically
- **Dual View Modes**: Generates both mobile (9:16) and desktop mockups
- **High-Fidelity Mockups**: 2K quality images with detailed UI elements
- **Iterative Refinement**: Regenerate and improve designs with one click
- **Session-Based**: Images are generated on-demand and available for immediate download (no backend storage required)

## Run Locally

**Prerequisites:** Node.js 18+

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   
   Create a `.env.local` file in the root directory:
   ```env
   VITE_GEMINI_API_KEY=your_gemini_api_key_here
   ```
   
   Get your API key from [Google AI Studio](https://ai.google.dev/gemini-api/docs/api-key).

3. **Run the development server:**
   ```bash
   npm run dev
   ```
   
   The app will be available at `http://localhost:3000`

4. **Build for production:**
   ```bash
   npm run build
   ```

## Deploy to Vercel

### Option 1: Deploy via GitHub (Recommended)

1. **Push to GitHub:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   gh repo create designgenius --public --source=. --remote=origin
   git push -u origin main
   ```

2. **Deploy on Vercel:**
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import your GitHub repository
   - Configure environment variables:
     - `VITE_GEMINI_API_KEY`: Your Gemini API key
   - Click "Deploy"

### Option 2: Deploy via Vercel CLI

```bash
npm install -g vercel
vercel login
vercel --prod
```

When prompted, add the environment variable:
- `VITE_GEMINI_API_KEY`: Your Gemini API key

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_GEMINI_API_KEY` | Your Google Gemini API key | Yes |

## Tech Stack

- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Styling (via CDN)
- **Google Gemini AI** - AI model for design generation and image synthesis
- **Google Search Grounding** - Real-time company research

## Project Structure

```
designgenius/
├── components/
│   ├── ApiKeySelector.tsx    # API key validation
│   └── FileUpload.tsx         # Drag & drop file upload
├── services/
│   └── geminiService.ts       # Gemini AI integration
├── types.ts                   # TypeScript interfaces
├── App.tsx                    # Main application component
├── index.tsx                  # Application entry point
├── index.html                 # HTML template
├── vite.config.ts            # Vite configuration
├── vercel.json               # Vercel deployment config
└── package.json              # Dependencies

```

## How It Works

1. **Input**: User provides a website URL, company information, current website screenshot, and optionally a logo
2. **Analysis**: Gemini AI researches the company using Google Search and analyzes the screenshot
3. **Concept Generation**: AI generates 3 distinct design concepts with detailed image prompts
4. **Image Rendering**: High-fidelity mockups are generated for both mobile and desktop views
5. **Refinement**: Users can regenerate any design to get improved variations

## Important Notes

- **No Database Required**: Images are generated as base64 data URLs and stored in browser memory
- **Session-Based**: Generated images are lost on page refresh (download them immediately)
- **API Costs**: Gemini API usage is billed per request - monitor your usage at [Google AI Studio](https://ai.google.dev/)
- **Image Models**: Uses `gemini-3-pro-image-preview` for high-quality image generation

## License

This project was created with Google AI Studio.

## Links

- [Google Gemini API Documentation](https://ai.google.dev/gemini-api/docs)
- [Vercel Documentation](https://vercel.com/docs)
- [React Documentation](https://react.dev/)
