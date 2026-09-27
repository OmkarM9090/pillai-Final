import { Response } from 'express';

// ============================================================
// Standard API response helpers
// ============================================================

interface SuccessResponse<T = unknown> {
  success: true;
  data: T;
  message: string;
}

interface ErrorResponse {
  success: false;
  message: string;
  errors?: Array<{ field?: string; message: string }>;
}

export function sendSuccess<T = unknown>(
  res: Response,
  data: T,
  message = 'Success',
  statusCode = 200
): Response<SuccessResponse<T>> {
  return res.status(statusCode).json({
    success: true,
    data,
    message,
  });
}

export function sendError(
  res: Response,
  message: string,
  statusCode = 500,
  errors?: Array<{ field?: string; message: string }>
): Response<ErrorResponse> {
  const body: ErrorResponse = { success: false, message };
  if (errors?.length) body.errors = errors;
  return res.status(statusCode).json(body);
}

export function sendCreated<T = unknown>(
  res: Response,
  data: T,
  message = 'Created successfully'
): Response<SuccessResponse<T>> {
  return sendSuccess(res, data, message, 201);
}
