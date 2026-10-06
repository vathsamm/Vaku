export const CAPTION_FONTS = [
  { id: 'TikTokSans', name: 'TikTok Sans', family: "'TikTok Sans', 'Proxima Nova', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", weight: '700', label: 'TikTok Classic (Default)' },
  { id: 'System', name: 'Normal / Standard', family: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif", weight: '400', label: 'Standard Normal' },
  { id: 'Arial', name: 'Arial / Helvetica', family: "Arial, Helvetica, sans-serif", weight: '400', label: 'Classic Standard' },
  { id: 'Montserrat', name: 'Montserrat', family: "'Montserrat', sans-serif", weight: '700', label: 'Heavy Sans' },
  { id: 'Poppins', name: 'Poppins', family: "'Poppins', sans-serif", weight: '700', label: 'Clean Bold' },
  { id: 'Rubik', name: 'Rubik', family: "'Rubik', sans-serif", weight: '700', label: 'Rounded Sans' },
  { id: 'Anton', name: 'Anton', family: "'Anton', sans-serif", weight: '400', label: 'Impact Punch' },
];

export const CAPTION_TEXT_COLORS = [
  { name: 'White', hex: '#ffffff', bg: 'bg-white', border: 'border-gray-300' }
];

// Subtle palette shades for sequential captions in Track 2 (identifies cuts with cohesive colors)
export const CAPTION_PALETTES = [
  { bg: 'bg-[#581c87]/90 hover:bg-[#6b21a8]', border: 'border-[#9333ea]/80 hover:border-[#a855f7]', text: 'text-purple-100' }, // Deep Purple
  { bg: 'bg-[#312e81]/90 hover:bg-[#3730a3]', border: 'border-[#6366f1]/80 hover:border-[#818cf8]', text: 'text-indigo-100' }, // Deep Indigo
  { bg: 'bg-[#4c1d95]/90 hover:bg-[#5b21b6]', border: 'border-[#8b5cf6]/80 hover:border-[#a78bfa]', text: 'text-violet-100' }, // Electric Violet
  { bg: 'bg-[#701a75]/90 hover:bg-[#86198f]', border: 'border-[#d946ef]/80 hover:border-[#e879f9]', text: 'text-fuchsia-100' }, // Deep Fuchsia
  { bg: 'bg-[#1e1b4b]/90 hover:bg-[#2e1065]', border: 'border-[#7c3aed]/80 hover:border-[#8b5cf6]', text: 'text-purple-200' }, // Royal Midnight
];

export const CAPTION_STROKE_COLORS = [
  { name: 'Black', hex: '#000000', bg: 'bg-black', border: 'border-white/40' }
];

export const DEFAULT_TITLE_PROMPT = `You are a social-media video title and hashtag generator.

Whenever this prompt is executed, generate exactly ONE catchy, high-converting social-media title for the video, followed by 3 to 5 relevant, trending hashtags.

The title must:
- Be short, punchy, and curiosity-driven.
- Feel authentic and viral for TikTok, Instagram Reels, and YouTube Shorts.
- Match the visual vibe and energy of the video.
- Always end with 1 or 2 relevant emojis.
- Avoid clickbait deception, offensive, or misleading wording.

Hashtags:
- Use 3 to 5 relevant, trending hashtags.
- Ensure hashtags match the theme and genre of the content.

Output ONLY the title on the first line and the hashtags on the second line. No explanations, quotes, numbering, or extra text.`;

