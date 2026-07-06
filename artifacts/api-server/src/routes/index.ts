import { Router, type IRouter } from "express";
import healthRouter from "./health";
import chatRouter from "./chat";
import projectsRouter from "./projects";
import accountRouter from "./account";
import stripeRouter from "./stripe";

const router: IRouter = Router();

router.use(healthRouter);
router.use(chatRouter);
router.use(projectsRouter);
router.use(accountRouter);
router.use(stripeRouter);

export default router;
