import { z } from "zod";

/**
 * Schémas de validation partagés client ↔ serveur.
 *
 * Le même schéma valide le formulaire dans le navigateur (retour immédiat pour
 * le visiteur) et l'action serveur (protection réelle). La validation client
 * n'est qu'un confort : c'est toujours celle du serveur qui décide, et la base
 * revalide encore derrière elle dans les fonctions SQL. Trois filets, un seul
 * jeu de règles à maintenir.
 */

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Format de date attendu : AAAA-MM-JJ");

export const contactSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  subject: z.string().trim().max(160).optional().or(z.literal("")),
  message: z.string().trim().min(10).max(4000),
  locale: z.enum(["fr", "en"]).default("fr"),
});

export type ContactInput = z.infer<typeof contactSchema>;

export const staySearchSchema = z
  .object({
    checkIn: isoDate,
    checkOut: isoDate,
    adults: z.coerce.number().int().min(1).max(6),
    children: z.coerce.number().int().min(0).max(4),
  })
  .refine((v) => v.checkOut > v.checkIn, {
    message: "La date de départ doit suivre la date d'arrivée",
    path: ["checkOut"],
  });

export type StaySearchInput = z.infer<typeof staySearchSchema>;

export const guestDetailsSchema = z.object({
  roomTypeId: z.string().uuid(),
  checkIn: isoDate,
  checkOut: isoDate,
  adults: z.coerce.number().int().min(1).max(6),
  children: z.coerce.number().int().min(0).max(4),
  firstName: z.string().trim().min(2).max(80),
  lastName: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(200),
  // Volontairement permissif : les formats de numéros varient beaucoup entre
  // la Côte d'Ivoire et l'international (CDC §2.1). On vérifie qu'il y a
  // assez de chiffres pour être joignable, pas la conformité à un plan de
  // numérotation — un refus injustifié ici coûte une réservation.
  phone: z
    .string()
    .trim()
    .min(8)
    .max(30)
    .refine((v) => (v.match(/\d/g) ?? []).length >= 8, {
      message: "Numéro de téléphone incomplet",
    }),
  country: z.string().trim().max(80).optional().or(z.literal("")),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
  locale: z.enum(["fr", "en"]).default("fr"),
  acceptTerms: z.literal(true),
});

export type GuestDetailsInput = z.infer<typeof guestDetailsSchema>;
