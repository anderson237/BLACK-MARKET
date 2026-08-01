// Regenerates all INITIAL_PRODUCTS fiches through the real Gemini API,
// using the original Chinese descriptions (Taobao/1688 style listings).
// Writes the results into src/data.ts and data/products.json.
//
// Run: npx tsx scripts/regenerate.ts
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { GoogleGenAI, Type } from "@google/genai";
import { INITIAL_PRODUCTS, CATEGORIES } from "../src/data";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("GEMINI_API_KEY manquante dans .env");
  process.exit(1);
}
const primaryModel = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const fallbackModel = process.env.GEMINI_FALLBACK_MODEL || "gemini-2.5-flash-lite";
const MARKUP = 60;

const ai = new GoogleGenAI({ apiKey });

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    translatedTitle: { type: Type.STRING, description: "Titre commercial accrocheur et élégant en Français." },
    translatedDescription: { type: Type.STRING, description: "Traduction claire et fidèle des détails/spécificités d'origine en Français." },
    salesPitch: { type: Type.STRING, description: "Argumentaire de vente premium en Français (copywriting e-commerce, ton cyberpunk coréen, orienté bénéfices)." },
    features: { type: Type.ARRAY, items: { type: Type.STRING }, description: "5 caractéristiques techniques clés du produit, courtes et percutantes." },
    priceEur: { type: Type.NUMBER, description: "Prix de vente public suggéré en Euros." },
    priceXof: { type: Type.NUMBER, description: "Prix de vente public suggéré en Francs CFA (XOF)." },
    priceExplanation: { type: Type.STRING, description: "Explication courte du calcul de prix." },
  },
  required: ["translatedTitle", "translatedDescription", "salesPitch", "features", "priceEur", "priceXof"],
};

async function generateFiche(product: any): Promise<any> {
  const prompt = `Tu es un copywriter d'élite et expert en sourcing de produits en Chine (Taobao/1688/WeChat).
Voici la fiche brute d'un fournisseur chinois :
- Titre chinois : "${product.chineseTitle}"
- Description chinoise : "${product.chineseDescription}"
- Prix d'achat en RMB : ${product.sourceRmb} yuan

Fais le travail suivant :
1. Traduis fidèlement la description du chinois vers un français clair et précis.
2. Crée un titre commercial accrocheur en français, adapté au marché francophone/africain, style streetwear coréen cyberpunk.
3. Rédige un argumentaire de vente premium en français (3 à 4 phrases, orienté bénéfices, enthousiaste mais crédible).
4. Extrais exactement 5 caractéristiques techniques clés, courtes et percutantes.
5. Calcule les prix de vente : convertis ${product.sourceRmb} RMB (1 RMB ≈ 85 XOF ≈ 0.13 EUR), applique une marge de ${MARKUP}% et ajoute les frais d'envoi (5-10€ / 3000-6000 XOF). Arrondis le prix XOF au 500 supérieur et le prix EUR à l'entier.`;

  const models = [primaryModel, fallbackModel];
  let lastError: any = null;

  for (const model of models) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: [{ text: prompt }],
          config: {
            systemInstruction: "Tu es un assistant de commerce international spécialisé dans le sourcing Chine et le copywriting e-commerce de précommande.",
            temperature: 0.7,
            responseMimeType: "application/json",
            responseSchema,
          },
        });
        const text = response.text || "{}";
        const json = JSON.parse(text);
        return {
          ...json,
          translatedTitle: String(json.translatedTitle || ""),
          translatedDescription: String(json.translatedDescription || ""),
          salesPitch: String(json.salesPitch || ""),
          features: Array.isArray(json.features) ? json.features.slice(0, 8).map(String) : [],
          priceEur: Number(json.priceEur) || 0,
          priceXof: Number(json.priceXof) || 0,
        };
      } catch (err: any) {
        lastError = err;
        const msg = JSON.stringify(err) + " " + (err.message || "");
        const isTemp = msg.includes("503") || msg.includes("UNAVAILABLE") || err.status === 503;
        if (isTemp) {
          await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
          continue;
        }
        break; // non-temp error: try next model
      }
    }
  }
  throw lastError || new Error("Échec de génération pour " + product.id);
}

function estimatePrices(rmb: number): { priceEur: number; priceXof: number } {
  const rate = 1 + MARKUP / 100;
  return {
    priceEur: Math.round(rmb * 0.13 * rate + 5),
    priceXof: Math.round(rmb * 85 * rate + 3500),
  };
}

async function main() {
  console.log(`Régénération de ${INITIAL_PRODUCTS.length} fiches via Gemini (${primaryModel})...`);

  const regenerated: any[] = [];

  for (const p of INITIAL_PRODUCTS) {
    process.stdout.write(`[${regenerated.length + 1}/${INITIAL_PRODUCTS.length}] ${p.id} (${p.chineseTitle?.slice(0, 18)}...) ... `);
    try {
      const ai = await generateFiche(p);
      const fallback = estimatePrices(p.sourceRmb || 0);
      const full = {
        id: p.id,
        title: ai.translatedTitle || p.title,
        chineseTitle: p.chineseTitle || "",
        chineseDescription: p.chineseDescription || "",
        description: ai.salesPitch || ai.translatedDescription || p.description,
        originalDescription: ai.translatedDescription || p.originalDescription || "",
        features: ai.features && ai.features.length ? ai.features : p.features,
        priceEur: ai.priceEur || fallback.priceEur,
        priceXof: ai.priceXof || fallback.priceXof,
        imageUrl: p.imageUrl,
        category: p.category,
        whatsappClicks: p.whatsappClicks || 0,
        sourceRmb: p.sourceRmb,
        createdAt: p.createdAt,
      };
      regenerated.push(full);
      console.log(`OK — ${full.title.slice(0, 45)} | ${full.priceEur}€ / ${full.priceXof} XOF`);
    } catch (err: any) {
      console.error(`ÉCHEC — ${err.message}`);
      regenerated.push(p); // keep original on failure
    }
    await new Promise((r) => setTimeout(r, 700)); // gentle pacing
  }

  // Write server data (public catalog source)
  const dataDir = path.resolve(process.cwd(), "data");
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, "products.json"), JSON.stringify(regenerated, null, 2), "utf-8");

  // Regenerate src/data.ts (keeps the same shape/imports)
  const json = JSON.stringify(regenerated, null, 2);
  const dataTs =
    `import { Product } from "./types";\n\n` +
    `export const INITIAL_PRODUCTS: Product[] = ${json};\n\n` +
    `export const CATEGORIES = ${JSON.stringify(CATEGORIES)};\n`;
  fs.writeFileSync(path.resolve(process.cwd(), "src/data.ts"), dataTs, "utf-8");

  console.log(`\nTerminé : ${regenerated.length} fiches écrites dans src/data.ts et data/products.json.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
