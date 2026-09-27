import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { sendError } from '../utils/response';

/**
 * Validates request using a Zod schema that expects { body, params, query }
 */
export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse({
      body: req.body,
      params: req.params,
      query: req.query,
    });

    if (!result.success) {
      // Zod v4 uses .issues, v3 uses .errors — handle both
      const rawIssues = (result.error as any).issues ?? (result.error as any).errors ?? [];
      const errors = rawIssues.map((e: any) => ({
        field: (Array.isArray(e.path) ? e.path.slice(1).join('.') : ''),
        message: e.message,
      }));
      sendError(res, 'Validation failed', 422, errors);
      return;
    }

    // Merge validated data back
    const data = result.data as any;
    if (data?.body) req.body = data.body;

    next();
  };
}
