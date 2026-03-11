import { defineCollection, z } from 'astro:content';

const skills = defineCollection({
  type: 'content',
  schema: z.object({
    name: z.string(),
    description: z.string(),
    skillSlug: z.string(),
    license: z.string().nullable().optional(),
    repoPath: z.string(),
    icon: z.string(),
    hasScripts: z.boolean(),
    hasReferences: z.boolean(),
    hasAssets: z.boolean(),
    scriptCount: z.number(),
    tags: z.array(z.string()),
    allowedTools: z.array(z.string()),
    pipeline: z.string().nullable().optional(),
    pipelineStage: z.string().nullable().optional(),
    pipelineOrder: z.number().nullable().optional(),
  }),
});

const docs = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    docSlug: z.string(),
    icon: z.string(),
    order: z.number(),
    sourcePath: z.string(),
  }),
});

export const collections = { skills, docs };
