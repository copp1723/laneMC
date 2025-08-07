import { Router } from 'express';
import { schedulerService } from '../services/scheduler';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// Get all scheduled tasks
router.get('/tasks', async (req, res) => {
  try {
    const tasks = schedulerService.getTasks();
    
    res.json({
      success: true,
      data: tasks
    });
  } catch (error: any) {
    console.error('Get tasks error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get specific task
router.get('/tasks/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    const task = schedulerService.getTask(taskId);
    
    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found'
      });
    }
    
    res.json({
      success: true,
      data: task
    });
  } catch (error: any) {
    console.error('Get task error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Enable a task
router.post('/tasks/:taskId/enable', async (req, res) => {
  try {
    const { taskId } = req.params;
    
    await schedulerService.enableTask(taskId);
    
    res.json({
      success: true,
      message: 'Task enabled successfully'
    });
  } catch (error: any) {
    console.error('Enable task error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Disable a task
router.post('/tasks/:taskId/disable', async (req, res) => {
  try {
    const { taskId } = req.params;
    
    await schedulerService.disableTask(taskId);
    
    res.json({
      success: true,
      message: 'Task disabled successfully'
    });
  } catch (error: any) {
    console.error('Disable task error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Run a task immediately
router.post('/tasks/:taskId/run', async (req, res) => {
  try {
    const { taskId } = req.params;
    
    const result = await schedulerService.runTaskNow(taskId);
    
    res.json({
      success: result.success,
      data: result
    });
  } catch (error: any) {
    console.error('Run task error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Start scheduler service
router.post('/start', async (req, res) => {
  try {
    await schedulerService.start();
    
    res.json({
      success: true,
      message: 'Scheduler service started'
    });
  } catch (error: any) {
    console.error('Start scheduler error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Stop scheduler service
router.post('/stop', async (req, res) => {
  try {
    await schedulerService.stop();
    
    res.json({
      success: true,
      message: 'Scheduler service stopped'
    });
  } catch (error: any) {
    console.error('Stop scheduler error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export { router as schedulerRouter };