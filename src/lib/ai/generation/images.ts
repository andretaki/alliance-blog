/**
 * Image Generation Module
 *
 * Uses Google's Gemini models for AI image generation:
 * - gemini-2.5-flash-image (Nano Banana) - Fast, efficient, 1024px
 * - gemini-3-pro-image-preview (Nano Banana Pro) - Advanced, up to 4K, thinking mode
 */

import { GoogleGenAI } from '@google/genai';
import * as fs from 'fs';
import * as path from 'path';

// Image aspect ratios
export type AspectRatio = '1:1' | '2:3' | '3:2' | '3:4' | '4:3' | '4:5' | '5:4' | '9:16' | '16:9' | '21:9';

// Image resolution (for Pro model only)
export type ImageResolution = '1K' | '2K' | '4K';

// Model options
export type ImageModel = 'gemini-2.5-flash-image' | 'gemini-3-pro-image-preview';

export interface ImageGenerationOptions {
  /** The model to use */
  model?: ImageModel;
  /** Aspect ratio of the output image */
  aspectRatio?: AspectRatio;
  /** Resolution (Pro model only) */
  resolution?: ImageResolution;
  /** Whether to return only the image (no text) */
  imageOnly?: boolean;
}

export interface GeneratedImage {
  /** Base64 encoded image data */
  data: string;
  /** MIME type of the image (from API response) */
  mimeType: string;
  /** Any accompanying text from the model */
  text?: string;
}

/**
 * Get Google API key from environment
 * @throws Error if GOOGLE_API_KEY is not set
 */
function getApiKey(): string {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GOOGLE_API_KEY is not configured. ' +
      'Please set it in your .env.local file.'
    );
  }
  return apiKey;
}

/**
 * Initialize the Google GenAI client
 */
function getClient(): GoogleGenAI {
  return new GoogleGenAI({ apiKey: getApiKey() });
}

/**
 * Parse image and text from API response using candidates[0].content.parts pattern
 */
function parseResponse(response: unknown): { imageData?: string; mimeType?: string; text?: string } {
  let imageData: string | undefined;
  let mimeType: string | undefined;
  let text: string | undefined;

  // Type guard for response structure
  const resp = response as {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          text?: string;
          inlineData?: {
            data?: string;
            mimeType?: string;
          };
        }>;
      };
    }>;
  };

  if (resp.candidates?.[0]?.content?.parts) {
    for (const part of resp.candidates[0].content.parts) {
      if (part.inlineData?.data) {
        imageData = part.inlineData.data;
        mimeType = part.inlineData.mimeType || 'image/png';
      }
      if (part.text) {
        text = text ? `${text}\n${part.text}` : part.text;
      }
    }
  }

  return { imageData, mimeType, text };
}

/**
 * Generate an image from a text prompt
 */
export async function generateImage(
  prompt: string,
  options: ImageGenerationOptions = {}
): Promise<GeneratedImage> {
  const {
    model = 'gemini-2.5-flash-image',
    aspectRatio = '16:9',
    resolution = '1K',
    imageOnly = false,
  } = options;

  const client = getClient();

  // Build config object
  const config: Record<string, unknown> = {
    responseModalities: imageOnly ? ['IMAGE'] : ['TEXT', 'IMAGE'],
  };

  // Add image config based on model
  if (model === 'gemini-3-pro-image-preview') {
    config.imageConfig = {
      aspectRatio,
      imageSize: resolution,
    };
  } else {
    config.imageConfig = {
      aspectRatio,
    };
  }

  const response = await client.models.generateContent({
    model,
    contents: prompt,
    config,
  });

  // Parse response using candidates[0].content.parts pattern
  const { imageData, mimeType, text } = parseResponse(response);

  if (!imageData) {
    throw new Error(
      'No image was generated. The model may have blocked the request, ' +
      'returned text only, or the response format was unexpected.'
    );
  }

  return {
    data: imageData,
    mimeType: mimeType || 'image/png',
    text,
  };
}

/**
 * Generate an image and save it to a file
 */
export async function generateAndSaveImage(
  prompt: string,
  outputPath: string,
  options: ImageGenerationOptions = {}
): Promise<{ filePath: string; text?: string }> {
  const result = await generateImage(prompt, options);

  // Ensure directory exists
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Decode base64 and write to file
  const imageBuffer = Buffer.from(result.data, 'base64');
  fs.writeFileSync(outputPath, imageBuffer);

  return {
    filePath: outputPath,
    text: result.text,
  };
}

/**
 * Generate a blog header image for an article
 */
