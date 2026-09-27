import fs from 'fs';
import { GoogleGenAI } from '@google/genai';

export interface VLMAnalysisResult {
  category: string;
  severity_score: number; // 1 to 10
  confidence_score: number; // 0 to 1
  recommended_action: string;
  model_name: string;
  gpu_type: string;
  latency_ms: number;
  mock: boolean;
}

// Fallback heuristic classification when Brev endpoint is not configured or unreachable
function generateMockClassification(
  text: string,
  hasImage: boolean
): { category: string; severity_score: number; confidence_score: number; recommended_action: string } {
  const lower = text.toLowerCase();

  let category = 'General Public Infrastructure';
  let severity = 5;
  let confidence = hasImage ? 0.82 : 0.48; // lower certainty without image as required by spec
  let action = 'Schedule standard municipal inspection within 5 business days.';

  if (lower.includes('sinkhole') || lower.includes('collapsed') || lower.includes('hazard') || lower.includes('emergency')) {
    category = 'Road Hazards & Sinkholes';
    severity = 9;
    confidence = hasImage ? 0.94 : 0.55;
    action = 'Emergency road closure and immediate public works structural triage.';
  } else if (lower.includes('pothole') || lower.includes('asphalt') || lower.includes('crater') || lower.includes('bump')) {
    category = 'Roads & Pavement';
    severity = 7;
    confidence = hasImage ? 0.88 : 0.50;
    action = 'Dispatch road maintenance crew for cold-mix or hot-mix asphalt patching.';
  } else if (lower.includes('flood') || lower.includes('drain') || lower.includes('water') || lower.includes('sewer') || lower.includes('pipe')) {
    category = 'Water & Stormwater Drainage';
    severity = 8;
    confidence = hasImage ? 0.91 : 0.52;
    action = 'Deploy vacuum truck to clear blocked storm basin and check storm main.';
  } else if (lower.includes('wire') || lower.includes('cable') || lower.includes('power') || lower.includes('electric') || lower.includes('spark')) {
    category = 'Electrical & Power Grid';
    severity = 10;
    confidence = hasImage ? 0.96 : 0.58;
    action = 'Urgent: dispatch utility crew to secure live electrical hazard and cordon perimeter.';
  } else if (lower.includes('light') || lower.includes('dark') || lower.includes('lamp') || lower.includes('pole')) {
    category = 'Street Lighting';
    severity = 4;
    confidence = hasImage ? 0.85 : 0.50;
    action = 'Assign technician to replace LED fixture or repair photocell sensor.';
  } else if (lower.includes('sidewalk') || lower.includes('trip') || lower.includes('curb') || lower.includes('concrete')) {
    category = 'Sidewalks & Pedestrian Access';
    severity = 6;
    confidence = hasImage ? 0.84 : 0.50;
    action = 'Grind down uneven concrete slab or schedule ADA ramp resurfacing.';
  } else if (lower.includes('trash') || lower.includes('dump') || lower.includes('debris') || lower.includes('litter')) {
    category = 'Sanitation & Illegal Dumping';
    severity = 5;
    confidence = hasImage ? 0.89 : 0.50;
    action = 'Dispatch sanitation waste truck for bulk debris cleanup.';
  }

  return {
    category,
    severity_score: severity,
    confidence_score: confidence,
    recommended_action: action,
  };
}

