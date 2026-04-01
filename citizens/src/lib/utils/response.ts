import { NextResponse } from 'next/server';

/**
 * Standard API Response Structure
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  errors?: Record<string, string[]>;
  metadata?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

/**
 * Create a success response
 */
export function successResponse<T>(
  data: T,
  message?: string,
  metadata?: ApiResponse['metadata']
): NextResponse<ApiResponse<T>> {
  return NextResponse.json({
    success: true,
    data,
    message,
    metadata,
  });
}

/**
 * Create an error response
 */
export function errorResponse(
  error: string | Error,
  statusCode: number = 500,
  errors?: Record<string, string[]>
): NextResponse<ApiResponse> {
  const errorMessage = error instanceof Error ? error.message : error;

  return NextResponse.json(
    {
      success: false,
      error: errorMessage,
      errors,
    },
    { status: statusCode }
  );
}

/**
 * Create a validation error response
 */
export function validationErrorResponse(
  errors: Record<string, string[]>
): NextResponse<ApiResponse> {
  return NextResponse.json(
    {
      success: false,
      error: 'Validation failed',
      errors,
    },
    { status: 400 }
  );
}

/**
 * Create a not found response
 */
export function notFoundResponse(
  resource: string = 'Resource'
): NextResponse<ApiResponse> {
  return NextResponse.json(
    {
      success: false,
      error: `${resource} not found`,
    },
    { status: 404 }
  );
}

/**
 * Create an unauthorized response
 */
export function unauthorizedResponse(
  message: string = 'Unauthorized'
): NextResponse<ApiResponse> {
  return NextResponse.json(
    {
      success: false,
      error: message,
    },
    { status: 401 }
  );
}

/**
 * Create a forbidden response
 */
export function forbiddenResponse(
  message: string = 'Forbidden'
): NextResponse<ApiResponse> {
  return NextResponse.json(
    {
      success: false,
      error: message,
    },
    { status: 403 }
  );
}

/**
 * Create a bad request response
 */
export function badRequestResponse(
  message: string = 'Bad request'
): NextResponse<ApiResponse> {
  return NextResponse.json(
    {
      success: false,
      error: message,
    },
    { status: 400 }
  );
}

/**
 * Create a conflict response
 */
export function conflictResponse(
  message: string = 'Resource already exists'
): NextResponse<ApiResponse> {
  return NextResponse.json(
    {
      success: false,
      error: message,
    },
    { status: 409 }
  );
}

/**
 * Handle API errors with appropriate response
 */
export function handleApiError(error: unknown): NextResponse<ApiResponse> {
  console.error('API Error:', error);

  if (error instanceof Error) {
    // Mongoose validation error
    if (error.name === 'ValidationError') {
      return errorResponse('Validation failed', 400);
    }

    // Mongoose duplicate key error
    if (error.name === 'MongoServerError' && (error as any).code === 11000) {
      return conflictResponse('Resource already exists');
    }

    // Mongoose cast error (invalid ObjectId)
    if (error.name === 'CastError') {
      return badRequestResponse('Invalid ID format');
    }

    return errorResponse(error.message, 500);
  }

  return errorResponse('An unexpected error occurred', 500);
}

/**
 * Create paginated response
 */
export function paginatedResponse<T>(
  data: T[],
  page: number,
  limit: number,
  total: number,
  message?: string
): NextResponse<ApiResponse<T[]>> {
  const totalPages = Math.ceil(total / limit);

  return NextResponse.json({
    success: true,
    data,
    message,
    metadata: {
      page,
      limit,
      total,
      totalPages,
    },
  });
}

/**
 * Extract pagination params from URL search params
 */
export function getPaginationParams(searchParams: URLSearchParams) {
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '10')));
  const skip = (page - 1) * limit;

  return { page, limit, skip };
}

/**
 * Validate required fields
 */
export function validateRequiredFields(
  data: Record<string, any>,
  requiredFields: string[]
): Record<string, string[]> | null {
  const errors: Record<string, string[]> = {};

  for (const field of requiredFields) {
    if (!data[field] || (typeof data[field] === 'string' && !data[field].trim())) {
      errors[field] = [`${field} is required`];
    }
  }

  return Object.keys(errors).length > 0 ? errors : null;
}
