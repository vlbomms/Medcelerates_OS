import express, { RequestHandler } from 'express';
import { register, login, refreshAccessToken } from '@controllers/authController';

const router = express.Router();

const registerHandler: RequestHandler = async (req, res, next) => {
  await register(req, res);
};
const loginHandler: RequestHandler = async (req, res, next) => {
  await login(req, res);
};
const refreshTokenHandler: RequestHandler = async (req, res, next) => {
  await refreshAccessToken(req, res);
};

router.post('/register', registerHandler);
router.post('/login', loginHandler);
router.post('/refresh-token', refreshTokenHandler);

export default router;