export async function classifyReportWithVLM(params: {
  photoPath: string | null;
  transcript: string;
  location: string;
}): Promise<VLMAnalysisResult> {
  const { photoPath, transcript, location } = params;
  const brevEndpoint = process.env.BREV_MODEL_ENDPOINT?.trim();
  const brevApiKey = process.env.BREV_API_KEY?.trim();

  let imageB64: string | null = null;
  if (photoPath && fs.existsSync(photoPath)) {
    try {
      const buffer = fs.readFileSync(photoPath);
      imageB64 = buffer.toString('base64');
    } catch (e) {
      console.warn('Could not read image file for VLM base64:', e);
    }
  }

  // If Brev endpoint is provided, attempt the call
  if (brevEndpoint) {
    const startTime = Date.now();
    const cleanEndpoint = brevEndpoint.replace(/\/+$/, '');
    const url = cleanEndpoint.endsWith('/v1')
      ? `${cleanEndpoint}/chat/completions`
      : cleanEndpoint.endsWith('/chat/completions')
      ? cleanEndpoint
      : `${cleanEndpoint}/v1/chat/completions`;

    // Build prompt according to spec
    let promptText: string;
    if (imageB64) {
      promptText =
        'You are reviewing a citizen report of a civic infrastructure problem. ' +
        'Here is a photo, a voice transcript, and a location. ' +
        `Transcript: ${transcript || 'None provided'}. Location: ${location}. ` +
        'Respond only with JSON in this exact shape: ' +
        '{"category": string, "severity_score": integer 1 to 10, "confidence_score": float 0 to 1, "recommended_action": string}.';
    } else {
      promptText =
        'You are reviewing a citizen report of a civic infrastructure problem. ' +
        'No image is available. Reason from text and location alone, and treat severity and confidence as lower certainty. ' +
        `Transcript: ${transcript || 'None provided'}. Location: ${location}. ` +
        'Respond only with JSON in this exact shape: ' +
        '{"category": string, "severity_score": integer 1 to 10, "confidence_score": float 0 to 1, "recommended_action": string}.';
    }

    const messagesContent: any[] = [{ type: 'text', text: promptText }];
    if (imageB64) {
      messagesContent.push({
        type: 'image_url',
        image_url: { url: `data:image/jpeg;base64,${imageB64}` },
      });
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (brevApiKey) {
      headers['Authorization'] = `Bearer ${brevApiKey}`;
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: 'nvidia/llama-3.1-nemotron-nano-vl-8b-v1',
          messages: [{ role: 'user', content: messagesContent }],
          temperature: 0.1,
        }),
      });

      const latencyMs = Date.now() - startTime;

      if (response.ok) {
        const json = await response.json();
        const content = json.choices?.[0]?.message?.content || '';
        const returnedModel = json.model || 'nvidia/llama-3.1-nemotron-nano-vl-8b-v1';
        
        // Extract GPU info if provided by headers or Brev runtime
        const gpuHeader = response.headers.get('x-gpu-type') || 
                          response.headers.get('x-compute-type') || 
                          process.env.BREV_GPU_TYPE || 
                          'L40S';

        // Parse JSON from result
        let parsed: any = null;
        try {
          const match = content.match(/\{[\s\S]*\}/);
          if (match) {
            parsed = JSON.parse(match[0]);
          } else {
            parsed = JSON.parse(content);
          }
        } catch {
          // Retry once with stricter instruction per spec:
          // "If parsing fails, retry once with a stricter instruction to return JSON only,
          // since VLMs occasionally add prose around the object."
          try {
            const retryResponse = await fetch(url, {
              method: 'POST',
              headers,
              body: JSON.stringify({
                model: 'nvidia/llama-3.1-nemotron-nano-vl-8b-v1',
                messages: [
                  { role: 'user', content: messagesContent },
                  { role: 'assistant', content },
                  {
                    role: 'user',
                    content: 'CRITICAL: Output raw valid JSON ONLY. No markdown, no commentary, no intro: {"category": string, "severity_score": number, "confidence_score": number, "recommended_action": string}',
                  },
                ],
              }),
            });
            if (retryResponse.ok) {
              const retryJson = await retryResponse.json();
              const retryContent = retryJson.choices?.[0]?.message?.content || '';
              const retryMatch = retryContent.match(/\{[\s\S]*\}/);
              parsed = JSON.parse(retryMatch ? retryMatch[0] : retryContent);
            }
          } catch (retryErr) {
            console.warn('Retry parsing failed:', retryErr);
          }
        }

        if (parsed && typeof parsed.severity_score === 'number') {
          return {
            category: parsed.category || 'General Municipal',
            severity_score: Math.min(10, Math.max(1, Math.round(parsed.severity_score))),
            confidence_score: Math.min(1.0, Math.max(0.1, Number(parsed.confidence_score) || 0.85)),
            recommended_action: parsed.recommended_action || 'Inspect and schedule municipal repair.',
            model_name: returnedModel,
            gpu_type: gpuHeader,
            latency_ms: latencyMs,
            mock: false,
          };
        }
      } else {
        console.warn(`Brev endpoint returned status ${response.status}: ${await response.text().catch(() => '')}`);
      }
    } catch (brevErr) {
      console.warn('Failed to connect to BREV_MODEL_ENDPOINT, falling back to mock per instructions:', brevErr);
    }
  }

  // Fallback mock per instructions:
  // "If BREV_MODEL_ENDPOINT is unset or unreachable, the backend should return a clearly labeled
  // mock response instead of failing, for example category 'Roads', severity_score 5, confidence_score 0.5,
  // with a mock true flag included in the response so it is never mistaken for a real result."
  const simulatedLatency = Math.floor(Math.random() * 120) + 180;
  const mockClass = generateMockClassification(transcript, Boolean(imageB64));

  return {
    category: mockClass.category,
    severity_score: mockClass.severity_score,
    confidence_score: mockClass.confidence_score,
    recommended_action: mockClass.recommended_action,
    model_name: 'nvidia/llama-3.1-nemotron-nano-vl-8b-v1 (fallback mock)',
    gpu_type: 'L40S (simulated)',
    latency_ms: simulatedLatency,
    mock: true,
  };
}

export async function transcribeAudioFile(audioPath: string, mimeType: string): Promise<string> {
  if (!fs.existsSync(audioPath)) {
    return '';
  }

  // Attempt transcription using Google Gemini API if key is available
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) {
    try {
      const ai = new GoogleGenAI();
      const audioBuffer = fs.readFileSync(audioPath);
      const audioB64 = audioBuffer.toString('base64');

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType: mimeType || 'audio/webm',
                  data: audioB64,
                },
              },
              {
                text: 'Please provide an exact, clean verbatim transcription of this citizen voice note reporting a civic problem. Return ONLY the transcribed text. Do not add explanations, formatting labels, or timestamps.',
              },
            ],
          },
        ],
      });

      const text = response.text?.trim();
      if (text) {
        return text;
      }
    } catch (err) {
      console.warn('Gemini audio transcription failed or rate-limited:', err);
    }
  }

  return '';
}
