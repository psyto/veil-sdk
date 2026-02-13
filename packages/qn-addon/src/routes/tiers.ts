import { Router, Request, Response } from 'express';
import * as tierService from '../services/tier-service';

const router = Router();

router.get('/v1/tiers/:score', (req: Request, res: Response) => {
  try {
    const score = parseInt(req.params.score, 10);
    if (isNaN(score) || score < 0 || score > 100) {
      res.status(400).json({ success: false, error: 'score must be an integer between 0 and 100' });
      return;
    }

    const benefits = tierService.getBenefits(score);
    res.json({
      success: true,
      score,
      ...benefits,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
