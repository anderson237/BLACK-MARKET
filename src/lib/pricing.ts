import { EUR_PER_RMB, RMB_TO_XOF_RATE, SHIPPING_EUR, SHIPPING_XOF, XOF_PER_EUR } from "./constants";
import { WebhookConfig } from "../types";

export function estimatePrices(rmb: number, markup: number): { priceEur: number; priceXof: number } {
  const rate = 1 + (markup || 0) / 100;
  const costEur = rmb * EUR_PER_RMB * rate;
  const costXof = rmb * RMB_TO_XOF_RATE * rate;
  return {
    priceEur: Math.round(costEur + SHIPPING_EUR),
    priceXof: Math.round(costXof + SHIPPING_XOF),
  };
}

export function formatPrice(priceEur: number, priceXof: number, currency: "EUR" | "XOF"): string {
  if (currency === "EUR") return `${priceEur} €`;
  return `${Number(priceXof || Math.round((priceEur * XOF_PER_EUR) / 100) * 100).toLocaleString("fr-FR")} F CFA`;
}

export function formatPriceForConfig(product: { priceEur: number; priceXof: number }, config: WebhookConfig): string {
  return formatPrice(product.priceEur, product.priceXof, config.currency);
}