export async function generateBlogHeaderImage(
  articleTitle: string,
  articleSummary: string,
  options: {
    style?: 'photorealistic' | 'illustration' | 'infographic' | 'minimalist';
    aspectRatio?: AspectRatio;
    model?: ImageModel;
  } = {}
): Promise<GeneratedImage> {
  const {
    style = 'photorealistic',
    aspectRatio = '16:9',
    model = 'gemini-2.5-flash-image',
  } = options;

  // Build style-specific prompt
  let stylePrompt: string;
  switch (style) {
    case 'photorealistic':
      stylePrompt = `A photorealistic, high-quality image suitable for a professional blog header.
        The image should be visually striking with excellent lighting and composition.
        Clean, professional look with significant negative space for potential text overlay.`;
      break;
    case 'illustration':
      stylePrompt = `A modern, stylized illustration suitable for a professional blog header.
        Clean lines, vibrant but professional colors, contemporary design aesthetic.
        The style should be polished and suitable for a B2B chemical company.`;
      break;
    case 'infographic':
      stylePrompt = `A clean, informative infographic-style image suitable for a blog header.
        Use icons, simple graphics, and clear visual hierarchy.
        Professional color palette, easy to understand at a glance.`;
      break;
    case 'minimalist':
      stylePrompt = `A minimalist, elegant composition suitable for a professional blog header.
        Significant negative space, subtle color palette, clean and modern.
        Focus on a single key visual element related to the topic.`;
      break;
  }

  const prompt = `Create a blog header image for an article titled "${articleTitle}".

Article summary: ${articleSummary}

${stylePrompt}

Important requirements:
- No text in the image (text will be added separately)
- Professional quality suitable for a B2B industrial chemical company
- Safe for work, no controversial imagery
- High contrast and visual impact
- Aspect ratio: ${aspectRatio}`;

  return generateImage(prompt, {
    model,
    aspectRatio,
    imageOnly: true,
  });
}

/**
 * Generate a product-focused image for chemical/industrial content
 */
export async function generateProductImage(
  productName: string,
  productDescription: string,
  useCase: string,
  options: ImageGenerationOptions = {}
): Promise<GeneratedImage> {
  const prompt = `A high-resolution, studio-lit product photograph showing the industrial/chemical product "${productName}" in a professional setting.

Product description: ${productDescription}
Use case context: ${useCase}

Requirements:
- Professional product photography style
- Clean white or gradient background
- Proper safety context (appropriate containers, labels visible if applicable)
- High-quality lighting that shows product details
- No people in the image
- Safe, professional representation suitable for B2B marketing`;

  return generateImage(prompt, {
    model: options.model || 'gemini-2.5-flash-image',
    aspectRatio: options.aspectRatio || '4:3',
    imageOnly: true,
  });
}

/**
 * Edit an existing image with a text prompt
 */
export async function editImage(
  imagePath: string,
  editPrompt: string,
  options: ImageGenerationOptions = {}
): Promise<GeneratedImage> {
  const {
    model = 'gemini-2.5-flash-image',
    aspectRatio = '16:9',
  } = options;

  // Validate file exists and is readable
  if (!fs.existsSync(imagePath)) {
    throw new Error(`Image file not found: ${imagePath}`);
  }

  const imageBuffer = fs.readFileSync(imagePath);
  const imageBase64 = imageBuffer.toString('base64');

  // Determine mime type from file extension
  const ext = path.extname(imagePath).toLowerCase();
  const mimeTypeMap: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
  };
  const inputMimeType = mimeTypeMap[ext] || 'image/png';

  const client = getClient();

  const response = await client.models.generateContent({
    model,
    contents: [
      {
        role: 'user',
        parts: [
          { text: editPrompt },
          {
            inlineData: {
              mimeType: inputMimeType,
              data: imageBase64,
            },
          },
        ],
      },
    ],
    config: {
      responseModalities: ['TEXT', 'IMAGE'],
      imageConfig: {
        aspectRatio,
      },
    },
  });

  const { imageData, mimeType, text } = parseResponse(response);

  if (!imageData) {
    throw new Error(
      'No image was generated from the edit request. ' +
      'The model may have blocked the request or returned text only.'
    );
  }

  return {
    data: imageData,
    mimeType: mimeType || 'image/png',
    text,
  };
}

/**
 * Create a multi-turn image generation chat session
 */
export async function createImageChat(model: ImageModel = 'gemini-3-pro-image-preview') {
  const client = getClient();

  return client.chats.create({
    model,
    config: {
      responseModalities: ['TEXT', 'IMAGE'],
    },
  });
}
