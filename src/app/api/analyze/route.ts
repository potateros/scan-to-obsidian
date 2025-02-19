import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';

// Initialize Google Generative AI with API key
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { file, mimeType, image } = body;

    if (!process.env.GOOGLE_API_KEY) {
      return NextResponse.json(
        { error: 'Google API key not configured' },
        { status: 500 }
      );
    }

    // Handle both new file upload format and legacy image format
    const base64Data = file ? file.split(',')[1] : image ? image.split(',')[1] : null;
    if (!base64Data) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Initialize the model
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

    // Generate content from the file
    const result = await model.generateContent([
      {
        inlineData: {
          data: base64Data,
          mimeType: mimeType || 'image/jpeg', // Default to image/jpeg for legacy support
        },
      },
      mimeType === 'application/pdf'
        ? "Extract and format the content of this PDF into markdown format. Include headers, lists, and other markdown elements as appropriate to maintain the document's structure."
        : "Generate markdown from this image. If the image contains text, convert it to markdown format. If it's a diagram or picture, describe it in markdown format.",
    ]);

    const response = await result.response;
    const markdown = response.text();

    return NextResponse.json({ markdown });
  } catch (error) {
    console.error('Error analyzing file:', error);
    return NextResponse.json(
      { error: 'Failed to analyze file' },
      { status: 500 }
    );
  }
}

// Configure body size limit in Next.js config
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '20mb'
    }
  }
};
