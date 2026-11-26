import { z } from "zod";

export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export const planSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(100, "Title is too long"),
  deadline: z
    .string()
    .refine((v) => !isNaN(Date.parse(v)), "Invalid deadline date")
    .refine(
      (v) => new Date(v).getTime() >= Date.now() - 24 * 60 * 60 * 1000,
      "Deadline cannot be in the past",
    ),
  studyDays: z.array(z.enum(DAYS)).min(1, "Pick at least one study day"),
  hoursPerDay: z
    .number({ message: "Hours per day must be a number" })
    .min(0.5, "At least 0.5 hours per day")
    .max(16, "At most 16 hours per day"),
});

export const planUpdateSchema = planSchema.partial();

export const subjectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Subject name is required")
    .max(100, "Name is too long"),
  deadline: z
    .string()
    .nullable()
    .optional()
    .refine((v) => !v || !isNaN(Date.parse(v)), "Invalid subject deadline"),
});

export const subjectUpdateSchema = subjectSchema.partial();

export const outcomeSchema = z.object({
  description: z
    .string()
    .trim()
    .min(1, "Outcome description is required")
    .max(300, "Description is too long"),
});

export const STATUSES = ["NOT_STARTED", "IN_PROGRESS", "COMPLETE"] as const;
export const RESOURCE_TYPES = [
  "Reading",
  "Video",
  "Notes",
  "Exercise",
  "Other",
] as const;

export const taskSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Task title is required")
    .max(150, "Title is too long"),
  estimatedHours: z
    .number({ message: "Estimated hours must be a number" })
    .min(0.25, "At least 0.25 hours")
    .max(100, "At most 100 hours"),
  outcomeId: z.string().nullable().optional(),
  status: z.enum(STATUSES).optional(),
});

export const taskUpdateSchema = taskSchema.partial();

export const resourceSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Resource title is required")
    .max(150, "Title is too long"),
  type: z.enum(RESOURCE_TYPES),
  url: z
    .string()
    .trim()
    .nullable()
    .optional()
    .refine(
      (v) => !v || /^https?:\/\//i.test(v),
      "URL must start with http:// or https://",
    ),
  outcomeId: z.string().nullable().optional(),
});

export const resourceUpdateSchema = resourceSchema.partial();
