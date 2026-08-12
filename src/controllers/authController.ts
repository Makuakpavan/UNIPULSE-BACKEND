import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { AuthService } from '../services/authService';
import { EmailService } from '../services/emailService';
import User from '../models/User';
import { formatResponse } from '../utils/helpers';
import { AppError } from '../middleware/errorHandler';
import logger from '../utils/logger';

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json(formatResponse(false, 'Validation error', undefined, { errors: errors.array() }));
      return;
    }

    const user = await AuthService.register(req.body);

    // Send welcome email (non-blocking)
    EmailService.sendWelcomeEmail(user.email, user.firstName).catch(() => {});

    const tokens = await AuthService.generateTokensForUser(user);

    res.status(201).json(
      formatResponse(true, 'Registration successful', {
        user: {
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          username: user.username,
          role: user.role,
          institution: user.institution,
        },
        ...tokens,
      })
    );
  } catch (error: any) {
    logger.error('Registration error:', error);
    res.status(400).json(formatResponse(false, error.message));
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json(formatResponse(false, 'Validation error', undefined, { errors: errors.array() }));
      return;
    }

    const { email, password } = req.body;
    const result = await AuthService.login(email, password, req.ip);

    if (result.requires2FA) {
      res.status(200).json(
        formatResponse(true, '2FA required', {
          requires2FA: true,
          userId: result.userId,
        })
      );
      return;
    }

    res.status(200).json(formatResponse(true, 'Login successful', result));
  } catch (error: any) {
    logger.error('Login error:', error);
    res.status(401).json(formatResponse(false, error.message));
  }
};

export const verify2FA = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, token } = req.body;
    const result = await AuthService.verify2FA(userId, token);
    res.status(200).json(formatResponse(true, '2FA verification successful', result));
  } catch (error: any) {
    res.status(401).json(formatResponse(false, error.message));
  }
};

export const setup2FA = async (req: any, res: Response): Promise<void> => {
  try {
    const result = await AuthService.setup2FA(req.user._id.toString());
    res.status(200).json(formatResponse(true, '2FA setup initiated', result));
  } catch (error: any) {
    res.status(400).json(formatResponse(false, error.message));
  }
};

export const enable2FA = async (req: any, res: Response): Promise<void> => {
  try {
    const { token } = req.body;
    const result = await AuthService.enable2FA(req.user._id.toString(), token);
    res.status(200).json(formatResponse(true, result.message));
  } catch (error: any) {
    res.status(400).json(formatResponse(false, error.message));
  }
};

export const disable2FA = async (req: any, res: Response): Promise<void> => {
  try {
    const { password } = req.body;
    const result = await AuthService.disable2FA(req.user._id.toString(), password);
    res.status(200).json(formatResponse(true, result.message));
  } catch (error: any) {
    res.status(400).json(formatResponse(false, error.message));
  }
};

export const refreshToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      res.status(400).json(formatResponse(false, 'Refresh token required'));
      return;
    }

    const tokens = await AuthService.refreshToken(refreshToken);
    res.status(200).json(formatResponse(true, 'Token refreshed', tokens));
  } catch (error: any) {
    res.status(401).json(formatResponse(false, error.message));
  }
};

export const logout = async (req: any, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body;
    await AuthService.logout(req.user._id.toString(), refreshToken);
    res.status(200).json(formatResponse(true, 'Logged out successfully'));
  } catch (error: any) {
    res.status(400).json(formatResponse(false, error.message));
  }
};

export const logoutAll = async (req: any, res: Response): Promise<void> => {
  try {
    await AuthService.logoutAll(req.user._id.toString());
    res.status(200).json(formatResponse(true, 'Logged out from all devices'));
  } catch (error: any) {
    res.status(400).json(formatResponse(false, error.message));
  }
};

export const getMe = async (req: any, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user._id)
      .populate('institution', 'name slug logo')
      .select('-password -refreshTokens -twoFactorSecret');

    if (!user) {
      res.status(404).json(formatResponse(false, 'User not found'));
      return;
    }

    res.status(200).json(formatResponse(true, 'User profile retrieved', { user }));
  } catch (error: any) {
    res.status(500).json(formatResponse(false, error.message));
  }
};

