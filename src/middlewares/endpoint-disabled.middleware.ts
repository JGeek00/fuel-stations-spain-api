import { NextFunction, Request, Response } from "express";
import { createNotFoundError, sendApiError } from '@/utils/error-handler';

/**
 * Factory that creates a middleware to guard an endpoint by an environment variable.
 *
 * If the environment variable is set to "true", the endpoint is disabled and the
 * middleware returns a 404 (Not Found). Otherwise, the request is allowed to continue.
 *
 * @param envVar - The name of the environment variable that controls the endpoint (e.g. "DISABLE_SERVICE_STATIONS").
 * @returns An Express middleware function.
 */
export const endpointDisabledMiddleware = (envVar: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (process.env[envVar] === "true") {
      sendApiError(res, createNotFoundError('Endpoint not found'), 404);
      return;
    }
    next();
  };
};