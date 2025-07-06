import { pgTable, text, serial, integer, boolean, timestamp, json, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Site settings table for global configuration
export const siteSettings = pgTable("site_settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  description: text("description"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertSiteSettingSchema = createInsertSchema(siteSettings).omit({
  id: true,
  updatedAt: true,
});

// User model for admin authentication
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

// Dealership model to track dealer sources
export const dealerships = pgTable("dealerships", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  url: text("url").notNull().unique(), // Primary URL (still unique for backward compatibility)
  additionalUrls: json("additional_urls").notNull().$type<string[]>().default([]), // Array of additional inventory URLs
  zipCode: text("zip_code"), // Added zipCode field for location accuracy
  location: text("location"), // Stores formatted location (City, State)
  lastSynced: timestamp("last_synced"),
  status: text("status").notNull().default("active"), // active, inactive, error, etc.
  vehicleCount: integer("vehicle_count").notNull().default(0),
  expirationDate: timestamp("expiration_date"),
  isExpired: boolean("is_expired").notNull().default(false),
});

export const insertDealershipSchema = createInsertSchema(dealerships).pick({
  name: true,
  url: true,
  additionalUrls: true,
  zipCode: true,
  location: true,
});

// Vehicle model to store car listings
export const vehicles = pgTable("vehicles", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  year: integer("year").notNull(),
  make: text("make").notNull(),
  model: text("model").notNull(),
  price: integer("price").notNull(),
  mileage: integer("mileage").notNull(),
  vin: text("vin").notNull().unique(),
  location: text("location"),
  zipCode: text("zip_code"),
  dealershipId: integer("dealership_id").notNull(),
  images: json("images").notNull().$type<string[]>(),
  carfaxUrl: text("carfax_url"),
  contactUrl: text("contact_url"),
  originalListingUrl: text("original_listing_url").notNull(),
  sortOrder: integer("sort_order").default(0), // For random ordering of listings
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertVehicleSchema = createInsertSchema(vehicles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Vehicle search filter schema
export const vehicleFilterSchema = z.object({
  keyword: z.string().optional(),
  make: z.string().array().optional(),
  yearMin: z.number().optional(),
  yearMax: z.number().optional(),
  priceMin: z.number().optional(),
  priceMax: z.number().optional(),
  mileageMin: z.number().optional(),
  mileageMax: z.number().optional(),
  zipCode: z.string().optional(),
  location: z.string().optional(), // Added location filter for City, State combinations
  distance: z.number().optional(),
  dealershipId: z.number().optional(),
  sortBy: z.enum(['relevance', 'price_low', 'price_high', 'year_new', 'mileage_low']).optional(),
  page: z.number().optional().default(1),
  limit: z.number().optional().default(12)
});

// Type definitions
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertDealership = z.infer<typeof insertDealershipSchema>;
export type Dealership = typeof dealerships.$inferSelect;

export type InsertVehicle = z.infer<typeof insertVehicleSchema>;
export type Vehicle = typeof vehicles.$inferSelect;

// Contact clicks tracking table
export const contactClicks = pgTable("contact_clicks", {
  id: serial("id").primaryKey(),
  vehicleId: integer("vehicle_id").notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  clickType: text("click_type").notNull().default("contact"), // "contact" or "view"
});

export const insertContactClickSchema = createInsertSchema(contactClicks).omit({
  id: true,
  timestamp: true,
});

export type InsertContactClick = z.infer<typeof insertContactClickSchema>;
export type ContactClick = typeof contactClicks.$inferSelect;
export type VehicleFilter = z.infer<typeof vehicleFilterSchema> & {
  _forceReset?: boolean;
  zipMatchPriority?: any; // Internal property used for ZIP code sorting
};

export type InsertSiteSetting = z.infer<typeof insertSiteSettingSchema>;
export type SiteSetting = typeof siteSettings.$inferSelect;
