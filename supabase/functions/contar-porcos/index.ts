// Edge Function: recebe uma foto (base64) e usa a API do Google Gemini
// (com visão) pra contar quantos suínos aparecem nela. A chave da Google
// fica só aqui no servidor (variável de ambiente GOOGLE_API_KEY), nunca
// no app.

const GOOGLE_API_KEY = Deno.env.get('GOOGLE_API_KEY');
const GEMINI_MODEL = 'gemini-2.5-flash';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const PROMPT = `Você é um sistema de contagem de suínos em fotos de galpões de terminação.
Olhe a imagem e conte quantos suínos (porcos) individuais conseguem ser identificados.
Responda ESTRITAMENTE em JSON, sem nenhum texto antes ou depois, no formato:
{"quantidade": <número inteiro de suínos contados>, "confianca": <número de 0 a 1 indicando sua confiança na contagem>}`;

function extrairJson(texto: string): { quantidade: number; confianca: number } {
  const semCercas = texto.replace(/```json|```/g, '').trim();
  const parsed = JSON.parse(semCercas);
  const quantidade = Math.round(Number(parsed.quantidade));
  const confianca = Number(parsed.confianca);
  if (!Number.isFinite(quantidade) || quantidade < 0) {
    throw new Error('Quantidade inválida retornada pela IA');
  }
  return {
    quantidade,
    confianca: Number.isFinite(confianca) ? Math.min(Math.max(confianca, 0), 1) : 0,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (!GOOGLE_API_KEY) {
    return new Response(JSON.stringify({ error: 'GOOGLE_API_KEY não configurada' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { imageBase64 } = await req.json();
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      throw new Error('imageBase64 é obrigatório');
    }

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: 'POST',
        headers: {
          'x-goog-api-key': GOOGLE_API_KEY,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                { inline_data: { mime_type: 'image/jpeg', data: imageBase64 } },
                { text: PROMPT },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
          },
        }),
      }
    );

    if (!geminiResponse.ok) {
      const detalhe = await geminiResponse.text();
      throw new Error(`Gemini API: ${geminiResponse.status} ${detalhe}`);
    }

    const data = await geminiResponse.json();
    const texto = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    const resultado = extrairJson(texto);

    return new Response(JSON.stringify(resultado), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err instanceof Error ? err.message : err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
