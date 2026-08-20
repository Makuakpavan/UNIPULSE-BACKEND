import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { formatResponse } from '../utils/helpers';

/**
 * Terminates the request when any preceding express-validator chain failed.
 * Without this the validator arrays only record results — each controller has
 * to remember to inspect them, and most of them did not.
 */
export const validate = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    res.status(400).json(
      formatResponse(false, 'Validation error', undefined, { errors: errors.array() })
    );
    return;
  }

  next();
};
