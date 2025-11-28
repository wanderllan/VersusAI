
import { GoogleGenAI } from "@google/genai";
import { AnalysisResult, ComparisonData } from "../types";

// Inicializa o cliente com a chave da API do ambiente
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const MODEL_NAME = 'gemini-2.5-flash';

export const compareProducts = async (query: string): Promise<AnalysisResult> => {
  try {
    const prompt = `
      Você é um especialista em análise de produtos e serviços.
      O usuário quer comparar: "${query}".
      
      IMPORTANTE: Identifique quantos produtos/serviços estão sendo comparados (pode ser 2, 3, 4 ou mais).
      
      Sua tarefa:
      1. Pesquise informações ATUAIS na web.
      2. Gere uma comparação estruturada para TODOS os itens identificados.
      3. Identifique as "Diferenças Chave" (Key Differences) que realmente impactam a decisão de compra na tabela comparativa.
      4. Crie 4 "Personas" (Perfis de usuário) específicos para essa categoria.
      5. Calcule um "Nível de Rivalidade" (0 a 100).
      6. Gere dados simulados de "Tendência de Busca" (searchTrend) dos últimos 6 meses (0-100) para mostrar a popularidade da categoria.
      
      Ícones disponíveis para personas: "gamepad", "student", "briefcase", "wallet", "camera", "heart", "zap", "star", "music", "home".
      
      Retorne a resposta EXATAMENTE no seguinte formato JSON:
      
      {
        "products": [
          {
            "name": "Nome Curto Produto 1",
            "priceEstimate": "Preço R$",
            "pros": ["Pro 1", "Pro 2"],
            "cons": ["Contra 1"]
          },
          ...
        ],
        "summary": "Resumo comparativo dos itens.",
        "verdict": "Veredito final detalhado.",
        "rivalryScore": 85, // Inteiro de 0 a 100
        "rivalryText": "Texto curto sobre a rivalidade.",
        "searchTrend": [
           { "month": "Jan", "value": 45 },
           { "month": "Fev", "value": 50 },
           ... (6 meses recentes)
        ],
        "personas": [
          { 
            "id": "p1", 
            "label": "Nome do Perfil", 
            "description": "Descrição curta",
            "icon": "gamepad" 
          },
          ... (Total 4)
        ],
        "suggestedPersona": "p1", // ID da persona sugerida
        "comparisonTable": [
          { 
            "feature": "Característica (ex: Tela)", 
            "values": ["Valor Prod 1", "Valor Prod 2", ...], 
            "winnerIndex": 0,
            "isKeyDifference": true // true se for um fator decisivo/importante, false caso contrário
          }
        ],
        "scores": [
          { "subject": "Desempenho", "prod0": 90, "prod1": 85, "fullMark": 100 },
          ...
        ]
      }
    `;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    // Processar Grounding (Fontes)
    const sources: { title: string; uri: string }[] = [];
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    
    if (groundingChunks) {
      groundingChunks.forEach((chunk: any) => {
        if (chunk.web) {
          sources.push({
            title: chunk.web.title || "Fonte Web",
            uri: chunk.web.uri
          });
        }
      });
    }

    const text = response.text || "";
    
    // Tentar extrair o JSON do texto
    let jsonData: ComparisonData | null = null;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonData = JSON.parse(jsonMatch[0]);
      } else {
        console.warn("Nenhum JSON encontrado na resposta. Retornando texto bruto.");
      }
    } catch (e) {
      console.error("Erro ao fazer parse do JSON:", e);
    }

    return {
      data: jsonData,
      sources: sources,
      rawText: !jsonData ? text : undefined,
      query: query,
      timestamp: Date.now()
    };

  } catch (error) {
    console.error("Erro na API Gemini:", error);
    throw error;
  }
};

export const refineComparison = async (originalContext: ComparisonData, userQuestion: string): Promise<string> => {
  try {
    const contextString = JSON.stringify(originalContext);
    const prompt = `
      Contexto da Comparação (JSON): ${contextString}

      Pergunta do usuário sobre essa comparação: "${userQuestion}"

      Responda de forma direta, útil e conversacional.
    `;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
    });

    return response.text || "Desculpe, não consegui processar essa pergunta.";
  } catch (error) {
    console.error("Erro ao refinar:", error);
    return "Ocorreu um erro ao tentar responder sua pergunta.";
  }
}

export const getPersonaAnalysis = async (context: ComparisonData, personaLabel: string): Promise<{winner: string, reason: string}> => {
  try {
    const contextString = JSON.stringify(context);
    const prompt = `
      Contexto da Comparação (JSON): ${contextString}
      
      O usuário se identifica como: "${personaLabel}".
      
      Analise os produtos listados e determine qual é a MELHOR escolha para esse perfil ESPECÍFICO.
      Seja direto.
      
      Retorne APENAS um JSON:
      {
        "winner": "Nome do produto vencedor",
        "reason": "Explicação curta (max 2 frases)."
      }
    `;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
    });

    const text = response.text || "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return { winner: "Indeterminado", reason: text };
  } catch (error) {
    console.error("Erro na análise de persona:", error);
    throw error;
  }
}
